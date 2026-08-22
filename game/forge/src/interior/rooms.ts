import type { Rng } from '@gb/kit'
import type { BuildingKind } from '@gb/world'
import { clamp, round, type Box, type Side } from './geometry.ts'
import { PROGRAMMES, type Programme, type RoomRole, type ServiceSpec } from './recipes.ts'

export interface RoomBox {
  readonly kind: Programme['main']['kind']
  readonly name: string
  readonly role: RoomRole
  readonly rect: Box
}

/** Nothing narrower than this is a room; it is a cupboard. */
const MIN_ROOM = 2.4
const MIN_MAIN_DEPTH = 3
const MIN_MAIN_FRONT = 3

/**
 * The floor plan seen from the street door: `front` runs along the wall the door
 * is in, `depth` runs into the building. Rooms are laid out in that frame and
 * turned back into interior coordinates at the end, so the same recipe works
 * whichever way the building faces.
 */
class Frame {
  readonly front: number
  readonly depth: number
  readonly #size: { readonly w: number; readonly h: number }
  readonly #side: Side

  constructor(size: { readonly w: number; readonly h: number }, side: Side) {
    this.#size = size
    this.#side = side
    const acrossX = side === 'north' || side === 'south'
    this.front = acrossX ? size.w : size.h
    this.depth = acrossX ? size.h : size.w
  }

  rect(front: number, depth: number, frontSpan: number, depthSpan: number): Box {
    const f = round(front)
    const d = round(depth)
    const fs = round(frontSpan)
    const ds = round(depthSpan)
    switch (this.#side) {
      case 'north':
        return { x: f, y: d, w: fs, h: ds }
      case 'south':
        return { x: f, y: round(this.#size.h - d - ds), w: fs, h: ds }
      case 'west':
        return { x: d, y: f, w: ds, h: fs }
      case 'east':
        return { x: round(this.#size.w - d - ds), y: f, w: ds, h: fs }
    }
  }
}

/**
 * Cuts the shell into rooms: an entrance hall where the building is deep enough
 * for one, the room people come for behind it, and the service rooms in a band
 * either across the back or down one side. Which of those happens depends on the
 * seed and on what actually fits, so two bars of the same size read differently.
 */
export function cutRooms(kind: BuildingKind, size: { w: number; h: number }, entrance: Side, rng: Rng): RoomBox[] {
  const programme = PROGRAMMES[kind]
  const frame = new Frame(size, entrance)
  const { front, depth } = frame

  const hallDepth = hallFor(programme, front, depth, rng)
  const bodyDepth = depth - hallDepth
  const wanted = programme.services.filter((service) => !service.spare || rng.chance(0.6))

  const backBand = Math.min(clamp(bodyDepth * rng.range(0.26, 0.4), MIN_ROOM, 4.6), bodyDepth - MIN_MAIN_DEPTH)
  const sideBand = Math.min(clamp(front * rng.range(0.26, 0.4), MIN_ROOM, 4.2), front - MIN_MAIN_FRONT)
  const backFits = wanted.length > 0 && backBand >= MIN_ROOM
  // a main room three times as deep as it is wide is a corridor, not a room
  const sideFits = wanted.length > 0 && sideBand >= MIN_ROOM && (front - sideBand) * 3 >= bodyDepth
  const alongBack = backFits && (!sideFits || rng.chance(0.6))
  const band = alongBack ? backBand : sideFits ? sideBand : 0

  const boxes: RoomBox[] = []
  if (hallDepth > 0 && programme.hall) {
    boxes.push({ kind: programme.hall.kind, name: programme.hall.name, role: 'hall', rect: frame.rect(0, 0, front, hallDepth) })
  }

  if (band === 0) {
    boxes.push({ ...programme.main, role: 'main', rect: frame.rect(0, hallDepth, front, bodyDepth) })
    return boxes
  }

  if (alongBack) {
    const mainDepth = bodyDepth - band
    boxes.push({ ...programme.main, role: 'main', rect: frame.rect(0, hallDepth, front, mainDepth) })
    let at = 0
    for (const room of order(wanted, front, rng)) {
      boxes.push({ kind: room.spec.kind, name: room.spec.name, role: 'service', rect: frame.rect(at, hallDepth + mainDepth, room.span, band) })
      at += room.span
    }
    return boxes
  }

  const stripLow = rng.chance(0.5)
  const mainFront = front - band
  boxes.push({
    ...programme.main,
    role: 'main',
    rect: frame.rect(stripLow ? band : 0, hallDepth, mainFront, bodyDepth),
  })
  let at = hallDepth
  for (const room of order(wanted, bodyDepth, rng)) {
    boxes.push({
      kind: room.spec.kind,
      name: room.spec.name,
      role: 'service',
      rect: frame.rect(stripLow ? 0 : mainFront, at, band, room.span),
    })
    at += room.span
  }
  return boxes
}

/** How deep the entrance hall is, or zero when the building is too shallow for one. */
function hallFor(programme: Programme, front: number, depth: number, rng: Rng): number {
  if (!programme.hall || front < MIN_ROOM) return 0
  const want = clamp(depth * programme.hall.share * rng.range(0.9, 1.1), programme.hall.min, programme.hall.max)
  return depth - want >= MIN_MAIN_DEPTH ? round(want) : 0
}

/** Shares the band out between the service rooms, dropping the ones that will not fit. */
function order(services: readonly ServiceSpec[], available: number, rng: Rng): Array<{ spec: ServiceSpec; span: number }> {
  const list = [...services]
  while (list.length > 1 && available < list.length * MIN_ROOM) list.pop()
  if (available < MIN_ROOM) return []
  const weight = list.reduce((sum, spec) => sum + spec.weight, 0)
  const spare = available - list.length * MIN_ROOM
  const spans = list.map((spec, index) => ({
    spec,
    span: index === list.length - 1 ? 0 : round(MIN_ROOM + (spare * spec.weight) / weight),
  }))
  const last = spans[spans.length - 1]!
  last.span = round(available - spans.reduce((sum, room) => sum + room.span, 0))
  return rng.chance(0.5) ? spans : spans.reverse()
}
