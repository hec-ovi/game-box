import { HudError } from './errors.ts'
import type { HudPatch, HudState, LiveNotice, Notice, TalkPatch, TalkState } from './types.ts'

const EMPTY: HudState = {
  objectives: [],
  prompt: undefined,
  money: 0,
  carrying: [],
  talk: undefined,
  journal: [],
  journalOpen: false,
  notices: [],
}

/** How long a notice stays on screen when the caller does not say. */
export const NOTICE_MS = 3200

/**
 * The one place interface state lives. Panels, the conversation and the
 * announcements are all fields here, so every one of them is drawn by the same
 * render pass instead of having its own show and hide.
 */
export class HudStore {
  #state: HudState = EMPTY
  #onChange: () => void
  #timers = new Map<number, ReturnType<typeof setTimeout>>()
  #nextId = 1

  constructor(onChange: () => void) {
    this.#onChange = onChange
  }

  get state(): HudState {
    return this.#state
  }

  apply(patch: HudPatch): void {
    const before = this.#state
    this.#state = {
      ...before,
      ...(patch.objectives ? { objectives: patch.objectives } : {}),
      ...(patch.prompt !== undefined ? { prompt: patch.prompt ?? undefined } : {}),
      ...(patch.money !== undefined ? { money: patch.money } : {}),
      ...(patch.carrying ? { carrying: patch.carrying } : {}),
      ...(patch.talk !== undefined ? { talk: mergeTalk(before.talk, patch.talk) } : {}),
      ...(patch.journal ? { journal: patch.journal } : {}),
      ...(patch.journalOpen !== undefined ? { journalOpen: patch.journalOpen } : {}),
    }
    this.#onChange()
  }

  /** Adds a notice and schedules the same store to drop it again. */
  announce(notice: Notice, ms: number): void {
    const id = this.#nextId++
    const live: LiveNotice = { id, notice }
    this.#state = { ...this.#state, notices: [...this.#state.notices, live] }
    this.#timers.set(
      id,
      setTimeout(() => {
        this.#timers.delete(id)
        this.#state = { ...this.#state, notices: this.#state.notices.filter((n) => n.id !== id) }
        this.#onChange()
      }, ms),
    )
    this.#onChange()
  }

  dispose(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer)
    this.#timers.clear()
  }
}

function mergeTalk(current: TalkState | undefined, patch: TalkPatch | null): TalkState | undefined {
  if (patch === null) return undefined

  const fresh = patch.speaker !== undefined && patch.speaker !== current?.speaker
  if (!fresh && !current) throw new HudError('no-conversation')

  const base: TalkState = fresh || !current ? { speaker: patch.speaker ?? '', reply: '', acted: [] } : current
  const reply = (patch.reply ?? base.reply) + (patch.replyChunk ?? '')
  return {
    speaker: patch.speaker ?? base.speaker,
    reply,
    acted: patch.acted ? [...base.acted, patch.acted] : base.acted,
  }
}
