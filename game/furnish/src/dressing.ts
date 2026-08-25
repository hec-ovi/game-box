import { Greybox, type Dressing } from '@gb/scene'
import type { AnchorKind, CellKind, FurnitureProp, Interior, Item, Npc, Plot } from '@gb/world'
import * as THREE from 'three'
import type { FurnishLibrary } from './kit/library.ts'
import { FurnishRoom } from './room.ts'
import { screenSlot } from './screens/screening.ts'
import { finishOf } from './style/finish.ts'
import type { FurnishStyle } from './style/palette.ts'
import { FIRST_CHOICES, surfaceChoices, type SurfaceChoices } from './surfaces/choose.ts'
import type { SurfacePart } from './surfaces/surfaces.ts'

/**
 * The inside of a building in one of the two interior languages: furniture
 * generated to the cells the planner claimed and the heights a body reaches
 * for, the things lying on it that a player can pick up, on a floor and walls
 * that tile at real-world size.
 *
 * Everything else, the buildings, the people, the ground outside, goes straight
 * to the dressing behind it.
 *
 * A dressing speaks one language. `as` hands back a sibling in the other over
 * the same library, so an app that knows which building it is entering pays
 * nothing for the second language: one library, one material, two dressings.
 * `room` hands back a sibling bound to one interior, in the language that
 * building's finish asks for, whose floor, walls and ceiling are that
 * interior's own, plus the bays its walls are made of, and whose screens are
 * on that interior's own channel.
 */
export class FurnishDressing implements Dressing {
  readonly #kit: FurnishLibrary
  readonly #rest: Dressing
  readonly #choices: SurfaceChoices
  readonly #slot: number
  readonly style: FurnishStyle

  constructor(
    kit: FurnishLibrary,
    rest: Dressing = new Greybox(),
    style: FurnishStyle = 'corpo',
    choices: SurfaceChoices = FIRST_CHOICES,
    slot = 0,
  ) {
    this.#kit = kit
    this.#rest = rest
    this.#choices = choices
    this.#slot = slot
    this.style = style
  }

  /** The same furniture in the other language. */
  as(style: FurnishStyle): FurnishDressing {
    return style === this.style
      ? this
      : new FurnishDressing(this.#kit, this.#rest, style, this.#choices, this.#slot)
  }

  /** This interior's own room: its language, its surfaces, its bays, and what its screens are showing. */
  room(interior: Interior): FurnishRoom {
    const style = finishOf(interior.kind)
    const bound = new FurnishDressing(
      this.#kit,
      this.#rest,
      style,
      surfaceChoices(this.#kit.seed, style, interior.id),
      screenSlot(this.#kit.seed, interior.id),
    )
    return new FurnishRoom(this.#kit, bound, style, interior)
  }

  /**
   * How high off the floor the top of a piece is drawn, for a piece that has
   * one: the number a till or a coffee machine is lifted by to stand on it.
   */
  contactHeight(prop: FurnitureProp): number | undefined {
    return this.#kit.contact(prop)
  }

  prop(prop: FurnitureProp): THREE.Object3D {
    const mesh = new THREE.Mesh(this.#kit.geometry(prop, this.style, this.#slot), this.#kit.material)
    mesh.name = prop
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  surface(part: SurfacePart): THREE.Material {
    return this.#kit.surfaces?.material(part, this.style, this.#choices[part]) ?? this.#rest.surface(part)
  }

  building(plot: Plot, size: { width: number; depth: number; height: number }): THREE.Object3D {
    return this.#rest.building(plot, size)
  }

  character(npc: Npc, doing: AnchorKind): THREE.Object3D {
    return this.#rest.character(npc, doing)
  }

  /**
   * The thing itself, at the size it really is, standing on the centre of its
   * own base so it lands on whatever it is put on rather than in it.
   */
  pickup(item: Item): THREE.Object3D {
    const mesh = new THREE.Mesh(this.#kit.item(item), this.#kit.material)
    mesh.name = item.archetype
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  ground(kind: CellKind): THREE.Material {
    return this.#rest.ground(kind)
  }
}
