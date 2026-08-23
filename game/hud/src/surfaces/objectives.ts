import type { Objective } from '@gb/quest'
import { HUD_KEYS } from '../controls.ts'
import { el } from '../dom.ts'
import { noObjectives } from '../phrase.ts'
import { otherQuests, stepsOf, trackedQuest } from '../tracked.ts'
import type { HudState } from '../types.ts'
import { MoreLine } from './more.ts'
import type { Surface } from './surface.ts'

/**
 * What the player is meant to be doing right now: the quest they are following
 * and its open steps, never the whole log. Ten quests at once is a list taller
 * than the screen, so the rest are one line pointing at the quests tab.
 */
export class ObjectivesSurface implements Surface {
  readonly node = el('section', 'gb-objectives')
  #quest = el('span', 'gb-quest')
  #list = el('ul')
  #more = new MoreLine(HUD_KEYS.quests)
  #key: string | null = null
  /** How far each step had got last time, so a count that moves says so. */
  #done = new Map<string, number>()

  constructor() {
    this.node.setAttribute('aria-label', 'Objectives')
    const head = el('header', 'gb-objectives-head')
    head.append(el('h2', undefined, 'Objectives'), this.#quest)
    this.node.append(head, this.#list, this.#more.node)
  }

  render(state: HudState): void {
    const tracked = trackedQuest(state)
    const steps = stepsOf(state, tracked)
    const rest = otherQuests(state, tracked)
    const key = `${rest}#${state.hadQuest}#${steps.map(signature).join('|')}`
    if (key === this.#key) return
    this.#key = key

    this.#quest.textContent = steps[0]?.questTitle ?? ''
    this.#list.replaceChildren(
      ...(steps.length ? steps.map((step) => this.#line(step)) : [el('li', 'gb-empty', noObjectives(state.hadQuest))]),
    )
    this.#more.set(rest > 0 ? `${rest} more quest${rest === 1 ? '' : 's'}` : null)
    this.#done = new Map(steps.flatMap((step) => (step.count ? [[id(step), step.count.done] as const] : [])))
  }

  #line(step: Objective): HTMLLIElement {
    const item = el('li')
    if (step.optional) item.dataset.optional = 'true'
    if (step.count && step.count.needed > 1) {
      item.dataset.counted = 'true'
      const count = el('span', 'gb-count', `${step.count.done}/${step.count.needed}`)
      // A count that just moved is the one thing on this panel that changed.
      const was = this.#done.get(id(step))
      if (was !== undefined && step.count.done > was) count.dataset.flash = 'up'
      item.append(count)
    }
    item.append(el('span', 'gb-what', step.text))
    if (step.optional) item.append(el('span', 'gb-tag', 'Optional'))
    if (step.hint) item.append(el('span', 'gb-hint', step.hint))
    return item
  }
}

function id(step: Objective): string {
  return `${step.questId}/${step.stepId}`
}

function signature(step: Objective): string {
  const count = step.count ? `${step.count.done}/${step.count.needed}` : ''
  return `${id(step)}/${step.text}/${count}/${step.optional ? 'o' : ''}/${step.hint ?? ''}`
}
