import type { CompassGoal } from '@gb/hud'
import type { CityNav, Point } from '@gb/nav'
import type { Objective, QuestKind } from '@gb/quest'
import type { World } from '@gb/world'
import type { Marked } from './places.ts'
import type { Vec2 } from './walk.ts'

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const

/** Closer than this and there is nothing left to walk. */
const ARRIVED = 6

/** How far out to look for somewhere to stand, when the spot aimed at is a building. */
const NEAR_RINGS = 12

/** A cell on the grid. */
type Point2 = { readonly x: number; readonly y: number }

/**
 * The way to whatever the tracked quest is pointing at: how far the walk is and
 * which way the street runs from where the player is standing. The route comes
 * from `@gb/nav`, so the distance is the walk rather than the crow's flight and
 * the direction is the first stretch of pavement rather than a line through a
 * building. The map is north up, so a compass point reads straight off it.
 *
 * `from` is where the player stands on the city, which indoors is the doorstep
 * of the building they are in rather than their metres across its floor.
 */
/** A walk kept between measurements: the corner it heads for, and the metres of route past it. */
export interface Way {
  readonly label: string
  readonly corner: Point
  /** Metres of the route beyond the corner. */
  readonly beyond: number
  /** Metres of the whole route when it was measured. */
  readonly distance: number
  readonly line?: QuestKind
}

export class Guide {
  #world: World
  #nav: CityNav
  #from: () => Vec2
  #goals: () => readonly Marked[]
  #steps: () => readonly Objective[]

  constructor(input: {
    world: World
    nav: CityNav
    from: () => Vec2
    goals: () => readonly Marked[]
    steps: () => readonly Objective[]
  }) {
    this.#world = input.world
    this.#nav = input.nav
    this.#from = input.from
    this.#goals = input.goals
    this.#steps = input.steps
  }

  /**
   * The tracked goal as the compass draws it: its name, the bearing of the
   * first stretch of the walk in radians clockwise from north, and the metres
   * along it. Nothing when there is no goal or no way there on foot.
   */
  resolve(): CompassGoal | undefined {
    const way = this.way()
    if (!way) return undefined
    return { label: way.label, bearing: bearingOf(this.#from(), way.corner), distance: way.distance, ...(way.line ? { line: way.line } : {}) }
  }

  /**
   * The same walk, kept as the corner it heads for and the metres of route
   * beyond that corner, so the strip can point at it every frame without
   * asking `@gb/nav` for the walk again. Finding a way through the streets is
   * the expensive half and it holds while the player walks it; pointing at the
   * next corner is arithmetic and goes stale in a stride.
   */
  way(): Way | undefined {
    const goal = this.#goals()[0]
    if (!goal) return undefined
    const from = this.#from()
    const route = this.#route(from, goal)
    if (!route) return undefined
    const corner = route[1] ?? { x: goal.x, z: goal.z }
    const beyond = length(route.slice(1))
    return { label: goal.label, corner, beyond, distance: length(route), ...(goal.line ? { line: goal.line } : {}) }
  }

  /** Where a walk points from wherever the player is standing now. */
  static pointAt(from: Vec2, way: Way): CompassGoal {
    const left = Math.hypot(way.corner.x - from.x, way.corner.z - from.z) + way.beyond
    return { label: way.label, bearing: bearingOf(from, way.corner), distance: left, ...(way.line ? { line: way.line } : {}) }
  }

  /**
   * How far the walk is to somewhere on the city, in metres, and nothing where
   * there is no walk to it. A building is walked to at its door; anywhere else
   * is walked to at the nearest cell somebody can stand on, because the middle
   * of a part of town is as often a rooftop as a street.
   */
  metresTo(to: { readonly x: number; readonly z: number; readonly plotId?: string }): number | undefined {
    const size = this.#world.cellSize
    const from = this.#from()
    const start = { x: Math.floor(from.x / size), y: Math.floor(from.z / size) }
    const path = to.plotId
      ? this.#nav.pathToDoor(this.#world, start, to.plotId)
      : this.#walk(start, { x: Math.floor(to.x / size), y: Math.floor(to.z / size) })
    return path ? length(this.#nav.waypoints(path)) : undefined
  }

  #walk(start: Point2, to: Point2): ReturnType<CityNav['path']> {
    const cell = this.#nearestWalkable(to)
    return cell ? this.#nav.path(start, cell) : undefined
  }

  /** The middle of a district is often a rooftop, so the walk aims at the nearest cell somebody can stand on. */
  #nearestWalkable(at: Point2): Point2 | undefined {
    if (this.#nav.walkable(at)) return at
    for (let ring = 1; ring <= NEAR_RINGS; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (const dy of [-ring, ring]) {
          for (const cell of [{ x: at.x + dx, y: at.y + dy }, { x: at.x + dy, y: at.y + dx }]) {
            if (this.#nav.walkable(cell)) return cell
          }
        }
      }
    }
    return undefined
  }

  say(): string {
    const goal = this.#goals()[0]
    // a step with nowhere on it is a step the player is still following, so say
    // that about the step rather than telling them to go and find a job
    if (!goal) {
      const step = this.#steps()[0]
      if (!step) return 'Nothing to head for: follow a quest first'
      return `${step.markerLabel ?? step.text}: not a place you can walk to`
    }

    const way = this.resolve()
    if (!way) return `${goal.label}: no way there on foot`
    if (way.distance < ARRIVED) return `${goal.label}: you are there`
    return `${goal.label}: ${Math.round(way.distance / 10) * 10} m, head ${POINTS[Math.round(way.bearing / (Math.PI / 4)) % 8]}`
  }

  /** The corners of the walk there, in metres, or nothing if there is no walk. */
  #route(from: Vec2, goal: Marked): Point[] | undefined {
    const size = this.#world.cellSize
    const start = { x: Math.floor(from.x / size), y: Math.floor(from.z / size) }
    const path = goal.plotId
      ? this.#nav.pathToDoor(this.#world, start, goal.plotId)
      : this.#nav.path(start, { x: Math.floor(goal.x / size), y: Math.floor(goal.z / size) })
    return path ? this.#nav.waypoints(path) : undefined
  }
}

/** How far the walk is, corner to corner. */
function length(route: readonly Point[]): number {
  let metres = 0
  for (let i = 1; i < route.length; i++) metres += Math.hypot(route[i]!.x - route[i - 1]!.x, route[i]!.z - route[i - 1]!.z)
  return metres
}

/** Which way one spot is from another, in radians clockwise from north, in one turn. */
function bearingOf(from: Vec2, to: Point): number {
  const turn = Math.PI * 2
  const bearing = Math.atan2(to.x - from.x, -(to.z - from.z))
  return ((bearing % turn) + turn) % turn
}
