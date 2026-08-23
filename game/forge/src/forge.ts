import { err, ok, Rng, type Result, type SchemaViolation } from '@gb/kit'
import { validateQuest, type QuestDoc, type QuestProblem } from '@gb/quest'
import {
  cellCentre,
  questView,
  World,
  type IntegrityProblem,
  type Item,
  type Rect,
  type WorldError,
} from '@gb/world'
import { briefContract, type Brief } from './brief.ts'
import type { Narrator, WorldSummary } from './narrator.ts'
import { writeEachPlace } from './narrator/one-at-a-time.ts'
import { Signs } from './narrator/signs.ts'
import { surfacesOf } from './populate.ts'
import { Avenues } from './layout/avenues.ts'
import { planStreets, type StreetPlan } from './layout/plan.ts'
import { sitesInBlock, storeysFor, type PlotSite } from './layout/plots.ts'
import { layRoads } from './layout/roads.ts'
import { paintStreets } from './layout/streets.ts'
import { instanceRequests, planRaise, type RaiseSetup } from './raise/plan.ts'
import { assemble } from './raise/assemble.ts'
import type { Chosen } from './raise/planned.ts'
import { questDemand } from './quests/demand.ts'
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
}

const GENERATOR_VERSION = '0.1.0'

/** How tall `extend` builds into a gap. */
const EXTEND_STOREYS = 2

/** How full `extend` makes the buildings it drops in. */
const EXTEND_DENSITY = 0.8

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
    const cityName = await this.#narrator.nameCity({ theme: brief.theme, seed: brief.seed })
    const found = World.found({
      name: cityName,
      theme: brief.theme,
      seed: brief.seed,
      width: streets.size.width,
      height: streets.size.height,
      generator: { name: 'forge', version: GENERATOR_VERSION },
    })
    if (!found.ok) return err({ code: 'invalid-brief', violations: violationsOf(found.error) })
    const world = found.value
    paintStreets(world, streets)

    layRoads(world, streets.crossings, streets.exits)
    await this.#raise(world, this.#townSites(brief, streets, rng), {
      theme: brief.theme,
      density: brief.density,
      signs: new Signs(brief.seed),
      doors: rng.fork('doors'),
      people: rng,
    })

    const problems = world.check()
    if (problems.length) return err({ code: 'unsound-world', problems })

    const { quests, rejected } = await this.#writeQuests(world, rng.fork('quests'))
    return ok({ world, quests, rejected })
  }

  /**
   * Adds buildings and the people in them to a city that already exists,
   * without touching anything already there.
   */
  async extend(world: World, count: number, rng = new Rng(`${world.seed}/extend`)): Promise<Result<readonly string[], ForgeError>> {
    const added = await this.#raise(world, this.#gapSites(world, count, rng), {
      theme: world.theme,
      density: EXTEND_DENSITY,
      signs: new Signs(world.seed),
      doors: rng.fork('extend/doors'),
      people: rng.fork('extend/people'),
    })
    const problems = world.check()
    if (problems.length) return err({ code: 'unsound-world', problems })
    return ok(added)
  }

  /**
   * Puts buildings up: plan the whole town with no awaits, ask about every place
   * that opens in one call, then write it all in the order it was planned.
   *
   * The three steps are apart because the middle one is the only slow one, and
   * because a town that is planned before anything is asked can ask about all of
   * it at once. Nothing downstream depends on which answer landed first.
   */
  async #raise(world: World, chosen: readonly Chosen[], setup: RaiseSetup): Promise<string[]> {
    const planned = planRaise(world, chosen, setup)
    const requests = instanceRequests(planned, setup.theme)
    const written = await (this.#narrator.writeInstances?.(requests) ?? writeEachPlace(this.#narrator, requests))
    return assemble(world, planned, written)
  }

  /**
   * What a whole town is built out of. What kind of town it is decides the mix,
   * the seed moves it around, and the few places the town is known for are
   * dropped on seeded sites before the rest is rolled.
   */
  #townSites(brief: Brief, streets: StreetPlan, rng: Rng): Chosen[] {
    const sites = streets.blocks.flatMap((block, index) => sitesInBlock(block, rng.fork(`block/${index}`)))
    const avenues = Avenues.from(streets.columns, streets.rows)
    const mix = rng.fork('plots')
    const flavour = flavourOf(brief.theme)
    const weights = kindWeights(flavour, mix)
    const wanted = stapleKinds(flavour, mix)
    const spots = mix.shuffle(sites.map((_, index) => index)).slice(0, wanted.length)
    const staples = new Map(spots.map((site, order) => [site, wanted[order]!]))

    const chosen: Chosen[] = []
    for (const [index, site] of sites.entries()) {
      const siteRng = rng.fork(`site/${index}`)
      // both draws happen either way, so whether a site is a staple cannot shift the rest
      const built = siteRng.chance(brief.density)
      const rolled = siteRng.weighted(weights)
      const kind = staples.get(index) ?? (built ? rolled : undefined)
      if (!kind) continue
      const onAvenue = avenues.has(site.entrance)
      chosen.push({ site, kind, onAvenue, storeys: storeysFor(kind, brief.maxStoreys, siteRng, onAvenue), rng: siteRng })
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
      const kind = rng.weighted(kindWeights(flavourOf(world.theme), rng.fork(`extend/mix/${i}`)))
      const siteRng = rng.fork(`extend/${i}`)
      chosen.push({ site, kind, onAvenue: false, storeys: storeysFor(kind, EXTEND_STOREYS, siteRng, false), rng: siteRng })
    }
    return chosen
  }

  async #writeQuests(world: World, rng: Rng): Promise<{ quests: QuestDoc[]; rejected: ForgeResult['rejected'] }> {
    const summary = summarise(world)
    const raw = await this.#narrator.writeQuests({ summary, sideQuests: questDemand(summary, rng) })
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
    for (const size of [
      { w: 4, h: 4 },
      { w: 3, h: 4 },
      { w: 3, h: 3 },
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
 * The abstract world a quest writer reads: places, who is in them, what is
 * there, where its door is and what a thing can be left on. No coordinates
 * beyond the door, because that is all a quest ever needs to measure a walk.
 */
export function summarise(world: World): WorldSummary {
  return {
    cityName: world.name,
    theme: world.theme,
    places: world.plots().map((plot) => {
      const interior = world.interiors().find((i) => i.plotId === plot.id)
      const npcs = interior ? world.npcs().filter((n) => n.station?.interiorId === interior.id) : []
      const items = interior
        ? world
            .placements()
            .filter((p) => p.at === 'anchor' && p.interiorId === interior.id)
            .map((p) => world.item(p.itemId))
            .filter((item): item is Item => item !== undefined)
        : []
      const surface = interior ? surfacesOf(interior.anchors)[0] : undefined
      return {
        plotId: plot.id,
        ...(interior ? { interiorId: interior.id } : {}),
        kind: plot.kind,
        name: plot.name,
        door: cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, world.cellSize),
        ...(surface ? { stashAnchorId: surface.id } : {}),
        npcs: npcs.map((n) => ({ npcId: n.id, name: n.name, role: n.role })),
        items: items.map((i) => ({
          itemId: i.id,
          name: i.name,
          archetype: i.archetype,
          ...(i.ownerNpcId ? { ownerNpcId: i.ownerNpcId } : {}),
        })),
      }
    }),
  }
}
