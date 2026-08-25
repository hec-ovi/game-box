import { CLIPS_FOR_ANCHOR, HANDHELD } from '@gb/cast'
import { Rng } from '@gb/kit'

/**
 * The standing idles a visitor may hold: the cast's `stand` shelf with nothing
 * in the hands, because a companion who came in off the street did not bring
 * a glass or a phone with them.
 */
const AT_EASE: readonly string[] = CLIPS_FOR_ANCHOR.stand.filter((clip) => !(clip in HANDHELD))

/** The relaxed idle this person holds indoors, drawn off their id, so the same person stands the same way every visit. */
export function stanceFor(npcId: string): string {
  return new Rng(`${npcId}/stance`).pick(AT_EASE)
}
