import { Rng } from '@gb/kit'
import { SHIPPED_CHARTERS, type ResolvedCharter, type World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { DoorBudget, mostOpen, OPEN_PLACES, openPlacesFor, placesOnNewLand } from '../src/interior/budget.ts'
import { drawOf, KEYSTONES, pullOf } from '../src/interior/draw.ts'
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

const town = (seed: string, blocks = 5, more: Record<string, unknown> = {}) => buildTown(seed, { blocksX: blocks, blocksY: blocks, ...more })

const [small, big, other] = await Promise.all([town('doors-small', 3), town('doors-big', 8), town('doors-other', 8)])

/**
 * Every size the creation panel offers, built for real. The rule inverted on the
 * smallest of them for as long as one city was the only city the tests built.
 */
const SIZES = [1, 1, 1, 2, 2, 3, 4, 6, 9, 12, 16, 20, 24]
const range = await Promise.all(SIZES.map((blocks, at) => town(`doors-size-${at}`, blocks)))

/** One seed at a hamlet, a town and a city: the only thing moving is how much scenery there is. */
const ABSOLUTE = [2, 12, 30]
const sizes = await Promise.all(ABSOLUTE.map((blocks) => town('doors-absolute', blocks)))

describe('a town of frontage with a few doors that open', () => {
  it('opens doors in step with how many buildings there are, so a bigger city is not a thinner one', () => {
    // it used to follow how far the town was across, and a town spreads as its
    // span while it fills as its span squared, so every city built bigger came
    // out thinner: a twenty by twenty town of 2,781 buildings opened eleven
    // doors. It follows the buildings now
    const opened = sizes.map((built) => built.world.interiors().length)
    const wanted = sizes.map((built) => openPlacesFor(built.world.plots().length))
    expect(opened, `${opened.join(', ')} places over ${ABSOLUTE.join(', ')} blocks`).toEqual(wanted)
    expect(opened[0], 'a town you can walk across wants no more than a handful').toBe(OPEN_PLACES)
    expect(opened[2]!, 'a city opens far more doors than a hamlet').toBeGreaterThan(opened[0]! * 10)

    // still mostly frontage: a city where every other building opens is not a
    // city, it is a corridor of doors
    const plots = sizes.map((built) => built.world.plots().length)
    const share = opened[2]! / plots[2]!
    expect(share, 'the doors are creeping towards a share of every plot').toBeLessThan(0.05)
    // and the count keeps step with the size rather than flattening off
    expect(opened[2]! / opened[1]!, 'a city is barely better off than a town').toBeGreaterThan(1.5)
    expect(plots[2]! / plots[0]!, 'the three sizes are not far enough apart to prove anything').toBeGreaterThan(50)
    // and everybody in the file is in one of them
    for (const built of sizes) {
      const open = openPlots(built.world)
      const { npcs } = homes(built.world)
      expect(npcs.size, `${built.world.name} has nobody in it`).toBeGreaterThan(5)
      expect(built.world.npcs().length, `${built.world.name} stations people outside its places`).toBe(npcs.size)
      expect([...new Set(npcs.values())].every((plot) => open.has(plot))).toBe(true)
    }
  })

  it('takes as many doors as the brief asks for, and no more', async () => {
    const wide = await town('doors-wide', 6, { openPlaces: 9 })
    expect(wide.world.interiors().length).toBe(9)
    expect(new Set(wide.world.interiors().map((interior) => interior.kind)).size, 'nine doors on one kind of place').toBeGreaterThan(3)
  })

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

  it('spends its first doors on its keystones, and its third on a home', () => {
    for (const built of [...range, small, big, other]) {
      // three doors is the whole game, so which three is not left to a ranking:
      // a counter to buy over, a room somebody is served in, and a home
      const drawn = built.world.interiors().map((interior) => drawOf(built.world.charter(interior.kind)!))
      const doors = `${built.world.name} (${drawn.length} doors)`
      expect(drawn.some(KEYSTONES[0]![1]), `${doors} has nowhere to buy anything over a counter`).toBe(true)
      if (drawn.length < OPEN_PLACES) continue
      expect(drawn.some(KEYSTONES[1]![1]), `${doors} has nowhere to sit down and be served`).toBe(true)
      expect(built.world.interiors().some((interior) => interior.forSale !== undefined), `${doors} sells nobody a home`).toBe(true)
    }
  })

  it('opens no door onto an empty room', () => {
    // a home on the market used to be emptied on its way to the deed, which was
    // one place in twenty-four and is one door in three
    for (const built of [...range, small, big, other]) {
      for (const interior of built.world.interiors()) {
        expect(built.world.npcsIn(interior.plotId).length, `${built.world.name}: its ${interior.kind} opens onto an empty room`).toBeGreaterThan(0)
      }
    }
  })

  it('always opens somewhere work is handed over a counter', () => {
    for (const built of [...range, small, big, other]) {
      const behind = built.world.interiors().filter((interior) => {
        if (!drawOf(built.world.charter(interior.kind)!).trades) return false
        const counters = new Set(interior.anchors.filter((anchor) => anchor.kind === 'serve').map((anchor) => anchor.id))
        return built.world.npcsIn(interior.plotId).some((npc) => npc.station && counters.has(npc.station.anchorId))
      })
      expect(behind.length, `${built.world.name} has nobody behind a counter`).toBeGreaterThan(0)
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

    const one = [...openPlots(big.world)].join()
    const two = [...openPlots(other.world)].join()
    expect(one, 'two towns of a size open the same plots').not.toBe(two)
  })

  it('opens what a place has to offer rather than what it is called', () => {
    // the ranking has to beat picking at random: the doors that open are the
    // ones worth opening, near the top of what a door can be worth at all
    for (const built of [small, big, other]) {
      const pull = (plots: readonly { kind: string }[]) =>
        plots.reduce((sum, plot) => sum + pullOf(built.world.charter(plot.kind)!), 0) / Math.max(1, plots.length)
      const open = openPlots(built.world)
      // a home opens for the player to buy, not for what it holds, so it is not what the ranking is measured on
      const chosen = pull(built.world.plots().filter((plot) => open.has(plot.id) && !built.world.charter(plot.kind)!.residential))
      expect(chosen, `${built.world.name} opens middling doors`).toBeGreaterThan(6)
      // a whole tier above the street, where the street leaves a tier under the most a door can be worth
      const best = Math.max(...built.world.charters().map(pullOf))
      expect(chosen, `${built.world.name} opens what the street happens to hold`).toBeGreaterThanOrEqual(Math.min(pull(built.world.plots()) + 1, best - 0.5))
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
})

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

  it('gives new land its own doors, and opens none of the city it grew out of', async () => {
    // a growth's new blocks are a district: they open the town's own number of
    // places among themselves, and the city they joined is the city it was
    const built = await town('doors-grow', 5)
    const standing = new Set(built.world.plots().map((plot) => plot.id))
    const before = openPlots(built.world)
    const added = await built.forge.extend(built.world, 20)
    expect(added.ok).toBe(true)
    if (!added.ok) return

    const opened = [...openPlots(built.world)].filter((plotId) => !before.has(plotId))
    expect(opened.length, 'new land opened no door at all').toBe(placesOnNewLand(added.value.length))
    expect(opened.every((plotId) => !standing.has(plotId)), 'new land opened a door in the city it joined').toBe(true)
  })

  it('opens a door that was painted on, and only as many as it was asked for', async () => {
    const built = await town('doors-facade', 5)
    const before = openPlots(built.world)
    const plots = built.world.plots().length
    const grown = await built.forge.extend(built.world, { places: 2 })
    expect(grown.ok).toBe(true)
    if (!grown.ok) return

    // the matrix does not change: no plot is put up, two of the ones standing gain an interior
    expect(grown.value).toEqual([])
    expect(built.world.plots().length).toBe(plots)
    const opened = [...openPlots(built.world)].filter((plotId) => !before.has(plotId))
    expect(opened.length).toBe(2)
    for (const plotId of opened) expect(before.has(plotId), 'a place that was already open was opened again').toBe(false)
  })

  it('opens nothing more in a town already over its allowance', () => {
    expect(new DoorBudget({ built: 100, open: 90 }, 10, OPEN_PLACES).spare).toBe(0)
  })
})
