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
}

/** Where bodies come from. `SceneCast` wraps `@gb/cast`; a test passes its own. */
export interface CrowdCast {
  spawn(npc: Npc): CrowdActor
}

/** What the crowd asks of navigation. `CityNav` from `@gb/nav` is one of these. */
export interface CrowdNav {
  walkable(cell: Cell): boolean
  path(from: Cell, to: Cell): Cell[] | undefined
  waypoints(path: readonly Cell[]): Point[]
}

export type WalkerState = 'walking' | 'idle'

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
