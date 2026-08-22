import { Greybox, type Dressing } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Item, Npc, Plot } from '@gb/world'
import * as THREE from 'three'
import { assemble } from './assemble.ts'
import { planBuilding, type BuildingSize } from './build/plan.ts'
import type { KitLibrary } from './kit/library.ts'

/**
 * The city dressed in the Downtown kit. It answers for buildings and hands
 * everything else to the dressing behind it, because the kit is a street kit:
 * it has no furniture, no people and no ground cover.
 */
export class KitDressing implements Dressing {
  readonly #kit: KitLibrary
  readonly #rest: Dressing

  constructor(kit: KitLibrary, rest: Dressing = new Greybox()) {
    this.#kit = kit
    this.#rest = rest
  }

  building(plot: Plot, size: BuildingSize): THREE.Object3D {
    const plan = planBuilding(plot, size, size.width / plot.rect.w)
    const building = assemble(plan.placements, this.#kit, plot.id)

    // an empty at the doorway, so whoever needs the door does not have to work
    // it out from the geometry again
    const door = new THREE.Object3D()
    door.name = 'door'
    door.position.set(...(plan.door.position as [number, number, number]))
    door.rotation.y = plan.door.rotationY
    building.add(door)
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