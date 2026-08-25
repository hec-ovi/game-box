import type { Rng } from '@gb/kit'

/**
 * The words a code is made of. Short and plain, so a player can type one, and
 * none of them a word a sign in town is headed by, so a code never reads as a
 * place.
 */
const WORDS: readonly string[] = [
  'kestrel', 'lantern', 'copper', 'sable', 'ember', 'marrow', 'tallow', 'quartz',
  'heron', 'cinder', 'bramble', 'anvil', 'saffron', 'vellum', 'beacon', 'gable',
]

/** A password for a door or a screen: a word and a number, the kind of thing somebody writes on a card. */
export function codeFor(rng: Rng): string {
  return `${rng.pick(WORDS)}-${rng.int(10, 100)}`
}
