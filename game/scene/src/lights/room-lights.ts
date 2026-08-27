import type { Interior } from '@gb/world'
import * as THREE from 'three'
import { RoomBounce } from '../fill.ts'
import { CEILING_HEIGHT } from '../shell.ts'
import { CityLights, type Shadowing } from './city-lights.ts'
import type { LightEmitter } from './emitter.ts'

/**
 * How many of a room's fixtures are real lights at once.
 *
 * A room publishes about forty: a stretch of lit channel every few metres of
 * every wall, a light line up each strip bay, a strip under each niche head,
 * the glass of each machine. Twenty is where the budget stops being visible:
 * measured over a town's twelve interiors, standing in each of its thirty-six
 * rooms in turn, the room's own floor drifts 1.13 times between the brightest
 * and the dimmest place to stand at twenty lights, 1.31 at sixteen and 1.07 at
 * twenty-four. A fifth of a stop of drift over a walk that takes a couple of
 * seconds and fades over 0.7 of one is not something a player sees; a third of
 * a stop is.
 */
export const ROOM_LIGHTS = 20

/**
 * The two nearest fixtures cast, at 512.
 *
 * Two, because a shadow casting point light is six renders of the room a frame,
 * one per cube face, each drawing only what casts and only what stands in its
 * own 90 degrees. Measured over two towns' interiors, 22 to 42 meshes a room: a
 * caster costs 2.1 times the room's meshes in draws, not six times, so the pair
 * is 90 to 180 depth-only draws a frame over a room that costs 34 to draw, and
 * four casters would be 360.
 *
 * 512, because of memory rather than sharpness. One face of a caster's cube is
 * 512 by 512 in colour and depth, so a caster is 12.6 MB and the pair is 25;
 * 1024 would be 100 MB for a browser tab. What 512 buys: a cube face spans
 * `2 * distance` metres, so a texel is 2.5 m of room over 512 at the 3 m a
 * ceiling fixture stands from the floor under it, about 12 mm, and a chair leg
 * is 40 to 50. Four texels across a leg with the five sample filter over them
 * is a soft contact shadow, which is what a room wants.
 *
 * The normal bias is two of those texels, in metres, which is what it takes to
 * keep a surface lit at a grazing angle from shadowing itself.
 */
export const ROOM_SHADOWS: Shadowing = { casters: 2, mapSize: 512, normalBias: 0.024, softness: 2 }

/**
 * The plain ceiling lamp a room the art says nothing about stands on: one over
 * the middle of each of its rooms, warm, hung under the lid.
 *
 * Its candela is charged by the square metre of the room it hangs in, because
 * one lamp over a big room is not one lamp over a small one, and the rate is
 * set to land a plain room where a dressed one lands: measured over two towns'
 * interiors, the floor takes a median 1.7 to 2.0 against the 1.9 a room lit by
 * its own fixtures gets, so swapping the art in changes the shape of the light
 * and not its level.
 */
const PLAIN_LAMP = { colour: 0xffe8cc, perSquareMetre: 0.78, height: 2.6, reach: 12 }

/**
 * What lights one room: its own fixtures, under a budget, and the bounce off
 * its own surfaces.
 *
 * The fixtures come from whoever dressed the room, in the interior's own
 * metres, and they are handed to the same machinery the street's lamps run on:
 * every one of them is kept, `ROOM_LIGHTS` of them are real point lights, and
 * the nearest to the player get those. Held at full night, because a ceiling
 * does not care what the sky is doing.
 *
 * Until the art says otherwise a room stands on one plain lamp over each of its
 * rooms, the same way a greybox building carries one lamp over its door: a room
 * nobody dressed is dim, never black.
 */
export class RoomLight {
  readonly group = new THREE.Group()
  readonly #interiorId: string
  readonly #size: { w: number; h: number }
  readonly #lights = new CityLights(1, ROOM_LIGHTS, ROOM_SHADOWS)
  readonly #bounce = new RoomBounce()

  constructor(interior: Interior) {
    this.group.name = 'room-light'
    this.#interiorId = interior.id
    this.#size = interior.size
    this.group.add(this.#lights.group)
    this.group.add(this.#bounce.light)
    this.lit(plainLamps(interior))
  }

  /** Every fixture in the room, live or not. */
  get fixtures(): readonly LightEmitter[] {
    return this.#lights.emitters
  }

  /** The point lights the budget allows, in the order they were cut. The first `ROOM_SHADOWS.casters` cast. */
  get lights(): readonly THREE.PointLight[] {
    return this.#lights.lights
  }

  /** What the art says this room is lit by. Handed nothing, the plain lamps stay. */
  lit(fixtures: readonly LightEmitter[]): void {
    if (!fixtures.length) return
    this.#lights.remove(this.#interiorId)
    this.#lights.add(this.#interiorId, fixtures, IN_PLACE)
    this.#bounce.lit(fixtures, this.#size)
  }

  /** Where the player is standing in the room, in its own metres, and the frame's own elapsed time. */
  follow(x: number, z: number, seconds?: number): void {
    this.#lights.follow(x, z, seconds)
  }

  dispose(): void {
    for (const light of this.#lights.lights) light.dispose()
    this.#bounce.dispose()
    this.group.clear()
  }
}

/** The fixtures are already in the interior's own metres, which is the frame the room is built in. */
const IN_PLACE = new THREE.Matrix4()

/** One lamp over the middle of each of the interior's rooms. */
function plainLamps(interior: Interior): LightEmitter[] {
  return interior.rooms.map((room) => ({
    kind: 'lamp',
    position: [room.rect.x + room.rect.w / 2, Math.min(PLAIN_LAMP.height, CEILING_HEIGHT - 0.4), room.rect.y + room.rect.h / 2] as const,
    colour: PLAIN_LAMP.colour,
    intensity: PLAIN_LAMP.perSquareMetre * room.rect.w * room.rect.h,
    radius: PLAIN_LAMP.reach,
  }))
}
