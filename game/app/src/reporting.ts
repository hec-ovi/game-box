import type { Carried, Hud, OwnedPlace, SettingsView } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { Change, Objective, QuestKind, QuestLog, Reward } from '@gb/quest'
import type { World } from '@gb/world'
import { codexOf } from './codex.ts'
import type { Conditions } from './conditions.ts'
import { marked, offered, type Marked, type Whereabouts } from './places.ts'
import type { View } from './view.ts'

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
  #view: View | undefined
  #out: Whereabouts
  #changed: () => void
  #paid: (reward: Reward) => void
  #tracked: string | null | undefined
  #pushedAt = Number.NaN
  #timed = false

  constructor(input: {
    world: World
    log: QuestLog
    player: PlayerState
    hud: Hud
    conditions: Conditions
    /** What the player set about the screen. Without one the tab reads its own defaults: the corner view on, the game in a window. */
    view?: View
    /** Where somebody out walking is, for the pins. Nobody is out by default. */
    out?: Whereabouts
    changed?: () => void
    /** A job paid out: what the city and the street have to be told about it. */
    paid?: (reward: Reward) => void
  }) {
    this.#world = input.world
    this.#log = input.log
    this.#player = input.player
    this.#hud = input.hud
    this.#conditions = input.conditions
    this.#view = input.view
    this.#out = input.out ?? (() => undefined)
    this.#changed = input.changed ?? (() => {})
    this.#paid = input.paid ?? (() => {})
  }

  veil(title: string): void {
    try {
      this.#hud.show({ loading: { title, stages: [] } })
      setTimeout(() => {
        try {
          this.#hud.show({ loading: null })
        } catch {
          // Hud was disposed in tests/teardown
        }
      }, 600)
    } catch {
      // Hud was disposed
    }
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

  /** Where there is work to pick up: whoever is holding a job the player has not taken. */
  offers(): Marked[] {
    return offered(this.#world, this.#log, this.#out)
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
      // the playthrough was paid by the quest log; the house it handed over and
      // the car it put on the street are the city's and are written here
      this.#paid(change.reward)
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
    this.#hud.show({ settings: this.#settings(), quests })
  }

  /** The clock, the sky and the screen, which the tab reads as one. */
  #settings(): SettingsView {
    return { ...this.#conditions.view(), ...(this.#view ? this.#view.settings : {}) }
  }

  refresh(): void {
    const carrying: Carried[] = this.#player.inventory().map((id) => this.#carried(id))
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
      homes: this.#homes(),
      settings: this.#settings(),
    })
    this.#changed()
  }

  /** A thing in hand, with what it is worth and whether a live job wants it. */
  #carried(itemId: string): Carried {
    const item = this.#world.item(itemId)
    return {
      id: itemId,
      name: item?.name ?? itemId,
      quest: this.#log.isQuestItem(itemId),
      ...(item?.value !== undefined ? { value: item.value } : {}),
    }
  }

  /** The places the player holds the deed to, and what they have left standing in each. */
  #homes(): OwnedPlace[] {
    return this.#world.homes().map((interior) => {
      const plot = this.#world.plot(interior.plotId)
      const label = this.#world.charter(interior.kind)?.label
      return {
        id: interior.id,
        name: plot?.name ?? interior.id,
        ...(label ? { text: `Your ${label}` } : {}),
        placed: this.#player.placedIn(interior.id).map((left) => this.#carried(left.itemId)),
      }
    })
  }
}
