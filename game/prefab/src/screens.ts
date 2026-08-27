/**
 * The pictures the screens on the walls carry: one strip of them beside the
 * rooms, one picture per layer.
 *
 * A screen is a large bright surface on the street, so unlike a room it is seen
 * whole, close, and often two at a time. What makes one read as a screen rather
 * than a poster is not the picture but the pixel grid over it, and that is
 * arithmetic in `src/display.ts` rather than anything stored here.
 *
 * Which pictures the strip holds is the theme pack's to say, in its `ads` list.
 * Nothing here names one: the runtime folds a plot's own uv shift onto however
 * many layers the strip it was handed carries.
 */

/**
 * Pixels a side, per screen. An outdoor LED wall runs a lamp every two or three
 * centimetres, so a 4 m board is about 150 of them across: at 256 the picture
 * is already finer than the grid drawn over it, and a larger one would be
 * throwing away detail no lamp can show.
 */
export const SCREEN_SIZE = 256

/** The finish a lit screen wears. A face on this layer is a panel, not a wall; the plate's edges wear its own dark colour. */
export const DISPLAY_FINISH = 'display'
