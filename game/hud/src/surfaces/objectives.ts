import type { Objective } from '@gb/quest'
import { HUD_KEYS } from '../controls.ts'
import { el, kbd } from '../dom.ts'
import { DECIDE_TAG, MAIN_TAG, moreQuests, noObjectives } from '../phrase.ts'
import { kindOf, mainWaiting, otherQuests, stepsOf, trackedQuest } from '../tracked.ts'
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
  #main = el('span', 'gb-tag gb-main', MAIN_TAG)
  #list = el('ul')
  #more = new MoreLine(HUD_KEYS.quests)
  #key: string | null = null
  /** How far each step had got last time, so a count that moves says so. */
  #done = new Map<string, number>()

  constructor() {
    this.node.setAttribute('aria-label', 'Objectives')
    const head = el('header', 'gb-objectives-head')
    this.#main.hidden = true
    head.append(el('h2', undefined, 'Objectives'), this.#quest, this.#main)
    this.node.append(head, this.#list, this.#more.node)
  }

  render(state: HudState): void {
    const tracked = trackedQuest(state)
    const steps = stepsOf(state, tracked)
    const rest = otherQuests(state, tracked)
    const waiting = mainWaiting(state, tracked)
    const main = kindOf(state, tracked) === 'main'
    const key = `${rest}#${state.hadQuest}#${main}#${waiting}#${steps.map(signature).join('|')}`
    if (key === this.#key) return
    this.#key = key

    this.#quest.textContent = steps[0]?.questTitle ?? ''
    // Following the story says so; following an errand says the story is there.
    this.#main.hidden = !main
    this.#list.replaceChildren(
      ...(steps.length ? steps.map((step) => this.#line(step)) : [el('li', 'gb-empty', noObjectives(state.hadQuest))]),
    )
    this.#more.set(moreQuests(rest, waiting))
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
    // A decision is answered in the journal, so the panel says so and prints
    // the key: nothing in the corner takes a click.
    if (step.choice) item.append(decide())
    if (step.hint) item.append(el('span', 'gb-hint', step.hint))
    return item
  }
}

function decide(): HTMLElement {
  const node = el('span', 'gb-decide')
  node.append(el('span', 'gb-tag', DECIDE_TAG), kbd(HUD_KEYS.quests))
  return node
}

function id(step: Objective): string {
  return `${step.questId}/${step.stepId}`
}

function signature(step: Objective): string {
  const count = step.count ? `${step.count.done}/${step.count.needed}` : ''
  return `${id(step)}/${step.text}/${count}/${step.optional ? 'o' : ''}/${step.choice ? 'd' : ''}/${step.hint ?? ''}`
}
