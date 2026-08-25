/**
 * The balconies some looks carry, and how far they may hang over the pavement.
 *
 * A balcony is the one thing on a building that reaches past its plot by more
 * than a tube's relief: a slab and its balustrade standing out over the
 * pavement, above the ground storey, on the wall the door is on. The pack
 * builder holds every model to `reach` on that wall above `above` metres, and
 * to the tube's relief everywhere else.
 */
export const BALCONY = {
  /** The layer the balustrade wears: a rail and the balusters under it. */
  finish: 'balcony',
  /** Metres a balcony may stand out past the plot, over the pavement. */
  reach: 1.4,
  /** Metres of clear height under the lowest one: the ground storey. */
  above: 4,
} as const
