import { el } from '../dom.ts'
import { rise } from '../motion.ts'
import { NO_CODEX } from '../phrase.ts'
import type { CodexPerson, CodexPlace, HudState, HudWindowName } from '../types.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { Row } from '../ui/row.ts'
import { person } from './person.ts'
import type { Tab } from './tab.ts'

export type SelectedCodex =
  | { kind: 'place'; item: CodexPlace }
  | { kind: 'person'; item: CodexPerson }

/**
 * Codex: Places and People only with interactive selection and amplified dossier.
 */
export class CodexTab implements Tab {
  readonly name: HudWindowName = 'codex'
  readonly node = el('div', 'gb-codex')
  #leftList = el('div', 'gb-codex-list-pane gb-scrolls')
  #amplified = el('div', 'gb-codex-amplified gb-plate gb-cut gb-edged')
  #selected: SelectedCodex | null = null
  #state: HudState | null = null
  #key: string | null = null

  constructor() {
    const content = el('div', 'gb-codex-split-view')
    content.append(this.#leftList, this.#amplified)
    this.node.append(content)
  }

  render(state: HudState): void {
    this.#state = state
    const codex = state.codex
    const key = JSON.stringify([codex.places, codex.people])
    if (key !== this.#key) {
      this.#key = key
      if (!this.#selected) {
        if (codex.places.length > 0) {
          this.#selected = { kind: 'place', item: codex.places[0]! }
        } else if (codex.people.length > 0) {
          this.#selected = { kind: 'person', item: codex.people[0]! }
        }
      }
    }
    this.#draw()
  }

  #draw(): void {
    if (!this.#state) return
    const codex = this.#state.codex

    const placeNodes = codex.places.map((p) => {
      const node = el('li', 'gb-codex-entry gb-place-entry')
      const row = new Row({ icon: 'door', title: p.name, line: p.text })
      const isSelected = this.#selected?.kind === 'place' && this.#selected.item.name === p.name
      node.dataset.selected = String(isSelected)
      node.append(row.node)
      node.addEventListener('click', () => {
        this.#selected = { kind: 'place', item: p }
        this.#draw()
      })
      return node
    })

    const peopleNodes = codex.people.map((p) => {
      const node = person(p)
      const isSelected = this.#selected?.kind === 'person' && this.#selected.item.name === p.name
      node.dataset.selected = String(isSelected)
      node.addEventListener('click', () => {
        this.#selected = { kind: 'person', item: p }
        this.#draw()
      })
      return node
    })

    const placesGroup = group('Places', placeNodes)
    const peopleGroup = group('People', peopleNodes)
    const groups = [placesGroup, peopleGroup].filter((g): g is HTMLElement => g !== undefined)

    this.#leftList.replaceChildren(...(groups.length ? groups : [el('p', 'gb-empty gb-t3', NO_CODEX)]))

    if (this.#selected?.kind === 'place') {
      const p = this.#selected.item
      this.#showAmplified(p.name, 'A place you have found', p.text ?? '', 'door')
    } else if (this.#selected?.kind === 'person') {
      const pr = this.#selected.item
      const known = pr.facts.map((fact) => fact.text).filter(Boolean).join('\n\n')
      this.#showAmplified(pr.name, pr.role || 'Somebody you have met', known || 'You know nothing about them yet.', 'person', pr.portrait)
    } else {
      this.#showAmplified('Nothing picked', '', 'Pick a place or a person from the list.', 'door')
    }
  }

  /**
   * The one that is open, in full. A person is shown their own face where the
   * game has drawn one; without it, and for a place, the tile's own icon
   * stands in. A line the game did not send is not drawn at all, so a place
   * nobody wrote about leaves no empty band under its name.
   */
  #showAmplified(name: string, subtitle: string, desc: string, mark: 'door' | 'person', portrait?: string): void {
    const avatar = el('div', `gb-codex-amplified-avatar gb-avatar-${mark}`)
    if (portrait) {
      const face = document.createElement('img')
      face.className = 'gb-codex-face'
      face.src = portrait
      face.alt = name
      face.decoding = 'async'
      avatar.append(face)
    } else {
      avatar.append(icon(mark, ICON_PX.tile))
    }
    this.#amplified.replaceChildren(
      avatar,
      el('h3', 'gb-t6', name),
      ...(subtitle ? [el('p', 'gb-t2 gb-amplified-sub', subtitle)] : []),
      ...(desc ? [el('p', 'gb-t3 gb-amplified-desc', desc)] : []),
    )
  }

  clear(): void {
    this.#key = null
    this.#state = null
    this.#selected = null
    this.#leftList.replaceChildren()
    this.#amplified.replaceChildren()
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
