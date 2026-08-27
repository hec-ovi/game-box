import type { QuestKind } from '@gb/quest'
import { el, svg } from '../dom.ts'
import type { MapDrawn, MapReadingKind, MapSpot } from '../types.ts'
import { ICON_PX, icon, type IconName } from '../ui/icon.ts'

/** One thing on the city worth a label. */
export interface Callout {
  readonly id: string
  readonly kind: MapReadingKind
  readonly label: string
  /** The story or an errand, so a main line callout is brass and an errand is not. */
  readonly line?: QuestKind
}

/** The stub off the thing, the flat run into the box, and the air kept between two boxes. */
const LEADER = { stub: 18, arm: 14, gap: 8 } as const

/** How far a box will look up and down for room, and in what steps. */
const NUDGE = { step: 20, tries: 6 } as const

/**
 * When each kind of label is worth the room, by how far in the view is. 1 is
 * the whole city.
 *
 * Standing back, a map of everything is a map of nothing: the whole town shows
 * where the player is, where their work is sending them, where the story starts
 * and what the parts of town are called, and nothing else. Coming in brings the
 * rest with it, a kind at a time, and takes the parts of town away again,
 * because a name written across a district is in the way of a street.
 */
const SHOWN: Record<MapReadingKind, { readonly from: number; readonly until?: number }> = {
  you: { from: 0 },
  goal: { from: 0 },
  home: { from: 0 },
  district: { from: 0, until: 3 },
  station: { from: 1.5 },
  offer: { from: 2 },
  place: { from: 3.5 },
}

/** The most labels on the glass at once, whatever the zoom, taken in the order they are worth reading. */
const MOST = 12

/** How wide a box reads as, per character, before the browser has laid one out. */
const GUESS = { perChar: 6.6, chrome: 40, height: 24 } as const

/** Which label gets the room when two want the same piece of glass. */
const RANK: Record<MapReadingKind, number> = { you: 0, goal: 1, offer: 4, home: 5, station: 6, district: 7, place: 8 }

/** The picture on a callout, one per kind of thing. The two lines of work carry their own. */
const PICTURE: Record<MapReadingKind, IconName> = {
  you: 'you',
  goal: 'quest-side',
  offer: 'ring',
  home: 'home',
  station: 'station',
  district: 'map',
  place: 'door',
}

/** The crown is the story and the compass an errand, the same two the journal wears. */
export function pictureOf(kind: MapReadingKind, line: QuestKind | undefined): IconName {
  return kind === 'goal' && line === 'main' ? 'quest-main' : PICTURE[kind]
}

/** A box as it is to be drawn: where it goes, and the line that ties it to the thing. */
interface Placed {
  readonly id: string
  readonly x: number
  readonly y: number
  /** The path from the thing, through the kink, to the near edge of the box. */
  readonly leader: string
  /** Where the mark on the thing itself sits. */
  readonly at: { readonly x: number; readonly y: number }
}

/** A box's own size, and how much of the glass it takes wherever it is put. */
interface Sized {
  readonly callout: Callout
  readonly box: HTMLElement
  readonly rank: number
  w: number
  h: number
  /** True while the size is the label's length standing in for a box the browser has not laid out. */
  guessed: boolean
}

/**
 * The labels over the city: a line from the thing, a kink, and a small box with
 * its name in it, the way a drawing calls out what it is showing.
 *
 * Two boxes never stack. They are placed in the order they are worth reading:
 * the story first, then the player, then the rest of the work, the places that
 * are theirs, the stations and the parts of town. Each one takes the first
 * piece of glass it fits in, looking above and below its own line and then on
 * the other side of the thing; one that fits nowhere is not drawn at all,
 * because a name lying over another name is worse than a name missing.
 *
 * Nothing here reads the city. The game says where each thing landed on the
 * glass and how far in the camera stands; this writes the labels for it.
 */
export class Callouts {
  readonly node = el('div', 'gb-callouts')
  #lines = svg('svg', { class: 'gb-callout-lines', 'aria-hidden': 'true' })
  #boxes = el('div', 'gb-callout-boxes')
  #drawn = new Map<string, { readonly box: HTMLButtonElement; readonly leader: SVGPathElement; readonly mark: SVGRectElement }>()
  #sized: Sized[] = []
  #key = ''
  #read: (targetId: string) => void

  constructor(read: (targetId: string) => void) {
    this.#read = read
    this.node.append(this.#lines, this.#boxes)
  }

  /** What the city has on it. Nodes are kept between pushes, so a camera move moves labels rather than rebuilding them. */
  set(callouts: readonly Callout[]): void {
    const key = callouts.map((one) => `${one.id}:${one.kind}:${one.line ?? ''}:${one.label}`).join('|')
    if (key === this.#key) return
    this.#key = key
    this.#drawn.clear()
    this.#lines.replaceChildren()
    this.#boxes.replaceChildren()
    this.#sized = []
    for (const callout of callouts) this.#build(callout)
  }

  /** Where everything landed on the frame the game just drew. */
  place(drawn: MapDrawn): void {
    const glass = { w: this.node.clientWidth, h: this.node.clientHeight }
    this.#lines.setAttribute('viewBox', `0 0 ${Math.max(glass.w, 1)} ${Math.max(glass.h, 1)}`)
    const spots = new Map(drawn.spots.map((spot) => [spot.id, spot]))
    for (const sized of this.#sized) if (sized.guessed) remeasure(sized)
    const showing = this.#sized.filter((sized) => worthShowing(sized.callout, drawn.zoom) && spots.get(sized.callout.id)?.ahead)
    const placed = layOut(showing.map((sized) => ({ ...sized, spot: spots.get(sized.callout.id)! })), glass)
    const put = new Map(placed.map((one) => [one.id, one]))
    for (const [id, nodes] of this.#drawn) {
      const at = put.get(id)
      // shown or not, a box keeps its place in the layout, because a box the
      // browser never laid out has no size to fit anything against
      nodes.box.dataset.shown = String(at !== undefined)
      nodes.leader.setAttribute('d', at?.leader ?? '')
      if (!at) {
        nodes.mark.setAttribute('width', '0')
        continue
      }
      nodes.box.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`
      nodes.mark.setAttribute('x', String(at.at.x - MARK / 2))
      nodes.mark.setAttribute('y', String(at.at.y - MARK / 2))
      nodes.mark.setAttribute('width', String(MARK))
      nodes.mark.setAttribute('height', String(MARK))
    }
  }

  clear(): void {
    this.#key = ''
    this.#sized = []
    this.#drawn.clear()
    this.#lines.replaceChildren()
    this.#boxes.replaceChildren()
  }

  /** Which label is lit: the thing the panel beside the glass is reading. */
  reading(targetId: string | undefined): void {
    for (const [id, nodes] of this.#drawn) nodes.box.dataset.on = String(id === targetId)
  }

  #build(callout: Callout): void {
    const box = el('button', 'gb-callout-box gb-cut gb-edged')
    box.type = 'button'
    box.dataset.kind = callout.kind
    if (callout.line) box.dataset.line = callout.line
    box.dataset.on = 'false'
    box.dataset.shown = 'false'
    const inner = el('span', 'gb-callout-face')
    inner.append(icon(pictureOf(callout.kind, callout.line), ICON_PX.line), el('span', 'gb-t1', callout.label))
    box.append(inner)
    box.addEventListener('click', () => this.#read(callout.id))
    this.#boxes.append(box)

    const group = svg('g', { class: 'gb-callout-line', 'data-kind': callout.kind, ...(callout.line ? { 'data-line': callout.line } : {}) })
    const leader = svg('path', { class: 'gb-callout-leader', d: '' })
    const mark = svg('rect', { class: 'gb-callout-mark', x: 0, y: 0, width: 0, height: 0 })
    group.append(leader, mark)
    this.#lines.append(group)

    this.#drawn.set(callout.id, { box, leader, mark })
    const sized: Sized = { callout, box, rank: rankOf(callout), w: 0, h: 0, guessed: true }
    remeasure(sized)
    this.#sized.push(sized)
  }
}

/** The square drawn on the thing a callout is about. */
const MARK = 7

/**
 * Whether a label is worth the room at this zoom. The story's own door is the
 * one offer written on the whole city, because a player with no job in hand has
 * to be able to read where the main line starts without hunting for it.
 */
function worthShowing(callout: Callout, zoom: number): boolean {
  if (callout.kind === 'offer' && callout.line === 'main') return true
  const band = SHOWN[callout.kind]
  return zoom >= band.from && (band.until === undefined || zoom <= band.until)
}

function rankOf(callout: Callout): number {
  if (callout.kind === 'goal') return callout.line === 'main' ? 1 : 2
  if (callout.kind === 'offer' && callout.line === 'main') return 3
  return RANK[callout.kind]
}

/**
 * How big a box is. The browser is asked first; a glass it has not laid out yet
 * has no numbers to give, so the label's own length stands in until it has.
 */
function remeasure(sized: Sized): void {
  const rect = sized.box.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    sized.w = rect.width
    sized.h = rect.height
    sized.guessed = false
    return
  }
  sized.w = sized.callout.label.length * GUESS.perChar + GUESS.chrome
  sized.h = GUESS.height
}

/** A box with the spot on the glass it belongs to. */
interface Wanting extends Sized {
  readonly spot: MapSpot
}

/** A rectangle of glass a box has taken. */
interface Taken {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/**
 * Where every box goes. Worth reading first gets its place first; the rest take
 * what is left, and whatever fits nowhere is left off.
 *
 * A box leans away from the middle of the view, so the city stays visible under
 * the labels rather than behind them.
 */
export function layOut(wanting: readonly Wanting[], glass: { w: number; h: number }): Placed[] {
  const order = [...wanting].sort((one, other) => one.rank - other.rank || one.spot.y - other.spot.y).slice(0, MOST)
  const taken: Taken[] = []
  const placed: Placed[] = []
  for (const want of order) {
    const outward = want.spot.x < glass.w / 2 ? 1 : -1
    const found = fit(want, outward, taken, glass) ?? fit(want, -outward, taken, glass)
    if (!found) continue
    taken.push(found.rect)
    placed.push(found.placed)
  }
  return placed
}

/** The first place on one side of the thing where the box has the glass to itself. */
function fit(
  want: Wanting,
  side: number,
  taken: readonly Taken[],
  glass: { w: number; h: number },
): { rect: Taken; placed: Placed } | undefined {
  for (const dy of steps()) {
    const kink = { x: want.spot.x + side * LEADER.stub, y: want.spot.y - LEADER.stub + dy }
    const edge = kink.x + side * LEADER.arm
    const rect = { x: side > 0 ? edge : edge - want.w, y: kink.y - want.h / 2, w: want.w, h: want.h }
    if (glass.w > 0 && (rect.x < 0 || rect.x + rect.w > glass.w)) continue
    if (glass.h > 0 && (rect.y < 0 || rect.y + rect.h > glass.h)) continue
    if (taken.some((other) => overlaps(rect, other))) continue
    return {
      rect,
      placed: {
        id: want.callout.id,
        x: rect.x,
        y: rect.y,
        leader: `M ${round(want.spot.x)} ${round(want.spot.y)} L ${round(kink.x)} ${round(kink.y)} L ${round(edge)} ${round(kink.y)}`,
        at: { x: want.spot.x, y: want.spot.y },
      },
    }
  }
  return undefined
}

/** On its own line first, then above and below it in turn. */
function steps(): number[] {
  const offsets = [0]
  for (let step = 1; step <= NUDGE.tries; step++) offsets.push(-step * NUDGE.step, step * NUDGE.step)
  return offsets
}

function overlaps(one: Taken, other: Taken): boolean {
  return (
    one.x < other.x + other.w + LEADER.gap &&
    other.x < one.x + one.w + LEADER.gap &&
    one.y < other.y + other.h + LEADER.gap &&
    other.y < one.y + one.h + LEADER.gap
  )
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
