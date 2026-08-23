import { HudError } from './errors.ts'
import type { HudPatch, HudState, LiveNotice, Notice, TalkPatch, TalkState } from './types.ts'

const EMPTY: HudState = {
  objectives: [],
  prompt: undefined,
  money: 0,
  carrying: [],
  talk: undefined,
  quests: [],
  trackedQuestId: undefined,
  map: undefined,
  controls: [],
  window: null,
  notices: [],
}

/** How long a notice takes to fade once its time is up. */
const NOTICE_EXIT_MS = 180

/** Past this many at once the oldest goes, so a busy minute stays readable. */
const MAX_NOTICES = 4

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
      ...(patch.quests ? { quests: patch.quests } : {}),
      ...(patch.trackedQuestId !== undefined ? { trackedQuestId: patch.trackedQuestId ?? undefined } : {}),
      ...(patch.map !== undefined ? { map: patch.map ?? undefined } : {}),
      ...(patch.controls ? { controls: patch.controls } : {}),
      ...(patch.window !== undefined ? { window: patch.window } : {}),
    }
    this.#onChange()
  }

  /**
   * The player answered, typed or picked. Their line goes up straight away, and
   * the menu goes quiet until the game publishes the next one, so a second
   * answer cannot land on a turn that has already moved on.
   */
  answered(you: string): void {
    const talk = this.#state.talk
    if (!talk) return
    this.#state = { ...this.#state, talk: { ...talk, you, pending: talk.moves.length > 0 } }
    this.#onChange()
  }

  /** Adds a notice, then fades it and drops it again on its own clock. */
  announce(notice: Notice, ms: number): void {
    const id = this.#nextId++
    const live: LiveNotice = { id, notice, leaving: false }
    let notices = [...this.#state.notices, live]
    while (notices.length > MAX_NOTICES) {
      const oldest = notices[0]!
      this.#stop(oldest.id)
      notices = notices.slice(1)
    }
    this.#state = { ...this.#state, notices }
    this.#after(id, Math.max(0, ms - NOTICE_EXIT_MS), () => {
      this.#write(this.#state.notices.map((n) => (n.id === id ? { ...n, leaving: true } : n)))
      this.#after(id, NOTICE_EXIT_MS, () => {
        this.#timers.delete(id)
        this.#write(this.#state.notices.filter((n) => n.id !== id))
      })
    })
    this.#onChange()
  }

  dispose(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer)
    this.#timers.clear()
  }

  #write(notices: readonly LiveNotice[]): void {
    this.#state = { ...this.#state, notices }
    this.#onChange()
  }

  #after(id: number, ms: number, run: () => void): void {
    this.#timers.set(id, setTimeout(run, ms))
  }

  #stop(id: number): void {
    const timer = this.#timers.get(id)
    if (timer) clearTimeout(timer)
    this.#timers.delete(id)
  }
}

function mergeTalk(current: TalkState | undefined, patch: TalkPatch | null): TalkState | undefined {
  if (patch === null) return undefined

  const fresh = patch.speaker !== undefined && patch.speaker !== current?.speaker
  if (!fresh && !current) throw new HudError('no-conversation')

  const blank: TalkState = { speaker: patch.speaker ?? '', you: '', reply: '', acted: [], moves: [], pending: false }
  const base: TalkState = fresh || !current ? blank : current
  const reply = (patch.reply ?? base.reply) + (patch.replyChunk ?? '')
  return {
    speaker: patch.speaker ?? base.speaker,
    you: base.you,
    reply,
    acted: patch.acted ? [...base.acted, patch.acted] : base.acted,
    moves: patch.moves ?? base.moves,
    // A menu arriving is the turn being over, so what is on it is live again.
    pending: patch.moves === undefined && base.pending,
  }
}
