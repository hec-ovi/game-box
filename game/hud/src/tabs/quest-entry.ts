import { el } from '../dom.ts'
import type { HudIntent, QuestEntry } from '../types.ts'
import { DROPPED_TAG, STEP_MARK, stateOf, titleOf } from './journal.ts'

const FOLLOW = { on: 'Following', off: 'Follow' } as const
const GIVE_UP = { armed: 'Give up?', idle: 'Give up' } as const

/**
 * One quest in the journal: every step and where it stands, which quest the
 * corner panel follows, and the way out of one. Giving up costs the player the
 * progress they made, so the button asks a second time before it reports it.
 */
export class QuestEntryView {
  readonly node = el('article', 'gb-quest-entry')
  #quest: QuestEntry
  #title: string
  #emit: (intent: HudIntent) => void
  #giveUp = button('gb-give-up')
  #armed = false

  constructor(quest: QuestEntry, tracked: boolean, emit: (intent: HudIntent) => void) {
    this.#quest = quest
    this.#title = titleOf(quest)
    this.#emit = emit
    this.node.dataset.tracked = String(tracked)

    const acts = el('div', 'gb-quest-acts')
    acts.append(this.#follow(tracked), this.#giveUp)
    const head = el('header', 'gb-quest-head')
    head.append(el('h3', undefined, this.#title), acts)

    this.#draw()
    this.#giveUp.addEventListener('click', () => this.#ask())
    // Walking away from the button is answering no, so a stray Enter later
    // cannot land on a question the player has stopped reading.
    this.#giveUp.addEventListener('blur', () => this.#arm(false))

    this.node.append(head, this.#steps())
  }

  #follow(tracked: boolean): HTMLButtonElement {
    const node = button('gb-track')
    node.setAttribute('aria-pressed', String(tracked))
    node.setAttribute('aria-label', `${tracked ? 'Stop following' : 'Follow'} ${this.#title}`)
    node.textContent = tracked ? FOLLOW.on : FOLLOW.off
    node.addEventListener('click', () => {
      this.#emit({ kind: 'track', questId: tracked ? null : this.#quest.questId })
    })
    return node
  }

  #steps(): HTMLUListElement {
    const list = el('ul')
    for (const step of this.#quest.steps) {
      const state = stateOf(step)
      const item = el('li', `gb-step-${state}`)
      item.append(el('span', 'gb-mark', STEP_MARK[state]), el('span', 'gb-what', step.text))
      // A branch nobody took is part of the story, so it stays on the page and
      // says in words that it is not work waiting to be done.
      if (state === 'dropped') item.append(el('span', 'gb-tag', DROPPED_TAG))
      list.append(item)
    }
    return list
  }

  #ask(): void {
    if (!this.#armed) {
      this.#arm(true)
      return
    }
    this.#arm(false)
    this.#emit({ kind: 'abandon', questId: this.#quest.questId })
  }

  #arm(armed: boolean): void {
    if (armed === this.#armed) return
    this.#armed = armed
    this.#draw()
  }

  #draw(): void {
    const title = this.#title
    this.#giveUp.dataset.armed = String(this.#armed)
    this.#giveUp.textContent = this.#armed ? GIVE_UP.armed : GIVE_UP.idle
    this.#giveUp.setAttribute('aria-label', this.#armed ? `Confirm giving up ${title}` : `Give up ${title}`)
  }
}

function button(className: string): HTMLButtonElement {
  const node = el('button', className)
  node.type = 'button'
  return node
}
