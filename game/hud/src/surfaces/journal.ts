import { el } from '../dom.ts'
import type { HudIntent, HudState, JournalQuest } from '../types.ts'
import type { Surface } from './surface.ts'

/** The quest log the player can open: what is active and how far it got. */
export class JournalSurface implements Surface {
  readonly node = el('section', 'gb-journal')
  #toggle = el('button', 'gb-journal-open', 'Journal')
  #panel = el('div', 'gb-journal-panel')
  #close = el('button', 'gb-journal-close', 'Close')
  #list = el('div', 'gb-journal-list')
  #open = false
  #key: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#toggle.type = 'button'
    this.#close.type = 'button'
    this.#panel.hidden = true
    this.#panel.setAttribute('aria-label', 'Journal')
    this.#panel.append(el('h2', undefined, 'Journal'), this.#list, this.#close)
    this.node.append(this.#toggle, this.#panel)

    this.#toggle.addEventListener('click', () => emit({ kind: 'journal', open: !this.#open }))
    this.#close.addEventListener('click', () => emit({ kind: 'journal', open: false }))
    this.#panel.addEventListener('keydown', (event) => {
      event.stopPropagation()
      if (event.key === 'Escape') emit({ kind: 'journal', open: false })
    })
  }

  render(state: HudState): void {
    this.#toggle.setAttribute('aria-expanded', String(state.journalOpen))
    this.#panel.hidden = !state.journalOpen

    // A closed journal holds no text, so nothing reads a quest that is not on screen.
    const key = state.journalOpen ? state.journal.map(signature).join('|') : null
    if (key !== this.#key) {
      this.#key = key
      this.#list.replaceChildren(
        ...(key === null
          ? []
          : state.journal.length
            ? state.journal.map(entry)
            : [el('p', 'gb-empty', 'No quests yet.')]),
      )
    }
    if (state.journalOpen && !this.#open) this.#close.focus()
    this.#open = state.journalOpen
  }
}

function signature(quest: JournalQuest): string {
  return `${quest.questId}/${quest.title}/${quest.steps.map((s) => `${s.stepId}${s.done ? '+' : '-'}`).join(',')}`
}

function entry(quest: JournalQuest): HTMLElement {
  const node = el('article', 'gb-journal-quest')
  node.append(el('h3', undefined, quest.title))
  const steps = el('ul')
  for (const step of quest.steps) {
    const item = el('li', step.done ? 'gb-step-done' : 'gb-step-open')
    item.append(el('span', 'gb-mark', step.done ? '✓' : '·'), el('span', 'gb-what', step.text))
    steps.append(item)
  }
  node.append(steps)
  return node
}
