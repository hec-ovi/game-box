import { el, kbd } from './dom.ts'
import type { ControlHint } from './types.ts'

/**
 * The keys the interface answers to. They are written on the controls that do
 * the same thing, so the player never has to be told twice.
 */
export const HUD_KEYS = {
  journal: 'J',
  help: '?',
  close: 'Esc',
  send: 'Enter',
} as const

/** Under the conversation box, where the player is looking while they type. */
export const TALK_HINTS: readonly ControlHint[] = [
  { keys: [HUD_KEYS.send], text: 'Send' },
  { keys: [HUD_KEYS.close], text: 'Walk away' },
]

/** The interface's own keys, listed last in the controls window. */
export const HUD_HINTS: readonly ControlHint[] = [
  { keys: [HUD_KEYS.journal], text: 'Journal', group: 'Interface' },
  { keys: [HUD_KEYS.help], text: 'These controls', group: 'Interface' },
  { keys: [HUD_KEYS.send], text: 'Send what you typed', group: 'Interface' },
  { keys: [HUD_KEYS.close], text: 'Close the window in front of you', group: 'Interface' },
]

/** One "these keys do this" row. */
export function hintRow(hint: ControlHint): HTMLLIElement {
  const row = el('li', 'gb-hint')
  const keys = el('span', 'gb-keys')
  for (const key of hint.keys) keys.append(kbd(key))
  row.append(keys, el('span', 'gb-hint-text', hint.text))
  return row
}

/** A flat list of hints: for the foot of a panel. */
export function hintList(hints: readonly ControlHint[]): HTMLUListElement {
  const list = el('ul', 'gb-hints')
  list.append(...hints.map(hintRow))
  return list
}

/** The same hints under their headings: for the controls window. */
export function hintGroups(hints: readonly ControlHint[]): HTMLElement[] {
  const groups = new Map<string, ControlHint[]>()
  for (const hint of hints) {
    const name = hint.group ?? ''
    const found = groups.get(name)
    if (found) found.push(hint)
    else groups.set(name, [hint])
  }
  return [...groups].map(([name, list]) => {
    const section = el('section', 'gb-control-group')
    if (name) section.append(el('h3', undefined, name))
    section.append(hintList(list))
    return section
  })
}
