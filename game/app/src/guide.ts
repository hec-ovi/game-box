import type { CityNav, Point } from '@gb/nav'
import type { World } from '@gb/world'
import type { Marked } from './places.ts'
import type { Vec2 } from './walk.ts'

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const

/** Closer than this and there is nothing left to walk. */
const ARRIVED = 6

/**
 * The way to whatever the tracked quest is pointing at: how far the walk is and
 * which way the street runs from where the player is standing. The route comes
 * from `@gb/nav`, so the distance is the walk rather than the crow's flight and
 * the direction is the first stretch of pavement rather than a line through a
 * building. The map is north up, so a compass point reads straight off it.
 */
export class Guide {
  #world: World
  #nav: CityNav
  #from: () => Vec2
  #goals: () => readonly Marked[]

  constructor(input: { world: World; nav: CityNav; from: () => Vec2; goals: () => readonly Marked[] }) {
    this.#world = input.world
    this.#nav = input.nav
    this.#from = input.from
    this.#goals = input.goals
  }

  /** One line for the player: where they are headed and which way to set off. */
  say(): string {
    const goal = this.#goals()[0]
    if (!goal) return 'Nothing to head for: follow a quest first'

    const from = this.#from()
    const route = this.#route(from, goal)
    if (!route) return `${goal.label}: no way there on foot`

    const walk = length(route)
    if (walk < ARRIVED) return `${goal.label}: you are there`

    const corner = route[1] ?? { x: goal.x, z: goal.z }
    return `${goal.label}: ${Math.round(walk / 10) * 10} m, head ${towards(from, corner)}`
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

/** Which of the eight points of the compass one spot is from another. */
function towards(from: Vec2, to: Point): string {
  const turn = Math.PI * 2
  const bearing = Math.atan2(to.x - from.x, -(to.z - from.z))
  const eighth = Math.round((((bearing % turn) + turn) % turn) / (turn / 8)) % 8
  return POINTS[eighth]!
}
