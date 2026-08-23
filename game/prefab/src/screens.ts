/**
 * The pictures the screens on the walls carry: one strip of them beside the
 * rooms, one picture per layer.
 *
 * A screen is a large bright surface on the street, so unlike a room it is seen
 * whole, close, and often two at a time. What makes one read as a screen rather
 * than a poster is not the picture but the pixel grid over it, and that is
 * arithmetic in `src/display.ts` rather than anything stored here.
 */

/**
 * Pixels a side, per screen. An outdoor LED wall runs a lamp every two or three
 * centimetres, so a 4 m board is about 150 of them across: at 256 the picture
 * is already finer than the grid drawn over it, and a larger one would be
 * throwing away detail no lamp can show.
 */
export const SCREEN_SIZE = 256

/**
 * The screens in the order they sit in the strip. Which one a panel carries is
 * the plot's own uv shift, so the count is what the shift is folded onto.
 */
export const SCREEN_PICTURES: readonly string[] = ['portrait', 'bottle', 'figure', 'bowl', 'bloom', 'skyline']

/** The finish a lit screen wears. A face on this layer is a panel, not a wall. */
export const DISPLAY_FINISH = 'display'
