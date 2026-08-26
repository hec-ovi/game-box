import { lightsFor, signsFor } from '@gb/kitbash'
import type { Dressing, SurfacePart, SurfaceSize } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Item, Npc, Plot, ResolvedCharter } from '@gb/world'
import * as THREE from 'three'
import type { Design } from './catalogue.ts'
import { Entrances } from './entrance.ts'
import { StreetFace } from './face.ts'
import { Fixtures } from './fixtures.ts'
import type { Library } from './library.ts'
import { BuildingLights, type LightEmitter } from './lights.ts'
import { orient, turnsFor } from './orient.ts'
import { designFor } from './pin.ts'

export interface BuildingSize {
  readonly width: number
  readonly depth: number
  readonly height: number
}

/** What a plot is drawn with: its design, and that model turned onto the plot. */
interface Drawn extends Design {
  readonly turned: THREE.BufferGeometry
  /**
   * The street face the model ended up with, read the first time it is asked
   * for. Only the signage seated on it needs one, and most of the town is a
   * shell that carries none.
   */
  face(): StreetFace
}

/**
 * What the dressing behind publishes if its signage is to go on prefab
 * buildings: the plot's signs as one mesh on the one sign material, in the
 * building's own frame. `@gb/kitbash` publishes it.
 */
export interface Signage {
  signs?(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Mesh | undefined
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
 * Signage keeps its material and its wall. `@gb/kitbash` puts every sign in the
 * city on one material and hands the plot's over as one mesh, which this hangs
 * on the prefab, so a prefab street still has names over its doors and the
 * whole town's signage is still one draw. It is written against the plot's
 * arithmetic and this building is the one the pack drew, so each fixture is
 * seated on the face it belongs to on the way over: `face` is what the model
 * really has there, and `Fixtures` carries the lamps onto the drawn door and
 * every plate onto the surface under it.
 *
 * What the building throws onto the street is published beside it: `lights`
 * answers the lit lobby and the screens off the geometry the plot is drawn
 * with, and the kit's own emitters, seated the same way, for the signs it hung.
 */
export class PrefabDressing implements Dressing {
  readonly #library: Library
  readonly #rest: Dressing & Signage
  readonly #entrances: Entrances
  readonly #lights: BuildingLights
  /** Plots the dressing behind hung signs on, so their lights are published with them. */
  readonly #signed = new Set<string>()

  constructor(library: Library, rest: Dressing & Signage) {
    this.#library = library
    this.#rest = rest
    this.#entrances = new Entrances(library.catalogue.atlas.finishes)
    this.#lights = new BuildingLights(library.catalogue.atlas.finishes, library.tints)
  }

  building(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const drawn = this.#drawn(plot, size, charter)
    if (!drawn) return this.#rest.building(plot, size, charter)

    const building = new THREE.Group()
    building.name = plot.id
    building.add(this.#walls(plot, drawn.model, drawn.turned, this.#library.material))
    const panes = this.#library.panes(drawn.model)
    if (panes) {
      const glass = new THREE.Mesh(orient(panes, turnsFor(plot.entrance.facing), drawn.mirror, drawn.rooms), this.#library.glass)
      glass.name = `${plot.id}:${drawn.model}:glass`
      building.add(glass)
    }
    const signs = this.#rest.signs?.(plot, size, charter)
    if (signs) {
      this.#signed.add(plot.id)
      Fixtures.on(drawn.face(), signsFor(plot, size, charter)).seat(signs)
      building.add(signs)
    }
    return building
  }

  /** The same building from far off: its walls on the shell material, and nothing else. */
  shell(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const drawn = this.#drawn(plot, size, charter)
    if (!drawn) return this.#rest.shell ? this.#rest.shell(plot, size, charter) : this.#rest.building(plot, size, charter)

    const building = new THREE.Group()
    building.name = plot.id
    building.add(this.#walls(plot, drawn.model, drawn.turned, this.#library.shell))
    return building
  }

  /**
   * The street face this plot is actually drawn with: where the pack put its
   * entrance and the band over it, in the building's own frame. Nothing when
   * the catalogue has no shape for the plot, which is when the dressing behind
   * answers for it and its own arithmetic is the truth.
   */
  face(plot: Plot, size: BuildingSize, charter: ResolvedCharter): StreetFace | undefined {
    return this.#drawn(plot, size, charter)?.face()
  }

  /** The model this plot is drawn with, turned onto its plot and read. */
  #drawn(plot: Plot, size: BuildingSize, charter: ResolvedCharter): Drawn | undefined {
    const design = designFor(this.#library.catalogue, plot, size, charter.suits)
    const geometry = design ? this.#library.geometry(design.model) : undefined
    const spec = design ? this.#library.catalogue.model(design.model) : undefined
    if (!design || !geometry || !spec) return undefined
    const turned = orient(geometry, turnsFor(plot.entrance.facing), design.mirror, design.rooms)
    let read: StreetFace | undefined
    const face = (): StreetFace => (read ??= StreetFace.of(turned, plot.entrance.facing, spec.depth / 2, this.#library.catalogue.atlas.finishes))
    return { ...design, turned, face }
  }

  /** The walls turned onto the plot, wearing the entrance the world says, on whichever material asked. */
  #walls(plot: Plot, model: string, turned: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    if (plot.interiorId !== undefined) this.#entrances.open(turned)
    const mesh = new THREE.Mesh(turned, material)
    mesh.name = `${plot.id}:${model}`
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
    const drawn = this.#drawn(plot, size, charter)
    const own = drawn ? this.#lights.of(drawn.turned, plot.entrance.facing, plot.interiorId !== undefined, drawn.rooms) : []
    if (!this.#signed.has(plot.id)) return own
    const hung = lightsFor(plot, size, charter)
    return [...own, ...(drawn ? Fixtures.on(drawn.face(), signsFor(plot, size, charter)).lit(hung) : hung)]
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
