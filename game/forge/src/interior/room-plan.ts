import type { Rng } from '@gb/kit'
import type { Anchor, AnchorKind, Furniture, FurnitureProp, Room } from '@gb/world'
import { BODY_RADIUS, Floor, FOOTING, REACH } from './floor.ts'
import {
  boxAt,
  centreOf,
  clamp,
  dirOf,
  headingTo,
  holds,
  inBox,
  inward,
  onWall,
  opposite,
  round,
  sideOf,
  step,
  wallOf,
  SIDES,
  type Box,
  type Side,
  type Vec,
} from './geometry.ts'
import { footprintOf, gapTo, seatSpecOf, specOf } from './props.ts'
import { seatRoot } from './stance.ts'

/** Half an interior wall: how far off a room's line anything has to stay. */
export const WALL_CLEAR = 0.1

/** How far along a wall the search moves between tries. */
const SWEEP = 0.15

/** Anchors that are extra people in the room rather than the person who runs it. */
const CROWD: readonly AnchorKind[] = ['sit', 'sit-drink', 'browse', 'lean']

export type Mint = (kind: string) => string

export interface DoorPoint {
  readonly pos: Vec
  /** Where you stand once you are through, inside this room. */
  readonly inner: Vec
  /** Floor the doorway needs to itself. */
  readonly zone: Box
}

export interface Placed {
  readonly id: string
  readonly prop: FurnitureProp
  readonly pos: Vec
  readonly rot: number
  readonly box: Box
}

export interface WallOptions {
  /** Where along the wall to try first. */
  readonly prefer?: 'centre' | 'ends' | 'any'
  /** Free floor to leave in front of the piece. */
  readonly approach?: number
  /** How far to stay from the corners. */
  readonly margin?: number
  /** How far off the wall the back of the piece sits. */
  readonly gap?: number
}

/**
 * One room being furnished. Everything goes through here, so every piece is
 * tested before it lands: inside the walls, off other furniture, out of the
 * doorways, and never sealing off a door or an anchor already placed.
 */
export class RoomPlan {
  readonly room: Room
  readonly rng: Rng
  readonly floor: Floor
  readonly doors: readonly DoorPoint[]
  /** How many bystanders one room is worth stationing. */
  crowdLimit = 5

  readonly #mint: Mint
  readonly #furniture: Furniture[] = []
  readonly #anchors: Anchor[] = []
  #waypoints: Vec[]
  #crowd = 0

  constructor(room: Room, doors: readonly DoorPoint[], mint: Mint, rng: Rng) {
    this.room = room
    this.doors = doors
    this.rng = rng
    this.#mint = mint
    this.floor = new Floor(room.rect, WALL_CLEAR)
    for (const door of doors) this.floor.reserve(door.zone)
    this.#waypoints = doors.map((door) => door.inner)
  }

  get furniture(): readonly Furniture[] {
    return this.#furniture
  }

  get anchors(): readonly Anchor[] {
    return this.#anchors
  }

  get bounds(): Box {
    return this.floor.bounds
  }

  get centre(): Vec {
    return centreOf(this.floor.bounds)
  }

  /** How long a wall is. */
  span(side: Side): number {
    const wall = wallOf(this.floor.bounds, side)
    return wall.to - wall.from
  }

  /** The sides a door opens on. */
  doorSides(): Side[] {
    const sides = new Set<Side>()
    for (const door of this.doors) {
      const side = sideOf(this.room.rect, door.pos, 0.12)
      if (side) sides.add(side)
    }
    return [...sides]
  }

  /** Sides with no door on them, longest first, ties broken by the seed. */
  openSides(): Side[] {
    const taken = new Set(this.doorSides())
    const free = SIDES.filter((side) => !taken.has(side))
    const order = this.rng.shuffle([...(free.length ? free : SIDES)])
    return order.sort((a, b) => this.span(b) - this.span(a))
  }

  /** The wall you face on the way in: where the thing people come for goes. */
  backSide(): Side {
    const entry = this.doors[0]
    const side = entry ? sideOf(this.room.rect, entry.pos, 0.12) : undefined
    return side ? opposite(side) : this.openSides()[0]!
  }

  /** Puts a piece flat against a wall, sweeping along it until one spot works. */
  againstWall(prop: FurnitureProp, side: Side, options: WallOptions = {}): Placed | undefined {
    const spec = specOf(prop)
    const wall = wallOf(this.floor.bounds, side)
    const rot = inward(side)
    const margin = options.margin ?? 0.1
    const gap = options.gap ?? 0
    const approach = options.approach ?? 0.6
    const low = wall.from + margin + spec.w / 2
    const high = wall.to - margin - spec.w / 2
    if (high < low) return undefined

    for (const along of this.#sweep(low, high, options.prefer ?? 'centre')) {
      const centre = onWall(wall, along, gap + spec.d / 2)
      const placed = this.at(prop, centre, rot, approach)
      if (placed) return placed
    }
    return undefined
  }

  /** Positions on a lattice that fills a region, in reading order. */
  lattice(region: Box, spacing: Vec): Vec[] {
    const spots: Vec[] = []
    const cols = Math.floor(region.w / spacing.x)
    const rows = Math.floor(region.h / spacing.y)
    if (cols < 1 || rows < 1) return spots
    const padX = (region.w - cols * spacing.x) / 2
    const padY = (region.h - rows * spacing.y) / 2
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        spots.push({
          x: round(region.x + padX + (col + 0.5) * spacing.x),
          y: round(region.y + padY + (row + 0.5) * spacing.y),
        })
      }
    }
    return spots
  }

  /**
   * Puts a piece exactly here, or nowhere. `approach` is floor left open in
   * front of it, `ring` floor left open all round it.
   */
  at(prop: FurnitureProp, pos: Vec, rot: number, approach = 0, ring = 0): Placed | undefined {
    const spec = specOf(prop)
    const box = boxAt(pos, spec, rot)
    if (!this.floor.fits(box)) return undefined
    if (ring > 0 && !this.floor.clear(boxAt(pos, { w: spec.w + ring * 2, d: spec.d + ring * 2 }, rot))) return undefined
    if (approach > 0) {
      const front = dirOf(rot)
      const centre = { x: pos.x + front.x * (spec.d / 2 + approach / 2), y: pos.y + front.y * (spec.d / 2 + approach / 2) }
      const strip = boxAt(centre, { w: spec.w, d: approach }, rot)
      if (!holds(this.floor.bounds, strip) || !this.floor.open(strip, 0)) return undefined
    }

    this.floor.add(box, spec.blocks)
    if (spec.blocks && !this.floor.connected(this.#waypoints)) {
      this.floor.undo()
      return undefined
    }
    const id = this.#mint('prop')
    this.#furniture.push({ id, prop, roomId: this.room.id, pos: { x: round(pos.x), y: round(pos.y) }, rot: round(rot) })
    return { id, prop, pos, rot, box }
  }

  /**
   * Marks a spot where somebody stands and does something. An anchor stands on
   * open floor, unless it is on its own seat or bed, and it is refused when it
   * lands inside somebody else's furniture or on floor cut off from the doors.
   *
   * Standing at a piece means standing against it, closer than the walk grid
   * keeps a walking body: that is what puts a bartender's hands on the counter
   * rather than over the floor in front of it. So a body working at a piece is
   * allowed inside the skirt of that one piece, and no other, and still has to
   * have real floor within a step of its back.
   *
   * A body on a seat is judged at the seat, and recorded where the sitting clip
   * actually puts it: `pos` is the seat, the anchor is `seatRoot` forward of it.
   * Whether the seat is a place somebody can sit is a question about the seat,
   * so nothing about which anchors are accepted turns on that offset.
   */
  anchor(kind: AnchorKind, pos: Vec, rot: number, propId?: string): boolean {
    if (!inBox(this.floor.bounds, pos)) return false
    // nobody stands in a doorway
    if (this.doors.some((door) => inBox(door.zone, pos))) return false
    const crowd = CROWD.includes(kind)
    if (crowd && this.#crowd >= this.crowdLimit) return false

    let own: Furniture | undefined
    for (const piece of this.#furniture) {
      if (piece.id === propId) own = piece
      else if (inBox(footprintOf(piece), pos)) return false
    }

    const ownBox = own ? footprintOf(own) : undefined
    const seat = ownBox && inBox(ownBox, pos) ? ownBox : undefined
    const skirt = own && !seat ? Math.max(0, BODY_RADIUS - gapTo(own, pos)) : 0
    const reach = seat ? REACH + Math.hypot(seat.w, seat.h) / 2 : FOOTING + skirt
    const footing = this.floor.footing(pos, reach, this.#waypoints)
    if (!footing) return false

    const body = own && seat && seatSpecOf(own.prop) ? step(pos, rot, seatRoot(own.prop)) : pos
    this.#anchors.push({ id: this.#mint('anchor'), kind, roomId: this.room.id, pos: { x: round(body.x), y: round(body.y) }, rot: round(rot), ...(propId ? { propId } : {}) })
    this.#waypoints = [...this.#waypoints, footing]
    if (crowd) this.#crowd++
    return true
  }

  /** A seat and the person on it, facing whatever the seat is drawn up to. */
  seat(prop: FurnitureProp, pos: Vec, faces: Vec, kind: AnchorKind): boolean {
    const rot = headingTo(pos, faces)
    const placed = this.at(prop, pos, rot)
    if (!placed) return false
    return this.anchor(kind, pos, rot, placed.id)
  }

  /** A spot to stand in the open, facing something. */
  post(kind: AnchorKind, pos: Vec, faces: Vec, propId?: string): boolean {
    return this.anchor(kind, pos, headingTo(pos, faces), propId)
  }

  reserve(box: Box): void {
    this.floor.reserve(box)
  }

  #sweep(low: number, high: number, prefer: 'centre' | 'ends' | 'any'): number[] {
    const spots: number[] = []
    for (let at = low; at <= high + 1e-6; at += SWEEP) spots.push(round(at))
    if (spots.length === 0) spots.push(round((low + high) / 2))
    if (prefer === 'any') return this.rng.shuffle(spots)
    const middle = (low + high) / 2 + this.rng.range(-0.6, 0.6) * clamp((high - low) / 4, 0, 1)
    const scored = spots.map((at) => ({ at, away: Math.abs(at - middle) }))
    scored.sort((a, b) => (prefer === 'centre' ? a.away - b.away : b.away - a.away))
    return scored.map((s) => s.at)
  }
}
