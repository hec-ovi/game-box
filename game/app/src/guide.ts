import type { CompassGoal } from '@gb/hud'
import type { CityNav, Point } from '@gb/nav'
import type { Objective } from '@gb/quest'
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
 *
 * `from` is where the player stands on the city, which indoors is the doorstep
 * of the building they are in rather than their metres across its floor.
 */
/** How far out to look for somewhere to stand, when the middle of a district is a building. */
const NEAR_RINGS = 12

/** The middle of a set of blocks, in cells. */
function middleOf(blocks: readonly { x: number; y: number; w: number; h: number }[]): { x: number; y: number } {
  let x = 0
  let y = 0
  let weight = 0
  for (const block of blocks) {
    const area = block.w * block.h
    x += (block.x + block.w / 2) * area
    y += (block.y + block.h / 2) * area
    weight += area
  }
  return weight ? { x: Math.round(x / weight), y: Math.round(y / weight) } : { x: 0, y: 0 }
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
    const goal = this.#goals()[0]
    if (!goal) return undefined
    const from = this.#from()
    const route = this.#route(from, goal)
    if (!route) return undefined
    const corner = route[1] ?? { x: goal.x, z: goal.z }
    return { label: goal.label, bearing: bearingOf(from, corner), distance: length(route), line: goal.line }
  }

  /** One line for the player: where they are headed and which way to set off. */
  /**
   * How far it is to walk to a part of the city, in words, and nothing when the
   * player cannot get there on foot. The middle of the district is aimed at,
   * which is a place rather than a door, so the nearest walkable cell to it is
   * what the route actually ends on.
   */
  walkTo(districtId: string): string | undefined {
    const district = this.#world.districts().find((one) => one.id === districtId)
    if (!district) return undefined
    const cell = this.#nearestWalkable(middleOf(district.blocks))
    if (!cell) return undefined
    const size = this.#world.cellSize
    const from = this.#from()
    const route = this.#nav.path({ x: Math.floor(from.x / size), y: Math.floor(from.z / size) }, cell)
    if (!route) return `${district.name} is over there, with no way to walk to it`
    const metres = length(this.#nav.waypoints(route))
    return `${district.name}, ${Math.round(metres / 10) * 10} m on foot`
  }

  /** The middle of a district is often a rooftop, so the walk aims at the nearest cell somebody can stand on. */
  #nearestWalkable(at: { x: number; y: number }): { x: number; y: number } | undefined {
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
