import type { HudWindowName } from './types.ts'
import type { IconName } from './ui/icon.ts'

/** One face of the window: what it is called, the key that brings it up, and its icon. */
export interface WindowTab {
  readonly name: HudWindowName
  readonly title: string
  readonly key: string
  readonly icon: IconName
}

/**
 * The six faces of the one window, in the order they sit in the tab strip and
 * in the bar. Everything that names a window reads this list, so adding a face
 * is one entry here plus its tab.
 */
export const WINDOW_TABS: readonly WindowTab[] = [
  { name: 'quests', title: 'Quests', key: 'J', icon: 'quest-main' },
  { name: 'map', title: 'Map', key: 'M', icon: 'map' },
  { name: 'inventory', title: 'Inventory', key: 'I', icon: 'inventory' },
  { name: 'codex', title: 'Codex', key: 'X', icon: 'codex' },
  { name: 'settings', title: 'Settings', key: 'O', icon: 'settings' },
  { name: 'controls', title: 'Controls', key: '?', icon: 'controls' },
]

export function tabFor(name: HudWindowName): WindowTab {
  return WINDOW_TABS.find((tab) => tab.name === name) ?? WINDOW_TABS[0]!
}

/** How far along the strip a face sits, so switching face knows which way it moved. */
export function tabAt(name: HudWindowName): number {
  return WINDOW_TABS.findIndex((tab) => tab.name === name)
}
