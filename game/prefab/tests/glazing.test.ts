import { describe, expect, it } from 'vitest'
import { BOXED, SALT, baySeed, boxedAt, hashOf } from '../src/pick.ts'

/**
 * Which kind a window gets, and which picture it shows, decide what a whole
 * city looks like and are read in two places: the fragment shader, through
 * `three/tsl`'s `hash`, and here, through `hashOf`. Both have to answer the
 * same thing on every machine, so the arithmetic is pinned rather than
 * described.
 */

/** A wall's worth of bays, enough that a share means something. */
const WALL = { across: 64, down: 24 }

/** Which layer of a run a bay draws, the fold the shader takes of its own hash. */
function pictureAt(across: number, down: number, count: number): number {
  return Math.floor(hashOf(baySeed(across, down) + SALT.picture) * count)
}

function bays<T>(answer: (across: number, down: number) => T): T[] {
  const out: T[] = []
  for (let down = 0; down < WALL.down; down++) {
    for (let across = 0; across < WALL.across; across++) out.push(answer(across, down))
  }
  return out
}

describe('which kind of window a bay gets', () => {
  it('is the same answer for the same bay, on every machine and every run', () => {
    // the exact hash, pinned: the shader runs the same three lines, so a change
    // here silently redraws every window in every city ever generated
    expect(hashOf(1)).toBeCloseTo(0.6591631313785911, 12)
    expect(hashOf(baySeed(0, 0))).toBe(hashOf(1))
    expect(baySeed(3, 5)).toBe(3 * 1973 + 5 * 9277 + 1)

    const once = bays((across, down) => boxedAt(across, down, false))
    const twice = bays((across, down) => boxedAt(across, down, false))
    expect(twice).toEqual(once)
    // and it is not the same answer for every bay, which a broken hash would give
    expect(new Set(once).size).toBe(2)
  })

  it('keeps the room box for street level and takes it off most of the floors above', () => {
    const share = (street: boolean) => bays((across, down) => boxedAt(across, down, street)).filter(Boolean).length / (WALL.across * WALL.down)
    expect(share(true)).toBeCloseTo(BOXED.street, 1)
    expect(share(false)).toBeCloseTo(BOXED.upper, 1)
    expect(BOXED.upper).toBeLessThan(BOXED.street)
  })

  it('does not decide the kind, the picture and the tint off one number', () => {
    // every choice salts the bay's seed differently, so a window that boxes is
    // not thereby always the same room or always lit
    const salts = Object.values(SALT)
    expect(new Set(salts).size).toBe(salts.length)
    const boxed = bays((across, down) => (boxedAt(across, down, true) ? pictureAt(across, down, 6) : -1)).filter((at) => at >= 0)
    expect(new Set(boxed).size).toBe(6)
  })

  it('spreads a bank\'s pictures over the wall rather than favouring one', () => {
    const counted = new Map<number, number>()
    for (const at of bays((across, down) => pictureAt(across, down, 8))) counted.set(at, (counted.get(at) ?? 0) + 1)
    expect(counted.size).toBe(8)
    const even = (WALL.across * WALL.down) / 8
    for (const [picture, count] of counted) expect(count, `picture ${picture}`).toBeGreaterThan(even * 0.7)
  })
})
