import { el } from '../dom.ts'
import { rise } from '../motion.ts'
import { MAP_PANELS, STATIONS, STATUS_TAG, mainStarts, stepCount } from '../phrase.ts'
import { progress, stateOf, statusOf, titleOf } from '../tabs/journal.ts'
import type { HudIntent, HudState, QuestEntry, QuestStep, QuestStepState, WorkOffer } from '../types.ts'
import { chip } from '../ui/chip.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { Meter } from '../ui/meter.ts'
import { Row } from '../ui/row.ts'
import { offerRow } from './offer-row.ts'
import { Section } from './section.ts'
import { StationList } from './stations.ts'

/** Which headings are folded away, by name. */
type Fold = 'main' | 'side' | 'stations'

/**
 * Everything there is to read beside the city: the main line with its steps,
 * the side jobs and how each stands, and the stations. A heading carries the
 * jobs already in hand and, under them, the ones still waiting behind somebody's
 * door, so a player who has taken nothing reads where the work is rather than an
 * empty list. Each heading folds away and the fold is the interface's own, so a
 * player who only wants the stations keeps the rest shut.
 *
 * A row picked is the same as a callout picked: it reports what the player
 * wants shown and the game answers with the view and the panel.
 */
export class WorkLists {
  readonly node = el('aside', 'gb-map-work gb-scrolls')
  #emit: (intent: HudIntent) => void
  #main: Section
  #side: Section
  #stations: Section
  #stationList: StationList
  #mainKey: string | null = null
  #sideKey: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.#main = new Section({ title: MAP_PANELS.main, icon: 'quest-main', onToggle: (open) => this.#fold('main', open) })
    this.#side = new Section({ title: MAP_PANELS.side, icon: 'quest-side', onToggle: (open) => this.#fold('side', open) })
    this.#stations = new Section({ title: STATIONS.head, icon: 'station', onToggle: (open) => this.#fold('stations', open) })
    this.#stationList = new StationList(
      (stationId) => emit({ kind: 'travel', stationId }),
      (targetId) => emit({ kind: 'read', targetId }),
    )
    this.#stations.body.append(this.#stationList.node)
    this.node.append(this.#main.node, this.#side.node, this.#stations.node)
  }

  render(state: HudState): void {
    const reading = state.reading?.id
    const main = state.quests.find((quest) => quest.kind === 'main')
    const side = state.quests.filter((quest) => quest.kind !== 'main')
    // the work nobody has taken, split the same way: the story's next door and
    // every errand somebody in town is holding
    const waiting = state.offers.filter((offer) => offer.line === 'main')
    const errands = state.offers.filter((offer) => offer.line !== 'main')
    this.#drawMain(main, waiting, reading)
    this.#drawSide(side, errands, reading)
    const stations = state.map?.stations ?? []
    this.#stations.count(stations.length ? String(stations.length) : null)
    this.#stationList.set(stations, state.map?.boarding, reading)
  }

  clear(): void {
    this.#mainKey = null
    this.#sideKey = null
    this.#main.body.replaceChildren()
    this.#side.body.replaceChildren()
    this.#stationList.clear()
  }

  #fold(which: Fold, open: boolean): void {
    const section = which === 'main' ? this.#main : which === 'side' ? this.#side : this.#stations
    section.open = open
  }

  /**
   * The story: how far it has got and every step it holds, or, with none of it
   * taken, whose door it starts behind. The count is the steps of the job in
   * hand, and how many are waiting when there is none.
   */
  #drawMain(quest: QuestEntry | undefined, waiting: readonly WorkOffer[], reading: string | undefined): void {
    const key = `${quest ? signature(quest) : ''}#${waiting.map(offerKey).join('|')}#${reading ?? ''}`
    if (key === this.#mainKey) return
    this.#mainKey = key
    if (!quest) {
      this.#main.count(waiting.length ? String(waiting.length) : null)
      const start = waiting[0]
      this.#main.body.replaceChildren(
        start ? el('p', 'gb-note gb-t2', mainStarts(start.giver, start.place)) : el('p', 'gb-empty gb-t3', MAP_PANELS.noMain),
        ...this.#offers(waiting, reading),
      )
      return
    }
    const at = progress(quest)
    this.#main.count(at.needed ? `${at.done}/${at.needed}` : null)
    const row = this.#questRow(quest, reading)
    const steps = el('ul', 'gb-steps gb-map-steps')
    const open = quest.steps.findIndex((step) => stateOf(step) === 'open')
    for (const [index, step] of quest.steps.entries()) steps.append(this.#step(step, index === open ? at.done + 1 : 0, at.needed))
    this.#main.body.replaceChildren(row, steps, ...this.#offers(waiting, reading))
  }

  /**
   * The errands: the ones in hand saying how far each got or how it ended, then
   * the ones still waiting with whose door each is behind. The count is both,
   * because that is how many jobs the list is holding.
   */
  #drawSide(quests: readonly QuestEntry[], waiting: readonly WorkOffer[], reading: string | undefined): void {
    const key = `${quests.map(signature).join('|')}#${waiting.map(offerKey).join('|')}#${reading ?? ''}`
    if (key === this.#sideKey) return
    this.#sideKey = key
    const held = quests.length + waiting.length
    this.#side.count(held ? String(held) : null)
    const rows: HTMLElement[] = quests.map((quest, at) => {
      const row = this.#questRow(quest, reading)
      rise(row, at)
      return row
    })
    rows.push(...this.#offers(waiting, reading, quests.length))
    this.#side.body.replaceChildren(...(rows.length ? rows : [el('p', 'gb-empty gb-t3', MAP_PANELS.noSide)]))
  }

  /** The jobs waiting behind somebody's door, one row each, in the order the game sent them. */
  #offers(offers: readonly WorkOffer[], reading: string | undefined, from = 0): HTMLElement[] {
    return offers.map((offer, at) => {
      const row = offerRow(offer, reading, (targetId) => this.#emit({ kind: 'read', targetId }))
      rise(row, from + at)
      return row
    })
  }

  #questRow(quest: QuestEntry, reading: string | undefined): HTMLElement {
    const main = quest.kind === 'main'
    const status = statusOf(quest)
    const row = new Row({ icon: main ? 'quest-main' : 'quest-side', title: titleOf(quest), compact: true })
    row.chosen(quest.questId === reading)
    row.keyLine(main ? 'main' : quest.questId === reading ? 'on' : status === 'failed' ? 'bad' : null)
    row.done(status === 'complete')
    const tag = STATUS_TAG[status]
    if (tag) row.state.append(chip(tag, status === 'failed' ? 'bad' : 'good'))
    else {
      const at = progress(quest)
      if (at.needed) {
        const meter = new Meter()
        meter.tone(main ? 'main' : 'accent')
        meter.set(at.done / at.needed)
        row.state.append(meter.node, el('span', 'gb-num gb-t1', `${at.done}/${at.needed}`))
      }
    }
    const pick = el('button', 'gb-map-pick', titleOf(quest))
    pick.type = 'button'
    pick.addEventListener('click', () => this.#emit({ kind: 'read', targetId: quest.questId }))
    row.titleCell.replaceChildren(pick)
    row.node.dataset.acts = 'true'
    return row.node
  }

  /**
   * One step of the story. The one the player is on says which of how many it
   * is; what is done is ticked and struck through, and what the quest has not
   * reached carries a question mark, because a step nobody has got to is not
   * work waiting, it is not known yet.
   */
  #step(step: QuestStep, at: number, of: number): HTMLLIElement {
    const state = stateOf(step)
    const item = el('li', `gb-step-${state}`)
    item.append(mark(state), el('span', 'gb-what gb-t3', step.text))
    if (state === 'open' && at > 0 && of > 0) item.append(el('span', 'gb-num gb-t1 gb-map-step-at', stepCount(at, of)))
    return item
  }
}

/** The mark in front of a step, in the four states the engine keeps. */
function mark(state: QuestStepState): HTMLElement {
  const node = el('span', 'gb-step-mark')
  if (state === 'done') node.append(icon('check', ICON_PX.line))
  if (state === 'dropped') node.append(icon('close', ICON_PX.line))
  if (state === 'upcoming') {
    node.append(icon('unknown', ICON_PX.line))
    node.setAttribute('aria-label', MAP_PANELS.unreached)
  }
  return node
}

/** Everything on a waiting job's row that changes what it says. */
function offerKey(offer: WorkOffer): string {
  return `${offer.id}/${offer.questId}/${offer.title}/${offer.giver}/${offer.place ?? ''}`
}

/** Everything on a row that changes what it says. */
function signature(quest: QuestEntry): string {
  return `${quest.questId}/${titleOf(quest)}/${statusOf(quest)}/${quest.steps.map((step) => `${step.stepId}:${stateOf(step)}`).join(',')}`
}
