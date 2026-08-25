import { el } from '../dom.ts'
import { rise } from '../motion.ts'
import { noQuests } from '../phrase.ts'
import { trackedQuest } from '../tracked.ts'
import type { HudIntent, HudState, HudWindowName, QuestEntry, QuestStep } from '../types.ts'
import { QuestEntryView } from './quest-entry.ts'
import { stateOf, statusOf, storyFirst, titleOf } from './journal.ts'
import type { Tab } from './tab.ts'

/**
 * Everything under way and how far each one got, with the two controls the
 * journal needs: which quest the objectives panel follows, and giving one up.
 * Pages are rebuilt when what is written on them changes; a clock ticking on
 * one is written into the page already there.
 */
export class QuestsTab implements Tab {
  readonly name: HudWindowName = 'quests'
  readonly node = el('div', 'gb-quests')
  #emit: (intent: HudIntent) => void
  #pages = new Map<string, QuestEntryView>()
  #key: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
  }

  render(state: HudState): void {
    const tracked = trackedQuest(state)
    const pages = storyFirst(state.quests)
    const key = `${tracked ?? ''}#${state.hadQuest}#${pages.map(signature).join('|')}`
    if (key !== this.#key) {
      this.#key = key
      this.#pages = new Map(pages.map((quest) => [quest.questId, new QuestEntryView(quest, quest.questId === tracked, this.#emit)]))
      const nodes = [...this.#pages.values()].map((page) => page.node)
      nodes.forEach((node, at) => rise(node, at))
      this.node.replaceChildren(...(nodes.length ? nodes : [el('p', 'gb-empty gb-t3', noQuests(state.hadQuest))]))
    }
    for (const quest of pages) this.#pages.get(quest.questId)?.tick(quest)
  }

  clear(): void {
    this.#key = null
    this.#pages.clear()
    this.node.replaceChildren()
  }
}

/** Everything on a page but the clock's reading, which is written in place. */
function signature(quest: QuestEntry): string {
  const clock = quest.timer ? `t${quest.timer.total}` : ''
  return `${quest.questId}/${titleOf(quest)}/${quest.kind ?? ''}/${statusOf(quest)}/${quest.failReason ?? ''}/${clock}/${quest.steps.map(step).join(',')}`
}

function step(s: QuestStep): string {
  return `${s.stepId}:${stateOf(s)}:${s.choice?.prompt ?? ''}`
}
