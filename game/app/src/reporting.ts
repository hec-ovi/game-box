import type { Carried, Hud, QuestEntry } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { Change, QuestLog } from '@gb/quest'
import type { World } from '@gb/world'

/** What a box handed back: changes to announce, or an error to let go. */
export type Reported = { ok: true; value: readonly Change[] } | { ok: false; error: unknown }

/**
 * What the player reads: the objectives, the purse, what they are carrying, the
 * quest list, and a line whenever a quest turns. The hud never asks; it is
 * pushed the whole state every time any of it moves.
 */
export class Reporting {
  #world: World
  #log: QuestLog
  #player: PlayerState
  #hud: Hud
  #changed: () => void

  constructor(input: { world: World; log: QuestLog; player: PlayerState; hud: Hud; changed?: () => void }) {
    this.#world = input.world
    this.#log = input.log
    this.#player = input.player
    this.#hud = input.hud
    this.#changed = input.changed ?? (() => {})
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

  refresh(): void {
    const carrying: Carried[] = this.#player.inventory().map((id) => ({
      id,
      name: this.#world.item(id)?.name ?? id,
      quest: this.#log.isQuestItem(id),
    }))
    this.#hud.show({ objectives: this.#log.objectives(), money: this.#player.money, carrying, quests: this.#quests() })
    this.#changed()
  }

  /** Every quest under way, with the steps behind and ahead of the player. */
  #quests(): QuestEntry[] {
    const open = new Set(this.#log.objectives().map((objective) => objective.stepId))
    return this.#log
      .quests()
      .filter((quest) => this.#log.status(quest.id) === 'active')
      .map((quest) => ({
        questId: quest.id,
        title: quest.title,
        steps: quest.steps
          .filter((step) => step.kind !== 'complete' && step.kind !== 'fail' && step.kind !== 'join')
          .map((step) => ({ stepId: step.id, text: step.objective, done: !open.has(step.id) })),
      }))
  }
}
