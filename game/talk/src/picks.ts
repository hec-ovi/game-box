import type { ActionName, Move } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

const WORDING = keyed(PROMPTS.picks)

/** One move as the player sees it: words to click, and the key that names it back. */
export interface TalkMove {
  readonly key: string
  /** What kind of move it is, so a caller can filter or group without reading the key. */
  readonly action: ActionName
  readonly label: string
}

/** This turn's moves in the player's own words, in the order the NPC weighs them. */
export function picks(moves: readonly Move[]): readonly TalkMove[] {
  return moves.map((move) => ({ key: keyFor(move), action: move.action, label: pickLabel(move) }))
}

/** The move a key stands for, or nothing when it is not legal any more. */
export function pickByKey(moves: readonly Move[], key: string): Move | undefined {
  return moves.find((move) => keyFor(move) === key)
}

/** What the player clicked, kept as the player's turn in the transcript. */
export function pickLabel(move: Move): string {
  const subject = move.subject ?? ''
  return fill(WORDING[move.action]!, { title: subject, item: subject, topic: subject })
}

/**
 * What the move is and what it is about, never where it sat in a list: a menu
 * that changes between the render and the click must not resolve the click onto
 * a different move.
 */
function keyFor(move: Move): string {
  return move.id ? `${move.action}#${move.id}` : move.action
}
