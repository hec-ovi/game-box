import { mergeTalk, withYours } from './transcript.ts'
import type { ConfirmAsk, HudPatch, HudState, LiveNotice, Notice } from './types.ts'

const EMPTY: HudState = {
  objectives: [],
  prompt: undefined,
  money: 0,
  carrying: [],
  inspecting: undefined,
  homes: [],
  counter: undefined,
  screen: undefined,
  talk: undefined,
  quests: [],
  offers: [],
  trackedQuestId: undefined,
  map: undefined,
  reading: undefined,
  minimap: undefined,
  compass: undefined,
  codex: { places: [], people: [] },
  settings: undefined,
  controls: [],
  window: null,
  confirm: undefined,
  loading: undefined,
  notices: [],
  hadQuest: false,
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
      ...(patch.inspecting !== undefined ? { inspecting: patch.inspecting ?? undefined } : {}),
      ...(patch.homes ? { homes: patch.homes } : {}),
      ...(patch.counter !== undefined ? { counter: patch.counter ?? undefined } : {}),
      ...(patch.screen !== undefined ? { screen: patch.screen ?? undefined } : {}),
      ...(patch.talk !== undefined ? { talk: mergeTalk(before.talk, patch.talk) } : {}),
      ...(patch.quests ? { quests: patch.quests } : {}),
      ...(patch.offers ? { offers: patch.offers } : {}),
      ...(patch.trackedQuestId !== undefined ? { trackedQuestId: patch.trackedQuestId ?? undefined } : {}),
      ...(patch.map !== undefined ? { map: patch.map ?? undefined } : {}),
      ...(patch.reading !== undefined ? { reading: patch.reading ?? undefined } : {}),
      ...(patch.minimap !== undefined ? { minimap: patch.minimap ?? undefined } : {}),
      ...(patch.compass !== undefined ? { compass: patch.compass ?? undefined } : {}),
      ...(patch.codex ? { codex: patch.codex } : {}),
      ...(patch.settings ? { settings: patch.settings } : {}),
      ...(patch.controls ? { controls: patch.controls } : {}),
      ...(patch.window !== undefined ? { window: patch.window } : {}),
      ...(patch.loading !== undefined ? { loading: patch.loading ?? undefined } : {}),
      hadQuest: before.hadQuest || hasWork(patch),
    }
    this.#onChange()
  }

  /**
   * Put a "you sure" in front of the player, or take it away. This one is the
   * interface's own state: the game never asks, it only hears the answer.
   */
  ask(confirm: ConfirmAsk | null): void {
    this.#state = { ...this.#state, confirm: confirm ?? undefined }
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
    this.#state = {
      ...this.#state,
      talk: { ...talk, turns: withYours(talk.turns, you), pending: talk.moves.length > 0 },
    }
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

/**
 * Whether this push proves the player has work in hand. It never goes back:
 * an empty board after a finished job is a lull, not a fresh start.
 */
function hasWork(patch: HudPatch): boolean {
  return (patch.objectives?.length ?? 0) > 0 || (patch.quests?.length ?? 0) > 0
}
