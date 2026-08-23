import { Greybox, type Dressing } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Item, Npc, Plot } from '@gb/world'
import * as THREE from 'three'
import type { FurnishLibrary } from './kit/library.ts'
import type { FurnishStyle } from './style/palette.ts'
import type { SurfacePart } from './surfaces/surfaces.ts'

/**
 * The inside of a building in one of the two interior languages: furniture
 * generated to the cells the planner claimed and the heights a body reaches
 * for, on a floor and walls that tile at real-world size.
 *
 * Everything else, the buildings, the people, the ground outside, goes straight
 * to the dressing behind it.
 *
 * A dressing speaks one language. `as` hands back a sibling in the other over
 * the same library, so an app that knows which building it is entering pays
 * nothing for the second language: one library, one material, two dressings.
 */
export class FurnishDressing implements Dressing {
  readonly #kit: FurnishLibrary
  readonly #rest: Dressing
  readonly style: FurnishStyle

  constructor(kit: FurnishLibrary, rest: Dressing = new Greybox(), style: FurnishStyle = 'corpo') {
    this.#kit = kit
    this.#rest = rest
    this.style = style
  }

  /** The same furniture in the other language. */
  as(style: FurnishStyle): FurnishDressing {
    return style === this.style ? this : new FurnishDressing(this.#kit, this.#rest, style)
  }

  prop(prop: FurnitureProp): THREE.Object3D {
    const mesh = new THREE.Mesh(this.#kit.geometry(prop, this.style), this.#kit.material)
    mesh.name = prop
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  surface(part: SurfacePart): THREE.Material {
    return this.#kit.surfaces?.material(part, this.style) ?? this.#rest.surface(part)
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
}
