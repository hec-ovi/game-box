import { el } from '../dom.ts'
import { rise } from '../motion.ts'
import { CODEX_HEADS, NO_CODEX } from '../phrase.ts'
import type { CodexNote, CodexPlace, HudState, HudWindowName } from '../types.ts'
import { Row } from '../ui/row.ts'
import { person } from './person.ts'
import type { Tab } from './tab.ts'

/**
 * What the player has found out: the places they have been into, the people
 * they have met and the history they have been told, under one heading each.
 * The game keeps the record and pushes it whole; the tab only reads it.
 */
export class CodexTab implements Tab {
  readonly name: HudWindowName = 'codex'
  readonly node = el('div', 'gb-codex')
  #key: string | null = null

  render(state: HudState): void {
    const codex = state.codex
    const key = JSON.stringify(codex)
    if (key === this.#key) return
    this.#key = key
    const sections = [
      group(CODEX_HEADS.places, codex.places.map(place)),
      group(CODEX_HEADS.people, codex.people.map(person)),
      group(CODEX_HEADS.history, (codex.history ?? []).map(note)),
    ].filter((section) => section !== undefined)
    this.node.replaceChildren(...(sections.length ? sections : [el('p', 'gb-empty gb-t3', NO_CODEX)]))
  }

  clear(): void {
    this.#key = null
    this.node.replaceChildren()
  }
}

/** A heading and its rows; nothing at all when there are no rows. */
function group(title: string, rows: readonly HTMLElement[]): HTMLElement | undefined {
  if (rows.length === 0) return undefined
  const node = el('section', 'gb-codex-group')
  const list = el('ul', 'gb-rows')
  rows.forEach((row, at) => rise(row, at))
  list.append(...rows)
  node.append(el('h3', 'gb-t5 gb-section-head', title), list)
  return node
}

function place(entry: CodexPlace): HTMLElement {
  const node = el('li', 'gb-codex-entry')
  node.append(new Row({ icon: 'door', title: entry.name, line: entry.text }).node)
  return node
}

function note(entry: CodexNote): HTMLElement {
  const node = el('li', 'gb-codex-entry')
  node.append(new Row({ icon: 'codex', title: entry.title }).node, el('p', 'gb-note-text gb-t3', entry.text))
  return node
}
