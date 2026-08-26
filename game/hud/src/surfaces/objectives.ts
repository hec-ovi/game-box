import type { Objective } from '@gb/quest'
import { HUD_KEYS } from '../controls.ts'
import { el, kbd } from '../dom.ts'
import { bump } from '../motion.ts'
import { DECIDE_TAG, moreQuests, noObjectives } from '../phrase.ts'
import { kindOf, mainWaiting, otherQuests, stepsOf, trackedQuest } from '../tracked.ts'
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
      this.#key = undefined
      this.node.dataset.mode = 'caller'
      this.node.dataset.line = 'caller'
      this.#head.hidden = true
      this.#more.node.hidden = true
      this.#list.replaceChildren(this.#callerCard(state.talk.speaker, state.talk.pending))
      return
    }

    this.#head.hidden = false
    this.#more.node.hidden = false
    this.node.dataset.mode = 'objectives'
    const tracked = trackedQuest(state)
    const steps = stepsOf(state, tracked)
    const rest = otherQuests(state, tracked)
    const waiting = mainWaiting(state, tracked)
    const main = kindOf(state, tracked) === 'main'
    const key = `${rest}#${state.hadQuest}#${main}#${waiting}#${steps.map(signature).join('|')}`
    if (key === this.#key) return
    this.#key = key

    this.node.dataset.line = main ? 'main' : 'side'
    this.#line.replaceChildren(icon(main ? 'quest-main' : 'quest-side', ICON_PX.line))
    this.#quest.textContent = steps[0]?.questTitle ?? ''
    // Following the story says so; following an errand says the story is there.
    this.#main.hidden = !main
    this.#list.replaceChildren(
      ...(steps.length
        ? steps.map((step) => this.#step(step))
        : [el('li', 'gb-empty gb-t3', noObjectives(state.hadQuest))]),
    )
    this.#more.set(moreQuests(rest, waiting))
    this.#done = new Map(steps.flatMap((step) => (step.count ? [[id(step), step.count.done] as const] : [])))
  }

  #callerCard(speaker: string, pending: boolean): HTMLLIElement {
    const item = el('li', 'gb-caller-card')
    const avatar = el('div', 'gb-caller-avatar-box')
    avatar.innerHTML = `
      <svg viewBox="0 0 100 100" class="gb-portrait-svg">
        <defs>
          <linearGradient id="cyber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2fd9e6" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#00e676" stop-opacity="0.3"/>
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="90" height="90" fill="none" stroke="var(--gb-edge-accent)" stroke-width="1.5" />
        <line x1="2" y1="20" x2="2" y2="5" stroke="var(--gb-accent)" stroke-width="2"/>
        <line x1="2" y1="5" x2="20" y2="5" stroke="var(--gb-accent)" stroke-width="2"/>
        <line x1="98" y1="20" x2="98" y2="5" stroke="var(--gb-accent)" stroke-width="2"/>
        <line x1="98" y1="5" x2="80" y2="5" stroke="var(--gb-accent)" stroke-width="2"/>
        <line x1="2" y1="80" x2="2" y2="95" stroke="var(--gb-accent)" stroke-width="2"/>
        <line x1="2" y1="95" x2="20" y2="95" stroke="var(--gb-accent)" stroke-width="2"/>
        <line x1="98" y1="80" x2="98" y2="95" stroke="var(--gb-accent)" stroke-width="2"/>
        <line x1="98" y1="95" x2="80" y2="95" stroke="var(--gb-accent)" stroke-width="2"/>
        <path d="M75 88v-8a16 16 0 0 0-16-16H41a16 16 0 0 0-16 16v8" stroke="var(--gb-dim)" stroke-width="2.5" fill="none"/>
        <circle cx="50" cy="40" r="16" stroke="var(--gb-dim)" stroke-width="2.5" fill="url(#cyber-grad)"/>
      </svg>
    `
    const name = el('span', 'gb-caller-name gb-t2', speaker)
    const voice = el('div', 'gb-caller-voice-wave')
    for (let i = 0; i < 14; i++) {
      const bar = el('span', 'gb-v-bar')
      bar.style.animationDelay = `${(i * 0.08).toFixed(2)}s`
      voice.append(bar)
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
