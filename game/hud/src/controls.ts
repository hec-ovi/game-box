import { el, kbd } from './dom.ts'
import { MAP_KEYS, MAP_TOOLS } from './phrase.ts'
import type { ControlHint } from './types.ts'
import { WINDOW_TABS } from './windows.ts'

/**
 * The keys the interface answers to. They are written on the controls that do
 * the same thing, so the player never has to be told twice.
 */
export const HUD_KEYS = {
  quests: 'J',
  map: 'M',
  inventory: 'I',
  codex: 'X',
  settings: 'O',
  controls: '?',
  leave: 'N',
  fullscreen: 'F',
  close: 'Esc',
  send: 'Enter',
  pick: 'Tab',
} as const

/** The way out of the game, on the bar beside the windows. */
export const LEAVE = { title: 'Leave', key: HUD_KEYS.leave } as const

/** Under the conversation box, where the player is looking while they type. */
export const TALK_HINTS: readonly ControlHint[] = [
  { keys: [HUD_KEYS.send], text: 'Send' },
  { keys: [HUD_KEYS.close], text: 'Walk away' },
]

/** Added to those while there is a menu, so the moves are reachable by hand. */
export const TALK_PICK_HINT: ControlHint = { keys: [HUD_KEYS.pick], text: 'Pick a reply' }

/** The interface's own keys, listed last in the controls tab. */
export const HUD_HINTS: readonly ControlHint[] = [
  ...WINDOW_TABS.map((tab) => ({ keys: [tab.key], text: tab.title, group: 'Interface' })),
  { keys: [LEAVE.key], text: 'Leave the game', group: 'Interface' },
  { keys: [HUD_KEYS.fullscreen], text: 'Full screen, on and off', group: 'Interface' },
  { keys: [HUD_KEYS.send], text: 'Send what you typed', group: 'Interface' },
  { keys: [HUD_KEYS.pick], text: 'Step through a conversation or a window', group: 'Interface' },
  { keys: [HUD_KEYS.close], text: 'Close the window in front of you', group: 'Interface' },
  { keys: [MAP_KEYS.in, MAP_KEYS.out], text: `${MAP_TOOLS.in}, ${MAP_TOOLS.out}`, group: 'Map' },
  { keys: [MAP_KEYS.fit], text: 'Fit the whole city', group: 'Map' },
  { keys: [MAP_KEYS.you], text: 'Centre on yourself', group: 'Map' },
  { keys: ['Arrows'], text: 'Pan', group: 'Map' },
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

/** The same hints under their headings: for the controls tab. */
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
