import type { Carried, Hud } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { Change, Objective, QuestKind, QuestLog } from '@gb/quest'
import type { World } from '@gb/world'
import { codexOf } from './codex.ts'
import type { Conditions } from './conditions.ts'
import { marked, type Marked, type Whereabouts } from './places.ts'

/** What a box handed back: changes to announce, or an error to let go. */
export type Reported = { ok: true; value: readonly Change[] } | { ok: false; error: unknown }

/**
 * What the player reads: the objectives, what they are carrying and the money
 * in with it, the quest list, the codex, the clock and the sky, and a line
 * whenever a quest turns. The hud never asks; it is pushed the whole state
 * every time any of it moves. The clock is carried to the quest log from here
 * as well, because what the log makes of a reading is something to announce.
 */
export class Reporting {
  #world: World
  #log: QuestLog
  #player: PlayerState
  #hud: Hud
  #conditions: Conditions
  #out: Whereabouts
  #changed: () => void
  #tracked: string | null | undefined
  #pushedAt = Number.NaN
  #timed = false

  constructor(input: {
    world: World
    log: QuestLog
    player: PlayerState
    hud: Hud
    conditions: Conditions
    /** Where somebody out walking is, for the pins. Nobody is out by default. */
    out?: Whereabouts
    changed?: () => void
  }) {
    this.#world = input.world
    this.#log = input.log
    this.#player = input.player
    this.#hud = input.hud
    this.#conditions = input.conditions
    this.#out = input.out ?? (() => undefined)
    this.#changed = input.changed ?? (() => {})
  }

  /**
   * The quest the player chose to follow, echoed back to the interface and
   * written down: which job they are on is part of the playthrough, so a
   * refresh comes back following the same one.
   */
  track(questId: string | null): void {
    this.#tracked = questId
    this.#player.setTracked(questId)
    this.#hud.show({ trackedQuestId: questId })
  }

  /**
   * The open steps of the quest being followed: what the guide walks to and
   * the compass points at. A quest that has finished is not one to
   * follow, so this falls back to the first quest with an open step exactly as
   * the interface does, and the guide agrees with the panel rather than
   * pointing at a job the player already handed in.
   */
  following(): readonly Objective[] {
    const objectives = this.#log.objectives()
    const chosen = objectives.some((objective) => objective.questId === this.#tracked)
    const tracked = chosen ? this.#tracked : objectives[0]?.questId
    return tracked ? objectives.filter((objective) => objective.questId === tracked) : []
  }

  /** Where the tracked quest is sending the player, found on the city. */
  followed(): Marked[] {
    return marked(this.#world, this.following(), (questId) => this.lineOf(questId), this.#out)
  }

  /** Where every live quest is sending the player, for the plan: the story and the errands apart. */
  goals(): Marked[] {
    return marked(this.#world, this.#log.objectives(), (questId) => this.lineOf(questId), this.#out)
  }

  /** The story or an errand. A quest with no page yet reads as an errand. */
  lineOf(questId: string): QuestKind {
    return this.#log.journal().find((page) => page.questId === questId)?.kind ?? 'side'
  }

  /** A result from the quest log: announce what it changed, or let it go. */
  report(result: Reported): void {
    if (!result.ok) return
    for (const change of result.value) this.announce(change)
    this.refresh()
  }

  announce(change: Change): void {
    const title = (id: string) => this.#log.quests().find((quest) => quest.id === id)?.title ?? 'a job'
    if (change.kind === 'quest-started') this.#hud.announce({ kind: 'quest-started', title: title(change.questId) })
    if (change.kind === 'quest-complete') {
      this.#hud.announce({ kind: 'quest-complete', title: title(change.questId), reward: { money: change.reward.money } })
    }
    if (change.kind === 'quest-failed') this.#hud.announce({ kind: 'quest-failed', title: title(change.questId) })
    this.refresh()
  }

  /** Say something in passing: a room the player walked into, somebody leaving. */
  note(text: string): void {
    this.#hud.announce({ kind: 'note', text })
  }

  /**
   * The clock moved. The quest log hears the reading first, because a timer
   * counts from the last one it heard, and whatever the reading ended is
   * announced with the list pushed as it stands, the failed page on it. Then
   * the settings tab and the journal are pushed again on a cadence: once a
   * game second while a page is counting down, so the time left moves, and
   * once a game minute otherwise, so the hour reads right for nothing.
   */
  tick(): void {
    const clock = this.#player.clock
    const result = this.#log.handle({ kind: 'clock', seconds: clock.totalSeconds })
    if (result.ok && result.value.length > 0) {
      this.report(result)
      return
    }
    const at = this.#timed ? clock.totalSeconds : Math.floor(clock.totalSeconds / 60)
    if (at === this.#pushedAt) return
    this.#pushedAt = at
    const quests = this.#log.journal()
    this.#timed = quests.some((page) => page.timer !== undefined)
    this.#hud.show({ settings: this.#conditions.view(), quests })
  }

  refresh(): void {
    const carrying: Carried[] = this.#player.inventory().map((id) => ({
      id,
      name: this.#world.item(id)?.name ?? id,
      quest: this.#log.isQuestItem(id),
    }))
    // the quests tab is the quest log's own journal page, pushed as it stands:
    // a page carries what the engine kept, secrets, timers and endings and all
    const quests = this.#log.journal()
    this.#timed = quests.some((page) => page.timer !== undefined)
    this.#hud.show({
      objectives: this.#log.objectives(),
      money: this.#player.money,
      carrying,
      quests,
      codex: codexOf(this.#world, this.#player),
      settings: this.#conditions.view(),
    })
    this.#changed()
  }
}
