import type { HudWindowName } from './types.ts'

/** One face of the window: what it is called and the key that brings it up. */
export interface WindowTab {
  readonly name: HudWindowName
  readonly title: string
  readonly key: string
}

/**
 * The four faces of the one window, in the order they sit in the tab strip and
 * in the bar. Everything that names a window reads this list, so adding a fifth
 * is one entry here plus its tab.
 */
export const WINDOW_TABS: readonly WindowTab[] = [
  { name: 'quests', title: 'Quests', key: 'J' },
  { name: 'map', title: 'Map', key: 'M' },
  { name: 'items', title: 'Items', key: 'I' },
  { name: 'controls', title: 'Controls', key: '?' },
]

export function tabFor(name: HudWindowName): WindowTab {
  return WINDOW_TABS.find((tab) => tab.name === name) ?? WINDOW_TABS[0]!
}
