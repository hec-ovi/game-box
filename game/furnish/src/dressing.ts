import { Greybox, type Dressing } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Item, Npc, Plot } from '@gb/world'
import * as THREE from 'three'
import type { Part } from './kit/build.ts'
import type { FurnishLibrary } from './kit/library.ts'
import type { SurfacePart } from './surfaces/surfaces.ts'

/**
 * The inside of a building dressed in the two KayKit packs: furniture that is
 * furniture, and a floor and walls that tile at real-world size. Everything
 * else - the buildings, the people, the ground outside - goes straight to the
 * dressing behind it.
 */
export class FurnishDressing implements Dressing {
  readonly #kit: FurnishLibrary
  readonly #rest: Dressing

  constructor(kit: FurnishLibrary, rest: Dressing = new Greybox()) {
    this.#kit = kit
    this.#rest = rest
  }

  prop(prop: FurnitureProp): THREE.Object3D {
    const parts = this.#kit.parts(prop)
    return parts ? this.#object(parts, prop) : this.#rest.prop(prop)
  }

  surface(part: SurfacePart): THREE.Material {
    return this.#kit.surfaces?.material(part) ?? this.#rest.surface(part)
  }

  building(plot: Plot, size: { width: number; depth: number; height: number }): THREE.Object3D {
    return this.#rest.building(plot, size)
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

  /**
   * A new object over shared geometry: the art is loaded once and a room of
   * twenty pieces costs twenty draws, not twenty loads. The geometry already
   * has its origin at the centre of its base and its front looking north, so
   * there is nothing to place here.
   */
  #object(parts: readonly Part[], name: string): THREE.Object3D {
    const meshes = parts.map((part) => {
      const mesh = new THREE.Mesh(part.geometry, this.#kit.material(part.material))
      mesh.name = name
      mesh.castShadow = true
      mesh.receiveShadow = true
      return mesh
    })
    if (meshes.length === 1) return meshes[0]!

    const group = new THREE.Group()
    group.name = name
    for (const mesh of meshes) group.add(mesh)
    return group
  }
}
