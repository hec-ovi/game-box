import type { Objective } from '@gb/quest'
import { HUD_KEYS } from '../controls.ts'
import { el, kbd, svg } from '../dom.ts'
import { bump } from '../motion.ts'
import { DECIDE_TAG, mainStarts, moreQuests, noObjectives } from '../phrase.ts'
import { kindOf, mainOffer, mainWaiting, otherQuests, stepsOf, trackedQuest } from '../tracked.ts'
import type { HudState } from '../types.ts'
import { chip, mainChip } from '../ui/chip.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { MoreLine } from './more.ts'
import type { Surface } from './surface.ts'

/**
 * What the player is meant to be doing right now: the quest they are following
 * and its open steps, never the whole log. Ten quests at once is a list taller
 * than the screen, so the rest are one line pointing at the quests tab.
 *
 * The step they are on wears the pointer; a count that climbs says so once.
 */
export class ObjectivesSurface implements Surface {
  readonly node = el('section', 'gb-objectives gb-plate gb-cut gb-edged gb-scrolls')
  #head: HTMLElement
  #line = el('span', 'gb-objectives-line')
  #quest = el('span', 'gb-quest gb-t1 gb-clip')
  #main = mainChip()
  #list = el('ul')
  #more = new MoreLine(HUD_KEYS.quests)
  #key: string | null = null
  /** How far each step had got last time, so a count that moves says so. */
  #done = new Map<string, number>()

  constructor() {
    this.node.setAttribute('aria-label', 'Objectives')
    this.#head = el('header', 'gb-objectives-head')
    this.#main.hidden = true
    this.#head.append(this.#line, el('h2', 'gb-t1', 'Objectives'), this.#quest, this.#main)
    this.node.append(this.#head, this.#list, this.#more.node)
  }

  render(state: HudState): void {
    if (state.talk) {
      this.#key = null
      this.node.dataset.mode = 'caller'
      this.node.dataset.line = 'caller'
      this.#head.hidden = true
      this.#more.node.hidden = true
      this.#list.replaceChildren(this.#callerCard(state.talk.speaker, state.talk.pending, state.talk.portrait))
      return
    }

    this.#head.hidden = false
    this.#more.node.hidden = false
    this.node.dataset.mode = 'objectives'
    const tracked = trackedQuest(state)
    const steps = stepsOf(state, tracked)
    const rest = otherQuests(state, tracked)
    const waiting = mainWaiting(state, tracked)
    // with nothing open, the story's own next door is what the panel points at,
    // in the giver's name rather than in a sentence about asking around
    const start = steps.length === 0 ? mainOffer(state) : undefined
    const main = start !== undefined || kindOf(state, tracked) === 'main'
    const key = `${rest}#${state.hadQuest}#${main}#${waiting}#${start?.id ?? ''}#${steps.map(signature).join('|')}`
    if (key === this.#key) return
    this.#key = key

    this.node.dataset.line = main ? 'main' : 'side'
    this.#line.replaceChildren(icon(main ? 'quest-main' : 'quest-side', ICON_PX.line))
    this.#quest.textContent = start?.title ?? steps[0]?.questTitle ?? ''
    // Following the story says so; following an errand says the story is there.
    this.#main.hidden = !main
    this.#list.replaceChildren(
      ...(steps.length
        ? steps.map((step) => this.#step(step))
        : [el('li', 'gb-empty gb-t3', start ? mainStarts(start.giver, start.place) : noObjectives(state.hadQuest))]),
    )
    this.#more.set(moreQuests(rest, waiting))
    this.#done = new Map(steps.flatMap((step) => (step.count ? [[id(step), step.count.done] as const] : [])))
  }

  /**
   * Who is talking, at the top of the corner the objectives usually hold: their
   * own face where the game has drawn one, the frame it sits in, their name and
   * the bars that move while their line is arriving.
   */
  #callerCard(speaker: string, pending: boolean, portrait: string | undefined): HTMLLIElement {
    const item = el('li', 'gb-caller-card')
    const avatar = el('div', 'gb-caller-avatar-box')
    avatar.append(portrait ? face(portrait, speaker) : silhouette(), corners())
    const name = el('span', 'gb-caller-name gb-t2', speaker)
    const voice = el('div', 'gb-caller-voice-wave')
    voice.dataset.speaking = String(pending)
    for (let bar = 0; bar < VOICE_BARS; bar++) {
      const tick = el('span', 'gb-v-bar')
      tick.style.animationDelay = `${(bar * 0.08).toFixed(2)}s`
      voice.append(tick)
    }
    item.append(avatar, name, voice)
    return item
  }

  #step(step: Objective): HTMLLIElement {
    const item = el('li')
    if (step.optional) item.dataset.optional = 'true'
    item.append(el('span', 'gb-pip'))
    if (step.count && step.count.needed > 1) {
      item.dataset.counted = 'true'
      const count = el('span', 'gb-count gb-num gb-t2', `${step.count.done}/${step.count.needed}`)
      // A count that just moved is the one thing on this panel that changed.
      const was = this.#done.get(id(step))
      if (was !== undefined && step.count.done > was) bump(count)
      item.append(count)
    }
    item.append(el('span', 'gb-what gb-t3', step.text))
    if (step.optional) item.append(chip('Optional'))
    // A decision is answered in the journal, so the panel says so and prints
    // the key: nothing in the corner takes a click.
    if (step.choice) item.append(decide())
    if (step.hint) item.append(el('span', 'gb-hint-line gb-t2', step.hint))
    return item
  }
}

/** How many bars the voice line is drawn with. */
const VOICE_BARS = 14

/** The speaker's own face, drawn by the game from their body. */
function face(portrait: string, speaker: string): HTMLImageElement {
  const node = document.createElement('img')
  node.className = 'gb-caller-face'
  node.src = portrait
  node.alt = speaker
  node.decoding = 'async'
  return node
}

/** Nobody in particular, for whoever the game has not drawn a face for yet. */
function silhouette(): SVGSVGElement {
  const node = svg('svg', { viewBox: '0 0 100 100', class: 'gb-portrait-svg', 'aria-hidden': 'true' })
  node.append(
    svg('path', { class: 'gb-portrait-shoulders', d: 'M75 88v-8a16 16 0 0 0-16-16H41a16 16 0 0 0-16 16v8' }),
    svg('circle', { class: 'gb-portrait-head', cx: 50, cy: 40, r: 16 }),
  )
  return node
}

/** The frame round the face: a cut corner at each end, drawn over whatever is inside it. */
function corners(): SVGSVGElement {
  const node = svg('svg', { viewBox: '0 0 100 100', class: 'gb-portrait-frame', 'aria-hidden': 'true' })
  node.append(svg('rect', { class: 'gb-portrait-edge', x: 5, y: 5, width: 90, height: 90 }))
  for (const [x, y, ax, ay] of [
    [2, 5, 20, 5],
    [98, 5, 80, 5],
    [2, 95, 20, 95],
    [98, 95, 80, 95],
  ] as const) {
    node.append(svg('path', { class: 'gb-portrait-corner', d: `M ${x} ${y < 50 ? y + 15 : y - 15} L ${x} ${y} L ${ax} ${ay}` }))
  }
  return node
}

function decide(): HTMLElement {
  const node = el('span', 'gb-decide')
  node.append(chip(DECIDE_TAG, 'accent'), kbd(HUD_KEYS.quests))
  return node
}

function id(step: Objective): string {
  return `${step.questId}/${step.stepId}`
}

function signature(step: Objective): string {
  const count = step.count ? `${step.count.done}/${step.count.needed}` : ''
  return `${id(step)}/${step.text}/${count}/${step.optional ? 'o' : ''}/${step.choice ? 'd' : ''}/${step.hint ?? ''}`
}
