/**
 * Where everything sits, in pixels, and which is in front. The screen is cut
 * into regions that never cross: the objectives corner top left with the
 * minimap under it above the foot, the compass strip and the notices band
 * beside them, the conversation down the right, the bar along the foot, and
 * the room the window, the counter and the confirm share in what is left. The
 * screen sits in the middle of the whole view. Every rule that places a
 * surface reads these numbers, so the regions stay disjoint by construction.
 */
export const LAYOUT = {
  /** Air between any surface and the edge of the screen. */
  margin: 22,
  /** The objectives corner: its width, and the tallest it may grow before it scrolls. */
  corner: { width: 330, height: 340 },
  /** The minimap, a square in the corner column above the foot. */
  minimap: 230,
  /** The conversation panel. */
  side: 380,
  /** The compass strip at the top of the band: its width, and the height it takes off the notices. */
  compass: { width: 360, height: 44 },
  /** The band across the top that the compass and the notices live in, and the window stays under. */
  top: 196,
  /** The band along the foot that the bar lives in, and everything else stays above. */
  foot: 88,
  /** The window frame, one size for every face; the room clamps it on a small screen. */
  window: { width: 1320, height: 800 },
  /** The counter, a smaller frame in the same room. */
  counter: { width: 520, height: 460 },
  /** The confirm, the smallest frame of the three, in the same room and in front of both. */
  confirm: { width: 420 },
} as const

/** Left edge of everything to the right of the objectives corner. */
export const INNER_LEFT = LAYOUT.margin * 2 + LAYOUT.corner.width

/** Right edge of everything to the left of the conversation, while it is up. */
export const SIDE_RIGHT = LAYOUT.margin * 2 + LAYOUT.side

/** Top of the notices column: under the compass strip, with a step of air. */
export const NOTICES_TOP = LAYOUT.margin + LAYOUT.compass.height + 8

/**
 * What the corner column owes to the minimap, the bar's band and the air round
 * them. The objectives panel takes what is left, so however short the view is
 * the two panels in that column never meet.
 */
export const CORNER_RESERVED = LAYOUT.margin * 2 + LAYOUT.minimap + LAYOUT.foot

/** Front to back. Nothing shares a layer, so nothing can be drawn through. */
export const LAYERS = {
  corner: 1,
  minimap: 2,
  compass: 3,
  side: 4,
  notices: 5,
  bar: 6,
  scrim: 7,
  counter: 8,
  window: 9,
  screen: 10,
  confirm: 11,
  loader: 12,
} as const
