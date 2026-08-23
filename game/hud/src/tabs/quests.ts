import { el } from '../dom.ts'
import { noQuests } from '../phrase.ts'
import { trackedQuest } from '../tracked.ts'
import type { HudIntent, HudState, HudWindowName, QuestEntry, QuestStep } from '../types.ts'
import { QuestEntryView } from './quest-entry.ts'
import { stateOf, storyFirst, titleOf } from './journal.ts'
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
    const pages = storyFirst(state.quests)
    const key = `${tracked ?? ''}#${state.hadQuest}#${pages.map(signature).join('|')}`
    if (key === this.#key) return
    this.#key = key
    this.node.replaceChildren(
      ...(pages.length
        ? pages.map((quest) => new QuestEntryView(quest, quest.questId === tracked, this.#emit).node)
        : [el('p', 'gb-empty', noQuests(state.hadQuest))]),
    )
  }

  clear(): void {
    this.#key = null
    this.node.replaceChildren()
  }
}

function signature(quest: QuestEntry): string {
  return `${quest.questId}/${titleOf(quest)}/${quest.kind ?? ''}/${quest.steps.map(step).join(',')}`
}

function step(s: QuestStep): string {
  return `${s.stepId}:${stateOf(s)}:${s.choice?.prompt ?? ''}`
}
