import { METRICS, type AnchorKind, type BuildingKind, type CellKind, type FurnitureProp, type Item, type Npc, type Plot } from '@gb/world'
import * as THREE from 'three'
import { clutterMaterial } from './clutter/mesh.ts'
import { PAINT_COLOUR, type MarkingPaint } from './markings.ts'

/**
 * Where art plugs in. The scene builder decides where everything goes and how
 * big it is; a dressing decides what it looks like. Swapping a greybox for a
 * building kit is one implementation of this and no change anywhere else.
 */
export interface Dressing {
  /** A building of this plot's kind, footprint and height, with its origin at the centre of its base. */
  building(plot: Plot, size: { width: number; depth: number; height: number }): THREE.Object3D
  /** A piece of furniture, origin at the centre of its base, facing north. */
  prop(prop: FurnitureProp): THREE.Object3D
  /** A person, origin at their feet, facing north, doing what the anchor implies. */
  character(npc: Npc, doing: AnchorKind): THREE.Object3D
  /** Something lying about that can be picked up, origin at the centre of its base. */
  pickup(item: Item): THREE.Object3D
  /** The surface of one kind of ground. */
  ground(kind: CellKind): THREE.Material
  /** Interior floor, walls and ceiling. */
  surface(part: 'floor' | 'wall' | 'ceiling'): THREE.Material
  /** Road paint. Left out, the street gets a plain white and yellow. */
  marking?(paint: MarkingPaint): THREE.Material
  /**
   * One material for every piece of rubbish on the street. Colour rides on the
   * vertices, so this is asked for once and never per piece. Left out, the
   * street gets a plain dull one.
   */
  clutter?(): THREE.Material
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

const BUILDING_TINT: Partial<Record<BuildingKind, number>> = {
  bar: 0x8c5a3c,
  cafe: 0x9a7a4a,
  restaurant: 0x8a4a4a,
  shop: 0x7a7a9a,
  market: 0x9a8a5a,
  office: 0x8a95a0,
  workshop: 0x6a6a60,
  warehouse: 0x5f5f58,
  clinic: 0xa8a8a4,
  hotel: 0x8a7a9a,
  station: 0x707880,
  chapel: 0x9a9a90,
  house: 0x9a8a76,
  apartment: 0x8a8276,
}

const PROP_SIZE: Record<FurnitureProp, [number, number, number]> = {
  'bar-counter': [1.4, METRICS.furniture.barCounterHeight, 0.6],
  'bar-stool': [0.4, METRICS.furniture.stoolHeight, 0.4],
  table: [1.0, METRICS.furniture.tableHeight, 1.0],
  chair: [0.45, 0.9, 0.45],
  sofa: [1.8, 0.8, 0.8],
  bed: [1.4, 0.5, 2.0],
  desk: [1.4, METRICS.furniture.tableHeight, 0.7],
  'office-chair': [0.5, 0.95, 0.5],
  shelf: [1.0, 1.8, 0.4],
  cabinet: [0.9, 1.2, 0.5],
  wardrobe: [1.0, 2.0, 0.6],
  fridge: [0.7, 1.8, 0.7],
  stove: [0.8, 0.9, 0.6],
  sink: [0.6, 0.9, 0.5],
  counter: [1.4, METRICS.furniture.serviceCounterHeight, 0.6],
  register: [0.4, 0.3, 0.4],
  'display-case': [1.2, 1.1, 0.5],
  'crate-stack': [0.9, 1.2, 0.9],
  plant: [0.5, 1.2, 0.5],
  lamp: [0.3, 1.5, 0.3],
  rug: [2.0, 0.02, 1.4],
  tv: [1.1, 0.65, 0.1],
  'coffee-machine': [0.5, 0.6, 0.5],
  jukebox: [0.8, 1.5, 0.5],
}

/**
 * Plain boxes at the right size, in the right place. Good enough to walk
 * around and check the city reads correctly, and the reference for what a real
 * kit has to line up with.
 */
export class Greybox implements Dressing {
  #materials = new Map<number, THREE.Material>()

  building(plot: Plot, size: { width: number; depth: number; height: number }): THREE.Object3D {
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(size.width, size.height, size.depth),
      this.#material(BUILDING_TINT[plot.kind] ?? 0x8a8a8a),
    )
    shell.position.y = size.height / 2
    shell.name = `${plot.id}:shell`

    const group = new THREE.Group()
    group.name = plot.id
    group.add(shell)
    group.add(this.#door(plot, size))
    return group
  }

  prop(prop: FurnitureProp): THREE.Object3D {
    const [width, height, depth] = PROP_SIZE[prop]
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
    const size = item.bulk === 'two-handed' ? 0.7 : item.bulk === 'bag' ? 0.35 : 0.2
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

  surface(part: 'floor' | 'wall' | 'ceiling'): THREE.Material {
    return this.#material(part === 'floor' ? 0x6a6258 : part === 'wall' ? 0xb0a99c : 0x8f8a80)
  }

  marking(paint: MarkingPaint): THREE.Material {
    return this.#material(PAINT_COLOUR[paint])
  }

  clutter(): THREE.Material {
    return clutterMaterial()
  }

  /** A slab on the face the entrance is on, so you can see where to go in. */
  #door(plot: Plot, size: { width: number; depth: number; height: number }): THREE.Mesh {
    const { doorWidth, doorHeight } = METRICS.building
    const thickness = 0.12
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, thickness), this.#material(0x3b2f26))
    door.name = `${plot.id}:door`
    door.position.y = doorHeight / 2

    const inset = thickness / 2
    const halfWidth = size.width / 2 - inset
    const halfDepth = size.depth / 2 - inset
    switch (plot.entrance.facing) {
      case 'north':
        door.position.z = -halfDepth
        break
      case 'south':
        door.position.z = halfDepth
        break
      case 'west':
        door.position.x = -halfWidth
        door.rotation.y = Math.PI / 2
        break
      case 'east':
        door.position.x = halfWidth
        door.rotation.y = Math.PI / 2
        break
    }
    return door
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
