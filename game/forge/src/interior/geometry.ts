/** Plan geometry: metres on a y-down floor plan, rotations as compass headings. */

export interface Vec {
  readonly x: number
  readonly y: number
}

export interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export type Side = 'north' | 'east' | 'south' | 'west'

export const SIDES: readonly Side[] = ['north', 'east', 'south', 'west']

/** Rounds to millimetres so a plan serialises the same way every time. */
export function round(n: number, places = 3): number {
  const scale = 10 ** places
  return Math.round(n * scale) / scale
}

export function norm(rot: number): number {
  return round(((rot % 360) + 360) % 360)
}

/** Heading 0 faces north (-y), 90 east (+x), 180 south (+y), 270 west (-x). */
export function dirOf(rot: number): Vec {
  const a = (rot * Math.PI) / 180
  return { x: Math.sin(a), y: -Math.cos(a) }
}

export function headingOf(dx: number, dy: number): number {
  return norm((Math.atan2(dx, -dy) * 180) / Math.PI)
}

export function headingTo(from: Vec, to: Vec): number {
  return headingOf(to.x - from.x, to.y - from.y)
}

export function step(from: Vec, rot: number, distance: number): Vec {
  const d = dirOf(rot)
  return { x: round(from.x + d.x * distance), y: round(from.y + d.y * distance) }
}

/** The heading that points from a wall into the room. */
export function inward(side: Side): number {
  switch (side) {
    case 'north':
      return 180
    case 'east':
      return 270
    case 'south':
      return 0
    case 'west':
      return 90
  }
}

export function outward(side: Side): number {
  return norm(inward(side) + 180)
}

export function opposite(side: Side): Side {
  switch (side) {
    case 'north':
      return 'south'
    case 'south':
      return 'north'
    case 'east':
      return 'west'
    case 'west':
      return 'east'
  }
}

/** The box a piece covers: `w` runs across its front, `d` from its front to its back. */
export function boxAt(centre: Vec, size: { readonly w: number; readonly d: number }, rot: number): Box {
  const a = (rot * Math.PI) / 180
  const c = Math.abs(Math.cos(a))
  const s = Math.abs(Math.sin(a))
  const w = size.w * c + size.d * s
  const h = size.w * s + size.d * c
  return { x: round(centre.x - w / 2), y: round(centre.y - h / 2), w: round(w), h: round(h) }
}

export function inset(box: Box, margin: number): Box {
  return {
    x: box.x + margin,
    y: box.y + margin,
    w: Math.max(0, box.w - margin * 2),
    h: Math.max(0, box.h - margin * 2),
  }
}

export function overlaps(a: Box, b: Box, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
}

export function holds(outer: Box, inner: Box): boolean {
  const slack = 1e-6
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.w <= outer.x + outer.w + slack &&
    inner.y + inner.h <= outer.y + outer.h + slack
  )
}

export function inBox(box: Box, p: Vec): boolean {
  return p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h
}

export function centreOf(box: Box): Vec {
  return { x: round(box.x + box.w / 2), y: round(box.y + box.h / 2) }
}

export function clamp(n: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, n))
}

/** Which side of the box this point sits on, when it sits on one at all. */
export function sideOf(box: Box, p: Vec, tol = 0.05): Side | undefined {
  if (Math.abs(p.y - box.y) <= tol) return 'north'
  if (Math.abs(p.y - (box.y + box.h)) <= tol) return 'south'
  if (Math.abs(p.x - box.x) <= tol) return 'west'
  if (Math.abs(p.x - (box.x + box.w)) <= tol) return 'east'
  return undefined
}

export interface Wall {
  readonly side: Side
  /** Fixed coordinate of the wall face. */
  readonly at: number
  /** Range the wall runs over, along its own axis. */
  readonly from: number
  readonly to: number
}

export function wallOf(box: Box, side: Side): Wall {
  switch (side) {
    case 'north':
      return { side, at: box.y, from: box.x, to: box.x + box.w }
    case 'south':
      return { side, at: box.y + box.h, from: box.x, to: box.x + box.w }
    case 'west':
      return { side, at: box.x, from: box.y, to: box.y + box.h }
    case 'east':
      return { side, at: box.x + box.w, from: box.y, to: box.y + box.h }
  }
}

/** How far along a wall a point sits. */
export function alongWall(wall: Wall, point: Vec): number {
  return wall.side === 'north' || wall.side === 'south' ? point.x : point.y
}

/** A point `along` the wall and `depth` metres in from it. */
export function onWall(wall: Wall, along: number, depth: number): Vec {
  const d = dirOf(inward(wall.side))
  const base = wall.side === 'north' || wall.side === 'south' ? { x: along, y: wall.at } : { x: wall.at, y: along }
  return { x: round(base.x + d.x * depth), y: round(base.y + d.y * depth) }
}

export interface SharedWall {
  readonly axis: 'x' | 'y'
  /** Where the shared wall sits on the axis it cuts. */
  readonly at: number
  readonly from: number
  readonly to: number
}

/** The wall two rooms have in common, if they touch along one. */
export function sharedWall(a: Box, b: Box, tol = 0.01): SharedWall | undefined {
  const vertical = Math.abs(a.x + a.w - b.x) <= tol || Math.abs(b.x + b.w - a.x) <= tol
  const horizontal = Math.abs(a.y + a.h - b.y) <= tol || Math.abs(b.y + b.h - a.y) <= tol
  if (vertical) {
    const from = Math.max(a.y, b.y)
    const to = Math.min(a.y + a.h, b.y + b.h)
    if (to - from <= tol) return undefined
    return { axis: 'x', at: Math.abs(a.x + a.w - b.x) <= tol ? a.x + a.w : b.x + b.w, from, to }
  }
  if (horizontal) {
    const from = Math.max(a.x, b.x)
    const to = Math.min(a.x + a.w, b.x + b.w)
    if (to - from <= tol) return undefined
    return { axis: 'y', at: Math.abs(a.y + a.h - b.y) <= tol ? a.y + a.h : b.y + b.h, from, to }
  }
  return undefined
}

/** A strip of floor along part of a wall, `depth` metres into the room. */
export function wallBand(wall: Wall, from: number, to: number, depth: number): Box {
  const length = Math.max(0, to - from)
  switch (wall.side) {
    case 'north':
      return { x: from, y: wall.at, w: length, h: depth }
    case 'south':
      return { x: from, y: wall.at - depth, w: length, h: depth }
    case 'west':
      return { x: wall.at, y: from, w: depth, h: length }
    case 'east':
      return { x: wall.at - depth, y: from, w: depth, h: length }
  }
}

/** The box with `amount` metres taken off the given side. */
export function shrinkFrom(box: Box, side: Side, amount: number): Box {
  switch (side) {
    case 'north':
      return { x: box.x, y: box.y + amount, w: box.w, h: Math.max(0, box.h - amount) }
    case 'south':
      return { x: box.x, y: box.y, w: box.w, h: Math.max(0, box.h - amount) }
    case 'west':
      return { x: box.x + amount, y: box.y, w: Math.max(0, box.w - amount), h: box.h }
    case 'east':
      return { x: box.x, y: box.y, w: Math.max(0, box.w - amount), h: box.h }
  }
}
