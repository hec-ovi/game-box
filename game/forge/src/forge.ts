import { err, ok, Rng, type Result } from '@gb/kit'
import { validateQuest, type QuestDoc, type QuestProblem } from '@gb/quest'
import { questView, World, type Premise, type Rect, type ResolvedCharter } from '@gb/world'
import { layOut, planTown, raiseSetup } from './blueprint.ts'
import { briefContract } from './brief.ts'
import type { Dropped } from './charters/resolve.ts'
import { stopped, type ForgeError } from './errors.ts'
import { openPlacesFor, placesOnNewLand } from './interior/budget.ts'
import { townNeeds } from './interior/needs.ts'
import { Avenues } from './layout/avenues.ts'
import { districtAt } from './layout/districts.ts'
import { streetLines } from './layout/lines.ts'
import type { PlotSite } from './layout/plots.ts'
import { Skyline } from './layout/skyline.ts'
import { askCityName, askKinds, askSigns, askZoneNames, type Asking } from './naming/ask.ts'
import { bindings, bindNames } from './naming/bind.ts'
import { instanceName, PLACEHOLDER_KIND } from './naming/placeholders.ts'
import { writeNames, type WrittenNames } from './naming/write.ts'
import type { Instance, InstanceCasting, Narrator, Written } from './narrator.ts'
import { writeEachPlace } from './narrator/one-at-a-time.ts'
import { Signs } from './narrator/signs.ts'
import { StreetNames } from './narrator/streets.ts'
import { readHistory } from './premise/history.ts'
import { premiseLines } from './premise/render.ts'
import { castOf, type Casting } from './quests/casting.ts'
import { questDemand } from './quests/demand.ts'
import { assemble, dress, PlaceNames, raiseShell } from './raise/assemble.ts'
import { hangSigns, instanceRequests, kindRequests, nameRequests, openIn, planRaise, siteBuildings, wantsName, type Decided, type RaiseSetup } from './raise/plan.ts'
import type { Chosen, PlannedSite, Sited } from './raise/planned.ts'
import { planSummary, summarise } from './summary.ts'

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
 * `Forge.plan` is the arithmetic half on its own, and it is static because it
 * needs no narrator: a plan is drawn from the brief and the seed, and there is
 * nobody to ask.
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
   *    `Instance 1`, every building a `building`. Nothing is a bar or a station
   *    and nothing is asked of anybody. It also picks which doors open.
   * 3. **What the places are.** The writing is handed those doors and says what
   *    each one is, and everything behind them is built to the answer.
   * 4. **The work.** The quests are written against that architecture, so what
   *    they name is a post the plan cut and a building that stands there.
   * 5. **The names.** The city, every part of it and every door in it, out of
   *    the story and out of what the work does where, and what the buildings
   *    that never open are. Written over the placeholders in one pass.
   * 6. **The people and the insides.** Each place that opens is written whole,
   *    told its name and the cast the quests already need standing in it, and
   *    the town is filled in around them.
   * 7. **The binding.** The lines the quests were written under are bound to the
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

    // 2. the architecture: buildings, zones and the doors that open, nothing else
    const laid = layOut(brief, rng, history)
    if (!laid.ok) return err(laid.error)
    const { world, sites, zones } = laid.value
    const setup = raiseSetup(brief, premise, world, rng, brief.openPlaces ?? openPlacesFor(sites.length))
    const sited = siteBuildings(world, sites, setup)
    const open = openIn(world, sited, setup)

    // 3. what each of those doors is, before anything is built behind it
    const decided = await this.#decide(world, sited, open, setup)
    if (!decided.ok) return err(stopped(decided.error))
    const bare = planRaise(world, sited, setup, decided.value)
    const plots = raiseShell(world, bare, new PlaceNames(bare, (one) => instanceName(one.index)))

    // 4. the work, over that architecture
    const summary = planSummary(world, bare, plots, premise)
    const written = await this.#narrator.writeQuests({ summary, sideQuests: questDemand(summary, rng.fork('quests')) })
    if (!written.ok) return err(stopped(written.error))
    const drafts = written.value
    const cast = new Cast(bare, castOf(drafts))

    // 5. the names, out of the story and out of the work, and what the rest of the town is
    const [city, zoneNames, signs] = await Promise.all([
      askCityName(this.#narrator, { theme: brief.theme, seed: brief.seed, ...(premise ? { premise } : {}) }),
      askZoneNames(this.#narrator, zones, { theme: brief.theme, seed: brief.seed, ...(premise ? { premise } : {}) }),
      askSigns(this.#narrator, asking(bare, setup, cast)),
    ])
    if (!city.ok) return err(stopped(city.error))
    if (!zoneNames.ok) return err(stopped(zoneNames.error))
    if (!signs.ok) return err(stopped(signs.error))
    const planned = hangSigns(bare, signs.value, setup)
    const places = new Map(
      planned.filter(wantsName).map((one) => [plots.get(one.index)!, { name: one.sign, kind: one.charter.word, style: one.style }] as const),
    )
    const names: WrittenNames = { city: city.value, zones: zoneNames.value, places }
    const renamed = writeNames(world, names)
    if (!renamed.ok) return err({ code: 'unsound-world', problems: renamed.problems })

    // 6. the people and the insides, written to the cast
    const town = renamed.world
    const inside = await this.#writeInsides(planned, setup, cast)
    if (!inside.ok) return err(stopped(inside.error))
    const wrote = dress(town, planned, plots, new PlaceNames(planned, (one) => one.sign), inside.value)

    // 7. the work bound to the names that landed, then checked against the city it names
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
   * The architecture of a city, with nothing written into it: the streets, the
   * plots and nothing behind any door. See `src/blueprint.ts`: it is static and
   * takes no narrator, because a plan is arithmetic and there is nobody to ask.
   */
  static plan(input: unknown, history?: unknown): Result<World, ForgeError> {
    return planTown(input, history)
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
        ? await this.#raise(world, this.#gapSites(world, blocks, rng), this.#growing(world, premise, world.interiors().length + placesOnNewLand(blocks), rng.fork('extend/people')))
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
      kinds: world.charters(),
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
    const sited = siteBuildings(world, chosen, setup)
    const open = openIn(world, sited, setup)
    const decided = await this.#decide(world, sited, open, setup)
    if (!decided.ok) return err(stopped(decided.error))
    const bare = planRaise(world, sited, setup, decided.value)
    const signs = await askSigns(this.#narrator, asking(bare, setup))
    if (!signs.ok) return err(stopped(signs.error))
    const planned = hangSigns(bare, signs.value, setup)
    const inside = await this.#writeInsides(planned, setup)
    if (!inside.ok) return err(stopped(inside.error))
    return ok(assemble(world, planned, inside.value))
  }

  /**
   * What each of the doors this pass opens is, asked before anything is built
   * behind them. This is the stage the whole order exists for: the architecture
   * put up buildings and nothing else, and until this answers there is no bar,
   * no station and nobody's home in the town.
   *
   * A facade the town already wrote is not asked again: an opened door keeps
   * what it always was, the way it keeps its sign.
   */
  async #decide(world: World, sited: readonly Sited[], open: ReadonlySet<number>, setup: RaiseSetup): Promise<Written<Decided>> {
    const kinds = new Map<number, ResolvedCharter>()
    for (const [at, one] of sited.entries()) if (one.standing?.charter) kinds.set(at, one.standing.charter)
    const asked = new Set(sited.flatMap((_, at) => (open.has(at) && !kinds.has(at) ? [at] : [])))
    const declared = setup.kinds.filter((one) => one.word !== PLACEHOLDER_KIND)
    const story = setup.premise ? premiseLines(setup.premise) : undefined
    const written = await askKinds(
      this.#narrator,
      {
        theme: setup.theme,
        ...(story ? { premise: story } : {}),
        kinds: declared,
        needs: townNeeds({
          places: setup.places,
          span: Math.max(world.grid.width, world.grid.height) * world.cellSize,
          charters: setup.kinds,
          ...(setup.premise ? { premise: setup.premise } : {}),
        }),
        places: kindRequests(sited, asked, setup),
      },
      declared,
    )
    if (!written.ok) return err(written.error)
    for (const [at, where] of [...asked].entries()) kinds.set(where, written.value[at]!)
    return ok({ kinds, open })
  }

  /**
   * Every place that opens, written whole in one call: what it is, the people
   * in it and what is lying about. Nothing to ask about is nothing asked, so a
   * growth that only opens doors that were painted on writes no places.
   */
  async #writeInsides(planned: readonly PlannedSite[], setup: RaiseSetup, cast?: Cast): Promise<Written<readonly Instance[]>> {
    const requests = instanceRequests(planned, setup, cast ? (one) => cast.at(one) : undefined)
    if (!requests.length) return ok([])
    return this.#narrator.writeInstances?.(requests) ?? writeEachPlace(this.#narrator, requests)
  }

  /**
   * The facades a growth may open: every building standing with nothing behind
   * its door that the town has already said something about. They go into the
   * ranking exactly as new land does, so a painted-on door is chosen for the
   * floor behind it, how near the middle of town it stands and how far it is
   * from the doors already open.
   *
   * A building nobody ever wrote a word about is not one of them. Opening a
   * door means knowing what is behind it, and saying what a building is is a
   * change to the base city rather than a growth: the one field a growth writes
   * on a record that was already there is the door pointer.
   */
  #facadeSites(world: World, rng: Rng): Chosen[] {
    const lines = streetLines(world)
    const avenues = Avenues.from(lines.columns, lines.rows)
    const chosen: Chosen[] = []
    for (const [index, plot] of world.plots().entries()) {
      const charter = plot.kind === PLACEHOLDER_KIND ? undefined : world.charter(plot.kind)
      // a door that already opens is never opened again, and one nobody ever
      // said anything about is a wall rather than a door
      if (plot.interiorId || !charter) continue
      chosen.push({
        site: { rect: plot.rect, facing: plot.entrance.facing, entrance: plot.entrance.cell },
        storeys: plot.storeys,
        onAvenue: avenues.has(plot.entrance.cell),
        rng: rng.fork(`facade/${plot.id}`),
        standing: { plotId: plot.id, name: plot.name, index, charter },
      })
    }
    return chosen
  }

  /** What `extend` drops into the gaps: one building at a time, into land nothing has claimed. */
  #gapSites(world: World, count: number, rng: Rng): Chosen[] {
    const chosen: Chosen[] = []
    const taken: Rect[] = []
    for (let i = 0; i < count; i++) {
      const site = this.#freeSite(world, rng, taken)
      if (!site) break
      taken.push(site.rect)
      const siteRng = rng.fork(`extend/${i}`)
      // new land stands in the part of town it was dropped into, so a growth
      // never adds a building the map cannot label
      const district = districtAt(world.districts(), site.rect)
      chosen.push({
        site,
        onAvenue: false,
        ...(district ? { district: district.id } : {}),
        storeys: EXTEND.storeysFor({ onAvenue: false, nearness: 0 }, siteRng),
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

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

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
