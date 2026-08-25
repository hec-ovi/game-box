import { svg } from '../dom.ts'

/**
 * Every picture the interface draws, as inline SVG on one 24 by 24 grid: one
 * colour inherited from whatever it sits in, one stroke weight, square caps
 * and mitred joins. No icon fonts, no image files, no two-tone icons. An icon
 * is drawn in outline; the one that stands for a place on the plan is filled
 * by the rule that paints it.
 *
 * An icon never sits alone where a word would do: it goes beside the word.
 */
export type IconName =
  | 'quest-main'
  | 'quest-side'
  | 'map'
  | 'inventory'
  | 'codex'
  | 'settings'
  | 'controls'
  | 'leave'
  | 'close'
  | 'check'
  | 'plus'
  | 'minus'
  | 'fit'
  | 'you'
  | 'pin'
  | 'diamond'
  | 'ring'
  | 'station'
  | 'door'
  | 'home'
  | 'credit'
  | 'item'
  | 'person'
  | 'clock'
  | 'hourglass'
  | 'weather-clear'
  | 'weather-rain'
  | 'weather-fog'
  | 'minimap'
  | 'fullscreen'
  | 'lock'
  | 'screen'
  | 'counter'
  | 'warn'

/** How big an icon is drawn, by where it sits. */
export const ICON_PX = { tile: 20, tab: 18, button: 16, line: 14 } as const

const PATHS: Record<IconName, readonly string[]> = {
  'quest-main': ['M3 8 L8 12 L12 5 L16 12 L21 8 L19 19 L5 19 Z'],
  'quest-side': ['M12 3 A9 9 0 1 0 12 21 A9 9 0 1 0 12 3', 'M16 8 L10 10 L8 16 L14 14 Z'],
  map: ['M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z', 'M9 4 L9 18', 'M15 6 L15 20'],
  inventory: ['M3 8 L21 8 L21 19 L3 19 Z', 'M9 8 L9 5 L15 5 L15 8', 'M3 13 L21 13'],
  codex: ['M5 4 L12 6 L19 4 L19 18 L12 20 L5 18 Z', 'M12 6 L12 20'],
  settings: [
    'M12 8 A4 4 0 1 0 12 16 A4 4 0 1 0 12 8',
    'M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12',
    'M5 5 L7 7 M17 17 L19 19 M19 5 L17 7 M7 17 L5 19',
  ],
  controls: ['M2 7 L22 7 L22 17 L2 17 Z', 'M6 11 L8 11 M11 11 L13 11 M16 11 L18 11', 'M8 14 L16 14'],
  leave: ['M14 4 L20 4 L20 20 L14 20', 'M3 12 L13 12', 'M9 8 L13 12 L9 16'],
  close: ['M6 6 L18 18', 'M18 6 L6 18'],
  check: ['M5 12 L10 17 L19 7'],
  plus: ['M12 5 L12 19', 'M5 12 L19 12'],
  minus: ['M5 12 L19 12'],
  fit: ['M4 9 L4 4 L9 4', 'M15 4 L20 4 L20 9', 'M20 15 L20 20 L15 20', 'M9 20 L4 20 L4 15'],
  you: ['M12 3 L19 20 L12 16 L5 20 Z'],
  pin: ['M12 21 C12 21 19 14.5 19 10 A7 7 0 1 0 5 10 C5 14.5 12 21 12 21 Z', 'M12 7 A3 3 0 1 0 12 13 A3 3 0 1 0 12 7'],
  diamond: ['M12 3 L21 12 L12 21 L3 12 Z'],
  ring: ['M12 4 A8 8 0 1 0 12 20 A8 8 0 1 0 12 4'],
  station: ['M6 4 L18 4 L18 15 A3 3 0 0 1 15 18 L9 18 A3 3 0 0 1 6 15 Z', 'M6 10 L18 10', 'M8 21 L10 18 M16 21 L14 18'],
  door: ['M6 3 L18 3 L18 21 L6 21 Z', 'M14 12 L15 12'],
  home: ['M3 11 L12 3 L21 11', 'M6 9 L6 20 L18 20 L18 9'],
  credit: ['M3 6 L21 6 L21 18 L3 18 Z', 'M3 10 L21 10', 'M6 14 L11 14'],
  item: ['M12 3 L21 8 L21 16 L12 21 L3 16 L3 8 Z', 'M3 8 L12 13 L21 8', 'M12 13 L12 21'],
  person: ['M12 4 A4 4 0 1 0 12 12 A4 4 0 1 0 12 4', 'M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21'],
  clock: ['M12 3 A9 9 0 1 0 12 21 A9 9 0 1 0 12 3', 'M12 7 L12 12 L16 14'],
  hourglass: ['M6 3 L18 3 L13 12 L18 21 L6 21 L11 12 Z'],
  'weather-clear': ['M20 14 A8 8 0 1 1 10 4 A6.5 6.5 0 0 0 20 14 Z'],
  'weather-rain': [
    'M7 15 A4 4 0 0 1 8 7.5 A5 5 0 0 1 17.5 9 A3.5 3.5 0 0 1 17 15 Z',
    'M8 18 L7 21 M12 18 L11 21 M16 18 L15 21',
  ],
  'weather-fog': ['M4 9 L20 9', 'M4 13 L20 13', 'M6 17 L18 17'],
  minimap: ['M4 4 L20 4 L20 20 L4 20 Z', 'M9 9 L15 9 L15 15 L9 15 Z'],
  fullscreen: ['M4 10 L4 4 L10 4', 'M14 4 L20 4 L20 10', 'M20 14 L20 20 L14 20', 'M10 20 L4 20 L4 14'],
  lock: ['M6 11 L18 11 L18 20 L6 20 Z', 'M9 11 L9 8 A3 3 0 0 1 15 8 L15 11'],
  screen: ['M3 5 L21 5 L21 17 L3 17 Z', 'M9 21 L15 21', 'M6 9 L8 11 L6 13', 'M11 13 L15 13'],
  counter: ['M12 4 L12 20', 'M6 20 L18 20', 'M4 8 L20 8', 'M4 8 L2 13 L6 13 Z', 'M20 8 L18 13 L22 13 Z'],
  warn: ['M12 3 L22 20 L2 20 Z', 'M12 9 L12 14', 'M12 17 L12 17.5'],
}

/** One icon at a size, ready to append. */
export function icon(name: IconName, size: number = ICON_PX.tile): SVGSVGElement {
  const node = svg('svg', {
    class: 'gb-icon',
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.5,
    'stroke-linecap': 'square',
    'stroke-linejoin': 'miter',
    'aria-hidden': 'true',
  })
  for (const d of PATHS[name]) node.append(svg('path', { d }))
  return node
}
