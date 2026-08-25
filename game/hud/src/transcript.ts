import { HudError } from './errors.ts'
import type { TalkPatch, TalkState, TalkTurn } from './types.ts'

/**
 * How a talk patch lands on the conversation. A new speaker starts an empty
 * transcript; `turns` replaces it whole; `reply`, `replyChunk` and `does` edit
 * the speaker's current turn, which is the last one when it is theirs and a new
 * one when the player spoke last.
 */
export function mergeTalk(current: TalkState | undefined, patch: TalkPatch | null): TalkState | undefined {
  if (patch === null) return undefined

  const fresh = patch.speaker !== undefined && patch.speaker !== current?.speaker
  if (!fresh && !current) throw new HudError('no-conversation')

  const blank: TalkState = { speaker: patch.speaker ?? '', turns: [], moves: [], pending: false }
  const base: TalkState = fresh || !current ? blank : current
  const turns = patch.turns ?? base.turns
  return {
    speaker: patch.speaker ?? base.speaker,
    turns: editsTurn(patch) ? withTheirs(turns, patch) : turns,
    moves: patch.moves ?? base.moves,
    // A menu arriving is the turn being over, so what is on it is live again.
    pending: patch.moves === undefined && base.pending,
  }
}

/** The player's own line, typed or picked, as a turn of its own. */
export function withYours(turns: readonly TalkTurn[], says: string): readonly TalkTurn[] {
  return [...turns, { who: 'you', says }]
}

function editsTurn(patch: TalkPatch): boolean {
  return patch.reply !== undefined || patch.replyChunk !== undefined || patch.does !== undefined
}

function withTheirs(turns: readonly TalkTurn[], patch: TalkPatch): readonly TalkTurn[] {
  const last = turns[turns.length - 1]
  const theirs = last?.who === 'them'
  const from: TalkTurn = theirs ? last : { who: 'them', says: '' }
  const says = (patch.reply ?? from.says) + (patch.replyChunk ?? '')
  const does = patch.does === undefined ? from.does : (patch.does ?? undefined)
  const turn: TalkTurn = { who: 'them', says, ...(does ? { does } : {}) }
  return theirs ? [...turns.slice(0, -1), turn] : [...turns, turn]
}
