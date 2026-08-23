import { Greybox, type Dressing } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Item, Npc, Plot } from '@gb/world'
import type * as THREE from 'three'
import { Cast } from './cast.ts'
import type { CastMember } from './member.ts'

/**
 * The dressing that puts real people in the world. Everything that is not a
 * person still comes from the greybox, so the city can gain real art one kind
 * of thing at a time.
 */
export class CastDressing implements Dressing {
  #cast: Cast
  #rest: Dressing
  #members = new Map<string, CastMember>()

  constructor(cast: Cast, rest: Dressing = new Greybox()) {
    this.#cast = cast
    this.#rest = rest
  }

  /** Everybody who has been placed, so the game can change what they are doing. */
  members(): ReadonlyMap<string, CastMember> {
    return this.#members
  }

  character(npc: Npc, doing: AnchorKind): THREE.Object3D {
    const member = this.#cast.spawn(npc, Cast.doingAt(doing, npc.id))
    this.#members.set(npc.id, member)
    return member.object
  }

  building(plot: Plot, size: { width: number; depth: number; height: number }): THREE.Object3D {
    return this.#rest.building(plot, size)
  }

  prop(prop: FurnitureProp): THREE.Object3D {
    return this.#rest.prop(prop)
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
