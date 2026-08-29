import { Rng } from '@gb/kit'
import { SHIPPED_CHARTERS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { DoorBudget, mostOpen, OPEN_PLACES, openPlacesFor } from '../src/interior/budget.ts'
import { homesFor, townNeeds } from '../src/interior/needs.ts'
import { openDoors, type Frontage } from '../src/interior/open.ts'
import { planned } from './support.ts'

/**
 * Which doors a town opens, and how many. The pick is architecture: at the time
 * it runs nothing in the town is anything, so it is measured here on the
 * buildings it actually reads rather than on a written city, a batch of
 * footprints in and a set of doors out. What each of those doors turns out to
 * be is the writing's, and what the town needs them to be is measured with it.
 */

/** A town nothing has been built in yet, laid out along one 1,600-cell street. */
const FRESH = { built: 0, open: [], span: 1600, places: OPEN_PLACES }

/** A batch of buildings to hand the ranking, each a footprint and a place on the street. */
const many = (count: number): Frontage[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `plot_${i}`,
    spot: { x: i * 8, y: 0 },
    floor: 30 + (i % 19),
    nearness: 1 - i / count,
    onAvenue: i % 3 === 0,
  }))

describe('which doors a town opens', () => {
  it('opens the number it is told to and no more, and not the same doors twice', () => {
    const picked = ['a', 'b', 'c', 'd'].map((seed) => [...openDoors(many(200), new Rng(seed), FRESH)].sort().join())
    for (const doors of picked) expect(doors.split(',').length).toBe(FRESH.places)
    expect(new Set(picked).size, 'every seed opens the same doors').toBeGreaterThan(1)
  })

  it('opens the doors with room behind them, on the way to everywhere', () => {
    // the ranking has nothing else to go on: how much floor is behind the door,
    // how near the middle of town it stands and whether the traffic goes past it
    const batch = many(200)
    const better = (chosen: readonly Frontage[]) =>
      chosen.reduce((sum, one) => sum + one.floor / 40 + one.nearness + (one.onAvenue ? 1 : 0), 0) / Math.max(1, chosen.length)
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const open = new Set(openDoors(batch, new Rng(seed), FRESH))
      expect(better(batch.filter((one) => open.has(one.id))), `${seed} opens middling doors`).toBeGreaterThan(better(batch))
    }
  })

  it('spreads the doors it opens across the town rather than onto one corner', () => {
    // two hundred plots down one long street: the ranking alone would take the
    // three best and they would be neighbours
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const open = [...openDoors(many(200), new Rng(seed), FRESH)]
      const spots = open.map((id) => Number(id.split('_')[1]) * 8)
      const apart = Math.min(...spots.flatMap((a, i) => spots.slice(i + 1).map((b) => Math.abs(a - b))))
      expect(apart, `${seed} opened three doors ${apart} apart`).toBeGreaterThanOrEqual(FRESH.span / (FRESH.places + 1))
    }
  })
})

describe('what a town needs its doors to be', () => {
  it('asks the writing for the rooms a town is met in, and a home', () => {
    // nothing here can pick a bar out of a row of footprints any more, so what a
    // town needs behind its doors is said in words and handed to the writing
    const wants = townNeeds({ places: OPEN_PLACES, span: 200, charters: SHIPPED_CHARTERS }).map((need) => need.wants)

    expect(wants.some((want) => want.includes('over a counter'))).toBe(true)
    expect(wants.some((want) => want.includes('sit down'))).toBe(true)
    expect(wants.some((want) => want.includes('home'))).toBe(true)
    expect(wants.some((want) => want.includes('trains')), 'a two hundred metre town is asked for a subway').toBe(false)
  })

  it('asks for one home in a small town and more as a city opens more doors', () => {
    expect(homesFor(2)).toBe(0)
    expect(homesFor(OPEN_PLACES)).toBe(1)
    expect(homesFor(89)).toBe(12)
    const homes = townNeeds({ places: 89, span: 200, charters: SHIPPED_CHARTERS }).find((need) => need.wants.includes('home'))
    expect(homes?.count).toBe(12)
  })

  it('asks for every kind of place the town\'s own history says it holds', () => {
    const premise = {
      livesOn: 'the assizes',
      happened: 'the court moved out',
      stake: 'the empty cells',
      sides: [{ name: 'the town', wants: 'them filled' }, { name: 'the county', wants: 'them shut' }],
      common: ['the cells are empty'],
      build: { moreOf: [], fewerOf: [], mustHave: ['jail'] },
    }
    expect(townNeeds({ places: OPEN_PLACES, span: 200, charters: SHIPPED_CHARTERS, premise }).map((need) => need.kind)).toContain('jail')
  })
})

describe('how many doors a town of any size opens', () => {
  it('opens the city\'s own number of places, from a hamlet to the widest grid', () => {
    for (let buildings = 8; buildings < 6000; buildings = Math.ceil(buildings * 1.07)) {
      const budget = new DoorBudget({ built: 0, open: 0 }, buildings, OPEN_PLACES)
      expect(budget.town, `${buildings} buildings, ${budget.town} open`).toBe(OPEN_PLACES)
      expect(budget.town * 2, `${buildings} buildings, ${budget.town} open`).toBeLessThan(buildings)
    }
  })

  it('gives the smallest town a door anyway, rather than a town nobody can walk into', () => {
    for (const buildings of [1, 2, 3, 4]) {
      expect(mostOpen(buildings), `${buildings} buildings`).toBe(buildings > 4 ? 2 : 1)
    }
  })

  it('lets the majority-shut ceiling beat the number in a town too small for both', () => {
    // a six-building hamlet cannot have three open and still be mostly frontage
    expect(new DoorBudget({ built: 0, open: 0 }, 6, OPEN_PLACES).town).toBe(2)
  })

  it('opens as many as a brief asks for, whatever the town is made of', () => {
    for (const wanted of [1, 3, 8, 24]) {
      expect(new DoorBudget({ built: 0, open: 0 }, 400, wanted).town).toBe(wanted)
    }
  })

  it('opens nothing more in a town already over its allowance', () => {
    expect(new DoorBudget({ built: 100, open: 90 }, 10, OPEN_PLACES).spare).toBe(0)
  })

  it('leaves every size the panel builds mostly frontage', () => {
    // measured on the buildings a brief actually lays out, from a hamlet up
    for (const blocks of [1, 2, 3, 6, 12, 20]) {
      const plots = planned(`doors-size-${blocks}`, { blocksX: blocks, blocksY: blocks }).plots().length
      const wanted = openPlacesFor(plots)
      const where = `${blocks}x${blocks} (${plots} plots, ${wanted} doors)`
      expect(wanted, `${where} opens nothing at all`).toBeGreaterThan(0)
      expect(wanted * 2, `${where} is not mostly frontage`).toBeLessThan(plots)
      expect(wanted, `${where} opens more than the town is allowed`).toBeLessThanOrEqual(mostOpen(plots))
    }
  })
})
