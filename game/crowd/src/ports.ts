import type { Rng } from '@gb/kit'
import type { Cell, Point } from '@gb/nav'
import type { Npc } from '@gb/world'

export type { Cell, Point }

/**
 * One body the crowd can move. The crowd never touches three.js: it hands a
 * position, a facing and a clip name to whatever is on the other side of this,
 * which is `SceneCast` in the game and a recorder in the tests.
 */
export interface CrowdActor {
  /** Stand here. Metres, Y up, feet on the ground. */
  placeAt(x: number, y: number, z: number): void
  /** Face this way: three.js `rotation.y`, so a body at 0 looks north (-Z), along its own front. */
  faceTo(heading: number): void
  /** Cross-fade to this clip. An unknown name is ignored by the cast, never thrown. */
  play(clip: string): void
  /** Take this body out of the world. */
  release(): void
  /**
   * Turn the head towards this point, in metres, the body left where it is.
   * Optional: a body that cannot turn its head just does not, and everything
   * else about being talked to still happens.
   */
  lookAt?(x: number, y: number, z: number): void
  /** Head back to whatever the clip has them looking at. */
  lookAway?(): void
}

/** Somebody who walks with the player until the game says otherwise. */
export interface Companion {
  /** Who they are. Their id is what `stopFollowing` takes, and what `following()` reports. */
  readonly npc: Npc
  /** Where they are standing when they set off. Defaults to where the player is. */
  readonly at?: Point
  /** A body the game already has for them. With none, the crowd asks its cast for one and gives it back later. */
  readonly actor?: CrowdActor
}

/**
 * The ground the whole world stands on, city and country alike, in metres.
 * The city grid stops at the edge of town and has nothing to say about the
 * landscape around it, which is where a companion following the player out of
 * town walks. `@gb/land`'s `Land` is one of these already.
 */
export interface CrowdGround {
  /** Where the ground is at this point. Feet go here, plus the kerb inside town. */
  heightAt(x: number, z: number): number
  /** True where somebody may stand: not too steep, not under water. */
  walkableAt(x: number, z: number): boolean
}

/**
 * Who is out on the street. The crowd asks for somebody every time it puts a
 * new walker on the pavement, and whoever it is answers `Crowd.person(id)`
 * from then on, so the game can talk to the people it passes.
 *
 * The default mints strangers who are in no world and own nothing. Give the
 * crowd a source of the city's own residents instead and the people walking
 * past are the people the world knows: `world.npc(walker.id)` resolves, and
 * the same person is never on the street twice at once.
 */
export interface CrowdPeople {
  /**
   * Somebody to put on the street, or nothing when there is nobody to spare.
   * `serial` counts the walkers this crowd has made, and `rng` is that
   * walker's own stream, so the same city fills with the same faces.
   */
  street(serial: number, rng: Rng): Npc | undefined
}

/** Where bodies come from. `SceneCast` wraps `@gb/cast`; a test passes its own. */
export interface CrowdCast {
  spawn(npc: Npc): CrowdActor
}

/**
 * Something moving on the road that a walker should not step in front of: a
 * car, a tram, a runaway barrel. Velocity is metres per second along the
 * ground; from a heading and a speed it is `(-sin(heading), -cos(heading))`
 * times the speed, the same yaw convention the crowd uses.
 */
export interface Hazard {
  /** Where it is now, in metres. */
  readonly x: number
  readonly z: number
  readonly vx: number
  readonly vz: number
  /** How much room it needs around that point, in metres. */
  readonly radius: number
}

/**
 * What is moving on the road near a point. The game feeds this from
 * `@gb/traffic`; give the crowd none and walkers cross without looking, which
 * is what a city with no traffic in it wants.
 */
export interface Hazards {
  /** Everything moving within this many metres of a point. */
  near(x: number, z: number, radius: number): readonly Hazard[]
}

/** What the crowd asks of navigation. `CityNav` from `@gb/nav` is one of these. */
export interface CrowdNav {
  walkable(cell: Cell): boolean
  path(from: Cell, to: Cell): Cell[] | undefined
  waypoints(path: readonly Cell[]): Point[]
}

/** Walking a route, held at a kerb by traffic, or standing about with nowhere to go. */
export type WalkerState = 'walking' | 'waiting' | 'idle'

/** A pedestrian as the rest of the game may read them. Plain numbers, no objects. */
export interface WalkerView {
  readonly id: string
  /** Metres. */
  readonly x: number
  readonly z: number
  /** Three.js `rotation.y`: 0 looks north (-Z), and it points the body along the way it is walking. */
  readonly heading: number
  readonly state: WalkerState
  readonly clip: string
  /** Metres still to walk on the current route. */
  readonly remaining: number
}
