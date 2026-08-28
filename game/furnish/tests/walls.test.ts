import { describe, expect, it } from 'vitest'
import { BAY_TASTE, WALL, WALL_CONTACTS, tasteOf } from '../src/index.ts'

/**
 * The two rules a wall is drawn under that hold whatever room it lines: which
 * kinds of bay a finish and a use reach for, and where the heights a bay offers
 * to stand something on fall against the field the wall is divided into.
 */

describe('what a wall reaches for', () => {
  it('is the finish\'s row tilted by the room\'s use, and a room with no use is the row itself', () => {
    expect(tasteOf('industrial', undefined)).toEqual(BAY_TASTE.industrial)
    // a store racks its walls and hangs no pictures; a kitchen the same way
    expect(tasteOf('industrial', 'store').shelf).toBeGreaterThan(BAY_TASTE.industrial.shelf)
    expect(tasteOf('industrial', 'store').frame).toBe(0)
    expect(tasteOf('domestic', 'kitchen').frame).toBe(0)
    // a kind the use says nothing about keeps its finish's weight
    expect(tasteOf('domestic', 'kitchen').window).toBe(BAY_TASTE.domestic.window)
  })
})

describe('a shelf you can put something on', () => {
  it('is one height, and the highest one keeps its pitch of air under the head of the field', () => {
    // the ledges are pitched off `worktopHeight` and the field of bays ends at
    // `WALL.head`, so the two metres are not free of each other: raise the
    // worktop far enough and the top ledge, or the bottle standing on it,
    // pushes through the head into the lit channel washing down the wall
    const air = WALL.shelf.pitch - WALL.shelf.ledge
    expect(Math.max(...WALL_CONTACTS) + air, 'the top ledge under the head of the field').toBeLessThanOrEqual(WALL.head)
    // a sill and a ledge that land on the same number are one height, not two
    expect(new Set(WALL_CONTACTS).size, 'distinct heights').toBe(WALL_CONTACTS.length)
  })
})
