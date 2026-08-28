import { err, ok, Rng, type Result } from '@gb/kit'
import { World, type Premise } from '@gb/world'
import { briefContract, type Brief } from './brief.ts'
import { violationsOf, type ForgeError } from './errors.ts'
import { Avenues } from './layout/avenues.ts'
import { cutDistricts } from './layout/districts.ts'
import { planStreets, type StreetPlan } from './layout/plan.ts'
import { nearnessIn, sitesInBlock, type PlotSite } from './layout/plots.ts'
import { layRoads } from './layout/roads.ts'
import { Skyline } from './layout/skyline.ts'
import { spreadSites, stationsWanted } from './layout/stations.ts'
import { paintStreets } from './layout/streets.ts'
import type { Zone } from './naming/ask.ts'
import { instanceName, PLACEHOLDER_CITY, zoneName } from './naming/placeholders.ts'
import { StreetNames } from './narrator/streets.ts'
import { Signs } from './narrator/signs.ts'
import { readHistory, type Founding } from './premise/history.ts'
import { planRaise, type RaiseSetup } from './raise/plan.ts'
import { PlaceNames, raiseShell } from './raise/assemble.ts'
import type { Chosen } from './raise/planned.ts'
import { flavourOf } from './theme/flavour.ts'
import { kindWeights, stapleKinds } from './theme/plot-mix.ts'

/**
 * The arithmetic half of a city: streets, roads, the parts of town, every site a
 * building goes up on and how tall it stands, all drawn from the brief and the
 * seed. Nobody is asked anything here, which is why it is a module of its own:
 * a plan takes no narrator, and a build reaches for the same functions before it
 * asks anybody a question.
 */

const GENERATOR_VERSION = '0.1.0'

/** A town laid out: the world with its streets, roads and parts in it, every site a building goes up on, and the parts waiting to be named. */
export interface LaidOut {
  readonly world: World
  readonly sites: readonly Chosen[]
  readonly zones: readonly Zone[]
}

/**
 * The architecture of a city, with nothing written into it: the street grid, the
 * roads and the roads out, the parts of town, every building with its footprint,
 * its height and the part it stands in, and where the trains board. No
 * interiors, so nobody is standing anywhere, nothing is lying about and there is
 * no work: this is what a brief gives, before anybody writes it.
 *
 * It is the same plan a build raises, drawn from the same seed by the same code,
 * so a plot on a plan is the plot the build puts up: same place, same height,
 * same part of town. What a build adds is the writing, names included: here the
 * city is `City`, its parts are `Zone 1` and `Zone 2` and its buildings
 * `Instance 1` and `Instance 2`, which is the architecture saying what it is
 * rather than a gap where a name goes.
 *
 * `history` is what a narrator already wrote, taken the way a build takes it and
 * checked the same way. Without one the town is planned off the presets and the
 * seed.
 */
export function planTown(input: unknown, history?: unknown): Result<World, ForgeError> {
  const parsed = briefContract.parse(input)
  if (!parsed.ok) return err({ code: 'invalid-brief', violations: parsed.error })
  const brief = parsed.value
  const rng = new Rng(brief.seed)
  const founding = readHistory(history)

  const laid = layOut(brief, rng, founding)
  if (!laid.ok) return err(laid.error)
  const { world, sites } = laid.value
  // no door opens, so there is nothing to write about: every building on a plan
  // is the frontage it is on the street, under the number it was laid out with
  const planned = planRaise(world, sites, raiseSetup(brief, founding.premise, world, rng, 0))
  raiseShell(world, planned, new PlaceNames(planned, (one) => instanceName(one.index)))

  const problems = world.check()
  if (problems.length) return err({ code: 'unsound-world', problems })
  return ok(world)
}

/**
 * Everything about a town that is arithmetic: the grid founded and painted, the
 * roads laid, the parts of the city cut, and every site a building goes up on.
 * Nothing is named: the city is `City` and its parts are `Zone 1` upwards until
 * the story says otherwise.
 */
export function layOut(brief: Brief, rng: Rng, history: Founding): Result<LaidOut, ForgeError> {
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
  const cut = cutIntoParts(world, streets, rng.fork('districts'))
  // the sites are chosen before the doors are counted, because how many open
  // follows how many buildings there are and not how far the town spreads
  return ok({ world, sites: townSites(brief, streets, rng, history.premise, world, cut.byBlock), zones: cut.zones })
}

/** What a whole city is raised against: its theme, its story, its signs, its streets and its door stream. */
export function raiseSetup(brief: Brief, premise: Premise | undefined, world: World, rng: Rng, places: number): RaiseSetup {
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
 * Cuts the town into its parts and writes them into the world under placeholder
 * names.
 *
 * The shapes are arithmetic, like everything else here: the cut is the seed's.
 * What each part is called comes later, out of the story and the work in it, so
 * what goes in now is `Zone 1` upwards and the naming pass writes over it.
 */
function cutIntoParts(world: World, streets: StreetPlan, rng: Rng): { byBlock: ReadonlyMap<number, string>; zones: Zone[] } {
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
function townSites(
  brief: Brief,
  streets: StreetPlan,
  rng: Rng,
  premise: Premise | undefined,
  world: World,
  districts: ReadonlyMap<number, string>,
): Chosen[] {
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
  const byWord = new Map(charters.map((charter) => [charter.word, charter]))
  // Somewhere to board every five hundred metres, spread over the town. The
  // mix never rolls the kind that boards, but a history's `mustHave` demands
  // it like any other kind, so whatever the staples already put up is counted
  // here: a town boards nowhere or boards at least twice, because a lone
  // entrance is a ride with nowhere to go
  const subway = charters.find((charter) => charter.transit === 'subway')
  if (subway) {
    const span = Math.max(streets.size.width, streets.size.height) * world.cellSize
    const standing = [...staples].filter(([, word]) => byWord.get(word)?.transit === 'subway').map(([site]) => site)
    const spread = { sites, count: stationsWanted(span, standing.length), taken: new Set(staples.keys()), standing, rng: mix.fork('stations') }
    for (const site of spreadSites(spread)) staples.set(site, subway.word)
  }
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
