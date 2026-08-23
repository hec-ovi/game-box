import { el } from '../dom.ts'
import { trackedQuest } from '../tracked.ts'
import type { HudIntent, HudState, HudWindowName, QuestEntry } from '../types.ts'
import type { Tab } from './tab.ts'

const NONE = 'No quests yet. Find someone with work.'

/**
 * Everything under way and how far each one got, and the one control the
 * journal needs: which quest the objectives panel follows.
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
    const key = `${tracked ?? ''}#${state.quests.map(signature).join('|')}`
    if (key === this.#key) return
    this.#key = key
    this.node.replaceChildren(
      ...(state.quests.length
        ? state.quests.map((quest) => this.#entry(quest, quest.questId === tracked))
        : [el('p', 'gb-empty', NONE)]),
    )
  }

  clear(): void {
    this.#key = null
    this.node.replaceChildren()
  }

  #entry(quest: QuestEntry, tracked: boolean): HTMLElement {
    const node = el('article', 'gb-quest-entry')
    node.dataset.tracked = String(tracked)

    const follow = el('button', 'gb-track')
    follow.type = 'button'
    follow.setAttribute('aria-pressed', String(tracked))
    follow.setAttribute('aria-label', `${tracked ? 'Stop following' : 'Follow'} ${quest.title}`)
    follow.textContent = tracked ? 'Following' : 'Follow'
    follow.addEventListener('click', () => this.#emit({ kind: 'track', questId: tracked ? null : quest.questId }))

    const head = el('header', 'gb-quest-head')
    head.append(el('h3', undefined, quest.title), follow)

    const steps = el('ul')
    for (const step of quest.steps) {
      const item = el('li', step.done ? 'gb-step-done' : 'gb-step-open')
      item.append(el('span', 'gb-mark', step.done ? '✓' : '·'), el('span', 'gb-what', step.text))
      steps.append(item)
    }
    node.append(head, steps)
    return node
  }
}

function signature(quest: QuestEntry): string {
  return `${quest.questId}/${quest.title}/${quest.steps.map((s) => `${s.stepId}${s.done ? '+' : '-'}`).join(',')}`
}
