import type { Turn } from './events.ts'

/** How many turns one person keeps of what was said between them and the player. */
const TURNS_KEPT = 16

/** One person's transcript: what was said between them and the player, newest last, bounded. */
export class Transcript {
  #turns: Turn[] = []

  get turns(): readonly Turn[] {
    return this.#turns
  }

  push(turn: Turn): void {
    this.#turns.push(turn)
    if (this.#turns.length > TURNS_KEPT) this.#turns.splice(0, this.#turns.length - TURNS_KEPT)
  }
}

/**
 * Every person is their own session: one transcript per npc id, kept for as
 * long as the playthrough runs, so walking back up to somebody carries on
 * where the two of them left off and nobody hears a word said to anyone else.
 */
export class Sessions {
  #transcripts = new Map<string, Transcript>()

  of(npcId: string): Transcript {
    let transcript = this.#transcripts.get(npcId)
    if (!transcript) {
      transcript = new Transcript()
      this.#transcripts.set(npcId, transcript)
    }
    return transcript
  }
}
