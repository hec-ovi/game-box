import { ok, Rng } from '@gb/kit'
import { World, type Premise } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Forge, OfflineNarrator, premiseLines } from '../src/index.ts'
import type { Instance, InstanceRequest, Narrator, Written } from '../src/narrator.ts'
import { FLAVOURS } from '../src/theme/flavour.ts'
import { tradesFor, turnsFor } from '../src/premise/wording.ts'
import { composePremise } from '../src/premise/write.ts'
import { TRADES } from '../src/premise/wording.generated.ts'
import { digest } from './support.ts'

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

/**
 * A narrator told what the town is about, offline in every other respect. It is
 * the shape `@gb/scribe` has: a premise from somewhere else, and the same city
 * built around it.
 */
class Told implements Narrator {
  readonly seen: InstanceRequest[] = []
  #offline: OfflineNarrator
  #premise: unknown

  constructor(seed: string, premise: unknown) {
    this.#offline = new OfflineNarrator(seed)
    this.#premise = premise
  }

  async writePremise(): Promise<Written<Premise>> {
    return ok(this.#premise as Premise)
  }

  nameCity = (input: Parameters<Narrator['nameCity']>[0]) => this.#offline.nameCity(input)
  namePlace = (input: Parameters<Narrator['namePlace']>[0]) => this.#offline.namePlace(input)
  describeNpc = (input: Parameters<Narrator['describeNpc']>[0]) => this.#offline.describeNpc(input)
  describeItem = (input: Parameters<Narrator['describeItem']>[0]) => this.#offline.describeItem(input)
  writeQuests = (input: Parameters<Narrator['writeQuests']>[0]) => this.#offline.writeQuests(input)

  async writeInstances(requests: readonly InstanceRequest[]): Promise<Written<readonly Instance[]>> {
    this.seen.push(...requests)
    return this.#offline.writeInstances(requests)
  }
}

/** A narrator from before there was a history stage: no `writePremise` at all. */
class Storyless implements Narrator {
  readonly seen: InstanceRequest[] = []
  #offline = new OfflineNarrator('storyless')
  nameCity = (input: Parameters<Narrator['nameCity']>[0]) => this.#offline.nameCity(input)
  namePlace = (input: Parameters<Narrator['namePlace']>[0]) => this.#offline.namePlace(input)
  describeNpc = (input: Parameters<Narrator['describeNpc']>[0]) => this.#offline.describeNpc(input)
  describeItem = (input: Parameters<Narrator['describeItem']>[0]) => this.#offline.describeItem(input)
  writeQuests = (input: Parameters<Narrator['writeQuests']>[0]) => this.#offline.writeQuests(input)
  async writeInstances(requests: readonly InstanceRequest[]): Promise<Written<readonly Instance[]>> {
    this.seen.push(...requests)
    return this.#offline.writeInstances(requests)
  }
}

const SEED = 'one-history'
const SIZE = { blocksX: 5, blocksY: 5 }

async function build(narrator: Narrator, overrides: Record<string, unknown> = {}) {
  const built = await new Forge(narrator).build({ theme: 'quiet coastal town', seed: SEED, ...SIZE, ...overrides })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  return built.value
}

const counts = (kinds: readonly string[]): Map<string, number> => {
  const held = new Map<string, number>()
  for (const kind of kinds) held.set(kind, (held.get(kind) ?? 0) + 1)
  return held
}

describe('a city written against a history', () => {
  it('builds two different towns out of one seed and two histories, and the same town twice out of one', async () => {
    // the whole point of the stage: a premise nothing can measure costs a call
    // and buys a feeling
    const [shipping, campus, again] = await Promise.all([
      build(new Told(SEED, SHIPPING)),
      build(new Told(SEED, CAMPUS)),
      build(new Told(SEED, SHIPPING)),
    ])

    expect(digest(again.world.toJSON()), 'one history built two towns').toBe(digest(shipping.world.toJSON()))
    expect(digest(again.quests)).toBe(digest(shipping.quests))
    expect(digest(campus.world.toJSON()), 'two histories built one town').not.toBe(digest(shipping.world.toJSON()))

    // the push is measured over a few seeds: one town's dice can halve a kind on their own
    const seeds = [SEED, 'two-histories', 'three-histories', 'four-histories', 'five-histories']
    const towns = await Promise.all(seeds.flatMap((seed) => [SHIPPING, CAMPUS].map((premise) => build(new Told(seed, premise), { seed }))))
    const port = counts(towns.filter((_, at) => at % 2 === 0).flatMap((town) => town.world.plots().map((plot) => plot.kind)))
    const college = counts(towns.filter((_, at) => at % 2 === 1).flatMap((town) => town.world.plots().map((plot) => plot.kind)))
    expect(port.get('warehouse')!, 'the port has no more sheds than the campus town').toBeGreaterThan(college.get('warehouse')! * 2)
    expect(port.get('market')!, 'the port has no more of a market than the campus town').toBeGreaterThan(college.get('market')! * 2)
    expect(college.get('cafe')!, 'the campus town has no more cafes than the port').toBeGreaterThan(port.get('cafe')! * 2)
  })

  it('puts up what the history demands, and opens one of them', async () => {
    // "a hospital, because of the flood" has to be a building, not a sentence
    for (const [premise, demanded] of [
      [SHIPPING, 'warehouse'],
      [CAMPUS, 'office'],
    ] as const) {
      const towns = await Promise.all(
        ['demand-1', 'demand-2', 'demand-3'].map((seed) => build(new Told(seed, premise), { seed, blocksX: 3, blocksY: 3 })),
      )
      for (const { world } of towns) {
        expect(world.plotsOfKind(demanded).length, `${world.name} has no ${demanded} at all`).toBeGreaterThan(0)
      }
      const opened = towns.filter(({ world }) =>
        world.interiors().some((interior) => interior.kind === demanded),
      )
      expect(opened.length, `no town opened the ${demanded} its history is about`).toBeGreaterThan(1)
    }
  })

  it('writes the history into the city file, and grows the city later against the one it started from', async () => {
    // a city that is steered by a history and does not carry it forgets what it
    // is: whoever it is sent to cannot read it, and its empty land fills up with
    // a town of no particular kind
    const forge = new Forge(new Told('grow', SHIPPING))
    const built = await forge.build({ theme: 'quiet coastal town', seed: 'grow', blocksX: 8, blocksY: 8 })
    if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 200))
    expect(built.value.world.premise()).toEqual(SHIPPING)

    const document = built.value.world.toJSON()
    const { premise: _lost, ...forgotten } = document as Record<string, unknown>
    // the same city on the same land with the same hand of dice, once with its
    // history and once without: every difference below is the history alone
    const grown = ([document, forgotten] as const).map((value) => {
      // a copy each: the two cities are grown side by side and must not share a plot
      const loaded = World.load(structuredClone(value))
      expect(loaded.ok, 'the city would not reopen').toBe(true)
      if (!loaded.ok) throw new Error('unreachable')
      const world = loaded.value
      const standing = new Set(world.plots().map((plot) => plot.id))
      return { world, standing }
    })
    expect(grown[0]!.world.premise(), 'the history did not survive the file').toEqual(SHIPPING)
    expect(grown[1]!.world.premise()).toBeUndefined()

    const added = await Promise.all(
      grown.map(async ({ world, standing }) => {
        const grew = await forge.extend(world, 120, new Rng('one-hand'))
        expect(grew.ok).toBe(true)
        expect(world.premise(), 'growing the city rewrote its history').toEqual(world === grown[0]!.world ? SHIPPING : undefined)
        return counts(world.plots().filter((plot) => !standing.has(plot.id)).map((plot) => plot.kind))
      }),
    )

    // how far a growth leans towards the story: the kinds it asks for, less the
    // kinds it has less use for. The city that kept its history leans twice as far
    const held = (counted: Map<string, number>, kinds: readonly string[]) => kinds.reduce((sum, kind) => sum + (counted.get(kind) ?? 0), 0)
    const lean = (counted: Map<string, number>) => held(counted, SHIPPING.build.moreOf) - held(counted, SHIPPING.build.fewerOf)
    expect(lean(added[0]!), 'the city grew the same either way').toBeGreaterThan(lean(added[1]!) * 1.5)
  })

  it('shows every place that opens the town it stands in', async () => {
    const told = new Told(SEED, SHIPPING)
    await build(told)
    expect(told.seen.length, 'the narrator was asked about no place at all').toBeGreaterThan(2)
    for (const request of told.seen) {
      expect(request.premise, `${request.kind} was written knowing nothing about the town`).toBe(premiseLines(SHIPPING))
    }

    // and a narrator that writes no history still gets a town, with nothing said about it
    const storyless = new Storyless()
    const { world } = await build(storyless)
    expect(world.check()).toEqual([])
    expect(storyless.seen.every((request) => request.premise === undefined)).toBe(true)
  })

  it('writes the main line about what the history put at stake, and the fork about who wants what', async () => {
    const { quests } = await build(new Told(SEED, SHIPPING))
    const main = quests.filter((quest) => quest.kind === 'main')
    expect(main.length).toBeGreaterThan(2)
    for (const quest of main) {
      expect(quest.summary, `${quest.title} is about nothing in particular`).toContain(SHIPPING.stake)
    }

    const options = main.flatMap((quest) => quest.steps.filter((step) => step.kind === 'choice').flatMap((step) => step.options.map((option) => option.label)))
    expect(options.length, 'the line never makes the player pick a side').toBeGreaterThan(1)
    for (const side of SHIPPING.sides) {
      expect(options.some((label) => label.includes(side.name)), `nothing on the fork is about ${side.name}`).toBe(true)
    }
  })

  it('drops a history that does not hold up and builds the town anyway', async () => {
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
      const told = new Told(SEED, junk)
      const { world, rejected } = await build(told)
      expect(world.check(), `${JSON.stringify(junk).slice(0, 40)} built a broken city`).toEqual([])
      expect(rejected).toEqual([])
      expect(told.seen.every((request) => request.premise === undefined)).toBe(true)
    }
  })

  it('has a history to draw on for every kind of town it can read a theme as', () => {
    // a flavour with no wording is a town that cannot be built at all: the
    // composer picks from an empty list and throws halfway through a city
    for (const flavour of FLAVOURS) {
      expect(tradesFor(flavour).length, `${flavour} lives on nothing`).toBeGreaterThan(0)
      expect(turnsFor(flavour).length, `nothing has ever happened to a ${flavour} town`).toBeGreaterThan(1)
    }
    const written = composePremise('dense neon port city', new Rng('offline')).history
    expect(written.sides.length).toBe(2)
    expect(written.build.mustHave.length).toBeGreaterThan(0)
    // and what the trade wants more of is never also what it wants less of
    for (const kind of written.build.fewerOf) {
      expect(written.build.moreOf, `${kind} is both wanted and not`).not.toContain(kind)
      expect(written.build.mustHave).not.toContain(kind)
    }
  })

  it('names a town after what it lives on', async () => {
    const words = new Set(TRADES.map((trade) => trade.word))
    const names = await Promise.all(
      ['named-1', 'named-2', 'named-3', 'named-4', 'named-5', 'named-6', 'named-7', 'named-8'].map(async (seed) => {
        const built = await new Forge(new OfflineNarrator(seed)).build({ theme: 'quiet coastal town', seed, blocksX: 2, blocksY: 2 })
        if (!built.ok) throw new Error('the town would not build')
        return built.value.world.name
      }),
    )
    const named = names.filter((name) => words.has(name.split(' ').at(-1)!))
    expect(named.length, `none of ${names.join(', ')} is named after what its town lives on`).toBeGreaterThan(2)
  })
})

describe('a history that fails the contract in one place', () => {
  it('keeps every field that holds up and drops only the word that does not', async () => {
    // one building kind the game has not got, and one side missing its wants:
    // the rest of the history is what the town is built on
    const broken = {
      ...SHIPPING,
      sides: [...SHIPPING.sides, { name: 'the harbourmaster' }],
      build: { moreOf: ['warehouse', 'casino', 'bar'], fewerOf: ['office'], mustHave: ['warehouse', 'lighthouse'] },
    }
    const built = await build(new Told(SEED, broken))
    const premise = built.world.premise()
    expect(premise, 'the whole history was thrown away for one bad word').toBeDefined()
    expect(premise!.livesOn).toBe(SHIPPING.livesOn)
    expect(premise!.sides).toEqual(SHIPPING.sides)
    expect(premise!.build).toEqual({ moreOf: ['warehouse', 'bar'], fewerOf: ['office'], mustHave: ['warehouse'] })
    expect(built.world.plotsOfKind('warehouse').length).toBeGreaterThan(0)
  })

  it('still drops a history nothing can be salvaged from', async () => {
    const built = await build(new Told(SEED, { livesOn: 'the sea', sides: [] }))
    expect(built.world.premise()).toBeUndefined()
  })
})
