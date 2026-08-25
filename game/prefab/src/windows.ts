import { WALL } from './wall.ts'

/**
 * How a kind of window lays a bay out, and what sort of room sits behind it.
 *
 * Two kinds, and the split is the whole reason a building is a couple of
 * hundred triangles: above the street a bay is a bay of curtain wall, and the
 * street level is one wide pane a player stands a metre from. Both are cut out
 * of the wall picture in the shader; the producer is told the same grid so the
 * picture and the cut agree.
 */
export interface WindowKind {
  /** Bays across and floors down one unit of the picture's uv: what the producer was told. */
  readonly grid: { readonly across: number; readonly down: number }
  /** How far the surround reaches into a bay from each edge, as a share of the bay. */
  readonly frame: { readonly across: number; readonly down: number }
  /** How the opening is divided, and how wide a mullion is as a share of one pane. */
  readonly panes: { readonly across: number; readonly down: number; readonly mullion: number }
  /** Metres the room runs back from the glass. */
  readonly deep: number
  /**
   * How much of the night's lit share it takes to light one. Under 1 lights
   * more of them, which is the difference between a street of shops and a
   * street of offices.
   */
  readonly keys: number
  /** Whether one of these near the ground looks into a shop rather than a room. */
  readonly street: boolean
  /** The shortest bay, in metres, worth cutting a window into. A parapet band is not one. */
  readonly shortest: number
}

/**
 * A wall above the street: a bay of curtain wall, six panes, an office or a
 * flat behind it. The bay is 3 m and the opening 2.1 m, and a room 2.4 m deep
 * behind that is a room; the picture carries its own depth past the box.
 */
export const FACADE: WindowKind = {
  grid: { across: 4, down: 2 },
  frame: { across: 0.15, down: 0.17 },
  panes: { across: 3, down: 2, mullion: 0.055 },
  deep: 2.4,
  keys: 1,
  street: false,
  shortest: 1.6,
}

/**
 * Street level: one wide pane a player stands a metre from, and most of them
 * are open. The opening is 2.6 m wide and the floor 3 m deep, the shallow end
 * of a real shop floor, so what is seen through the glass is the shop and not
 * the tunnel to it.
 */
export const SHOPFRONT: WindowKind = {
  grid: { across: 2, down: 1 },
  frame: { across: 0.07, down: 0.11 },
  panes: { across: 2, down: 1, mullion: 0.03 },
  deep: 3,
  keys: 0.32,
  street: true,
  shortest: 1.6,
}

/** Which kind of window a finish wears, if any: a base, a door and a neon tube have none. */
export function windowsOn(finish: string): WindowKind | undefined {
  if (finish.startsWith(WALL)) return FACADE
  if (finish === 'glass') return SHOPFRONT
  return undefined
}

/** The share of a bay that is glass once the surround and the mullions are out of it. */
export function glassShareOf(kind: WindowKind): number {
  return (1 - kind.frame.across * 2) * (1 - kind.frame.down * 2) * (1 - kind.panes.mullion * 2) ** 2
}
