import type { LightEmitter } from '@gb/scene'
import type { Finish, Interior } from '@gb/world'
import * as THREE from 'three'
import { Solid } from './build/solid.ts'
import { layDanceFloor, type LitTile } from './dance/floor.ts'
import type { RoomDress } from './dress.ts'
import type { FurnishDressing } from './dressing.ts'
import type { FurnishLibrary } from './kit/library.ts'
import { danceFixtures, screenFixtures } from './lights/room.ts'
import { printScreens, type Printed } from './machines/print.ts'
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
 * - `decor` is everything in the room that is this interior's own and not a
 *   shared piece: the bays its walls are made of (panels, lit recesses with
 *   things standing in them, shelves, framed pictures, grilles, light strips,
 *   windows, the booth over a dance floor), what every screen in it is showing,
 *   printed on the glass of the machine the file put there, and the lit tiles
 *   under its dancers. One indexed mesh on the one shared material, in the
 *   interior's own coordinates, so it goes straight into what `buildInterior`
 *   hands back and costs one draw however much of it there is.
 * - `lights` is what all of that burns: a light emitter standing in every lit
 *   thing the room drew, so the room is lit by its own ceiling rather than by a
 *   fill from nowhere.
 *
 * ```ts
 * const room = dressing.room(interior)
 * const built = buildInterior(world, interior, room.dressing)
 * built.root.add(room.decor)
 * ```
 *
 * The things standing in a niche or on a shelf are decoration, and so are the
 * prints and the tiles. None of it is `@gb/world` furniture, nothing can pick
 * any of it up, and nothing collides with it: no bay reaches more than
 * `BAY_SPECS[kind].depth` off the wall, which is inside the radius the player
 * is already held off it by, a print is a millimetre off a screen, and a tile
 * is under the height a body steps over.
 */
export class FurnishRoom {
  readonly interiorId: string
  /** The language the room came out in. */
  readonly style: FurnishStyle
  /** The finish its walls drew their taste from. */
  readonly finish: Finish
  /** Hand this to `buildInterior`. */
  readonly dressing: FurnishDressing
  /** Add this to the root `buildInterior` gives back. */
  readonly decor: THREE.Mesh
  /** Every bay on every wall of the interior, in interior metres. */
  readonly bays: readonly PlacedBay[]
  /** Every height in this room a body can put something down on, exactly. */
  readonly contacts: readonly number[]
  /** Every screen in the interior and what it is showing. */
  readonly screens: readonly Printed[]
  /** Every lit tile of a dance floor, in interior metres. */
  readonly tiles: readonly LitTile[]
  /** What this room is lit by: every fixture in it, in interior metres. */
  readonly lights: readonly LightEmitter[]
  readonly triangles: number

  constructor(kit: FurnishLibrary, dressing: FurnishDressing, dress: RoomDress, interior: Interior) {
    const solid = new Solid()
    const walls = buildWalls(solid, interior, dress, kit.seed, (prop) => kit.heightOf(prop, dress.style))
    const screens = printScreens(solid, interior, kit.seed)
    const tiles = layDanceFloor(solid, interior, kit.seed)
    const geometry = solid.geometry()
    geometry.name = `furnish:decor:${dress.style}:${interior.id}`

    this.interiorId = interior.id
    this.style = dress.style
    this.finish = dress.finish
    this.dressing = dressing
    this.decor = new THREE.Mesh(geometry, kit.material)
    this.decor.name = `furnish:decor:${interior.id}`
    this.decor.castShadow = true
    this.decor.receiveShadow = true
    this.bays = walls.bays
    this.contacts = walls.contacts
    this.screens = screens
    this.tiles = tiles
    this.lights = [...walls.lights, ...screenFixtures(interior), ...danceFixtures(tiles)]
    this.triangles = solid.triangles
  }

  /** The decor is this room's own geometry, so this room owns it. */
  dispose(): void {
    this.decor.geometry.dispose()
  }
}
