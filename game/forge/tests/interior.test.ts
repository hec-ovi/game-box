import { Rng } from '@gb/kit'
import { BUILDING_KINDS, type Anchor, type BuildingKind, type Interior, type Room } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Forge, OfflineNarrator } from '../src/index.ts'
import { boxAt, dirOf, holds, inBox, overlaps, type Box, type Side, type Vec } from '../src/interior/geometry.ts'
import { planInterior, type InteriorPlan } from '../src/interior/plan.ts'
import { footprintOf, PROP_SPECS } from '../src/interior/props.ts'

/** The floor a doorway keeps to itself: the opening, and a metre either side of the wall. */
const DOOR_ZONE = { w: 1.2, d: 2 }
/** What the planner promises to leave open, checked here without asking it. */
const RADIUS = 0.35
const WALL = 0.1
const CELL = 0.1

const SIZES = [
  { w: 5.6, h: 7.6 },
  { w: 7.6, h: 11.6 },
  { w: 11.6, h: 9.6 },
  { w: 9.6, h: 15.6 },
]
const FACINGS: Side[] = ['north', 'east', 'south', 'west']
const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo']

function plan(kind: BuildingKind, seed: string, size = SIZES[1]!, entrance: Side = 'north'): InteriorPlan {
  let minted = 0
  const mint = (thing: string) => `${thing}_${String(++minted).padStart(4, '0')}`
  return planInterior({ kind, size, entrance, mint, rng: new Rng(seed) })
}

/** Every plan a sweep over kinds, seeds, shapes and which way the door faces. */
function everyPlan(): Array<{ kind: BuildingKind; seed: string; size: { w: number; h: number }; entrance: Side; made: InteriorPlan }> {
  const all = []
  for (const kind of BUILDING_KINDS) {
    for (const [index, seed] of SEEDS.entries()) {
      const size = SIZES[index % SIZES.length]!
      const entrance = FACINGS[index % FACINGS.length]!
      all.push({ kind, seed, size, entrance, made: plan(kind, seed, size, entrance) })
    }
  }
  return all
}

function doorZone(door: Interior['doors'][number]): Box {
  return boxAt(door.pos, DOOR_ZONE, door.rot)
}

function roomOf(made: InteriorPlan, id: string): Room {
  const room = made.rooms.find((r) => r.id === id)
  if (!room) throw new Error(`no room ${id}`)
  return room
}

/**
 * Walks the whole interior from the street door, independently of how the plan
 * was made: rooms are separated by their walls, doorways are the only way
 * through, and every blocking piece of furniture is grown by the player's radius.
 */
class Walk {
  readonly #free = new Set<string>()
  readonly #reached = new Set<string>()

  constructor(made: InteriorPlan, size: { w: number; h: number }) {
    const rooms = made.rooms.map((room) => inset(room.rect, WALL + RADIUS))
    const gaps = made.doors.map((door) => boxAt(door.pos, { w: 0.3, d: 1.4 }, door.rot))
    const blocked = made.furniture
      .filter((piece) => PROP_SPECS[piece.prop].blocks)
      .map((piece) => inset(footprintOf(piece), -RADIUS))

    for (let y = CELL / 2; y < size.h; y += CELL) {
      for (let x = CELL / 2; x < size.w; x += CELL) {
        const point = { x, y }
        const open = rooms.some((room) => inBox(room, point)) || gaps.some((gap) => inBox(gap, point))
        if (!open) continue
        if (blocked.some((box) => inBox(box, point))) continue
        this.#free.add(key(point))
      }
    }

    const street = made.doors.find((door) => door.from === 'outside')!
    const start = step(street.pos, street.rot + 180, 0.5)
    this.#flood(start)
  }

  /** Can somebody standing at the street door get within `reach` of this spot. */
  reaches(point: Vec, reach: number): boolean {
    const span = Math.ceil(reach / CELL)
    const cx = Math.round(point.x / CELL)
    const cy = Math.round(point.y / CELL)
    for (let y = cy - span; y <= cy + span; y++) {
      for (let x = cx - span; x <= cx + span; x++) {
        const spot = { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL }
        if ((spot.x - point.x) ** 2 + (spot.y - point.y) ** 2 > reach * reach) continue
        if (this.#reached.has(key(spot))) return true
      }
    }
    return false
  }

  #flood(from: Vec): void {
    const seeds = [from]
    while (seeds.length) {
      const seed = seeds.pop()!
      const cell = { x: (Math.floor(seed.x / CELL) + 0.5) * CELL, y: (Math.floor(seed.y / CELL) + 0.5) * CELL }
      if (!this.#free.has(key(cell)) || this.#reached.has(key(cell))) continue
      this.#reached.add(key(cell))
      seeds.push(
        { x: cell.x + CELL, y: cell.y },
        { x: cell.x - CELL, y: cell.y },
        { x: cell.x, y: cell.y + CELL },
        { x: cell.x, y: cell.y - CELL },
      )
    }
  }
}

function key(point: Vec): string {
  return `${Math.floor(point.x / CELL)},${Math.floor(point.y / CELL)}`
}

function inset(box: Box, margin: number): Box {
  return { x: box.x + margin, y: box.y + margin, w: box.w - margin * 2, h: box.h - margin * 2 }
}

function step(from: Vec, rot: number, distance: number): Vec {
  const dir = dirOf(rot)
  return { x: from.x + dir.x * distance, y: from.y + dir.y * distance }
}

/** How far from open floor an anchor is allowed to be: on its own seat, or on the floor. */
function reachOf(made: InteriorPlan, anchor: Anchor): number {
  const own = made.furniture.find((piece) => piece.id === anchor.propId)
  if (!own) return 0.35
  const box = footprintOf(own)
  return inBox(box, anchor.pos) ? 0.8 + Math.hypot(box.w, box.h) / 2 : 0.35
}

describe('interior plans', () => {
  it('keeps every piece of furniture inside its own room', () => {
    for (const { kind, seed, made } of everyPlan()) {
      for (const piece of made.furniture) {
        const room = roomOf(made, piece.roomId)
        expect(holds(room.rect, footprintOf(piece)), `${kind}/${seed} ${piece.prop} outside ${room.name}`).toBe(true)
      }
      for (const anchor of made.anchors) {
        const room = roomOf(made, anchor.roomId)
        expect(inBox(room.rect, anchor.pos), `${kind}/${seed} ${anchor.kind} outside ${room.name}`).toBe(true)
      }
    }
  })

  it('never puts two pieces of furniture in the same place', () => {
    for (const { kind, seed, made } of everyPlan()) {
      const boxes = made.furniture.map((piece) => ({ piece, box: footprintOf(piece) }))
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const clash = overlaps(boxes[i]!.box, boxes[j]!.box)
          expect(clash, `${kind}/${seed} ${boxes[i]!.piece.prop} overlaps ${boxes[j]!.piece.prop}`).toBe(false)
        }
      }
    }
  })

  it('leaves every doorway clear', () => {
    for (const { kind, seed, made } of everyPlan()) {
      for (const door of made.doors) {
        const zone = doorZone(door)
        for (const piece of made.furniture) {
          expect(overlaps(zone, footprintOf(piece)), `${kind}/${seed} ${piece.prop} blocks a door`).toBe(false)
        }
      }
    }
  })

  it('has one street door and a way into every room', () => {
    for (const { kind, seed, made } of everyPlan()) {
      const street = made.doors.filter((door) => door.from === 'outside')
      expect(street.length, `${kind}/${seed} street doors`).toBe(1)

      const linked = new Set([street[0]!.to])
      let grew = true
      while (grew) {
        grew = false
        for (const door of made.doors) {
          if (door.from === 'outside') continue
          if (linked.has(door.from) && !linked.has(door.to)) linked.add(door.to), (grew = true)
          if (linked.has(door.to) && !linked.has(door.from)) linked.add(door.from), (grew = true)
        }
      }
      expect(linked.size, `${kind}/${seed} rooms reachable`).toBe(made.rooms.length)
    }
  })

  it('leaves a walk from the street door to every anchor', () => {
    for (const { kind, seed, size, made } of everyPlan()) {
      const walk = new Walk(made, size)
      for (const anchor of made.anchors) {
        expect(walk.reaches(anchor.pos, reachOf(made, anchor)), `${kind}/${seed} cannot reach ${anchor.kind}`).toBe(true)
      }
    }
  })

  it('faces every anchor at the thing it is there for', () => {
    // somebody working at a piece faces it; a lookout faces the room, not the altar behind them
    const working = ['serve', 'cook', 'work-desk', 'browse']
    for (const { kind, seed, made } of everyPlan()) {
      for (const anchor of made.anchors) {
        if (!anchor.propId || !working.includes(anchor.kind)) continue
        const own = made.furniture.find((piece) => piece.id === anchor.propId)
        expect(own, `${kind}/${seed} anchor points at a missing prop`).toBeDefined()
        if (!own) continue
        const box = footprintOf(own)
        if (inBox(box, anchor.pos)) continue
        const heading = dirOf(anchor.rot)
        const towards = { x: own.pos.x - anchor.pos.x, y: own.pos.y - anchor.pos.y }
        const length = Math.hypot(towards.x, towards.y)
        const dot = (heading.x * towards.x + heading.y * towards.y) / (length || 1)
        expect(dot, `${kind}/${seed} ${anchor.kind} faces away from its ${own.prop}`).toBeGreaterThan(0.5)
      }
      for (const anchor of made.anchors) {
        for (const piece of made.furniture) {
          if (piece.id === anchor.propId) continue
          expect(inBox(footprintOf(piece), anchor.pos), `${kind}/${seed} ${anchor.kind} stands inside a ${piece.prop}`).toBe(false)
        }
      }
    }
  })

  it('gives the same interior for the same seed and a different one otherwise', () => {
    for (const kind of BUILDING_KINDS) {
      const once = JSON.stringify(plan(kind, 'repeat'))
      const twice = JSON.stringify(plan(kind, 'repeat'))
      const other = JSON.stringify(plan(kind, 'elsewhere'))
      expect(once, `${kind} is not repeatable`).toEqual(twice)
      expect(once, `${kind} ignores its seed`).not.toEqual(other)
    }
  })

  it('makes each kind of building recognisable from the inside', () => {
    const signature: Record<BuildingKind, { props: string[]; anchors: string[] }> = {
      bar: { props: ['bar-counter', 'bar-stool'], anchors: ['serve', 'sit-drink'] },
      cafe: { props: ['counter', 'table'], anchors: ['serve', 'sit'] },
      restaurant: { props: ['table', 'chair'], anchors: ['serve', 'sit'] },
      shop: { props: ['counter', 'display-case'], anchors: ['serve', 'browse'] },
      market: { props: ['display-case'], anchors: ['serve', 'browse'] },
      house: { props: ['bed', 'sofa'], anchors: ['sleep', 'sit'] },
      apartment: { props: ['bed', 'sofa'], anchors: ['sleep', 'sit'] },
      office: { props: ['desk', 'office-chair'], anchors: ['work-desk'] },
      workshop: { props: ['counter'], anchors: ['work-desk', 'serve'] },
      warehouse: { props: ['crate-stack'], anchors: ['guard'] },
      clinic: { props: ['bed'], anchors: ['sleep', 'serve'] },
      hotel: { props: ['bed', 'counter'], anchors: ['sleep', 'serve'] },
      station: { props: ['chair'], anchors: ['serve', 'sit'] },
      chapel: { props: ['chair'], anchors: ['sit', 'stand'] },
    }

    for (const kind of BUILDING_KINDS) {
      const want = signature[kind]
      for (const seed of SEEDS) {
        const made = plan(kind, seed, { w: 9.6, h: 11.6 })
        const props = new Set(made.furniture.map((piece) => piece.prop))
        const anchors = new Set(made.anchors.map((anchor) => anchor.kind))
        for (const prop of want.props) expect([...props], `${kind}/${seed} has no ${prop}`).toContain(prop)
        for (const anchor of want.anchors) expect([...anchors], `${kind}/${seed} has no ${anchor}`).toContain(anchor)
      }
    }
  })

  it('holds all of that up in a city the forge actually built', async () => {
    const forge = new Forge(new OfflineNarrator('interiors'))
    const built = await forge.build({ theme: 'harbour town', seed: 'interiors', blocksX: 2, blocksY: 2, blockCells: 14 })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const world = built.value.world
    expect(world.interiors().length).toBeGreaterThan(8)

    for (const interior of world.interiors()) {
      const made: InteriorPlan = {
        rooms: [...interior.rooms],
        doors: [...interior.doors],
        furniture: [...interior.furniture],
        anchors: [...interior.anchors],
      }
      const walk = new Walk(made, interior.size)
      for (const anchor of made.anchors) {
        expect(walk.reaches(anchor.pos, reachOf(made, anchor)), `${interior.kind} cannot reach ${anchor.kind}`).toBe(true)
      }
      for (const door of made.doors) {
        for (const piece of made.furniture) {
          expect(overlaps(doorZone(door), footprintOf(piece)), `${interior.kind}: ${piece.prop} blocks a door`).toBe(false)
        }
      }
      for (const npc of world.npcs()) {
        if (npc.station?.interiorId !== interior.id) continue
        expect(made.anchors.some((anchor) => anchor.id === npc.station!.anchorId)).toBe(true)
      }
    }
  })
})
