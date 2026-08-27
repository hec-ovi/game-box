import * as THREE from 'three'
import { Assembly } from '../assembly.ts'
import { MaterialBatch } from '../batch/batch.ts'
import type { Placing } from '../batch/batcher.ts'
import type { BuildingSize, Dressing } from '../dressing.ts'

/** Where a building stands and how big it is: the middle of its footprint, in city metres. */
export interface Site {
  readonly x: number
  readonly z: number
  readonly size: BuildingSize
  /** The charter's colour, which is all a silhouette carries of what the place is. */
  readonly tint: number
}

/**
 * The skyline: every plot in the city as the box it occupies, coarsest of the
 * three ways a building is drawn.
 *
 * A shell is the walls and the roof a dressing drew; a massing is the shape
 * they make, in the charter's colour. One unit box goes into the buffer per
 * colour the city uses and every plot is an instance of one of them, so a town
 * of thousands of buildings is one draw, a handful of boxes of geometry and
 * twelve triangles a plot, whatever a building really costs to draw. That is
 * what lets the shells stream: the far half of the town is standing whether or
 * not its facades are, so nothing ever goes missing out of the skyline.
 *
 * It casts no shadow and takes none. A shadow map that reached the far side of
 * a town would have no resolution left for the street the player is on, and
 * these are the buildings past the street.
 */
export class CityMassing {
  readonly #batch: MaterialBatch
  /** The box held in the buffer for each colour, by that colour. */
  readonly #boxes = new Map<number, number>()
  #settled = false

  /** Cut for a city of that many plots in those colours, and named `city:massing`. */
  constructor(root: THREE.Group, dressing: Dressing, plots: number, tints: Iterable<number>) {
    const boxes = new Map([...new Set(tints)].map((tint) => [tint, boxOf(tint)]))
    const held = [...boxes.values()]
    this.#batch = new MaterialBatch('city:massing', dressing.massing?.() ?? massingMaterial(), {
      instances: plots,
      vertices: held.reduce((total, box) => total + box.getAttribute('position').count, 0),
      indices: held.reduce((total, box) => total + (box.getIndex()?.count ?? 0), 0),
    })
    this.#batch.mesh.castShadow = false
    this.#batch.mesh.receiveShadow = false
    this.#batch.mesh.userData['plots'] = []
    for (const [tint, box] of boxes) this.#boxes.set(tint, this.#batch.hold(box))
    root.add(this.#batch.mesh)
  }

  /** One plot's silhouette, standing where the grid puts it. */
  place(plotId: string, site: Site): Placing {
    const { size } = site
    const at = new THREE.Matrix4()
      .makeTranslation(site.x, size.height / 2, site.z)
      .multiply(new THREE.Matrix4().makeScale(size.width, size.height, size.depth))
    const instance = this.#batch.place(this.#boxFor(site.tint), at)
    ;(this.#batch.mesh.userData['plots'] as string[])[instance] = plotId
    this.#settled = false

    return {
      bounds: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(site.x, size.height / 2, site.z),
        new THREE.Vector3(size.width, size.height, size.depth),
      ),
      show: (visible) => this.#batch.mesh.setVisibleAt(instance, visible),
      remove: () => {
        ;(this.#batch.mesh.userData['plots'] as Array<string | undefined>)[instance] = undefined
        this.#batch.mesh.deleteInstance(instance)
      },
    }
  }

  /** Measures the skyline again, for the scene-wide cull. Call it once the plots are in. */
  settle(): void {
    if (this.#settled) return
    this.#batch.remeasure()
    this.#settled = true
  }

  /** A colour the city was not cut for, which is a plot built into it after it opened. */
  #boxFor(tint: number): number {
    let held = this.#boxes.get(tint)
    if (held === undefined) {
      held = this.#batch.hold(boxOf(tint))
      this.#boxes.set(tint, held)
    }
    return held
  }
}

/** A unit box in one colour, painted on its vertices so the whole skyline is one material. */
function boxOf(tint: number): THREE.BufferGeometry {
  return new Assembly().add(new THREE.BoxGeometry(1, 1, 1), new THREE.Matrix4(), new THREE.Color(tint)).geometry()
}

/**
 * What a silhouette is made of when a dressing has not said otherwise: matte,
 * unlit by itself, and coloured off the vertices so every charter in the city
 * shares the one material.
 */
export function massingMaterial(): THREE.Material {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  material.name = 'massing'
  return material
}
