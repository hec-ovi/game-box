import type { MapFact, MapReading, MapReadingKind } from '@gb/hud'
import type { JournalEntry, Objective } from '@gb/quest'
import type { District, World } from '@gb/world'
import type { Spot } from './citymap.ts'
import type { Marked, Offer } from './places.ts'

/** What the map says about a thing, in the game's own words. */
const WORDS = {
  you: 'You',
  yourself: 'Where you are standing right now.',
  station: 'The train boards here.',
  nowhere: 'This one is not a place you can walk to.',
  part: 'Part of town',
  onFoot: 'On foot',
  buildings: 'Buildings',
  step: 'Step',
  job: 'Job waiting',
  noWalk: 'No way there on foot',
} as const

/** Whose door this is, and that the work behind it is still there to take. */
function holding(giver: string): string {
  return `${giver} is holding work you have not taken.`
}

/** Where a thing is and what is known about it: the map asks, the game answers. */
export interface Read {
  /** Where to put the camera, in metres. Nothing where the thing has no place on the city. */
  readonly at: Spot | undefined
  /** The part of town it stands in, which is the one the drawing holds lit. */
  readonly districtId: string | undefined
  readonly reading: MapReading
}

/**
 * What is known about a thing on the map.
 *
 * The interface reports the handle the player clicked and nothing else; this
 * turns it back into a place on the city and the few facts worth reading about
 * it: which part of town it is in, how far the walk is, which step of the story
 * it is. A quest picked out of the list reads as wherever it is sending the
 * player, so a row and a label on the city answer the same way.
 */
export class Readings {
  #world: World
  #goals: () => readonly Marked[]
  #offers: () => readonly Offer[]
  #homes: () => readonly string[]
  #you: () => Spot
  #steps: () => readonly Objective[]
  #journal: () => readonly JournalEntry[]
  #metres: (to: { x: number; z: number; plotId?: string }) => number | undefined
  #plotOf: (interiorId: string) => string | undefined

  constructor(input: {
    world: World
    goals: () => readonly Marked[]
    offers: () => readonly Offer[]
    homes: () => readonly string[]
    you: () => Spot
    steps: () => readonly Objective[]
    journal: () => readonly JournalEntry[]
    metres: (to: { x: number; z: number; plotId?: string }) => number | undefined
    plotOf: (interiorId: string) => string | undefined
  }) {
    this.#world = input.world
    this.#goals = input.goals
    this.#offers = input.offers
    this.#homes = input.homes
    this.#you = input.you
    this.#steps = input.steps
    this.#journal = input.journal
    this.#metres = input.metres
    this.#plotOf = input.plotOf
  }

  /** The thing the player picked, or nothing where the handle names nothing on this city. */
  of(targetId: string): Read | undefined {
    return (
      this.#mark(targetId) ??
      this.#station(targetId) ??
      this.#district(targetId) ??
      this.#place(targetId) ??
      this.#home(targetId) ??
      this.#quest(targetId) ??
      this.#yourself(targetId)
    )
  }

  #yourself(targetId: string): Read | undefined {
    if (targetId !== 'you') return undefined
    const at = this.#you()
    return { at, districtId: this.#partOf(at)?.id, reading: this.#read('you', 'you', WORDS.you, at, { text: WORDS.yourself }) }
  }

  /**
   * A place a job is sending the player, or a door with work behind it. A door
   * says whose it is and names every job waiting there, so picking the story's
   * own callout answers what the main line actually is.
   */
  #mark(targetId: string): Read | undefined {
    const goal = this.#goals().find((one) => one.id === targetId)
    const waiting = goal ? [] : this.#offers().filter((one) => one.id === targetId)
    const found = goal ?? waiting[0]
    if (!found) return undefined
    const kind: MapReadingKind = goal ? 'goal' : 'offer'
    const at = { x: found.x, z: found.z }
    const step = goal ? this.#steps().find((one) => `goal:${one.questId}:${one.stepId}` === targetId) : undefined
    const stepFact = goal && found.questId ? this.#stepFact(found.questId) : undefined
    return {
      at,
      districtId: this.#partOf(at, found.plotId)?.id,
      reading: this.#read(targetId, kind, found.label, at, {
        // a door holds the story where it holds any of it, so the callout, the
        // panel and the strip all burn the same colour
        line: waiting.some((one) => one.line === 'main') ? 'main' : found.line,
        text: goal ? step?.text : holding(found.label),
        plotId: found.plotId,
        extra: stepFact ? [stepFact] : waiting.map((one) => ({ label: WORDS.job, value: one.title })),
      }),
    }
  }

  #station(targetId: string): Read | undefined {
    const plot = this.#world.stations().find((one) => one.id === targetId)
    if (!plot) return undefined
    const at = { x: (plot.rect.x + plot.rect.w / 2) * this.#world.cellSize, z: (plot.rect.y + plot.rect.h / 2) * this.#world.cellSize }
    return {
      at,
      districtId: this.#partOf(at, plot.id)?.id,
      reading: this.#read(targetId, 'station', plot.name, at, { text: WORDS.station, plotId: plot.id }),
    }
  }

  #district(targetId: string): Read | undefined {
    const district = this.#world.districts().find((one) => one.id === targetId)
    if (!district) return undefined
    const at = middleOf(district, this.#world.cellSize)
    const built = this.#world.plots().filter((plot) => plot.district === district.id).length
    return {
      at,
      districtId: district.id,
      reading: {
        id: targetId,
        kind: 'district',
        name: district.name,
        facts: [{ label: WORDS.buildings, value: String(built) }, ...this.#walkFact(at)],
      },
    }
  }

  /** A building with its name on the drawing: a landmark, a place a job points at, a place already walked into. */
  #place(targetId: string): Read | undefined {
    const plot = this.#world.plot(targetId)
    if (!plot) return undefined
    const at = { x: (plot.rect.x + plot.rect.w / 2) * this.#world.cellSize, z: (plot.rect.y + plot.rect.h / 2) * this.#world.cellSize }
    const inside = plot.interiorId ? this.#world.interior(plot.interiorId) : undefined
    return {
      at,
      districtId: this.#partOf(at, plot.id)?.id,
      reading: this.#read(targetId, 'place', plot.name, at, { text: inside?.description, plotId: plot.id }),
    }
  }

  #home(targetId: string): Read | undefined {
    const interiorId = targetId.startsWith('home:') ? targetId.slice('home:'.length) : undefined
    if (!interiorId || !this.#homes().includes(interiorId)) return undefined
    const plotId = this.#plotOf(interiorId)
    const plot = plotId ? this.#world.plot(plotId) : undefined
    if (!plot) return undefined
    const at = { x: (plot.rect.x + plot.rect.w / 2) * this.#world.cellSize, z: (plot.rect.y + plot.rect.h / 2) * this.#world.cellSize }
    const interior = this.#world.interior(interiorId)
    return {
      at,
      districtId: this.#partOf(at, plot.id)?.id,
      reading: this.#read(targetId, 'home', plot.name, at, { text: interior?.description, plotId: plot.id }),
    }
  }

  /** A quest picked out of the list reads as wherever it is sending the player next. */
  #quest(targetId: string): Read | undefined {
    const page = this.#journal().find((entry) => entry.questId === targetId)
    if (!page) return undefined
    const goal = this.#goals().find((one) => one.questId === targetId)
    if (!goal) {
      return { at: undefined, districtId: undefined, reading: { id: targetId, kind: 'goal', name: page.questTitle, ...(page.kind ? { line: page.kind } : {}), text: WORDS.nowhere } }
    }
    return this.#mark(goal.id)
  }

  /** One reading, with the two facts every place on the city carries. */
  #read(
    id: string,
    kind: MapReadingKind,
    name: string,
    at: Spot,
    more: { line?: Marked['line']; text?: string | undefined; plotId?: string | undefined; extra?: readonly MapFact[] },
  ): MapReading {
    const district = this.#partOf(at, more.plotId)
    const facts: MapFact[] = [...(more.extra ?? [])]
    if (district) facts.push({ label: WORDS.part, value: district.name })
    facts.push(...this.#walkFact(at, more.plotId))
    return {
      id,
      kind,
      name,
      ...(more.line ? { line: more.line } : {}),
      ...(more.text ? { text: more.text } : {}),
      facts,
    }
  }

  /** How far the walk is, or that there is none. */
  #walkFact(at: Spot, plotId?: string): MapFact[] {
    const metres = this.#metres({ ...at, ...(plotId ? { plotId } : {}) })
    return [{ label: WORDS.onFoot, value: metres === undefined ? WORDS.noWalk : `${Math.round(metres / 10) * 10} m` }]
  }

  /** Which step of the quest this is, counted the way the journal counts it. */
  #stepFact(questId: string): MapFact | undefined {
    const page = this.#journal().find((entry) => entry.questId === questId)
    if (!page) return undefined
    const counted = page.steps.filter((step) => step.state !== 'dropped')
    const done = counted.filter((step) => step.state === 'done').length
    if (counted.length === 0) return undefined
    return { label: WORDS.step, value: `${Math.min(done + 1, counted.length)} of ${counted.length}` }
  }

  /**
   * Which part of town a thing is in. A building says so itself; anything else
   * is placed by the cell it stands on, which for somebody at a door is the
   * pavement outside and belongs to no block at all.
   */
  #partOf(at: Spot, plotId?: string): District | undefined {
    const named = plotId ? this.#world.plot(plotId)?.district : undefined
    if (named) return this.#world.districts().find((district) => district.id === named)
    const size = this.#world.cellSize
    const cell = { x: at.x / size, y: at.z / size }
    return this.#world
      .districts()
      .find((district) =>
        district.blocks.some((block) => cell.x >= block.x && cell.x < block.x + block.w && cell.y >= block.y && cell.y < block.y + block.h),
      )
  }
}

/** The middle of a part of town, weighted by how big each of its blocks is. */
function middleOf(district: District, size: number): Spot {
  let x = 0
  let z = 0
  let weight = 0
  for (const block of district.blocks) {
    const area = block.w * block.h
    x += (block.x + block.w / 2) * area
    z += (block.y + block.h / 2) * area
    weight += area
  }
  return weight ? { x: (x / weight) * size, z: (z / weight) * size } : { x: 0, z: 0 }
}
