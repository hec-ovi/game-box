import { el } from '../dom.ts'
import { DROPPED_TAG, FAIL_REASON, STATUS_TAG } from '../phrase.ts'
import type { HudIntent, QuestEntry, QuestStatus } from '../types.ts'
import { act } from '../ui/act.ts'
import { chip, mainChip } from '../ui/chip.ts'
import { Meter } from '../ui/meter.ts'
import { Row } from '../ui/row.ts'
import { ChoiceView } from './choice.ts'
import { progress, stateOf, statusOf, stepMark, titleOf } from './journal.ts'
import { TimerView } from './timer.ts'

const TRACK = { on: 'Tracking', off: 'Track' } as const
const GIVE_UP = { armed: 'Give up?', idle: 'Give up' } as const

/**
 * One quest in the journal: the page's own row, with the kind's icon, the step
 * under way beneath the title, how far it has got as a bar, and the two things
 * that can be done to it; then every step and where it stands, the clock when
 * it has one, and the question when the flow is standing on one.
 *
 * Only a live quest can be tracked or given up, so a finished or failed page
 * carries its chip, its reason, and no buttons. Giving up costs the player the
 * progress they made, so the button asks a second time before it reports it.
 */
export class QuestEntryView {
  readonly node = el('article', 'gb-quest-entry gb-cut')
  #quest: QuestEntry
  #title: string
  #emit: (intent: HudIntent) => void
  #giveUp = act({ label: GIVE_UP.idle, icon: 'close' })
  #timer: TimerView | undefined
  #armed = false

  constructor(quest: QuestEntry, tracked: boolean, emit: (intent: HudIntent) => void) {
    this.#quest = quest
    this.#title = titleOf(quest)
    this.#emit = emit
    const status = statusOf(quest)
    const main = quest.kind === 'main'
    this.node.dataset.tracked = String(tracked)
    this.node.dataset.status = status

    // The steps are listed right below, so the line under the title is what
    // they do not say: why a page that failed ended.
    const row = new Row({
      icon: main ? 'quest-main' : 'quest-side',
      title: this.#title,
      line: status === 'failed' && quest.failReason ? FAIL_REASON[quest.failReason] : undefined,
      className: 'gb-quest-row',
    })
    row.chosen(tracked)
    row.keyLine(main ? 'main' : tracked ? 'on' : status === 'failed' ? 'bad' : null)
    row.done(status === 'complete')
    // The story says so on the page; an errand is everything that does not.
    if (main) row.state.append(mainChip())
    const tag = STATUS_TAG[status]
    if (tag) row.state.append(endedChip(status, tag))
    if (status === 'active') this.#counted(row, main)
    if (status === 'active') this.#acts(row, tracked)
    this.node.append(row.node)

    const body = el('div', 'gb-quest-body')
    if (quest.timer && status === 'active') {
      this.#timer = new TimerView()
      body.append(this.#timer.node)
      this.#timer.set(quest.timer)
    }
    body.append(this.#steps())
    this.node.append(body)
  }

  /** The clock moved on a push: written in place, nothing else redrawn. */
  tick(quest: QuestEntry): void {
    if (quest.timer) this.#timer?.set(quest.timer)
  }

  /** How far the page has got, as a bar with its count beside it. */
  #counted(row: Row, main: boolean): void {
    const at = progress(this.#quest)
    if (at.needed === 0) return
    const meter = new Meter()
    meter.tone(main ? 'main' : 'accent')
    meter.set(at.done / at.needed)
    row.state.append(meter.node, el('span', 'gb-num gb-t1', `${at.done}/${at.needed}`))
  }

  #acts(row: Row, tracked: boolean): void {
    row.act(this.#track(tracked))
    row.act(this.#giveUp)
    this.#draw()
    this.#giveUp.addEventListener('click', () => this.#ask())
    // Walking away from the button is answering no, so a stray Enter later
    // cannot land on a question the player has stopped reading.
    this.#giveUp.addEventListener('blur', () => this.#arm(false))
  }

  #track(tracked: boolean): HTMLButtonElement {
    const node = act({
      label: tracked ? TRACK.on : TRACK.off,
      icon: 'pin',
      lit: !tracked,
      aria: `${tracked ? 'Stop tracking' : 'Track'} ${this.#title}`,
    })
    node.setAttribute('aria-pressed', String(tracked))
    node.addEventListener('click', () => {
      this.#emit({ kind: 'track', questId: tracked ? null : this.#quest.questId })
    })
    return node
  }

  #steps(): HTMLUListElement {
    const list = el('ul', 'gb-steps')
    for (const step of this.#quest.steps) {
      const state = stateOf(step)
      const item = el('li', `gb-step-${state}`)
      item.append(stepMark(state), el('span', 'gb-what gb-t3', step.text))
      // A branch nobody took is part of the story, so it stays on the page and
      // says in words that it is not work waiting to be done.
      if (state === 'dropped') item.append(chip(DROPPED_TAG))
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
    const label = this.#armed ? GIVE_UP.armed : GIVE_UP.idle
    this.#giveUp.classList.toggle('gb-act-armed', this.#armed)
    this.#giveUp.dataset.armed = String(this.#armed)
    const words = this.#giveUp.querySelector('span')
    if (words) words.textContent = label
    this.#giveUp.setAttribute('aria-label', this.#armed ? `Confirm giving up ${title}` : `Give up ${title}`)
  }
}

/** How a quest that ended reads: finished in good, failed warned. */
function endedChip(status: QuestStatus, tag: string): HTMLElement {
  return status === 'failed' ? chip(tag, 'bad', 'warn') : chip(tag, 'good', 'check')
}
