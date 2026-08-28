/**
 * The objective lines the compiler writes for a step no beat asked for.
 *
 * They are short on purpose. A step the compiler put in is a step the writer
 * left out, and the beat right after it carries the story; the marker on the
 * thing or the person says the rest, and the beat's own line rides along as the
 * hint. Nothing here ever reaches the player as the whole of what a quest says.
 */
export const LINES = {
  /** A thing the flow hands over that nothing had picked up. */
  fetch: 'Get your hands on it first.',
  /** Somebody the flow walks somewhere who never agreed to come. */
  recruit: 'Talk them into coming along.',
  /** The end of the quest. A complete step resolves itself, so nobody reads this. */
  done: 'The job is done.',
} as const
