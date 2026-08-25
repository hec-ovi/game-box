import { SIGN, lightsFor } from '@gb/kitbash'
import type { Dressing, SurfacePart, SurfaceSize } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Item, Npc, Plot, ResolvedCharter } from '@gb/world'
import * as THREE from 'three'
import type { Design } from './catalogue.ts'
import { Entrances } from './entrance.ts'
import type { Library } from './library.ts'
import { BuildingLights, type LightEmitter } from './lights.ts'
import { orient, turnsFor } from './orient.ts'
import { designFor } from './pin.ts'

export interface BuildingSize {
  readonly width: number
  readonly depth: number
  readonly height: number
}

/**
 * Dresses a plot with the building its world file pins it to, or the one the
 * catalogue picks when nothing is written down. A plot the catalogue has no
 * shape for, and a pin this copy of the pack cannot honour, are handed straight
 * to the dressing behind, so a footprint nobody baked is a kit building rather
 * than a hole in the street.
 *
 * Which look a plot may wear is its charter's `suits`, handed in beside the
 * plot by whoever resolved the charter, and handed on whole to the dressing
 * behind, which reads the rest of it.
 *
 * A building is two meshes on the pack's materials: the walls, and the glass
 * in their windows, turned onto the plot together. Its shell, what `@gb/scene`
 * draws it as from far off, is the walls alone on the shell material: no
 * glass, no signs, no rooms behind the panes. A plot with an interior gets the
 * entrance you can walk through on both. It is the same building on the same
 * layer count: one attribute rewritten on the copy this plot already owns.
 *
 * Signage stays where it was written. `@gb/kitbash` puts every sign in the city
 * on one material; this lifts those meshes off the kit's building and hangs
 * them on the prefab, so a prefab street still has names over its doors and the
 * whole town's signage is still one draw.
 *
 * What the building throws onto the street is published beside it: `lights`
 * answers the lit lobby and the screens off the geometry the plot is drawn
 * with, and the kit's own emitters for the signs it hung.
 */
export class PrefabDressing implements Dressing {
  readonly #library: Library
  readonly #rest: Dressing
  readonly #entrances: Entrances
  readonly #lights: BuildingLights
  /** Plots the dressing behind hung signs on, so their lights are published with them. */
  readonly #signed = new Set<string>()

  constructor(library: Library, rest: Dressing) {
    this.#library = library
    this.#rest = rest
    this.#entrances = new Entrances(library.catalogue.atlas.finishes)
    this.#lights = new BuildingLights(library.catalogue.atlas.finishes, library.tints)
  }

  building(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const design = designFor(this.#library.catalogue, plot, size, charter.suits)
    const geometry = design ? this.#library.geometry(design.model) : undefined
    if (!design || !geometry) return this.#rest.building(plot, size, charter)

    const building = new THREE.Group()
    building.name = plot.id
    building.add(this.#walls(plot, design, geometry, this.#library.material))
    const panes = this.#library.panes(design.model)
    if (panes) {
      const glass = new THREE.Mesh(orient(panes, turnsFor(plot.entrance.facing), design.mirror, design.rooms), this.#library.glass)
      glass.name = `${plot.id}:${design.model}:glass`
      building.add(glass)
    }
    const signs = signsOn(this.#rest.building(plot, size, charter))
    if (signs.length) this.#signed.add(plot.id)
    for (const sign of signs) building.add(sign)
    return building
  }

  /** The same building from far off: its walls on the shell material, and nothing else. */
  shell(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const design = designFor(this.#library.catalogue, plot, size, charter.suits)
    const geometry = design ? this.#library.geometry(design.model) : undefined
    if (!design || !geometry) return this.#rest.shell ? this.#rest.shell(plot, size, charter) : this.#rest.building(plot, size, charter)

    const building = new THREE.Group()
    building.name = plot.id
    building.add(this.#walls(plot, design, geometry, this.#library.shell))
    return building
  }

  /** The walls turned onto the plot, wearing the entrance the world says, on whichever material asked. */
  #walls(plot: Plot, design: Design, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    const turned = orient(geometry, turnsFor(plot.entrance.facing), design.mirror, design.rooms)
    if (plot.interiorId !== undefined) this.#entrances.open(turned)
    const mesh = new THREE.Mesh(turned, material)
    mesh.name = `${plot.id}:${design.model}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  /**
   * The light this plot's building throws, in its own frame: the lobby of a
   * door you can walk through, one emitter per screen, and the kit's own for
   * every sign `building` hung. Asked after `building`, since that is what
   * decides whether signs were hung; a plot the catalogue handed to the
   * dressing behind has nothing of its own here.
   */
  lights(plot: Plot, size: BuildingSize, charter: ResolvedCharter): LightEmitter[] {
    const design = designFor(this.#library.catalogue, plot, size, charter.suits)
    const geometry = design ? this.#library.geometry(design.model) : undefined
    const own = design && geometry ? this.#lights.of(orient(geometry, turnsFor(plot.entrance.facing), design.mirror), plot.entrance.facing, plot.interiorId !== undefined, design.rooms) : []
    return this.#signed.has(plot.id) ? [...own, ...lightsFor(plot, size, charter)] : own
  }

  prop(prop: FurnitureProp): THREE.Object3D {
    return this.#rest.prop(prop)
  }

  character(npc: Npc, doing: AnchorKind): THREE.Object3D {
    return this.#rest.character(npc, doing)
  }

  pickup(item: Item): THREE.Object3D {
    return this.#rest.pickup(item)
  }

  ground(kind: CellKind): THREE.Material {
    return this.#rest.ground(kind)
  }

  surface(part: SurfacePart, size: SurfaceSize): THREE.Material {
    return this.#rest.surface(part, size)
  }
}

/**
 * The signs off a building somebody else made, brought into that building's own
 * frame so they can be hung on another one. They are found by their material,
 * which `@gb/kitbash` publishes as `SIGN` precisely so the one sign batch is
 * addressable from outside.
 */
function signsOn(building: THREE.Object3D): THREE.Mesh[] {
  building.updateMatrixWorld(true)
  const inverse = building.matrixWorld.clone().invert()
  const found: THREE.Mesh[] = []
  building.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material)) return
    if ((mesh.material as THREE.Material).name === SIGN.material) found.push(mesh)
  })

  for (const mesh of found) {
    const local = inverse.clone().multiply(mesh.matrixWorld)
    mesh.removeFromParent()
    local.decompose(mesh.position, mesh.quaternion, mesh.scale)
  }
  return found
}
