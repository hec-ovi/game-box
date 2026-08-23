import type { Hud, MapMark, MapPlot } from '@gb/hud'
import type { World } from '@gb/world'
import type { Marked } from './places.ts'
import type { Vec2 } from './walk.ts'

/** Where the player is standing and which way they are looking. */
export interface Pose {
  readonly position: Vec2
  readonly heading: number
}

/**
 * How often the map is redrawn while it is open. The player is reading a plan,
 * not chasing a dot: four times a second is smooth enough to watch yourself
 * move and cheap enough to cost nothing.
 */
const EVERY = 0.25

/**
 * The city from above, for the map face of the window. The plan is the grid the
 * city was generated on, so nothing is surveyed or baked: the plots are read
 * once and the pins are measured only while the map is actually up.
 */
export class Chart {
  #world: World
  #hud: Hud
  #you: () => Pose
  #goals: () => readonly Marked[]
  #plan: MapPlot[]
  #labelled: MapPlot[] | undefined
  #labels = ''
  #open = false
  #since = EVERY

  constructor(input: { world: World; hud: Hud; you: () => Pose; goals: () => readonly Marked[] }) {
    this.#world = input.world
    this.#hud = input.hud
    this.#you = input.you
    this.#goals = input.goals
    this.#plan = this.#world.plots().map((plot) => ({ id: plot.id, rect: plot.rect }))
  }

  /** The map face is up, or it is not. Nothing is measured while it is not. */
  set open(open: boolean) {
    this.#open = open
    // opening it draws on the frame it opens, rather than a quarter second later
    if (open) this.#since = EVERY
  }

  update(seconds: number): void {
    if (!this.#open) return
    this.#since += seconds
    if (this.#since < EVERY) return
    this.#since = 0
    this.draw()
  }

  /** Measure the city and push it, whatever the map face is doing. */
  draw(): void {
    const goals = this.#goals()
    this.#hud.show({
      map: {
        width: this.#world.grid.width,
        height: this.#world.grid.height,
        plots: this.#named(goals),
        marks: [this.#here(), ...goals.map((goal) => this.#pin(goal))],
      },
    })
  }

  /** The player, as an arrow. The map is north up, so a heading is its bearing. */
  #here(): MapMark {
    const pose = this.#you()
    const size = this.#world.cellSize
    return {
      x: pose.position.x / size,
      y: pose.position.z / size,
      label: 'You',
      kind: 'you',
      facing: bearing(-pose.heading),
    }
  }

  #pin(goal: Marked): MapMark {
    const size = this.#world.cellSize
    return { x: goal.x / size, y: goal.z / size, label: goal.label, kind: 'goal' }
  }

  /**
   * The plan, with the places the quest points at named. Every other building
   * stays a shape: a plan with nine hundred names on it is unreadable, and the
   * player has no reason to read most of them.
   */
  #named(goals: readonly Marked[]): MapPlot[] {
    const wanted = new Map(goals.flatMap((goal) => (goal.plotId ? [[goal.plotId, goal.label] as const] : [])))
    if (wanted.size === 0) return this.#plan

    const key = [...wanted].flat().join('/')
    if (key === this.#labels && this.#labelled) return this.#labelled
    this.#labels = key
    this.#labelled = this.#plan.map((plot) => {
      const label = wanted.get(plot.id)
      return label ? { ...plot, label } : plot
    })
    return this.#labelled
  }
}

/** Radians clockwise from north, in one turn. */
function bearing(radians: number): number {
  const turn = Math.PI * 2
  return ((radians % turn) + turn) % turn
}
