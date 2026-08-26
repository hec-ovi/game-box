import { err, ok, Rng, type Result, type SchemaViolation } from '@gb/kit'
import { validateQuest, type QuestDoc, type QuestProblem } from '@gb/quest'
import {
  cellCentre,
  questView,
  World,
  type IntegrityProblem,
  type Interior,
  type Item,
  type Premise,
  type Rect,
  type WorldError,
} from '@gb/world'
import { briefContract, type Brief } from './brief.ts'
import type { Dropped } from './charters/resolve.ts'
import { openPlacesFor, placesOnNewLand } from './interior/budget.ts'
import { Avenues } from './layout/avenues.ts'
import { cutDistricts, districtAt } from './layout/districts.ts'
import { streetLines } from './layout/lines.ts'
import { planStreets, type StreetPlan } from './layout/plan.ts'
import { nearnessIn, sitesInBlock, storeysFor, type PlotSite } from './layout/plots.ts'
import { layRoads } from './layout/roads.ts'
import { spreadSites, stationsWanted } from './layout/stations.ts'
import { paintStreets } from './layout/streets.ts'
import type { DistrictRequest, Narrator, SummaryLock, SummaryMachine, WorldSummary } from './narrator.ts'
import { districtNames } from './narrator/districts.ts'
import { writeEachPlace } from './narrator/one-at-a-time.ts'
import { Signs } from './narrator/signs.ts'
import { StreetNames } from './narrator/streets.ts'
import { readHistory } from './premise/history.ts'
import { premiseLines } from './premise/render.ts'
import { surfacesOf } from './populate.ts'
import { questDemand } from './quests/demand.ts'
import { assemble } from './raise/assemble.ts'
import { hangSigns, instanceRequests, planRaise, signRequests, type RaiseSetup } from './raise/plan.ts'
import type { Chosen } from './raise/planned.ts'
import { flavourOf } from './theme/flavour.ts'
import { kindWeights, stapleKinds } from './theme/plot-mix.ts'

export type ForgeError =
  | { readonly code: 'invalid-brief'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'unsound-world'; readonly problems: readonly IntegrityProblem[] }

export interface ForgeResult {
  readonly world: World
  readonly quests: readonly QuestDoc[]
  /** Quests the narrator wrote that did not hold up, and why. Kept, not hidden. */
  readonly rejected: ReadonlyArray<{ readonly index: number; readonly problems: readonly QuestProblem[] }>
  /** Kinds of place the history invented that the city would not take, and why. */
  readonly dropped: readonly Dropped[]
}

/**
 * How a finished city grows.
 *
 * Two kinds of growth, and a pack may ask for both. `places` opens doors that
 * were painted on: a plot that was a sign and a wall gains its interior, its
 * people and its things, so the streets are the streets anybody already played.
 * `blocks` is new land at the edge, and new land is a district: it goes up on
 * ground nothing has claimed and opens its own doors among itself.
 */
export interface Growth {
  /** Buildings to put up on empty land. A bare number means this. */
  readonly blocks?: number
  /** Painted-on doors to open in the frontage already standing. */
  readonly places?: number
}

/** The work a growth wrote: playable quests over the whole city, and the drafts that did not hold up. */
export interface GrownQuests {
  readonly quests: readonly QuestDoc[]
  readonly rejected: ForgeResult['rejected']
}

const GENERATOR_VERSION = '0.1.0'

/**
 * How tall `extend` builds into a gap, and how built up it counts the gap as.
 * A growth fills the holes in a town that is already standing, so it puts up
 * frontage rather than dropping a tower into a back yard.
 */
const EXTEND = { maxStoreys: 2, density: 1 } as const

/**
 * Builds a city from a brief: streets and plots by arithmetic, names and people
 * and quests by a narrator, then checks the result before handing it over.
 * Geometry is never left to the narrator, and nothing invented is trusted
 * without validation.
 */
export class Forge {
  #narrator: Narrator

  constructor(narrator: Narrator) {
    this.#narrator = narrator
  }

  async build(input: unknown): Promise<Result<ForgeResult, ForgeError>> {
    const parsed = briefContract.parse(input)
    if (!parsed.ok) return err({ code: 'invalid-brief', violations: parsed.error })
    const brief = parsed.value
    const rng = new Rng(brief.seed)

    const streets = planStreets(brief, rng.fork('streets'))
    // the town's history, before a plot is placed: it decides the kinds of
    // place the town has, the mix, which doors open, how every place is
    // written and what the main line is about
    const { brief: owner, asks } = brief
    const history = readHistory(
      await this.#narrator.writePremise?.({ theme: brief.theme, seed: brief.seed, ...(owner ? { brief: owner } : {}), ...(asks ? { asks } : {}) }),
    )
    const premise = history.premise
    const cityName = await this.#narrator.nameCity({ theme: brief.theme, seed: brief.seed, ...(premise ? { premise } : {}) })
    const found = World.found({
      name: cityName,
      theme: brief.theme,
      seed: brief.seed,
      width: streets.size.width,
      height: streets.size.height,
      // the history and the kinds of place go into the file, so a city somebody
      // is sent still knows what it is about and what each place is, and
      // growing it later grows it against the same story
      ...(premise ? { premise } : {}),
      charters: history.charters,
      ...(owner ? { brief: owner } : {}),
      ...(asks ? { asks } : {}),
      generator: { name: 'forge', version: GENERATOR_VERSION },
    })
    if (!found.ok) return err({ code: 'invalid-brief', violations: violationsOf(found.error) })
    const world = found.value
    paintStreets(world, streets)

    layRoads(world, streets.crossings, streets.exits)
    // the town is cut into its named parts before a plot is placed, so every
    // plot can say which one it stands in as it goes up
    const districts = await this.#cut(world, streets, rng.fork('districts'), premise)
    await this.#raise(world, this.#townSites(brief, streets, rng, premise, world, districts), {
      theme: brief.theme,
      ...(premise ? { premise } : {}),
      places: brief.openPlaces ?? openPlacesFor(world.grid.width * world.cellSize),
      signs: new Signs(brief.seed),
      streets: StreetNames.of(world),
      doors: rng.fork('doors'),
      people: rng,
    })

    const problems = world.check()
    if (problems.length) return err({ code: 'unsound-world', problems })

    const { quests, rejected } = await this.#writeQuests(world, premise, rng.fork('quests'))
    return ok({ world, quests, rejected, dropped: history.dropped })
  }

  /**
   * Grows a city that already exists: opens doors that were painted on, puts
   * new buildings up on land nothing has claimed, or both. Nothing already
   * standing is rewritten; the one thing a growth writes on the base is the
   * door pointer of a facade it opened.
   *
   * The facades go first, so the people and the things behind a door that was
   * always there are numbered before a building that was not.
   */
  async extend(world: World, growth: number | Growth, rng = new Rng(`${world.seed}/extend`)): Promise<Result<readonly string[], ForgeError>> {
    const blocks = typeof growth === 'number' ? growth : (growth.blocks ?? 0)
    const places = typeof growth === 'number' ? 0 : (growth.places ?? 0)
    // the city carries its own history, so what a growth writes is the same
    // kind of town as what is already standing
    const premise = world.premise()

    if (places > 0) {
      const facades = rng.fork('facades')
      await this.#raise(world, this.#facadeSites(world, facades), this.#growing(world, premise, world.interiors().length + places, facades.fork('people')))
    }
    const added =
      blocks > 0
        ? await this.#raise(world, this.#gapSites(world, blocks, rng, premise), this.#growing(world, premise, world.interiors().length + placesOnNewLand(blocks), rng.fork('extend/people')))
        : []

    const problems = world.check()
    if (problems.length) return err({ code: 'unsound-world', problems })
    return ok(added)
  }

  /**
   * The work a growth adds: the town's own appetite for side jobs, less the
   * quests it already carries, written over the whole city so a pack's errands
   * send the player back through the base as well as into what just opened.
   * Never nothing, because a pack nobody can do anything in is scenery. Ids
   * continue from the ones already handed out.
   */
  async extendQuests(world: World, existing: readonly QuestDoc[], rng = new Rng(`${world.seed}/extend`)): Promise<GrownQuests> {
    const summary = summarise(world, world.premise())
    const stream = rng.fork('more-quests')
    const from = existing.reduce((most, quest) => Math.max(most, Number(quest.id.split('_')[1] ?? 0) || 0), existing.length)
    const wanted = Math.max(1, questDemand(summary, stream) - existing.length)
    return this.#read(world, await this.#narrator.writeQuests({ summary, sideQuests: wanted, from }))
  }

  /** What every growth is raised against: the town's own theme, story, streets and door stream. */
  #growing(world: World, premise: Premise | undefined, places: number, people: Rng): RaiseSetup {
    return {
      theme: world.theme,
      ...(premise ? { premise } : {}),
      places,
      signs: new Signs(world.seed),
      streets: StreetNames.of(world),
      // the town's own stream: which doors open is a fact about the town, so a
      // growth ranks its frontage the way the town ranked its first three
      doors: new Rng(world.seed).fork('doors'),
      people,
    }
  }

  /**
   * Puts buildings up: plan the whole town with no awaits, ask about every place
   * that opens in one call and every sign over a shut door in another, both in
   * the air at once, then write it all in the order it was planned.
   *
   * The three steps are apart because the middle one is the only slow one, and
   * because a town that is planned before anything is asked can ask about all of
   * it at once. Nothing downstream depends on which answer landed first.
   */
  async #raise(world: World, chosen: readonly Chosen[], setup: RaiseSetup): Promise<string[]> {
    const planned = planRaise(world, chosen, setup)
    const requests = instanceRequests(planned, setup)
    const wantSigns = signRequests(planned, setup)
    // nothing to ask about is nothing asked: a growth that only opens doors
    // hangs no signs, and a batch that opens none writes no places
    const [written, signs] = await Promise.all([
      requests.length ? (this.#narrator.writeInstances?.(requests) ?? writeEachPlace(this.#narrator, requests)) : [],
      wantSigns.length ? (this.#narrator.namePlaces?.(wantSigns) ?? []) : [],
    ])
    return assemble(world, hangSigns(planned, signs), written)
  }

  /**
   * Cuts the town into its named parts and writes them into the world.
   *
   * The shapes are arithmetic and the names are invention, like everything
   * else here: the cut is the seed's, and a narrator that names its districts
   * is asked for all of them in one call. Whatever it will not write, or names
   * twice, is composed from the seed instead, so a city always comes out with
   * every part of it named and no two of them called the same thing.
   */
  async #cut(world: World, streets: StreetPlan, rng: Rng, premise: Premise | undefined): Promise<ReadonlyMap<number, string>> {
    // parks and plazas are cut in with the built blocks: a district is a part
    // of the town rather than a set of buildings, so the map fills and a green
    // square belongs to the quarter it stands in. The built blocks come first,
    // so a block's number here is its number in the plan
    const ground = [...streets.blocks, ...streets.open.map((one) => one.rect)]
    const cut = cutDistricts(ground, rng)
    if (!cut.length) return new Map()
    const story = premise ? premiseLines(premise) : undefined
    const requests: DistrictRequest[] = cut.map((one, index) => ({
      index,
      theme: world.theme,
      blocks: one.blocks.length,
      bearing: one.bearing,
      ...(story ? { premise: story } : {}),
    }))
    const written = (await this.#narrator.nameDistricts?.(requests)) ?? []
    const names = districtNames(cut, written, { theme: world.theme, seed: world.seed })
    const districts = cut.map((one, index) => ({
      id: world.mintId('district'),
      name: names[index]!,
      blocks: one.blocks.map((block) => ground[block]!),
    }))
    if (!world.recordDistricts(districts).ok) return new Map()
    return new Map(cut.flatMap((one, index) => one.blocks.map((block) => [block, districts[index]!.id] as const)))
  }

  /**
   * What a whole town is built out of. What kind of town it is decides the mix,
   * its own history pushes that further, the seed moves it around, and the few
   * places the town is known for, the ones the history demands included, are
   * dropped on seeded sites before the rest is rolled.
   */
  #townSites(brief: Brief, streets: StreetPlan, rng: Rng, premise: Premise | undefined, world: World, districts: ReadonlyMap<number, string>): Chosen[] {
    const charters = world.charters()
    const sites: PlotSite[] = []
    const inDistrict: (string | undefined)[] = []
    streets.blocks.forEach((block, index) => {
      for (const site of sitesInBlock(block, rng.fork(`block/${index}`))) {
        sites.push(site)
        inDistrict.push(districts.get(index))
      }
    })
    const avenues = Avenues.from(streets.columns, streets.rows)
    const mix = rng.fork('plots')
    const flavour = flavourOf(brief.theme)
    const weights = kindWeights(flavour, mix, charters, premise?.build)
    const wanted = stapleKinds(flavour, mix, charters, premise?.build.mustHave)
    const spots = mix.shuffle(sites.map((_, index) => index)).slice(0, wanted.length)
    const staples = new Map(spots.map((site, order) => [site, wanted[order]!]))
    // somewhere to board every five hundred metres, spread over the town: the mix never rolls the kind that boards
    const subway = charters.find((charter) => charter.transit === 'subway')
    if (subway) {
      const span = Math.max(streets.size.width, streets.size.height) * world.cellSize
      for (const site of spreadSites(sites, stationsWanted(span), new Set(staples.keys()), mix.fork('stations'))) staples.set(site, subway.word)
    }
    const byWord = new Map(charters.map((charter) => [charter.word, charter]))

    const chosen: Chosen[] = []
    for (const [index, site] of sites.entries()) {
      const siteRng = rng.fork(`site/${index}`)
      // both draws happen either way, so whether a site is a staple cannot shift the rest
      const built = siteRng.chance(brief.density)
      const rolled = siteRng.weighted(weights)
      const charter = byWord.get(staples.get(index) ?? (built ? rolled : ''))
      if (!charter) continue
      const onAvenue = avenues.has(site.entrance)
      const spot = { onAvenue, nearness: nearnessIn(streets.size, site.entrance) }
      const district = inDistrict[index]
      chosen.push({ site, charter, onAvenue, ...(district ? { district } : {}), storeys: storeysFor(charter, brief, siteRng, spot), rng: siteRng })
    }
    return chosen
  }

  /**
   * The facades a growth may open: every building standing with nothing behind
   * its door. They go into the ranking exactly as new land does, so a painted-on
   * door is chosen for what the place holds, the floor behind it, how near the
   * middle of town it stands and how far it is from the doors already open.
   */
  #facadeSites(world: World, rng: Rng): Chosen[] {
    const lines = streetLines(world)
    const avenues = Avenues.from(lines.columns, lines.rows)
    const chosen: Chosen[] = []
    for (const [index, plot] of world.plots().entries()) {
      const charter = world.charter(plot.kind)
      // a door that already opens is never opened again
      if (plot.interiorId || !charter) continue
      chosen.push({
        site: { rect: plot.rect, facing: plot.entrance.facing, entrance: plot.entrance.cell },
        charter,
        storeys: plot.storeys,
        onAvenue: avenues.has(plot.entrance.cell),
        rng: rng.fork(`facade/${plot.id}`),
        standing: { plotId: plot.id, name: plot.name, index },
      })
    }
    return chosen
  }

  /** What `extend` drops into the gaps: one building at a time, into land nothing has claimed. */
  #gapSites(world: World, count: number, rng: Rng, premise: Premise | undefined): Chosen[] {
    const chosen: Chosen[] = []
    const taken: Rect[] = []
    const charters = world.charters()
    for (let i = 0; i < count; i++) {
      const site = this.#freeSite(world, rng, taken)
      if (!site) break
      taken.push(site.rect)
      const word = rng.weighted(kindWeights(flavourOf(world.theme), rng.fork(`extend/mix/${i}`), charters, premise?.build))
      const charter = charters.find((one) => one.word === word)!
      const siteRng = rng.fork(`extend/${i}`)
      // new land stands in the part of town it was dropped into, so a growth
      // never adds a building the map cannot label
      const district = districtAt(world.districts(), site.rect)
      chosen.push({
        site,
        charter,
        onAvenue: false,
        ...(district ? { district: district.id } : {}),
        storeys: storeysFor(charter, EXTEND, siteRng, { onAvenue: false, nearness: 0 }),
        rng: siteRng,
      })
    }
    return chosen
  }

  async #writeQuests(world: World, premise: Premise | undefined, rng: Rng): Promise<GrownQuests> {
    const summary = summarise(world, premise)
    return this.#read(world, await this.#narrator.writeQuests({ summary, sideQuests: questDemand(summary, rng) }))
  }

  /** Nothing a narrator writes is trusted: every draft goes through `@gb/quest` against this city, and what fails comes back with why. */
  #read(world: World, raw: readonly unknown[]): GrownQuests {
    const quests: QuestDoc[] = []
    const rejected: Array<{ index: number; problems: readonly QuestProblem[] }> = []

    for (const [index, candidate] of raw.entries()) {
      const validated = validateQuest(candidate, questView(world))
      if (validated.ok) {
        quests.push(validated.value)
      } else {
        rejected.push({
          index,
          problems:
            validated.error.code === 'broken-flow'
              ? validated.error.problems
              : validated.error.violations.map((v) => ({ where: v.path, message: v.message })),
        })
      }
    }
    return { quests, rejected }
  }

  #freeSite(world: World, rng: Rng, taken: readonly Rect[]): PlotSite | undefined {
    // every one of these is inside the plot band whichever wall its door ends up on
    for (const size of [
      { w: 5, h: 6 },
      { w: 6, h: 5 },
      { w: 5, h: 5 },
    ]) {
      // nothing is on the ground yet, so a site already spoken for is skipped here
      const sites = world.buildSites(size.w, size.h).filter((rect) => !taken.some((claim) => overlaps(rect, claim)))
      if (!sites.length) continue
      const rect = rng.pick(sites)
      const facings = [
        { facing: 'south' as const, cell: { x: rect.x + Math.floor(rect.w / 2), y: rect.y + rect.h } },
        { facing: 'north' as const, cell: { x: rect.x + Math.floor(rect.w / 2), y: rect.y - 1 } },
        { facing: 'west' as const, cell: { x: rect.x - 1, y: rect.y + Math.floor(rect.h / 2) } },
        { facing: 'east' as const, cell: { x: rect.x + rect.w, y: rect.y + Math.floor(rect.h / 2) } },
      ]
      const door = facings.find((option) => world.grid.at(option.cell.x, option.cell.y) === 'sidewalk')
      if (door) return { rect, facing: door.facing, entrance: door.cell }
    }
    return undefined
  }
}

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The world refusing a spec means the brief asked for a city that cannot exist. */
function violationsOf(error: WorldError): readonly SchemaViolation[] {
  if (error.code === 'invalid-document') return error.violations
  if (error.code === 'inconsistent-world') return error.problems.map((p) => ({ path: p.where, message: p.message }))
  return [{ path: '(root)', message: error.message }]
}

/**
 * The abstract world a quest writer reads: what the town is about, its places,
 * who is in them, what is there, where its door is and what a thing can be left
 * on. No coordinates beyond the door, because that is all a quest ever needs to
 * measure a walk.
 */
export function summarise(world: World, premise?: Premise): WorldSummary {
  const asks = world.asks()
  const carried = new Map<string, string>()
  for (const placement of world.placements()) if (placement.at === 'npc') carried.set(placement.itemId, placement.npcId)
  return {
    cityName: world.name,
    theme: world.theme,
    ...(premise ? { premise } : {}),
    ...(asks ? { asks } : {}),
    districts: world.districts().map((district) => ({ districtId: district.id, name: district.name })),
    places: world.plots().map((plot) => {
      const interior = world.interiors().find((i) => i.plotId === plot.id)
      const npcs = interior ? world.npcs().filter((n) => n.station?.interiorId === interior.id) : []
      const roomOf = new Map((interior?.anchors ?? []).map((anchor) => [anchor.id, anchor.roomId]))
      const items = interior
        ? world
            .placements()
            .flatMap((p) => {
              if (p.at !== 'anchor' || p.interiorId !== interior.id) return []
              const item = world.item(p.itemId)
              return item ? [{ item, roomId: roomOf.get(p.anchorId) }] : []
            })
        : []
      const surface = interior ? surfacesOf(interior.anchors)[0] : undefined
      const work = world.charter(plot.kind)?.work
      return {
        plotId: plot.id,
        ...(interior ? { interiorId: interior.id } : {}),
        kind: plot.kind,
        name: plot.name,
        ...(plot.district ? { districtId: plot.district } : {}),
        door: cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, world.cellSize),
        ...(surface ? { stashAnchorId: surface.id } : {}),
        ...(work ? { work } : {}),
        ...(interior?.forSale !== undefined ? { forSale: interior.forSale } : {}),
        ...(interior ? { locks: locksOf(interior, items, carried), machines: machinesOf(interior) } : {}),
        npcs: npcs.map((n) => {
          const roomId = n.station ? roomOf.get(n.station.anchorId) : undefined
          return { npcId: n.id, name: n.name, role: n.role, ...(roomId ? { roomId } : {}) }
        }),
        items: items.map(({ item, roomId }) => ({
          itemId: item.id,
          name: item.name,
          archetype: item.archetype,
          ...(item.ownerNpcId ? { ownerNpcId: item.ownerNpcId } : {}),
          value: item.value,
          ...(roomId ? { roomId } : {}),
        })),
      }
    }),
  }
}

/** Every locked door of a place: what opens it, who has that in their pocket, and what is lying behind it. */
function locksOf(interior: Interior, items: ReadonlyArray<{ item: Item; roomId: string | undefined }>, carried: ReadonlyMap<string, string>): SummaryLock[] {
  const named = new Map(interior.rooms.map((room) => [room.id, room.name]))
  return interior.doors
    .filter((door) => door.locked)
    .map((door) => {
      const street = door.from === 'outside'
      const keeper = door.keyItemId ? carried.get(door.keyItemId) : undefined
      return {
        doorId: door.id,
        room: named.get(door.to) ?? door.to,
        roomId: door.to,
        street,
        ...(door.keyItemId ? { keyItemId: door.keyItemId } : {}),
        ...(keeper ? { keeperNpcId: keeper } : {}),
        ...(door.password ? { password: door.password } : {}),
        behind: items.filter(({ roomId }) => street || roomId === door.to).map(({ item }) => item.id),
      }
    })
}

/** Every screen of a place: what it runs and what opens it. */
function machinesOf(interior: Interior): SummaryMachine[] {
  return interior.furniture.flatMap((piece) =>
    piece.machine
      ? [{ machineId: piece.machine.id, program: piece.machine.program, locked: piece.machine.locked, ...(piece.machine.password ? { password: piece.machine.password } : {}), roomId: piece.roomId }]
      : [],
  )
}
