import type { Objective } from '@gb/quest'
import { el } from '../dom.ts'
import type { HudState } from '../types.ts'
import type { Surface } from './surface.ts'

const NOTHING = 'Nothing yet. Find someone to talk to.'

/** What the player is meant to be doing, one line per open step. */
export class ObjectivesSurface implements Surface {
  readonly node = el('section', 'gb-objectives')
  #list = el('ul')
  #key: string | null = null

  constructor() {
    this.node.setAttribute('aria-label', 'Objectives')
    this.node.append(el('h2', undefined, 'Objectives'), this.#list)
  }

  render(state: HudState): void {
    const key = state.objectives.map((o) => `${o.questId}/${o.stepId}/${o.text}/${o.hint ?? ''}`).join('|')
    if (key === this.#key) return
    this.#key = key
    this.#list.replaceChildren(
      ...(state.objectives.length ? state.objectives.map(line) : [el('li', 'gb-empty', NOTHING)]),
    )
  }
}

function line(objective: Objective): HTMLLIElement {
  const item = el('li')
  item.append(el('span', 'gb-what', objective.text), el('span', 'gb-quest', objective.questTitle))
  if (objective.hint) item.append(el('span', 'gb-hint', objective.hint))
  return item
}
