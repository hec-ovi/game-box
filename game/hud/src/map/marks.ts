import type { QuestKind } from '@gb/quest'
import { svg } from '../dom.ts'
import type { MapMark } from '../types.ts'

/**
 * Screen sizes of everything drawn in pixels rather than cells, so a mark is
 * the same size at every zoom and on the minimap as on the plan. `halo` and
 * `ring` are multiples of the mark's own half-width.
 */
export const MARK_PX = { you: 8, main: 4.5, side: 4, station: 5, door: 5, home: 5, gap: 9, halo: 2.1, ring: 1.9 } as const

/**
 * Which way the player is looking: an arrow with a notch cut in its tail, so
 * the point is never mistaken for the back of it.
 */
export function youArrow(): SVGPathElement {
  const r = MARK_PX.you
  return svg('path', { d: `M 0 ${-r} L ${r * 0.7} ${r * 0.85} L 0 ${r * 0.45} L ${-r * 0.7} ${r * 0.85} Z` })
}

/**
 * Work, on the plan. A square burning in its line's colour: orange for the
 * story, yellow for an errand. The glow is a second square behind the first
 * rather than a filter, because the plan is drawn over a scene and a filter
 * costs the frame.
 *
 * A job the player has taken wears a ring around the square as well, so the
 * board they are working through is the one that stands out from the work
 * waiting to be picked up.
 */
export function questMark(line: QuestKind | undefined, taken: boolean): SVGElement {
  const half = line === 'main' ? MARK_PX.main : MARK_PX.side
  const node = svg('g', { class: 'gb-mark-quest', 'data-line': line ?? 'side', 'data-taken': String(taken) })
  node.append(square(half * MARK_PX.halo, 'gb-mark-halo'), square(half, 'gb-mark-core'))
  if (taken) node.append(square(half * MARK_PX.ring, 'gb-mark-ring'))
  return node
}

/** A place the player owns: an open square with its roof line across the top. */
export function homeMark(): SVGElement {
  const r = MARK_PX.home
  const node = svg('g', { class: 'gb-mark-home' })
  node.append(
    svg('rect', { x: -r, y: -r * 0.55, width: r * 2, height: r * 1.55 }),
    svg('path', { d: `M ${-r * 1.25} ${-r * 0.55} L 0 ${-r * 1.35} L ${r * 1.25} ${-r * 0.55}` }),
  )
  return node
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

/** The shape a mark of that kind wears, without its name or its place. */
export function shapeOf(mark: MapMark): SVGElement {
  if (mark.kind === 'you') return youArrow()
  if (mark.kind === 'home') return homeMark()
  return questMark(mark.line, mark.kind === 'goal')
}

function square(half: number, css: string): SVGRectElement {
  return svg('rect', { class: css, x: -half, y: -half, width: half * 2, height: half * 2 })
}
