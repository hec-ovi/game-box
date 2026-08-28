import { err, ok, Rng, type Result, type SchemaViolation } from '@gb/kit'
import { validateQuest, type QuestDoc, type QuestProblem } from '@gb/quest'
import { questView, World, type IntegrityProblem, type Premise, type Rect, type WorldError } from '@gb/world'
import { briefContract, type Brief } from './brief.ts'
import type { Dropped } from './charters/resolve.ts'
import { openPlacesFor, placesOnNewLand } from './interior/budget.ts'
import { Avenues } from './layout/avenues.ts'
import { cutDistricts, districtAt } from './layout/districts.ts'
import { streetLines } from './layout/lines.ts'
import { planStreets, type StreetPlan } from './layout/plan.ts'
import { nearnessIn, sitesInBlock, type PlotSite } from './layout/plots.ts'
import { Skyline } from './layout/skyline.ts'
import { layRoads } from './layout/roads.ts'
import { spreadSites, stationsWanted } from './layout/stations.ts'
import { paintStreets } from './layout/streets.ts'
import { askCityName, askSigns, askZoneNames, type Asking, type Zone } from './naming/ask.ts'
import { bindings, bindNames } from './naming/bind.ts'
import { instanceName, PLACEHOLDER_CITY, zoneName } from './naming/placeholders.ts'
import { writeNames, type WrittenNames } from './naming/write.ts'
import type { Instance, InstanceCasting, Narrator, Unwritten, Written, WritingStage } from './narrator.ts'
import { writeEachPlace } from './narrator/one-at-a-time.ts'
import { Signs } from './narrator/signs.ts'
import { StreetNames } from './narrator/streets.ts'
import { readHistory, type Founding } from './premise/history.ts'
import { castOf, type Casting } from './quests/casting.ts'
import { questDemand } from './quests/demand.ts'
import { assemble, dress, PlaceNames, raiseShell } from './raise/assemble.ts'
import { hangSigns, instanceRequests, nameRequests, planRaise, wantsName, type RaiseSetup } from './raise/plan.ts'
import type { Chosen, PlannedSite } from './raise/planned.ts'
import { planSummary, summarise } from './summary.ts'
import { flavourOf } from './theme/flavour.ts'
import { kindWeights, stapleKinds } from './theme/plot-mix.ts'

export type ForgeError =
  | { readonly code: 'invalid-brief'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'unsound-world'; readonly problems: readonly IntegrityProblem[] }
  /** A stage of the writing stopped. `message` is the sentence to show whoever asked for the city. */
  | { readonly code: 'unwritten'; readonly stage: WritingStage; readonly message: string }

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

/** A town laid out: the world with its streets, roads and parts in it, every site a building goes up on, and the parts waiting to be named. */
interface LaidOut {
  readonly world: World
  readonly sites: readonly Chosen[]
  readonly zones: readonly Zone[]
}

const GENERATOR_VERSION = '0.1.0'

/**
 * How tall `extend` builds into a gap. A growth fills the holes in a town that
 * is already standing, so it puts up frontage rather than dropping a tower into
 * a back yard.
 */
const EXTEND = new Skyline({ maxStoreys: 2, density: 1 })

/**
 * Builds a city from a brief: streets and plots by arithmetic, the history, the
 * work, the names and the people by a narrator, in that order, then checks the
 * result before handing it over. Geometry is never left to the narrator, and
 * nothing invented is trusted without validation.
 *
 * `plan` is the arithmetic half on its own: the town a brief lays out, with
 * nothing written into it and nobody asked anything.
 */
export class Forge {
  #narrator: Narrator

  constructor(narrator: Narrator) {
    this.#narrator = narrator
  }

  /**
   * Builds a city, in the order the parts of it actually depend on each other:
   *
   * 1. **The history.** Written from the brief before a plot is placed. It
   *    decides the mix of buildings, which doors open and what the main line is
   *    about.
   * 2. **The architecture.** Streets, roads, the parts of town and every
   *    building, all arithmetic, all under placeholder names: `Zone 1`,
   *    `Instance 1`. Nothing is asked of anybody.
   * 3. **The work.** The quests are written against that bare architecture, so
   *    what they name is a post the plan cut and a building that stands there.
   * 4. **The names.** The city, every part of it and every door in it, out of
   *    the story and out of what the work does where. Written over the
   *    placeholders in one pass.
   * 5. **The people and the insides.** Each place that opens is written whole,
   *    told its name and the cast the quests already need standing in it, and
   *    the town is filled in around them.
   * 6. **The binding.** The lines the quests were written under are bound to the
   *    names that landed, and every draft goes through `@gb/quest` against the
   *    finished city.
   *
   * The order is the whole point. A quest written after the people were
   * invented can name somebody who is not in the building the map points at;
   * a quest written before them cannot, because the people are written to it.
   */
  async build(input: unknown): Promise<Result<ForgeResult, ForgeError>> {
    const parsed = briefContract.parse(input)
    if (!parsed.ok) return err({ code: 'invalid-brief', violations: parsed.error })
    const brief = parsed.value
    const rng = new Rng(brief.seed)
    const { brief: owner, asks } = brief

    // 1. the town's history, before a plot is placed
    const told = this.#narrator.writePremise
      ? await this.#narrator.writePremise({ theme: brief.theme, seed: brief.seed, ...(owner ? { brief: owner } : {}), ...(asks ? { asks } : {}) })
      : undefined
    if (told && !told.ok) return err(stopped(told.error))
    const history = readHistory(told?.value)
    const premise = history.premise

    // 2. the architecture, under placeholder names
    const laid = this.#layOut(brief, rng, history)
    if (!laid.ok) return err(laid.error)
    const { world, sites, zones } = laid.value
    const setup = this.#building(brief, premise, world, rng, brief.openPlaces ?? openPlacesFor(sites.length))
    const bare = planRaise(world, sites, setup)
    const plots = raiseShell(world, bare, new PlaceNames(bare, (one) => instanceName(one.index)))

    // 3. the work, over the bare architecture
    const summary = planSummary(world, bare, plots, premise)
    const written = await this.#narrator.writeQuests({ summary, sideQuests: questDemand(summary, rng.fork('quests')) })
    if (!written.ok) return err(stopped(written.error))
    const drafts = written.value
    const cast = new Cast(bare, castOf(drafts))

    // 4. the names, out of the story and out of the work
    const [city, zoneNames, signs] = await Promise.all([
      askCityName(this.#narrator, { theme: brief.theme, seed: brief.seed, ...(premise ? { premise } : {}) }),
      askZoneNames(this.#narrator, zones, { theme: brief.theme, seed: brief.seed, ...(premise ? { premise } : {}) }),
      askSigns(this.#narrator, asking(bare, setup, cast)),
    ])
    if (!city.ok) return err(stopped(city.error))
    if (!zoneNames.ok) return err(stopped(zoneNames.error))
    if (!signs.ok) return err(stopped(signs.error))
    const planned = hangSigns(bare, signs.value)
    const places = new Map(planned.filter(wantsName).map((one) => [plots.get(one.index)!, one.sign] as const))
    const names: WrittenNames = { city: city.value, zones: zoneNames.value, places }
    const renamed = writeNames(world, names)
    if (!renamed.ok) return err({ code: 'unsound-world', problems: renamed.problems })

    // 5. the people and the insides, written to the cast
    const town = renamed.world
    const inside = await this.#writePlaces(planned, setup, cast)
    if (!inside.ok) return err(stopped(inside.error))
    const wrote = dress(town, planned, plots, new PlaceNames(planned, (one) => one.sign), inside.value)

    // 6. the work bound to the names that landed, then checked against the city it names
    const book = bindings(planned, zoneNames.value, wrote)
    // and the buildings under their own ids, so a line the model wrote as "the
    // house on plot_0031" reaches the player as the house it is
    for (const plot of town.plots()) {
      if (plot.name) book.set(plot.id, plot.name)
    }
    for (const interior of town.interiors()) {
      const name = town.plot(interior.plotId)?.name
      if (name) book.set(interior.id, name)
    }
    const { quests, rejected } = this.#read(town, drafts.map((draft) => bindNames(draft, book)))

    const problems = town.check()
    if (problems.length) return err({ code: 'unsound-world', problems })
    return ok({ world: town, quests, rejected, dropped: history.dropped })
  }

  /**
   * The architecture of a city, with nothing written into it: the street grid,
   * the roads and the roads out, the parts of town, every building with
   * its footprint, its height and the part it stands in, and where the trains
   * board. No interiors, so nobody is standing anywhere, nothing is lying about
   * and there is no work: this is what a brief gives, before anybody writes it.
   *
   * It is the same plan `build` raises, drawn from the same seed by the same
   * code, so a plot on a plan is the plot the build puts up: same place, same
   * height, same part of town. What a build adds is the writing, names
   * included: here the city is `City`, its parts are `Zone 1` and `Zone 2` and
   * its buildings `Instance 1` and `Instance 2`, which is the architecture
   * saying what it is rather than a gap where a name goes.
   *
   * `history` is what a narrator already wrote, and the plan is drawn against
   * it exactly as a build would be. Without one nothing is asked of anybody and
   * no model is involved: the town is planned off the presets and the seed.
   */
  async plan(input: unknown, history?: unknown): Promise<Result<World, ForgeError>> {
    const parsed = briefContract.parse(input)
    if (!parsed.ok) return err({ code: 'invalid-brief', violations: parsed.error })
    const brief = parsed.value
    const rng = new Rng(brief.seed)
    const founding = readHistory(history)

    const laid = this.#layOut(brief, rng, founding)
    if (!laid.ok) return err(laid.error)
    const { world, sites } = laid.value
    // no door opens, so nothing is asked of a narrator: every building on a plan
    // is the frontage it is on the street, under the number it was laid out with
    const planned = planRaise(world, sites, this.#building(brief, founding.premise, world, rng, 0))
    raiseShell(world, planned, new PlaceNames(planned, (one) => instanceName(one.index)))

    const problems = world.check()
    if (problems.length) return err({ code: 'unsound-world', problems })
    return ok(world)
  }

  /**
   * Everything about a town that is arithmetic: the grid founded and painted,
   * the roads laid, the parts of the city cut, and every site a building goes
   * up on. Nobody is asked anything here, and nothing is named: the city is
   * `City` and its parts are `Zone 1` upwards until the story says otherwise.
   */
  #layOut(brief: Brief, rng: Rng, history: Founding): Result<LaidOut, ForgeError> {
    const streets = planStreets(brief, rng.fork('streets'))
    const { brief: owner, asks } = brief
    const found = World.found({
      name: PLACEHOLDER_CITY,
      theme: brief.theme,
      seed: brief.seed,
      width: streets.size.width,
      height: streets.size.height,
      // the history and the kinds of place go into the file, so a city somebody
      // is sent still knows what it is about and what each place is, and
      // growing it later grows it against the same story
      ...(history.premise ? { premise: history.premise } : {}),
      charters: history.charters,
      ...(owner ? { brief: owner } : {}),
      ...(asks ? { asks } : {}),
      generator: { name: 'forge', version: GENERATOR_VERSION },
    })
    if (!found.ok) return err({ code: 'invalid-brief', violations: violationsOf(found.error) })
    const world = found.value
    paintStreets(world, streets)
    layRoads(world, streets.crossings, streets.exits)
    // the town is cut into its parts before a plot is placed, so every plot can
    // say which one it stands in as it goes up
    const cut = this.#cut(world, streets, rng.fork('districts'))
    // the sites are chosen before the doors are counted, because how many open
    // follows how many buildings there are and not how far the town spreads
    return ok({ world, sites: this.#townSites(brief, streets, rng, history.premise, world, cut.byBlock), zones: cut.zones })
  }

  /** What a whole city is raised against: its theme, its story, its signs, its streets and its door stream. */
  #building(brief: Brief, premise: Premise | undefined, world: World, rng: Rng, places: number): RaiseSetup {
    return {
      theme: brief.theme,
      ...(premise ? { premise } : {}),
      places,
      signs: new Signs(brief.seed),
      streets: StreetNames.of(world),
      doors: rng.fork('doors'),
      people: rng,
    }
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
      const opened = await this.#raise(world, this.#facadeSites(world, facades), this.#growing(world, premise, world.interiors().length + places, facades.fork('people')))
      if (!opened.ok) return err(opened.error)
    }
    const grown =
      blocks > 0
        ? await this.#raise(world, this.#gapSites(world, blocks, rng, premise), this.#growing(world, premise, world.interiors().length + placesOnNewLand(blocks), rng.fork('extend/people')))
        : ok([] as string[])
    if (!grown.ok) return err(grown.error)
    const added = grown.value

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
  async extendQuests(world: World, existing: readonly QuestDoc[], rng = new Rng(`${world.seed}/extend`)): Promise<Result<GrownQuests, ForgeError>> {
    const summary = summarise(world, world.premise())
    const stream = rng.fork('more-quests')
    const from = existing.reduce((most, quest) => Math.max(most, Number(quest.id.split('_')[1] ?? 0) || 0), existing.length)
    const wanted = Math.max(1, questDemand(summary, stream) - existing.length)
    const written = await this.#narrator.writeQuests({ summary, sideQuests: wanted, from })
    if (!written.ok) return err(stopped(written.error))
    return ok(this.#read(world, written.value))
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
   * Puts a growth up: plan it with no awaits, name every door it adds in one
   * call, write every place that opens in another, then put the lot into the
   * world in the order it was planned.
   *
   * A growth has its names before it has its plots, because the town it is
   * growing onto was argued about long ago: what is new here is buildings, not
   * a story. A build takes the same pieces in a different order, because its
   * quests are written between the two.
   */
  async #raise(world: World, chosen: readonly Chosen[], setup: RaiseSetup): Promise<Result<string[], ForgeError>> {
    const bare = planRaise(world, chosen, setup)
    const signs = await askSigns(this.#narrator, asking(bare, setup))
    if (!signs.ok) return err(stopped(signs.error))
    const planned = hangSigns(bare, signs.value)
    const inside = await this.#writePlaces(planned, setup)
    if (!inside.ok) return err(stopped(inside.error))
    return ok(assemble(world, planned, inside.value))
  }

  /**
   * Every place that opens, written whole in one call: what it is, the people
   * in it and what is lying about. Nothing to ask about is nothing asked, so a
   * growth that only opens doors that were painted on writes no places.
   */
  async #writePlaces(planned: readonly PlannedSite[], setup: RaiseSetup, cast?: Cast): Promise<Written<readonly Instance[]>> {
    const requests = instanceRequests(planned, setup, cast ? (one) => cast.at(one) : undefined)
    if (!requests.length) return ok([])
    return this.#narrator.writeInstances?.(requests) ?? writeEachPlace(this.#narrator, requests)
  }

  /**
   * Cuts the town into its parts and writes them into the world under
   * placeholder names.
   *
   * The shapes are arithmetic, like everything else here: the cut is the
   * seed's. What each part is called comes later, out of the story and the work
   * in it, so what goes in now is `Zone 1` upwards and the naming pass writes
   * over it.
   */
  #cut(world: World, streets: StreetPlan, rng: Rng): { byBlock: ReadonlyMap<number, string>; zones: Zone[] } {
    // parks and plazas are cut in with the built blocks: a district is a part
    // of the town rather than a set of buildings, so the map fills and a green
    // square belongs to the quarter it stands in. The built blocks come first,
    // so a block's number here is its number in the plan
    const ground = [...streets.blocks, ...streets.open.map((one) => one.rect)]
    const cut = cutDistricts(ground, rng)
    if (!cut.length) return { byBlock: new Map(), zones: [] }
    const districts = cut.map((one, index) => ({
      id: world.mintId('district'),
      name: zoneName(index),
      blocks: one.blocks.map((block) => ground[block]!),
    }))
    if (!world.recordDistricts(districts).ok) return { byBlock: new Map(), zones: [] }
    return {
      byBlock: new Map(cut.flatMap((one, index) => one.blocks.map((block) => [block, districts[index]!.id] as const))),
      zones: cut.map((one, index) => ({ id: districts[index]!.id, bearing: one.bearing, blocks: one.blocks.length })),
    }
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
    const skyline = new Skyline(brief)

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
      chosen.push({ site, charter, onAvenue, ...(district ? { district } : {}), storeys: skyline.storeysFor(charter, spot, siteRng), rng: siteRng })
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
        storeys: EXTEND.storeysFor(charter, { onAvenue: false, nearness: 0 }, siteRng),
        rng: siteRng,
      })
    }
    return chosen
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

/** A stage that stopped, as the error a caller reads: the sentence goes on `message`, where the launcher looks for it. */
const stopped = (failure: Unwritten): ForgeError => ({ code: 'unwritten', stage: failure.stage, message: failure.message })

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The world refusing a spec means the brief asked for a city that cannot exist. */
function violationsOf(error: WorldError): readonly SchemaViolation[] {
  if (error.code === 'invalid-document') return error.violations
  if (error.code === 'inconsistent-world') return error.problems.map((p) => ({ path: p.where, message: p.message }))
  return [{ path: '(root)', message: error.message }]
}

/**
 * The people the town's work needs, by the building they have to be standing
 * in. It is the contract between the two halves of a build: the quests were
 * written against posts the plan cut, and this is what turns that into a
 * sentence the writer of each place is handed, so the person a step names is
 * written into the very post the step points at.
 */
class Cast {
  readonly #byPlace = new Map<number, InstanceCasting[]>()
  readonly #work = new Map<number, string[]>()

  constructor(planned: readonly PlannedSite[], cast: readonly Casting[]) {
    const posts = new Map(planned.flatMap((one) => (one.inside?.posts ?? []).map((post) => [post.npcId, { one, post }] as const)))
    for (const casting of cast) {
      const stands = posts.get(casting.npcId)
      if (!stands) continue
      const { one, post } = stands
      const { npcId: _, ...rest } = casting
      this.#byPlace.set(one.index, [...(this.#byPlace.get(one.index) ?? []), { postId: post.anchor.id, ...rest }])
      this.#work.set(one.index, [...(this.#work.get(one.index) ?? []), `${casting.questTitle}: ${casting.line}`])
    }
  }

  /** Who the work needs standing in this place. */
  at(one: PlannedSite): readonly InstanceCasting[] {
    return this.#byPlace.get(one.index) ?? []
  }

  /** What the work does here, in the lines the player reads, so a place can be named after what happens in it. */
  work(one: PlannedSite): readonly string[] {
    return [...new Set(this.#work.get(one.index) ?? [])]
  }
}

/** Every door this pass has to name, with the sign composed for it and what the work does behind it. */
function asking(planned: readonly PlannedSite[], setup: RaiseSetup, cast?: Cast): Asking[] {
  const wanted = planned.filter(wantsName)
  const requests = nameRequests(planned, setup, cast ? (one) => cast.work(one) : undefined)
  return wanted.map((one, at) => ({ request: requests[at]!, composed: one.sign, opens: one.inside !== undefined }))
}
