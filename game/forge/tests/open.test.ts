import { Rng } from '@gb/kit'
import { SHIPPED_CHARTERS, type ResolvedCharter, type World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { DoorBudget, mostOpen } from '../src/interior/budget.ts'
import { drawOf, NEEDS, pullOf } from '../src/interior/draw.ts'
import { openDoors, type Frontage } from '../src/interior/open.ts'
import { buildTown } from './support.ts'

/** Which plots you can walk into. */
function openPlots(world: World): Set<string> {
  return new Set(world.interiors().map((interior) => interior.plotId))
}

/** The plot a person is standing in, and the plot a thing is lying in. */
function homes(world: World): { npcs: Map<string, string>; items: Map<string, string> } {
  const plotOf = new Map(world.interiors().map((interior) => [interior.id, interior.plotId]))
  const npcs = new Map<string, string>()
  for (const npc of world.npcs()) {
    const plot = npc.station ? plotOf.get(npc.station.interiorId) : undefined
    if (plot) npcs.set(npc.id, plot)
  }
  const items = new Map<string, string>()
  for (const placement of world.placements()) {
    const plot = placement.at === 'anchor' ? plotOf.get(placement.interiorId) : undefined
    if (plot) items.set(placement.itemId, plot)
  }
  return { npcs, items }
}

const town = (seed: string, blocks = 5) => buildTown(seed, { blocksX: blocks, blocksY: blocks })

const [small, big, other] = await Promise.all([town('doors-small', 3), town('doors-big', 8), town('doors-other', 8)])

/**
 * Every size the creation panel offers, built for real. The rule inverted on the
 * smallest of them for as long as one city was the only city the tests built.
 */
const SIZES = [1, 1, 1, 2, 2, 3, 4, 6, 9, 12, 16, 20, 24]
const range = await Promise.all(SIZES.map((blocks, at) => town(`doors-size-${at}`, blocks)))

describe('a town of frontage with a few doors that open', () => {
  it('leaves most of the town shut at every size the panel builds', () => {
    // a floor applied to the batch rather than to the town turned this inside
    // out on a hamlet: six of nine plots open, and on one seed six of six
    for (const [at, built] of range.entries()) {
      const open = openPlots(built.world)
      const plots = built.world.plots().length
      const where = `${SIZES[at]}x${SIZES[at]} (${open.size} of ${plots})`
      expect(open.size, `${where} opens nothing at all`).toBeGreaterThan(0)
      expect(open.size * 2, `${where} is not mostly frontage`).toBeLessThan(plots)
      expect(open.size, `${where} opens more than the town is allowed`).toBeLessThanOrEqual(mostOpen(plots))
    }
  })

  it('still has work in it at every size, however few doors it opens', () => {
    // the floor exists for this: cut it too far and the writer has no hub, no
    // far side and nowhere to send the player between them
    for (const [at, built] of range.entries()) {
      expect(built.quests.length, `${SIZES[at]}x${SIZES[at]} has nothing to do in it`).toBeGreaterThan(0)
      expect(built.rejected, `${SIZES[at]}x${SIZES[at]} wrote work it could not verify`).toEqual([])
    }
  })

  it('opens somewhere to sit, to buy, to sleep and to work in any town big enough to hold them', () => {
    for (const built of [...range, small, big, other]) {
      // a town with as many doors as it has needs has to meet all of them
      if (built.world.interiors().length < NEEDS.length) continue
      const kinds = built.world.interiors().map((interior) => drawOf(built.world.charter(interior.kind)!))
      for (const [need, met] of NEEDS) {
        expect(kinds.some(met), `${built.world.name} has nowhere ${need.replace('somewhere ', '')}`).toBe(true)
      }
    }
  })

  it('closes a building all the way through: no people, no things, no rooms', () => {
    for (const built of [small, big]) {
      const open = openPlots(built.world)
      const { npcs, items } = homes(built.world)
      const closed = built.world.plots().filter((plot) => !open.has(plot.id))
      expect(closed.length).toBeGreaterThan(0)
      for (const plot of closed) {
        expect(built.world.npcsIn(plot.id), `${plot.name} is shut and still has people in it`).toEqual([])
      }
      for (const plot of [...npcs.values(), ...items.values()]) {
        expect(open.has(plot), 'somebody or something is inside a building that does not open').toBe(true)
      }
    }
  })

  it('never sends the player through a door that does not open', () => {
    let reached = 0
    for (const built of [small, big]) {
      const open = openPlots(built.world)
      const { npcs, items } = homes(built.world)
      const interiors = new Set(built.world.interiors().map((interior) => interior.id))
      for (const quest of built.quests) {
        const at = (plot: string | undefined, what: string) => {
          expect(plot, `${quest.title}: ${what} is nowhere`).toBeDefined()
          expect(open.has(plot!), `${quest.title}: ${what} is behind a door that does not open`).toBe(true)
          reached++
        }
        at(npcs.get(quest.giverNpcId), 'the person handing the job out')
        for (const step of quest.steps) {
          if (step.kind === 'talk' || step.kind === 'escort') at(npcs.get(step.npcId), `the ${step.kind} step`)
          if (step.kind === 'deliver') at(npcs.get(step.toNpcId), 'the person it goes to')
          if (step.kind === 'collect' || step.kind === 'deliver') {
            for (const itemId of [step.itemId, ...(step.alternates ?? [])]) at(items.get(itemId), 'a thing to pick up')
          }
          if (step.kind === 'goto' || step.kind === 'escort') {
            const plot = 'plotId' in step.place ? step.place.plotId : built.world.interior(step.place.interiorId)?.plotId
            at(plot, 'somewhere to walk to')
          }
          if (step.kind === 'stash') expect(interiors.has(step.interiorId), `${quest.title}: stashing it in a room that is not there`).toBe(true)
        }
      }
    }
    expect(reached, 'the quests reach into nothing at all').toBeGreaterThan(100)
  })

  it('opens different doors in two towns of a size, and the same ones twice over', async () => {
    const twice = await town('doors-big', 8)
    expect([...openPlots(twice.world)]).toEqual([...openPlots(big.world)])

    const one = openPlots(big.world)
    const two = openPlots(other.world)
    expect(one.size).not.toBe(two.size)
  })

  it('opens what a place has to offer rather than what it is called', () => {
    // the ranking has to beat picking at random: the doors that open are the
    // ones worth opening, near the top of what a door can be worth at all
    for (const built of [small, big, other]) {
      const pull = (plots: readonly { kind: string }[]) =>
        plots.reduce((sum, plot) => sum + pullOf(built.world.charter(plot.kind)!), 0) / Math.max(1, plots.length)
      const open = openPlots(built.world)
      const chosen = pull(built.world.plots().filter((plot) => open.has(plot.id)))
      expect(chosen, `${built.world.name} opens middling doors`).toBeGreaterThan(6)
      // a whole tier above the street: a door a place is worth is a counter, staff, stock or seats
      expect(chosen, `${built.world.name} opens what the street happens to hold`).toBeGreaterThan(pull(built.world.plots()) + 1)
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
      ...Array.from({ length: 50 }, (_, i) => ({ id: `shop_${i}`, charter: preset('shop'), nearness: 1, onAvenue: true, storied: false })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `flat_${i}`, charter: preset('apartment'), nearness: 0, onAvenue: false, storied: false })),
    ]
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const open = openDoors(frontages, new Rng(seed), FRESH)
      const beds = [...open].filter((id) => id.startsWith('flat_'))
      expect(beds.length, `${seed} left the town with nowhere to sleep`).toBeGreaterThan(0)
    }
  })

  it('opens the doors it is told to and no more', () => {
    const sizes = ['a', 'b', 'c', 'd'].map((seed) => openDoors(many(200), new Rng(seed), FRESH).size)
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(200 * 0.12 * 0.7)
      expect(size).toBeLessThanOrEqual(200 * 0.12 * 1.3)
    }
    expect(new Set(sizes).size, 'every town of a size opens the same number of doors').toBeGreaterThan(1)
  })
})

/** A town nothing has been built in yet. */
const FRESH = { built: 0, open: [] }

const preset = (word: string): ResolvedCharter => SHIPPED_CHARTERS.find((charter) => charter.word === word)!

/** A batch of buildings to hand the ranking, one of every kind and then round again. */
const many = (count: number): Frontage[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `plot_${i}`,
    charter: SHIPPED_CHARTERS[i % SHIPPED_CHARTERS.length]!,
    nearness: 1 - i / count,
    onAvenue: i % 3 === 0,
    storied: false,
  }))

describe('how many doors a town of any size opens', () => {
  it('keeps the majority of every town shut, from a hamlet to the widest grid', () => {
    for (let buildings = 3; buildings < 6000; buildings = Math.ceil(buildings * 1.07)) {
      for (const seed of ['a', 'b', 'c', 'd', 'e']) {
        const budget = new DoorBudget({ built: 0, open: 0 }, buildings, new Rng(seed))
        expect(budget.town * 2, `${buildings} buildings, ${budget.town} open`).toBeLessThan(buildings)
        expect(budget.town, `${buildings} buildings and nothing open`).toBeGreaterThan(0)
      }
    }
  })

  it('gives the smallest town a door anyway, rather than a town nobody can walk into', () => {
    for (const buildings of [1, 2, 3, 4]) {
      expect(mostOpen(buildings), `${buildings} buildings`).toBe(buildings > 4 ? 2 : 1)
    }
  })

  it('lets the majority-shut ceiling beat the floor in a town too small for both', () => {
    // a six-building hamlet cannot have four open and still be mostly frontage
    const budget = new DoorBudget({ built: 0, open: 0 }, 6, new Rng('hamlet'))
    expect(NEEDS.length).toBeGreaterThan(2)
    expect(budget.town).toBe(2)
  })

  it('opens the four things a town needs once it is big enough to hold them', () => {
    for (const seed of ['a', 'b', 'c']) {
      expect(new DoorBudget({ built: 0, open: 0 }, 20, new Rng(seed)).town).toBeGreaterThanOrEqual(NEEDS.length)
    }
  })

  it('counts a batch of new buildings against the town, not against itself', async () => {
    // a floor spent per batch opened six of every ten new plots, whatever the
    // city they were dropped into already had open
    const built = await town('doors-grow', 5)
    const before = built.world.interiors().length
    const added = await built.forge.extend(built.world, 20)
    expect(added.ok).toBe(true)
    const opened = built.world.interiors().length - before
    expect(opened, `20 new plots opened ${opened} doors`).toBeLessThanOrEqual(4)
    expect(built.world.interiors().length * 2).toBeLessThan(built.world.plots().length)
  })

  it('opens nothing more in a town already over its allowance', () => {
    expect(new DoorBudget({ built: 100, open: 90 }, 10, new Rng('full')).spare).toBe(0)
  })
})
