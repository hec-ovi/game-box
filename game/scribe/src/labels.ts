/**
 * The handles the model answers under.
 *
 * A door and a need are both asked about in a list, and a model that has to
 * repeat a long string to say which one it is answering gets one of them wrong.
 * So each carries a short label, and every answer is read back off the label
 * rather than off the order it was written in. A door's label is its own index
 * in the town, so the same door is `b12` in the call that says what it is and in
 * the call that names it.
 */

/** One door of the town, by its place in the town's own count of plots. */
export const doorLabel = (index: number): string => `b${index}`

/** One thing the town needs behind its doors, by its place in the list it was handed in. */
export const needLabel = (index: number): string => `n${index}`
