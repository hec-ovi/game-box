import { err, ok, Rng, type Result, type SchemaViolation } from '@gb/kit'
import { validateQuest, type QuestDoc, type QuestProblem } from '@gb/quest'
import {
  BODY_KINDS,
  cellCentre,
  METRICS,
  questView,
  World,
  type Anchor,
  type BuildingKind,
  type Interior,
  type IntegrityProblem,
  type Item,
  type Npc,
  type Placement,
  type Room,
  type WorldError,
} from '@gb/world'
import { briefContract, type Brief } from './brief.ts'
import { openDoors, type Frontage } from './interior/open.ts'
import { planInterior } from './interior/plan.ts'
import { Avenues } from './layout/avenues.ts'
import { planStreets, type StreetPlan } from './layout/plan.ts'
import { sitesInBlock, storeysFor, type PlotSite } from './layout/plots.ts'
import { layRoads } from './layout/roads.ts'
import { paintStreets } from './layout/streets.ts'
import type { Narrator, WorldSummary } from './narrator.ts'
import { bulkOf, itemsFor, occupancy, roleFor, surfacesOf } from './populate.ts'
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

/** A building that is up, before anybody has decided whether its door opens. */
interface Raised {
  readonly plotId: string
  readonly kind: BuildingKind
  readonly site: PlotSite
  /** Whether its door is on one of the town's avenues. */
  readonly onAvenue: boolean
  /** Its own stream, so the inside is planned off the same seed the outside was. */
  readonly rng: Rng
}

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
    await this.#raise(world, brief, streets, rng)
    await this.#populate(world, brief, rng)

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
    const raised: Raised[] = []
    for (let i = 0; i < count; i++) {
      const site = this.#freeSite(world, rng)
      if (!site) break
      const kind = rng.weighted(kindWeights(flavourOf(world.theme), rng.fork(`extend/mix/${i}`)))
      const up = await this.#raiseOne(world, site, kind, world.theme, 2, rng.fork(`extend/${i}`))
      if (up) raised.push(up)
    }
    this.#openDoors(world, raised, rng.fork('extend/doors'))
    const added = raised.map((one) => one.plotId)
    await this.#populate(world, { density: 0.8 } as Brief, rng.fork('extend/people'), added)
    const problems = world.check()
    if (problems.length) return err({ code: 'unsound-world', problems })
    return ok(added)
  }

  /**
   * Puts buildings on the blocks, leaving gaps for the city to grow into later.
   * What kind of town it is decides the mix, the seed moves it around, and the
   * few places the town is known for are dropped on seeded sites before the
   * rest is rolled.
   */
  async #raise(world: World, brief: Brief, streets: StreetPlan, rng: Rng): Promise<void> {
    const sites = streets.blocks.flatMap((block, index) => sitesInBlock(block, rng.fork(`block/${index}`)))
    const avenues = Avenues.from(streets.columns, streets.rows)
    const mix = rng.fork('plots')
    const flavour = flavourOf(brief.theme)
    const weights = kindWeights(flavour, mix)
    const wanted = stapleKinds(flavour, mix)
    const spots = mix.shuffle(sites.map((_, index) => index)).slice(0, wanted.length)
    const staples = new Map(spots.map((site, order) => [site, wanted[order]!]))

    const raised: Raised[] = []
    for (const [index, site] of sites.entries()) {
      const siteRng = rng.fork(`site/${index}`)
      // both draws happen either way, so whether a site is a staple cannot shift the rest
      const built = siteRng.chance(brief.density)
      const rolled = siteRng.weighted(weights)
      const kind = staples.get(index) ?? (built ? rolled : undefined)
      if (!kind) continue
      const up = await this.#raiseOne(world, site, kind, brief.theme, brief.maxStoreys, siteRng, avenues)
      if (up) raised.push(up)
    }
    this.#openDoors(world, raised, rng.fork('doors'))
  }

  async #raiseOne(
    world: World,
    site: PlotSite,
    kind: BuildingKind,
    theme: string,
    maxStoreys: number,
    rng: Rng,
    avenues?: Avenues,
  ): Promise<Raised | undefined> {
    const name = await this.#narrator.namePlace({ kind, theme, index: world.plots().length })
    const onAvenue = avenues?.has(site.entrance) ?? false
    const plot = world.addPlot({
      kind,
      name,
      rect: site.rect,
      entrance: { cell: site.entrance, facing: site.facing },
      storeys: storeysFor(kind, maxStoreys, rng, onAvenue),
      style: `${theme.split(/\s+/)[0]?.toLowerCase() ?? 'plain'}-${kind}`,
    })
    if (!plot.ok) return undefined
    return { plotId: plot.value.id, kind, site, onAvenue, rng }
  }

  /**
   * Opens the few doors that are worth opening and leaves the rest of the town
   * as frontage. Everything downstream reads a building's inside off its
   * interior, so a plot without one has nobody in it, nothing lying about and
   * nothing a quest can reach: a closed door is closed all the way through.
   */
  #openDoors(world: World, raised: readonly Raised[], rng: Rng): void {
    const middle = { x: world.grid.width / 2, y: world.grid.height / 2 }
    const furthest = Math.hypot(middle.x, middle.y) || 1
    const frontages: Frontage[] = raised.map((one) => ({
      plotId: one.plotId,
      kind: one.kind,
      nearness: 1 - Math.hypot(one.site.entrance.x - middle.x, one.site.entrance.y - middle.y) / furthest,
      onAvenue: one.onAvenue,
    }))

    const open = openDoors(frontages, rng)
    for (const one of raised) {
      if (!open.has(one.plotId)) continue
      world.addInterior(this.#planInterior(world, one.plotId, one.kind, one.site, one.rng.fork('inside')))
    }
  }

  #planInterior(world: World, plotId: string, kind: BuildingKind, site: PlotSite, rng: Rng): Interior {
    const wall = METRICS.building.wallThickness
    const size = {
      w: site.rect.w * world.cellSize - wall * 2,
      h: site.rect.h * world.cellSize - wall * 2,
    }
    const plan = planInterior({ kind, size, entrance: site.facing, mint: (idKind) => world.mintId(idKind), rng })
    return { id: world.mintId('interior'), plotId, kind, size, ...plan }
  }

  /** Puts people on anchors and things on surfaces. */
  async #populate(world: World, brief: Brief, rng: Rng, onlyPlots?: readonly string[]): Promise<void> {
    for (const interior of world.interiors()) {
      if (onlyPlots && !onlyPlots.includes(interior.plotId)) continue
      const plot = world.plot(interior.plotId)
      if (!plot) continue
      const interiorRng = rng.fork(`people/${interior.id}`)

      let staff: string | undefined
      for (const anchor of interior.anchors) {
        const role = roleFor(anchor.kind, interior.kind)
        if (!role) continue
        // a staff post is always filled: a bar without a bartender is not a bar
        const chance = occupancy(anchor.kind)
        if (chance < 1 && !interiorRng.chance(chance * (brief.density ?? 0.8))) continue

        const index = world.npcs().length
        const profile = await this.#narrator.describeNpc({
          role,
          placeKind: interior.kind,
          placeName: plot.name,
          theme: world.theme,
          index,
        })
        const npc: Npc = {
          id: world.mintId('npc'),
          name: profile.name,
          role,
          appearance: { base: interiorRng.pick(BODY_KINDS), variant: interiorRng.int(0, 8) },
          station: { interiorId: interior.id, anchorId: anchor.id },
          workPlotId: plot.id,
          personality: profile.personality,
          knowledge: [...profile.knowledge],
        }
        if (world.addNpc(npc).ok && anchor.kind === 'serve') staff ??= npc.id
      }

      const surfaces = surfacesOf(interior.anchors)
      for (const [i, archetype] of itemsFor(interior.kind, interiorRng).entries()) {
        const anchor = surfaces[i % Math.max(1, surfaces.length)]
        if (!anchor) break
        const index = world.items().length
        const profile = await this.#narrator.describeItem({ archetype, theme: world.theme, index })
        const item: Item = {
          id: world.mintId('item'),
          name: profile.name,
          description: profile.description,
          archetype,
          value: interiorRng.int(1, 60),
          bulk: bulkOf(archetype),
          ...(staff ? { ownerNpcId: staff } : {}),
        }
        const placement: Placement = { at: 'anchor', itemId: item.id, interiorId: interior.id, anchorId: anchor.id }
        world.addItem(item, placement)
      }
    }
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

  #freeSite(world: World, rng: Rng): PlotSite | undefined {
    for (const size of [
      { w: 4, h: 4 },
      { w: 3, h: 4 },
      { w: 3, h: 3 },
    ]) {
      const sites = world.buildSites(size.w, size.h)
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
