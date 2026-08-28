import type { Premise, World } from '@gb/world'
import { describe, expect, it } from 'vitest'
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

const counts = (world: World): Map<string, number> => {
  const held = new Map<string, number>()
  for (const plot of world.plots()) held.set(plot.kind, (held.get(plot.kind) ?? 0) + 1)
  return held
}

const pooled = (worlds: readonly World[]): Map<string, number> => {
  const held = new Map<string, number>()
  for (const world of worlds) for (const [kind, n] of counts(world)) held.set(kind, (held.get(kind) ?? 0) + n)
  return held
}

describe('a city drawn against a history', () => {
  it('lays out two different towns from one seed and two histories, and the same town twice from one', () => {
    // the whole point of the stage: a premise nothing can measure costs a call
    // and buys a feeling
    const shipping = town(SHIPPING)
    expect(digest(town(SHIPPING).toJSON()), 'one history laid out two towns').toBe(digest(shipping.toJSON()))
    expect(digest(town(CAMPUS).toJSON()), 'two histories laid out one town').not.toBe(digest(shipping.toJSON()))

    // the push is measured over a few seeds: one town's dice can halve a kind on their own
    const seeds = [SEED, 'two-histories', 'three-histories', 'four-histories', 'five-histories']
    const port = pooled(seeds.map((seed) => town(SHIPPING, seed)))
    const college = pooled(seeds.map((seed) => town(CAMPUS, seed)))
    expect(port.get('warehouse')!, 'the port has no more sheds than the campus town').toBeGreaterThan(college.get('warehouse')! * 2)
    expect(port.get('market')!, 'the port has no more of a market than the campus town').toBeGreaterThan(college.get('market')! * 2)
    expect(college.get('cafe')!, 'the campus town has no more cafes than the port').toBeGreaterThan(port.get('cafe')! * 2)
  })

  it('puts up what the history demands', () => {
    // "a hospital, because of the flood" has to be a building, not a sentence
    for (const [premise, demanded] of [
      [SHIPPING, 'warehouse'],
      [CAMPUS, 'office'],
    ] as const) {
      for (const seed of ['demand-1', 'demand-2', 'demand-3']) {
        const world = town(premise, seed, { blocksX: 3, blocksY: 3 })
        expect(world.plotsOfKind(demanded).length, `${seed} has no ${demanded} at all`).toBeGreaterThan(0)
      }
    }
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
    expect(world.plotsOfKind('warehouse').length).toBeGreaterThan(0)
  })

  it('still drops a history nothing can be salvaged from', () => {
    expect(town({ livesOn: 'the sea', sides: [] }).premise()).toBeUndefined()
  })
})
