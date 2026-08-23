import { SIGN } from '@gb/kitbash'
import type { Dressing } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Item, Npc, Plot } from '@gb/world'
import * as THREE from 'three'
import type { Library } from './library.ts'
import { orient, turnsFor } from './orient.ts'

export interface BuildingSize {
  readonly width: number
  readonly depth: number
  readonly height: number
}

/**
 * Dresses a plot with the building the catalogue gives it, out of one packed
 * library on one material. A plot the catalogue has no shape for is handed
 * straight to the dressing behind, so a footprint nobody baked is a kit
 * building rather than a hole in the street.
 *
 * Signage stays where it was written. `@gb/kitbash` puts every sign in the city
 * on one material; this lifts those meshes off the kit's building and hangs
 * them on the prefab, so a prefab street still has names over its doors and the
 * whole town's signage is still one draw.
 */
export class PrefabDressing implements Dressing {
  readonly #library: Library
  readonly #rest: Dressing

  constructor(library: Library, rest: Dressing) {
    this.#library = library
    this.#rest = rest
  }

  building(plot: Plot, size: BuildingSize): THREE.Object3D {
    const design = this.#library.catalogue.design(plot, size)
    const geometry = design ? this.#library.geometry(design.model) : undefined
    if (!design || !geometry) return this.#rest.building(plot, size)

    const mesh = new THREE.Mesh(orient(geometry, turnsFor(plot.entrance.facing), design.mirror, design.rooms), this.#library.material)
    mesh.name = `${plot.id}:${design.model}`
    mesh.castShadow = true
    mesh.receiveShadow = true

    const building = new THREE.Group()
    building.name = plot.id
    building.add(mesh)
    for (const sign of signsOn(this.#rest.building(plot, size))) building.add(sign)
    return building
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

  surface(part: 'floor' | 'wall' | 'ceiling'): THREE.Material {
    return this.#rest.surface(part)
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
