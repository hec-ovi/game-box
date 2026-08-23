import { el } from '../dom.ts'
import { noQuests } from '../phrase.ts'
import { trackedQuest } from '../tracked.ts'
import type { HudIntent, HudState, HudWindowName, QuestEntry } from '../types.ts'
import { QuestEntryView } from './quest-entry.ts'
import { stateOf } from './step-state.ts'
import type { Tab } from './tab.ts'

/**
 * Everything under way and how far each one got, with the two controls the
 * journal needs: which quest the objectives panel follows, and giving one up.
 */
export class QuestsTab implements Tab {
  readonly name: HudWindowName = 'quests'
  readonly node = el('div', 'gb-quests')
  #emit: (intent: HudIntent) => void
  #key: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
  }

  render(state: HudState): void {
    const tracked = trackedQuest(state)
    const key = `${tracked ?? ''}#${state.hadQuest}#${state.quests.map(signature).join('|')}`
    if (key === this.#key) return
    this.#key = key
    this.node.replaceChildren(
      ...(state.quests.length
        ? state.quests.map((quest) => new QuestEntryView(quest, quest.questId === tracked, this.#emit).node)
        : [el('p', 'gb-empty', noQuests(state.hadQuest))]),
    )
  }

  clear(): void {
    this.#key = null
    this.node.replaceChildren()
  }
}

function signature(quest: QuestEntry): string {
  return `${quest.questId}/${quest.title}/${quest.steps.map((s) => `${s.stepId}:${stateOf(s)}`).join(',')}`
}
