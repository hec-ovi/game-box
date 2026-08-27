import type { Hud, MapMark, MapPlot, MinimapDoor, MinimapView } from '@gb/hud'
import type { World } from '@gb/world'
import { interiorPlot, planOf, type Marked } from './places.ts'
import { bearing, type Vec2 } from './walk.ts'

/**
 * How much city the corner holds, in cells either side of the player. Forty
 * cells is eighty metres, which is a street and the two either side of it: far
 * enough to see where the next turning goes, near enough that the names on it
 * are the ones you could walk to.
 */
const RADIUS = 40

/** How often what is round the player is measured again, in seconds. Somebody being followed walks. */
const EVERY = 0.5

/** A turn of the head too small to redraw the corner for, in radians. */
const STILL = 0.01

/**
 * The corner view: the streets round the player, which way they face, where
 * they are headed and the doors they have already been through. The hud draws
 * what it is pushed and never reads the world, so the city is windowed here.
 *
 * The window is measured again when the player has crossed a cell, when the
 * quests moved or when half a second has passed, and it is pushed on the tick
 * the compass is pushed, so turning on the spot moves the corner with the
 * strip. Indoors it goes: a room has its own metres and the streets outside are
 * not what the player is standing in.
 */
export class Minimap {
  #world: World
  #hud: Hud
  #heading: () => number
  #standing: () => Vec2
  #outdoors: () => boolean
  #goals: () => readonly Marked[]
  #entered: () => readonly string[]
  #plan: readonly MapPlot[]
  #view: Omit<MinimapView, 'facing'> | undefined
  #facing = Number.NaN
  #since = EVERY
  #cell = ''
  #again = true
  #shown = false

  constructor(input: {
    world: World
    hud: Hud
    heading: () => number
    standing: () => Vec2
    outdoors: () => boolean
    goals: () => readonly Marked[]
    /** The interiors the player has walked into, for the doors on it. */
    entered: () => readonly string[]
  }) {
    this.#world = input.world
    this.#hud = input.hud
    this.#heading = input.heading
    this.#standing = input.standing
    this.#outdoors = input.outdoors
    this.#goals = input.goals
    this.#entered = input.entered
    this.#plan = planOf(this.#world)
  }

  /** The quests moved, or a place was found: whatever is on the corner wants measuring again. */
  dirty(): void {
    this.#again = true
  }

  update(seconds: number): void {
    if (!this.#outdoors()) {
      if (this.#shown) this.#hud.show({ minimap: null })
      this.#shown = false
      this.#facing = Number.NaN
      this.#again = true
      return
    }

    const size = this.#world.cellSize
    const at = this.#standing()
    const x = at.x / size
    const y = at.z / size
    const cell = `${Math.floor(x)}/${Math.floor(y)}`
    this.#since += seconds

    let changed = false
    if (this.#again || cell !== this.#cell || this.#since >= EVERY) {
      this.#view = this.#around(x, y)
      this.#cell = cell
      this.#since = 0
      this.#again = false
      changed = true
    }

    const facing = bearing(-this.#heading())
    if (Number.isNaN(this.#facing) || Math.abs(facing - this.#facing) > STILL) {
      this.#facing = facing
      changed = true
    }
    if (!changed || !this.#view) return
    this.#hud.show({ minimap: { ...this.#view, x, y, facing } })
    this.#shown = true
  }

  /** The city inside the radius: the buildings, where they are headed, and the doors they know. */
  #around(x: number, y: number): Omit<MinimapView, 'facing'> {
    const size = this.#world.cellSize
    const marks: MapMark[] = this.#goals().map((goal) => ({
      id: goal.id,
      x: goal.x / size,
      y: goal.z / size,
      label: goal.label,
      kind: 'goal',
      line: goal.line,
    }))
    return {
      x,
      y,
      radius: RADIUS,
      plots: this.#plan.filter((plot) => within(plot.rect, x, y)),
      marks,
      doors: this.#doors(),
    }
  }

  /** Every place the player has walked into, on its own doorway. */
  #doors(): MinimapDoor[] {
    const doors: MinimapDoor[] = []
    for (const interiorId of this.#entered()) {
      const plotId = interiorPlot(this.#world, interiorId)
      const plot = plotId ? this.#world.plot(plotId) : undefined
      if (plot) doors.push({ id: plot.id, name: plot.name, x: plot.entrance.cell.x + 0.5, y: plot.entrance.cell.y + 0.5 })
    }
    return doors
  }
}

/** Whether a building's footprint reaches into the square on show. */
function within(rect: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
  return rect.x <= x + RADIUS && rect.x + rect.w >= x - RADIUS && rect.y <= y + RADIUS && rect.y + rect.h >= y - RADIUS
}

