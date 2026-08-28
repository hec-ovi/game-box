import { Rng } from '@gb/kit'
import { SHIPPED_CHARTERS, type ResolvedCharter } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { DoorBudget, mostOpen, OPEN_PLACES, openPlacesFor } from '../src/interior/budget.ts'
import { drawOf, KEYSTONES, pullOf } from '../src/interior/draw.ts'
import { openDoors, type Frontage } from '../src/interior/open.ts'
import { planned } from './support.ts'

/**
 * Which doors a town opens, and how many. The ranking is arithmetic, so it is
 * measured here on the frontage it actually reads rather than on a written city:
 * a batch of buildings in, a set of doors out.
 */

/** A town nothing has been built in yet, laid out along one 1,600-cell street. */
const FRESH = { built: 0, open: [], span: 1600, places: OPEN_PLACES }

const preset = (word: string): ResolvedCharter => SHIPPED_CHARTERS.find((charter) => charter.word === word)!

/** A batch of buildings to hand the ranking, one of every kind and then round again. */
const many = (count: number): Frontage[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `plot_${i}`,
    charter: SHIPPED_CHARTERS[i % SHIPPED_CHARTERS.length]!,
    spot: { x: i * 8, y: 0 },
    floor: 30 + (i % 19),
    nearness: 1 - i / count,
    onAvenue: i % 3 === 0,
    storied: false,
  }))

describe('which doors a town opens', () => {
  it('spends its first doors on its keystones: a counter to buy over, and a room to be served in', () => {
    // three doors is the whole game, so which three is not left to a ranking
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const open = [...openDoors(many(200), new Rng(seed), FRESH)]
      const drawn = open.map((id) => drawOf(many(200).find((one) => one.id === id)!.charter))
      expect(drawn.some(KEYSTONES[0]![1]), `${seed} opens nowhere to buy anything over a counter`).toBe(true)
      expect(drawn.some(KEYSTONES[1]![1]), `${seed} opens nowhere to sit down and be served`).toBe(true)
    }
  })

  it('opens what a place has to offer rather than what it is called', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const batch = many(200)
      const open = new Set(openDoors(batch, new Rng(seed), FRESH))
      const pull = (plots: readonly Frontage[]) => plots.reduce((sum, plot) => sum + pullOf(plot.charter), 0) / Math.max(1, plots.length)
      const chosen = pull(batch.filter((plot) => open.has(plot.id) && !plot.charter.residential))
      expect(chosen, `${seed} opens middling doors`).toBeGreaterThan(pull(batch))
    }
  })

  it('weighs a kind of building by what its own interior turns out to hold', () => {
    for (const charter of SHIPPED_CHARTERS) {
      const draw = drawOf(charter)
      expect(draw.staff + draw.seats + draw.beds + draw.stock, `${charter.word} offers nothing at all`).toBeGreaterThan(0)
      expect(drawOf(charter), `${charter.word} is weighed differently on a second look`).toEqual(draw)
    }
    // a place with staff and stock outranks one with neither, whatever either is called
    const rich = SHIPPED_CHARTERS.filter((charter) => drawOf(charter).staff > 0 && drawOf(charter).stock > 0)
    const bare = SHIPPED_CHARTERS.filter((charter) => drawOf(charter).staff === 0)
    expect(rich.length).toBeGreaterThan(0)
    expect(bare.length).toBeGreaterThan(0)
    for (const kind of rich) for (const other of bare) expect(pullOf(kind)).toBeGreaterThan(pullOf(other))
  })

  it('opens somewhere to sleep even when nowhere with a bed is worth opening', () => {
    // fifty shops on the avenue and three flats out at the edge: the ranking
    // would take the shops and leave the town with nowhere to sleep
    const frontages: Frontage[] = [
      ...Array.from({ length: 50 }, (_, i) => ({ id: `shop_${i}`, charter: preset('shop'), spot: { x: i * 8, y: 0 }, floor: 40, nearness: 1, onAvenue: true, storied: false })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `flat_${i}`, charter: preset('apartment'), spot: { x: i * 8, y: 120 }, floor: 40, nearness: 0, onAvenue: false, storied: false })),
    ]
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const open = openDoors(frontages, new Rng(seed), FRESH)
      const beds = [...open].filter((id) => id.startsWith('flat_'))
      expect(beds.length, `${seed} left the town with nowhere to sleep`).toBeGreaterThan(0)
    }
  })

  it('opens the number it is told to and no more, and not the same doors twice', () => {
    const picked = ['a', 'b', 'c', 'd'].map((seed) => [...openDoors(many(200), new Rng(seed), FRESH)].sort().join())
    for (const doors of picked) expect(doors.split(',').length).toBe(FRESH.places)
    expect(new Set(picked).size, 'every seed opens the same doors').toBeGreaterThan(1)
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

  it('opens as many different kinds of place as a wider brief can manage', () => {
    // every door of a kind already open charges the next one of that kind, so a
    // brief that asks for more places spends them across the town
    const batch = many(200)
    const open = [...openDoors(batch, new Rng('spread'), { ...FRESH, places: 24 })]
    const kinds = new Set(open.map((id) => batch.find((one) => one.id === id)!.charter.word))
    expect(open.length).toBe(24)
    expect(kinds.size).toBeGreaterThan(5)
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
