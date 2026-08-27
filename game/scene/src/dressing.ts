import { footprintOf, METRICS, PROP_SPECS, type AnchorKind, type CellKind, type Facing, type FurnitureProp, type Item, type Npc, type Plot, type ResolvedCharter } from '@gb/world'
import * as THREE from 'three'
import { clutterMaterial } from './clutter/mesh.ts'
import type { LightEmitter } from './lights/emitter.ts'
import { PAINT_COLOUR, type MarkingPaint } from './markings.ts'

/** A building's footprint and height in metres, the size the plot says. */
export interface BuildingSize {
  readonly width: number
  readonly depth: number
  readonly height: number
}

export type SurfacePart = 'floor' | 'wall' | 'ceiling'

/** How many metres a surface spans along each of its texture axes: `u` across it, `v` up a wall or along the depth of a floor. */
export interface SurfaceSize {
  readonly u: number
  readonly v: number
}

/**
 * Where art plugs in. The scene builder decides where everything goes and how
 * big it is; a dressing decides what it looks like. Swapping a greybox for a
 * building kit is one implementation of this and no change anywhere else.
 */
export interface Dressing {
  /** A building of this plot's charter, footprint and height, with its origin at the centre of its base. */
  building(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D
  /**
   * The same building as it is seen from far off: its walls and roof and
   * nothing that is only worth drawing near (no signs, no screens, no rooms
   * behind the panes). Left out, `building` is drawn at every distance.
   */
  shell?(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D
  /** What that building throws light from, in its own frame. Asked after `building`. Left out, it lights nothing. */
  lights?(plot: Plot, size: BuildingSize, charter: ResolvedCharter): readonly LightEmitter[]
  /** A piece of furniture, origin at the centre of its base, facing north. */
  prop(prop: FurnitureProp): THREE.Object3D
  /** A person, origin at their feet, facing north, doing what the anchor implies. */
  character(npc: Npc, doing: AnchorKind): THREE.Object3D
  /** Something lying about that can be picked up, origin at the centre of its base. */
  pickup(item: Item): THREE.Object3D
  /** The surface of one kind of ground. */
  ground(kind: CellKind): THREE.Material
  /** Interior floor, walls and ceiling, told how many metres the surface covers. Its UVs are in metres. */
  surface(part: SurfacePart, size: SurfaceSize): THREE.Material
  /** Road paint. Left out, the street gets a plain white and yellow. */
  marking?(paint: MarkingPaint): THREE.Material
  /**
   * One material for every piece of rubbish on the street. Colour rides on the
   * vertices, so this is asked for once and never per piece. Left out, the
   * street gets a plain dull one.
   */
  clutter?(): THREE.Material
  /**
   * One material for the skyline: every building past the shell radius as the
   * box it occupies. The charter's `tint` rides on the vertices, so this is
   * asked for once and never per building. Left out, the skyline gets a plain
   * matte one.
   */
  massing?(): THREE.Material
}

/**
 * Dark and desaturated, because the city is lit at night by signs and lamps and
 * anything pale on the ground has no contrast left to reflect them into.
 */
const PALETTE: Record<CellKind, number> = {
  street: 0x14151a,
  sidewalk: 0x24252a,
  building: 0x1e1d1f,
  park: 0x1c2a1e,
  mountain: 0x17161a,
  water: 0x0d1720,
  empty: 0x1b1a17,
}

/** How tall a piece nobody touches and nothing sizes is drawn: the plant. */
const UNSIZED_HEIGHT = 1.2

/** How big a thing you pick up is drawn, by how it is carried; the largest is a crate, 44 cm across. */
const PICKUP_SIZE = { pocket: 0.2, bag: 0.35, 'two-handed': 0.44 } as const

/** Which way out of the building each entrance wall looks. */
const OUT: Record<Facing, { x: number; z: number }> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
  east: { x: 1, z: 0 },
}

const DOOR_THICKNESS = 0.12

/** The one lamp a greybox building carries: warm, over the door, so a greybox street lights its doorsteps after dark. */
const DOOR_LAMP = { colour: 0xffd2a0, candela: 20, above: 0.3, off: 0.2 }

/** How far a lamp of that strength is worth drawing: where it falls to 0.1 lux, and never past 16 m. */
function reachOf(candela: number): number {
  return Math.min(16, Math.sqrt(candela / 0.1))
}

/**
 * Plain boxes at the right size, in the right place. Good enough to walk
 * around and check the city reads correctly, and the reference for what a real
 * kit has to line up with.
 */
export class Greybox implements Dressing {
  #materials = new Map<number, THREE.Material>()

  building(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const group = this.shell(plot, size, charter)
    group.add(this.#door(plot, size))
    return group
  }

  /** The box alone: what a greybox building is from far off. */
  shell(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(size.width, size.height, size.depth), this.#material(charter.tint))
    shell.position.y = size.height / 2
    shell.name = `${plot.id}:shell`

    const group = new THREE.Group()
    group.name = plot.id
    group.add(shell)
    return group
  }

  /** One warm lamp over the door, just off the wall. */
  lights(plot: Plot, size: BuildingSize): readonly LightEmitter[] {
    const doorway = this.#doorway(plot, size)
    return [
      {
        kind: 'doorlamp',
        position: [
          doorway.x + doorway.out.x * DOOR_LAMP.off,
          METRICS.building.doorHeight + DOOR_LAMP.above,
          doorway.z + doorway.out.z * DOOR_LAMP.off,
        ],
        colour: DOOR_LAMP.colour,
        intensity: DOOR_LAMP.candela,
        radius: reachOf(DOOR_LAMP.candela),
      },
    ]
  }

  /** A box filling the floor the world claims for it, as tall as the surface a body meets it at. */
  prop(prop: FurnitureProp): THREE.Object3D {
    const spec = PROP_SPECS[prop]
    const { width, depth } = footprintOf(prop)
    const height = spec.contact?.height ?? spec.height ?? UNSIZED_HEIGHT
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.#material(0x7d7468))
    mesh.position.y = height / 2
    mesh.castShadow = true

    // the group's origin is the centre of the base, so whoever places it only
    // has to say where on the floor it goes
    const base = new THREE.Group()
    base.name = prop
    base.add(mesh)
    return base
  }

  character(npc: Npc, _doing: AnchorKind): THREE.Object3D {
    const height = METRICS.player.height
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, height - 0.6, 4, 12),
      this.#material(0xb0743f + npc.appearance.variant * 0x040404),
    )
    body.position.y = height / 2
    body.castShadow = true

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.2), this.#material(0x2a2320))
    nose.position.set(0, height - 0.35, -0.28)

    const person = new THREE.Group()
    person.name = npc.id
    person.add(body)
    person.add(nose)
    return person
  }

  pickup(item: Item): THREE.Object3D {
    const size = PICKUP_SIZE[item.bulk]
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), this.#material(0xd8b45a))
    mesh.position.y = size / 2

    const base = new THREE.Group()
    base.name = item.id
    base.add(mesh)
    return base
  }

  ground(kind: CellKind): THREE.Material {
    return this.#material(PALETTE[kind])
  }

  surface(part: SurfacePart): THREE.Material {
    return this.#material(part === 'floor' ? 0x6a6258 : part === 'wall' ? 0xb0a99c : 0x8f8a80)
  }

  marking(paint: MarkingPaint): THREE.Material {
    return this.#material(PAINT_COLOUR[paint])
  }

  clutter(): THREE.Material {
    return clutterMaterial()
  }

  /** A slab on the face the entrance is on, so you can see where to go in. */
  #door(plot: Plot, size: BuildingSize): THREE.Mesh {
    const { doorWidth, doorHeight } = METRICS.building
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, DOOR_THICKNESS), this.#material(0x3b2f26))
    door.name = `${plot.id}:door`
    const doorway = this.#doorway(plot, size)
    door.position.set(doorway.x, doorHeight / 2, doorway.z)
    if (doorway.out.x !== 0) door.rotation.y = Math.PI / 2
    return door
  }

  /** The middle of the doorway on the entrance wall, flush with it, and the way out of it. */
  #doorway(plot: Plot, size: BuildingSize): { x: number; z: number; out: { x: number; z: number } } {
    const inset = DOOR_THICKNESS / 2
    const out = OUT[plot.entrance.facing]
    return { x: out.x * (size.width / 2 - inset), z: out.z * (size.depth / 2 - inset), out }
  }

  #material(colour: number): THREE.Material {
    let material = this.#materials.get(colour)
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9, metalness: 0 })
      this.#materials.set(colour, material)
    }
    return material
  }
}
