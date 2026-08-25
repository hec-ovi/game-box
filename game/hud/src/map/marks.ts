import type { QuestKind } from '@gb/quest'
import { svg } from '../dom.ts'

/**
 * Screen sizes of everything drawn in pixels rather than cells, so a mark is
 * the same size at every zoom and on the minimap as on the plan.
 */
export const MARK_PX = { you: 9, main: 8, side: 7, station: 5, door: 5, gap: 10 } as const

/**
 * Which way the player is looking: an arrow with a notch cut in its tail, so
 * the point is never mistaken for the back of it.
 */
export function youArrow(): SVGPathElement {
  const r = MARK_PX.you
  return svg('path', { d: `M 0 ${-r} L ${r * 0.7} ${r * 0.85} L 0 ${r * 0.45} L ${-r * 0.7} ${r * 0.85} Z` })
}

/**
 * Where to head. The two lines of work wear two shapes, not two shades of one:
 * the story is a solid diamond, an errand a hollow ring. Angular against round
 * and filled against open reads at a glance, at any size, either way up.
 */
export function goalShape(line: QuestKind | undefined): SVGElement {
  if (line === 'main') {
    const r = MARK_PX.main
    return svg('path', { class: 'gb-mark-main', d: `M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z` })
  }
  return svg('circle', { class: 'gb-mark-side', r: MARK_PX.side - 1.5 })
}

/** A doorway the player has walked through: an open square, the shape of a gap in a wall. */
export function doorShape(): SVGElement {
  const r = MARK_PX.door
  return svg('rect', { class: 'gb-mark-door', x: -r, y: -r, width: r * 2, height: r * 2 })
}

/** What hovering says, for anything with a name. */
export function title(label: string): SVGTitleElement {
  const node = svg('title')
  node.textContent = label
  return node
}
