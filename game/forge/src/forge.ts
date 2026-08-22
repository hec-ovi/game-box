import { err, ok, Rng, type Result, type SchemaViolation } from '@gb/kit'
import { validateQuest, type QuestDoc, type QuestProblem } from '@gb/quest'
import {
  BODY_KINDS,
  METRICS,
  World,
  type Anchor,
  type BuildingKind,
  type Interior,
  type IntegrityProblem,
  type Item,
  type Npc,
  type Placement,
  type Room,
} from '@gb/world'
import { briefContract, type Brief } from './brief.ts'
import { furnish } from './interior/furnish.ts'
import { cutRooms } from './interior/rooms.ts'
import { sitesInBlock, storeysFor, type PlotSite } from './layout/plots.ts'
import { gridSize, layStreets } from './layout/streets.ts'
import type { Narrator, WorldSummary } from './narrator.ts'
import { bulkOf, itemsFor, occupancy, roleFor } from './populate.ts'

export type ForgeError =
  | { readonly code: 'invalid-brief'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'unsound-world'; readonly problems: readonly IntegrityProblem[] }

export interface ForgeResult {
  readonly world: World
  readonly quests: readonly QuestDoc[]
  /** Quests the narrator wrote that did not hold up, and why. Kept, not hidden. */
  readonly rejected: ReadonlyArray<{ readonly index: number; readonly problems: readonly QuestProblem[] }>
}

/** What a town is made of, before anything is named. */
const KIND_WEIGHTS: ReadonlyArray<readonly [BuildingKind, number]> = [
  ['house', 10],
  ['apartment', 3],
  ['shop', 3],
  ['office', 2],
  ['bar', 2],
  ['cafe', 2],
  ['workshop', 2],
  ['warehouse', 1],
  ['restaurant', 1],
  ['clinic', 1],
  ['hotel', 1],
  ['market', 1],
  ['chapel', 1],
  ['station', 1],
]

const GENERATOR_VERSION = '0.1.0'

/** Every town gets at least one of these, whatever the dice say. */
const STAPLES: readonly BuildingKind[] = ['bar', 'shop']

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

    const cityName = await this.#narrator.nameCity({ theme: brief.theme, seed: brief.seed })
    const size = gridSize(brief)
    const world = World.create({
      name: cityName,
      theme: brief.theme,
      seed: brief.seed,
      width: size.width,
      height: size.height,
      generator: { name: 'forge', version: GENERATOR_VERSION },
    })
    const streets = layStreets(world, brief)

    this.#layRoads(world, streets.crossings)
    await this.#raise(world, brief, streets.blocks, rng)
    await this.#populate(world, brief, rng)

    const problems = world.check()
    if (problems.length) return err({ code: 'unsound-world', problems })

    const { quests, rejected } = await this.#writeQuests(world, brief)
    return ok({ world, quests, rejected })
  }

  /**
   * Adds buildings and the people in them to a city that already exists,
   * without touching anything already there.
   */
  async extend(world: World, count: number, rng = new Rng(`${world.seed}/extend`)): Promise<Result<readonly string[], ForgeError>> {
    const added: string[] = []
    for (let i = 0; i < count; i++) {
      const site = this.#freeSite(world, rng)
      if (!site) break
      const kind = rng.weighted(KIND_WEIGHTS)
      const plot = await this.#raiseOne(world, site, kind, world.theme, 2, rng.fork(`extend/${i}`))
      if (plot) added.push(plot)
    }
    await this.#populate(world, { density: 0.8 } as Brief, rng.fork('extend/people'), added)
    const problems = world.check()
    if (problems.length) return err({ code: 'unsound-world', problems })
    return ok(added)
  }

  #layRoads(world: World, crossings: ReadonlyArray<{ x: number; y: number }>): void {
    const nodes = crossings.map((cell) => ({ id: world.mintId('node'), cell }))
    const segments: Parameters<World['addRoad']>[1] = []
    for (const from of nodes) {
      for (const to of nodes) {
        const sameRow = from.cell.y === to.cell.y && to.cell.x > from.cell.x
        const sameColumn = from.cell.x === to.cell.x && to.cell.y > from.cell.y
        if (!sameRow && !sameColumn) continue
        const between = nodes.some(
          (other) =>
            other !== from &&
            other !== to &&
            ((sameRow && other.cell.y === from.cell.y && other.cell.x > from.cell.x && other.cell.x < to.cell.x) ||
              (sameColumn && other.cell.x === from.cell.x && other.cell.y > from.cell.y && other.cell.y < to.cell.y)),
        )
        if (between) continue
        segments.push({ id: world.mintId('road'), from: from.id, to: to.id, kind: 'street', lanes: 2 })
      }
    }
    world.addRoad(nodes, segments)
  }

  /** Puts buildings on the blocks, leaving gaps for the city to grow into later. */
  async #raise(world: World, brief: Brief, blocks: readonly { x: number; y: number; w: number; h: number }[], rng: Rng): Promise<void> {
    const sites = blocks.flatMap((block, index) => sitesInBlock(block, rng.fork(`block/${index}`)))
    const staples = [...STAPLES]

    for (const [index, site] of sites.entries()) {
      const siteRng = rng.fork(`site/${index}`)
      if (staples.length === 0 && !siteRng.chance(brief.density)) continue
      const kind = staples.shift() ?? siteRng.weighted(KIND_WEIGHTS)
      await this.#raiseOne(world, site, kind, brief.theme, brief.maxStoreys, siteRng)
    }
  }

  async #raiseOne(
    world: World,
    site: PlotSite,
    kind: BuildingKind,
    theme: string,
    maxStoreys: number,
    rng: Rng,
  ): Promise<string | undefined> {
    const name = await this.#narrator.namePlace({ kind, theme, index: world.plots().length })
    const plot = world.addPlot({
      kind,
      name,
      rect: site.rect,
      entrance: { cell: site.entrance, facing: site.facing },
      storeys: storeysFor(kind, maxStoreys, rng),
      style: `${theme.split(/\s+/)[0]?.toLowerCase() ?? 'plain'}-${kind}`,
    })
    if (!plot.ok) return undefined

    const interior = this.#planInterior(world, plot.value.id, kind, site, rng)
    const added = world.addInterior(interior)
    return added.ok ? plot.value.id : undefined
  }

  #planInterior(world: World, plotId: string, kind: BuildingKind, site: PlotSite, rng: Rng): Interior {
    const wall = METRICS.building.wallThickness
    const size = {
      w: site.rect.w * world.cellSize - wall * 2,
      h: site.rect.h * world.cellSize - wall * 2,
    }
    const rooms: Room[] = cutRooms(kind, size, rng).map((box) => ({
      id: world.mintId('room'),
      kind: box.kind,
      name: box.name,
      rect: box.rect,
    }))

    const furniture: Interior['furniture'] = []
    const anchors: Anchor[] = []
    for (const room of rooms) {
      const dressed = furnish(kind, room, (idKind) => world.mintId(idKind), rng.fork(`room/${room.id}`))
      furniture.push(...dressed.furniture)
      anchors.push(...dressed.anchors)
    }

    const entry = rooms[0]!
    const doors: Interior['doors'] = [
      {
        id: world.mintId('door'),
        from: 'outside',
        to: entry.id,
        pos: { x: entry.rect.x + entry.rect.w / 2, y: entry.rect.y },
        rot: 0,
        locked: false,
      },
    ]
    for (let i = 1; i < rooms.length; i++) {
      const previous = rooms[i - 1]!
      const room = rooms[i]!
      doors.push({
        id: world.mintId('door'),
        from: previous.id,
        to: room.id,
        pos: { x: room.rect.x, y: room.rect.y + room.rect.h / 2 },
        rot: 90,
        locked: false,
      })
    }

    return { id: world.mintId('interior'), plotId, kind, size, rooms, doors, furniture, anchors }
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

      for (const [i, archetype] of itemsFor(interior.kind, interiorRng).entries()) {
        const anchor = interior.anchors[i % Math.max(1, interior.anchors.length)]
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

  async #writeQuests(world: World, brief: Brief): Promise<{ quests: QuestDoc[]; rejected: ForgeResult['rejected'] }> {
    const raw = await this.#narrator.writeQuests({ summary: summarise(world), sideQuests: Math.max(2, brief.blocksX * brief.blocksY) })
    const quests: QuestDoc[] = []
    const rejected: Array<{ index: number; problems: readonly QuestProblem[] }> = []

    for (const [index, candidate] of raw.entries()) {
      const validated = validateQuest(candidate, viewOf(world))
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

/** The abstract world a quest writer reads: places, who is in them, what is there. */
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
      return {
        plotId: plot.id,
        ...(interior ? { interiorId: interior.id } : {}),
        kind: plot.kind,
        name: plot.name,
        npcs: npcs.map((n) => ({ npcId: n.id, name: n.name, role: n.role })),
        items: items.map((i) => ({ itemId: i.id, name: i.name, ...(i.ownerNpcId ? { ownerNpcId: i.ownerNpcId } : {}) })),
      }
    }),
  }
}

/** The five questions the quest layer asks about a world. */
export function viewOf(world: World) {
  return {
    hasNpc: (id: string) => world.hasNpc(id),
    hasPlot: (id: string) => world.hasPlot(id),
    hasInterior: (id: string) => world.hasInterior(id),
    hasItem: (id: string) => world.hasItem(id),
    hasAnchor: (interiorId: string, anchorId: string) =>
      world.interior(interiorId)?.anchors.some((a) => a.id === anchorId) ?? false,
  }
}
