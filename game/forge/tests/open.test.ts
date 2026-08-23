import { Rng } from '@gb/kit'
import { BUILDING_KINDS, type World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { drawOf, NEEDS, openDoors, pullOf, type Frontage } from '../src/interior/open.ts'
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

describe('a town of frontage with a few doors that open', () => {
  it('leaves most of the town as buildings you cannot walk into', () => {
    for (const built of [small, big, other]) {
      const open = openPlots(built.world)
      const share = open.size / built.world.plots().length
      expect(share, `${built.world.name} opens ${(share * 100).toFixed(0)}% of its doors`).toBeLessThan(0.25)
      expect(open.size, `${built.world.name} opens nothing`).toBeGreaterThanOrEqual(6)
    }
  })

  it('opens somewhere to sit, to buy, to sleep and to work, however small the town', () => {
    for (const built of [small, big, other]) {
      const kinds = built.world
        .interiors()
        .map((interior) => interior.kind)
        .map(drawOf)
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
    // the ranking has to beat picking at random: the doors that open are the ones worth opening
    const open = openPlots(big.world)
    const pull = (plots: readonly { kind: (typeof BUILDING_KINDS)[number] }[]) =>
      plots.reduce((sum, plot) => sum + pullOf(plot.kind), 0) / Math.max(1, plots.length)
    const chosen = pull(big.world.plots().filter((plot) => open.has(plot.id)))
    expect(chosen).toBeGreaterThan(pull(big.world.plots()) * 1.4)
  })

  it('weighs a kind of building by what its own interior turns out to hold', () => {
    for (const kind of BUILDING_KINDS) {
      const draw = drawOf(kind)
      expect(draw.staff + draw.seats + draw.beds + draw.stock, `${kind} offers nothing at all`).toBeGreaterThan(0)
      expect(drawOf(kind), `${kind} is weighed differently on a second look`).toEqual(draw)
    }
    // a place with staff and stock outranks one with neither, whatever either is called
    const rich = BUILDING_KINDS.filter((kind) => drawOf(kind).staff > 0 && drawOf(kind).stock > 0)
    const bare = BUILDING_KINDS.filter((kind) => drawOf(kind).staff === 0)
    expect(rich.length).toBeGreaterThan(0)
    expect(bare.length).toBeGreaterThan(0)
    for (const kind of rich) for (const other of bare) expect(pullOf(kind)).toBeGreaterThan(pullOf(other))
  })

  it('opens somewhere to sleep even when nowhere with a bed is worth opening', () => {
    // fifty shops on the good streets and three flats out at the edge: the ranking
    // would take the shops and leave the town with nowhere to sleep
    const frontages: Frontage[] = [
      ...Array.from({ length: 50 }, (_, i) => ({ plotId: `shop_${i}`, kind: 'shop' as const, nearness: 1 })),
      ...Array.from({ length: 3 }, (_, i) => ({ plotId: `flat_${i}`, kind: 'apartment' as const, nearness: 0 })),
    ]
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const open = openDoors(frontages, new Rng(seed))
      const beds = [...open].filter((plotId) => plotId.startsWith('flat_'))
      expect(beds.length, `${seed} left the town with nowhere to sleep`).toBeGreaterThan(0)
    }
  })

  it('opens the doors it is told to and no more', () => {
    const frontages: Frontage[] = Array.from({ length: 200 }, (_, i) => ({
      plotId: `plot_${i}`,
      kind: BUILDING_KINDS[i % BUILDING_KINDS.length]!,
      nearness: 1 - i / 200,
    }))
    const sizes = ['a', 'b', 'c', 'd'].map((seed) => openDoors(frontages, new Rng(seed)).size)
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(200 * 0.12 * 0.7)
      expect(size).toBeLessThanOrEqual(200 * 0.12 * 1.3)
    }
    expect(new Set(sizes).size, 'every seed opens the same number of doors').toBeGreaterThan(1)
  })
})
