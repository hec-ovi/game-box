import type { Premise, World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { townNeeds } from '../src/interior/needs.ts'
import { digest, planned } from './support.ts'

/**
 * A city drawn against a history somebody wrote. The history is the first thing
 * a build asks for and the last thing this box invents: it comes in as data, and
 * everything below measures what a town does with it. `Forge.plan` takes one the
 * way a build does, so all of it runs with no model anywhere near it.
 */

/** A town whose trade went, in the owner's own example. */
const SHIPPING: Premise = {
  livesOn: 'the wharves, and the freight that used to come over them',
  happened: 'the shipping line moved to a deeper port two years ago and took the work with it',
  stake: 'who ends up holding the empty sheds',
  sides: [
    { name: 'the freight families', wants: 'the sheds kept shut until the boats come back' },
    { name: 'the receivers', wants: 'the whole waterfront sold on before it rots' },
  ],
  common: ['half the sheds on the water belong to somebody who has never been here'],
  build: { moreOf: ['warehouse', 'bar', 'market'], fewerOf: ['office', 'hotel', 'cafe'], mustHave: ['warehouse'] },
}

/** The other one: a town built round a research campus. */
const CAMPUS: Premise = {
  livesOn: 'the research campus on the hill, and everything that grew up to feed it',
  happened: 'the campus doubled in four years and the town has been catching up ever since',
  stake: 'whether this is a town with a campus in it or a campus with houses attached',
  sides: [
    { name: 'the faculty', wants: 'the campus given the room it was promised' },
    { name: 'the streets that were here first', wants: 'rents somebody who works here can pay' },
  ],
  common: ['every third flat is let to somebody who will be gone within the year'],
  build: { moreOf: ['office', 'cafe', 'apartment', 'clinic'], fewerOf: ['warehouse', 'workshop', 'market'], mustHave: ['office'] },
}

const SEED = 'one-history'
const SIZE = { theme: 'quiet coastal town', blocksX: 5, blocksY: 5 }

const town = (history: unknown, seed = SEED, overrides: Record<string, unknown> = {}) => planned(seed, { ...SIZE, ...overrides }, history)

/** The footprints and heights a brief laid out, which is the whole of what an architecture is. */
const architecture = (world: World): string =>
  world.plots().map((plot) => `${plot.rect.x},${plot.rect.y},${plot.rect.w}x${plot.rect.h},${plot.storeys}`).join()

/** What a town asks the writing for, in the words it asks in. */
const asked = (world: World) =>
  townNeeds({
    places: 3,
    span: Math.max(world.grid.width, world.grid.height) * world.cellSize,
    charters: world.charters(),
    ...(world.premise() ? { premise: world.premise()! } : {}),
  })

describe('a city drawn against a history', () => {
  it('draws one architecture whatever the history, because a footprint is not a kind of place', () => {
    const shipping = town(SHIPPING)
    expect(digest(town(SHIPPING).toJSON()), 'one history laid out two towns').toBe(digest(shipping.toJSON()))
    // what a town holds is the writing's now, so two histories are two towns to
    // write and one town to lay out: the same blocks, the same doors, the same
    // heights, and nothing in either of them is a warehouse or an office yet
    expect(architecture(town(CAMPUS)), 'a history moved a footprint').toBe(architecture(shipping))
    expect(new Set(shipping.plots().map((plot) => plot.kind))).toEqual(new Set(['building']))
  })

  it('asks the writing for what the history demands', () => {
    // "a hospital, because of the flood" has to be a building, not a sentence,
    // and the only stage that can make one a building is the writing
    for (const [premise, demanded] of [
      [SHIPPING, 'warehouse'],
      [CAMPUS, 'office'],
    ] as const) {
      const world = town(premise, 'demand-1', { blocksX: 3, blocksY: 3 })
      expect(asked(world).map((need) => need.kind), `${demanded} is not asked for`).toContain(demanded)
    }
    // and a town with no history asks for nothing in particular
    expect(asked(town(undefined)).every((need) => need.kind === undefined)).toBe(true)
  })

  it('writes the history into the city file, so whoever is sent it can read what the town is about', () => {
    // a city that is steered by a history and does not carry it forgets what it
    // is: whoever it is sent to cannot read it, and its empty land fills up with
    // a town of no particular kind
    expect(town(SHIPPING).premise()).toEqual(SHIPPING)
    expect(town(undefined).premise()).toBeUndefined()
  })

  it('drops a history that does not hold up and lays the town out anyway', () => {
    // nothing a narrator writes is trusted: a model that answers with the wrong
    // shape must not take the city down with it
    for (const junk of [
      { livesOn: 'somewhere' },
      { ...SHIPPING, sides: [{ name: 'only one side', wants: 'everything' }] },
      // longer than a world document will hold: dropped here, rather than taken
      // as far as `World.found` and refused with the whole city
      { ...SHIPPING, stake: 'x'.repeat(500) },
      'a paragraph of prose',
      null,
    ]) {
      const world = town(junk)
      expect(world.check(), `${JSON.stringify(junk).slice(0, 40)} laid out a broken city`).toEqual([])
      expect(world.premise(), `${JSON.stringify(junk).slice(0, 40)} was taken as a history`).toBeUndefined()
    }
  })
})

describe('a history that fails the contract in one place', () => {
  it('keeps every field that holds up and drops only the word that does not', () => {
    // one building kind the game has not got, and one side missing its wants:
    // the rest of the history is what the town is built on
    const world = town({
      ...SHIPPING,
      sides: [...SHIPPING.sides, { name: 'the harbourmaster' }],
      build: { moreOf: ['warehouse', 'casino', 'bar'], fewerOf: ['office'], mustHave: ['warehouse', 'lighthouse'] },
    })
    const premise = world.premise()
    expect(premise, 'the whole history was thrown away for one bad word').toBeDefined()
    expect(premise!.livesOn).toBe(SHIPPING.livesOn)
    expect(premise!.sides).toEqual(SHIPPING.sides)
    expect(premise!.build).toEqual({ moreOf: ['warehouse', 'bar'], fewerOf: ['office'], mustHave: ['warehouse'] })
    // and the word that held up is what the writing is asked for
    const kinds = asked(world).map((need) => need.kind)
    expect(kinds).toContain('warehouse')
    expect(kinds).not.toContain('lighthouse')
  })

  it('still drops a history nothing can be salvaged from', () => {
    expect(town({ livesOn: 'the sea', sides: [] }).premise()).toBeUndefined()
  })
})
