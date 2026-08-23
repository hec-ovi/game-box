import type { Carried, Hud } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { Change, Objective, QuestLog } from '@gb/quest'
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
  #tracked: string | null | undefined

  constructor(input: { world: World; log: QuestLog; player: PlayerState; hud: Hud; changed?: () => void }) {
    this.#world = input.world
    this.#log = input.log
    this.#player = input.player
    this.#hud = input.hud
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
   * The open steps of the quest being followed: what the map pins and the guide
   * walks to. A quest that has finished is no longer one to follow, so this
   * falls back to the first quest with an open step exactly as the interface
   * does, and the pins agree with the panel rather than pointing at a job the
   * player already handed in.
   */
  following(): readonly Objective[] {
    const objectives = this.#log.objectives()
    const chosen = objectives.some((objective) => objective.questId === this.#tracked)
    const tracked = chosen ? this.#tracked : objectives[0]?.questId
    return tracked ? objectives.filter((objective) => objective.questId === tracked) : []
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
    // the quests tab is the quest log's own journal page, pushed as it stands.
    // Walking the progress by hand instead is what dropped `state`, `optional`
    // and `count` on the floor and listed a secret from the moment the quest
    // was taken: a page carries what the engine kept, secrets and all.
    this.#hud.show({ objectives: this.#log.objectives(), money: this.#player.money, carrying, quests: this.#log.journal() })
    this.#changed()
  }
}
