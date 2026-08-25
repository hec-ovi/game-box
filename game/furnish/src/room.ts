import type { Dressing } from '@gb/scene'
import type { Finish, Interior } from '@gb/world'
import * as THREE from 'three'
import type { RoomDress } from './dress.ts'
import type { FurnishDressing } from './dressing.ts'
import type { FurnishLibrary } from './kit/library.ts'
import type { FurnishStyle } from './style/palette.ts'
import { buildWalls, type PlacedBay } from './walls/build.ts'

/**
 * One interior, dressed.
 *
 * Two things come out of it and they go to two places:
 *
 * - `dressing` is what `@gb/scene` builds the room with. It paints this
 *   interior's own floor, walls and ceiling, drawn from the seed, so the shop
 *   is not the same room as the flat above it.
 * - `decor` is everything the walls are made of that is not flat: panelled
 *   bays, lit recesses with things standing in them, shelves, framed pictures,
 *   grilles, light strips and windows. One indexed mesh on the one shared
 *   material, in the interior's own coordinates, so it goes straight into what
 *   `buildInterior` hands back and costs one draw however many bays there are.
 *
 * ```ts
 * const room = dressing.room(interior)
 * const built = buildInterior(world, interior, room.dressing)
 * built.root.add(room.decor)
 * ```
 *
 * The things standing in a niche or on a shelf are decoration. They are not
 * `@gb/world` furniture, nothing can pick one up, and nothing collides with
 * one: no bay reaches more than `BAY_SPECS[kind].depth` off the wall, which is
 * well inside the radius the player is already held off it by.
 */
export class FurnishRoom {
  readonly interiorId: string
  /** The language the room came out in. */
  readonly style: FurnishStyle
  /** The finish its walls drew their taste from. */
  readonly finish: Finish
  /** Hand this to `buildInterior`. */
  readonly dressing: Dressing
  /** Add this to the root `buildInterior` gives back. */
  readonly decor: THREE.Mesh
  /** Every bay on every wall of the interior, in interior metres. */
  readonly bays: readonly PlacedBay[]
  /** Every height in this room a body can put something down on, exactly. */
  readonly contacts: readonly number[]
  readonly triangles: number

  constructor(kit: FurnishLibrary, dressing: FurnishDressing, dress: RoomDress, interior: Interior) {
    const walls = buildWalls(interior, dress, kit.seed, (prop) => kit.heightOf(prop, dress.style))

    this.interiorId = interior.id
    this.style = dress.style
    this.finish = dress.finish
    this.dressing = dressing
    this.decor = new THREE.Mesh(walls.geometry, kit.material)
    this.decor.name = `furnish:walls:${interior.id}`
    this.decor.castShadow = true
    this.decor.receiveShadow = true
    this.bays = walls.bays
    this.contacts = walls.contacts
    this.triangles = walls.triangles
  }

  /** The bays are this room's own geometry, so this room owns them. */
  dispose(): void {
    this.decor.geometry.dispose()
  }
}
