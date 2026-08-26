/**
 * The icons the panel draws, from the set `docs/UI.md` names. Each one is a
 * 24-unit line drawing in one colour it inherits, so an icon is the same
 * weight as the text beside it whatever size it is set at. No icon files, no
 * icon font: the panel is served with the first byte of the page.
 */
const PATHS = {
  city: 'M3 21h18M6 21V8l6-4v17M15 21v-8l4 2.5V21M8.5 9.5h1M8.5 13h1M8.5 16.5h1',
  codex: 'M4 4h7v16H4zM13 4h7v16h-7zM6.5 8h2M15.5 8h2',
  settings: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8',
  seed: 'M12 4v16M4.8 7.8l14.4 8.4M19.2 7.8L4.8 16.2',
  screen: 'M3 4h18v13H3zM8 20h8M12 17v3M6.5 8.5l2 2-2 2M11.5 12.5h4',
  door: 'M6 3h12v18H6zM14.5 12h1',
  leave: 'M10 4H5v16h5M13.5 8l4 4-4 4M17.5 12H9',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M4 12.5l5 5L20 6.5',
  'chevron-left': 'M14.5 5.5l-7 6.5 7 6.5',
  'chevron-right': 'M9.5 5.5l7 6.5-7 6.5',
  'quest-main': 'M4 8.5l4 3.5 4-7 4 7 4-3.5V19H4zM4 21h16',
  'quest-side': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  person: 'M12 4a3.8 3.8 0 1 0 0 7.6A3.8 3.8 0 0 0 12 4zM4.5 21v-1.8a4.7 4.7 0 0 1 4.7-4.7h5.6a4.7 4.7 0 0 1 4.7 4.7V21',
  home: 'M3.5 11.5L12 4l8.5 7.5M6 10v10h12V10M10 20v-6h4v6',
  item: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  map: 'M9 4L3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4zM9 4v14M15 6.5v14',
  back: 'M19 12H5M12 19l-7-7 7-7',
} as const

export type IconName = keyof typeof PATHS

/** The markup for one icon, ready to be set on a slot. */
export function iconMarkup(name: IconName): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="${PATHS[name]}" /></svg>`
}

export function isIcon(name: string): name is IconName {
  return name in PATHS
}
