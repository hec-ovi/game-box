import { el } from '../dom.ts'
import { DROPPED_TAG, FAIL_REASON, MAIN_TAG, STATUS_TAG } from '../phrase.ts'
import type { HudIntent, QuestEntry } from '../types.ts'
import { ChoiceView } from './choice.ts'
import { STEP_MARK, stateOf, statusOf, titleOf } from './journal.ts'
import { TimerView } from './timer.ts'

const TRACK = { on: 'Tracking', off: 'Track' } as const
const GIVE_UP = { armed: 'Give up?', idle: 'Give up' } as const

/**
 * One quest in the journal: every step and where it stands, how the quest
 * itself stands, the clock on it when it has one, which quest the corner panel
 * follows, and the way out of one. Only a live quest can be tracked or given
 * up, so a finished or failed page carries its tag, its reason, and no
 * buttons. Giving up costs the player the progress they made, so the button
 * asks a second time before it reports it.
 */
export class QuestEntryView {
  readonly node = el('article', 'gb-quest-entry')
  #quest: QuestEntry
  #title: string
  #emit: (intent: HudIntent) => void
  #giveUp = button('gb-give-up')
  #timer: TimerView | undefined
  #armed = false

  constructor(quest: QuestEntry, tracked: boolean, emit: (intent: HudIntent) => void) {
    this.#quest = quest
    this.#title = titleOf(quest)
    this.#emit = emit
    const status = statusOf(quest)
    this.node.dataset.tracked = String(tracked)
    this.node.dataset.status = status

    const name = el('div', 'gb-quest-name')
    name.append(el('h3', undefined, this.#title))
    // The story says so on the page; an errand is everything that does not.
    if (quest.kind === 'main') name.append(el('span', 'gb-tag gb-main', MAIN_TAG))
    const tag = STATUS_TAG[status]
    if (tag) name.append(el('span', `gb-tag gb-status-${status}`, tag))
    const head = el('header', 'gb-quest-head')
    head.append(name)
    if (status === 'active') head.append(this.#acts(tracked))

    this.node.append(head)
    if (status === 'failed' && quest.failReason) this.node.append(el('p', 'gb-quest-reason', FAIL_REASON[quest.failReason]))
    if (quest.timer && status === 'active') {
      this.#timer = new TimerView()
      this.node.append(this.#timer.node)
      this.#timer.set(quest.timer)
    }
    this.node.append(this.#steps())
  }

  /** The clock moved on a push: written in place, nothing else redrawn. */
  tick(quest: QuestEntry): void {
    if (quest.timer) this.#timer?.set(quest.timer)
  }

  #acts(tracked: boolean): HTMLElement {
    const acts = el('div', 'gb-quest-acts')
    acts.append(this.#track(tracked), this.#giveUp)
    this.#draw()
    this.#giveUp.addEventListener('click', () => this.#ask())
    // Walking away from the button is answering no, so a stray Enter later
    // cannot land on a question the player has stopped reading.
    this.#giveUp.addEventListener('blur', () => this.#arm(false))
    return acts
  }

  #track(tracked: boolean): HTMLButtonElement {
    const node = button('gb-track')
    node.setAttribute('aria-pressed', String(tracked))
    node.setAttribute('aria-label', `${tracked ? 'Stop tracking' : 'Track'} ${this.#title}`)
    node.textContent = tracked ? TRACK.on : TRACK.off
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
      // The question is asked only where it can be answered: the step the flow
      // is standing on. Anywhere else there is nothing to click, so a decision
      // that has been made or has not come up cannot be sent at all.
      if (step.choice && state === 'open') {
        item.append(new ChoiceView(this.#quest.questId, step.stepId, step.choice, this.#emit).node)
      }
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
