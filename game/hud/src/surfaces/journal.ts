import { HUD_KEYS, hintList } from '../controls.ts'
import { el } from '../dom.ts'
import type { HudIntent, HudState, JournalQuest } from '../types.ts'
import type { Surface } from './surface.ts'
import { HudWindow } from './window.ts'

/** The quest log: what is under way and how far each one got. */
export class JournalSurface implements Surface {
  #window: HudWindow
  #list = el('div', 'gb-journal-list')
  #key: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#window = new HudWindow({
      className: 'gb-journal',
      title: 'Journal',
      onClose: () => emit({ kind: 'journal', open: false }),
      // A window nobody can see holds no text, so nothing reads a quest that
      // is not on screen. It waits for the fade so the last frame still reads.
      onClosed: () => this.#clear(),
    })
    this.#window.body.append(this.#list, hintList([{ keys: [HUD_KEYS.close, HUD_KEYS.journal], text: 'Close' }]))
  }

  get node(): HTMLElement {
    return this.#window.node
  }

  render(state: HudState): void {
    const key = state.journalOpen ? state.journal.map(signature).join('|') : this.#key
    if (state.journalOpen && key !== this.#key) {
      this.#key = key
      this.#list.replaceChildren(
        ...(state.journal.length ? state.journal.map(entry) : [el('p', 'gb-empty', 'No quests yet.')]),
      )
    }
    this.#window.set(state.journalOpen)
  }

  trap(back: boolean): boolean {
    return this.#window.trap(back)
  }

  dispose(): void {
    this.#window.dispose()
  }

  #clear(): void {
    this.#key = null
    this.#list.replaceChildren()
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
