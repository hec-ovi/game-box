/**
 * Where everything sits, in pixels, and which is in front. The screen is cut
 * into regions that never cross: the objectives corner top left, the compass
 * strip and the notices band beside it, the conversation down the right, the
 * bar along the foot, and the window in the room those leave. Every rule that
 * places a surface reads these numbers, so the regions stay disjoint by
 * construction.
 */
export const LAYOUT = {
  /** Air between any surface and the edge of the screen. */
  margin: 22,
  /** The objectives corner. */
  corner: 330,
  /** The conversation panel. */
  side: 380,
  /** The compass strip at the top of the band: its width, and the height it takes off the notices. */
  compass: { width: 360, height: 44 },
  /** The band across the top that the compass and the notices live in, and the window stays under. */
  top: 196,
  /** The band along the foot that the bar lives in, and everything else stays above. */
  foot: 88,
  /** The window frame, one size for every face; the room clamps it on a small screen. */
  window: { width: 760, height: 600 },
} as const

/** Left edge of everything to the right of the objectives corner. */
export const INNER_LEFT = LAYOUT.margin * 2 + LAYOUT.corner

/** Right edge of everything to the left of the conversation, while it is up. */
export const SIDE_RIGHT = LAYOUT.margin * 2 + LAYOUT.side

/** Top of the notices column: under the compass strip, with a step of air. */
export const NOTICES_TOP = LAYOUT.margin + LAYOUT.compass.height + 8

/** Front to back. Nothing shares a layer, so nothing can be drawn through. */
export const LAYERS = {
  corner: 1,
  compass: 2,
  side: 3,
  notices: 4,
  bar: 5,
  scrim: 6,
  window: 7,
  loader: 8,
} as const
