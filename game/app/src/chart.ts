import type { Hud, MapDistrict, MapMark, MapPlot, MapStation } from '@gb/hud'
import type { World } from '@gb/world'
import { interiorPlot, planOf, type Marked } from './places.ts'
import { bearing, type Vec2 } from './walk.ts'

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
 * once and the pins are measured only while the map is actually up. Every plot
 * carries its name for the hover and its charter's prominence for its fill;
 * the ones written on the plan are the places the player has walked into, the
 * places the quests point at, and the landmarks.
 */
export class Chart {
  #world: World
  #hud: Hud
  #you: () => Pose
  #goals: () => readonly Marked[]
  #offers: () => readonly Marked[]
  #entered: () => readonly string[]
  #stations: readonly MapStation[]
  #boarding: () => string | undefined
  #homes: () => readonly string[]
  #plan: MapPlot[]
  #districts: readonly MapDistrict[]
  #landmarks: readonly string[]
  #named: MapPlot[] | undefined
  #naming = ''
  #open = false
  #since = EVERY

  constructor(input: {
    world: World
    hud: Hud
    you: () => Pose
    goals: () => readonly Marked[]
    /** Where there is work to pick up, so a player holding no job can read where to start. */
    offers?: () => readonly Marked[]
    entered: () => readonly string[]
    /** Where fast travel boards, and the one the player is standing at. A city with no stations lists none. */
    stations?: readonly MapStation[]
    boarding?: () => string | undefined
    /** The interiors the player holds the deed to, so a place of their own is on their map. */
    homes?: () => readonly string[]
  }) {
    this.#world = input.world
    this.#hud = input.hud
    this.#you = input.you
    this.#goals = input.goals
    this.#offers = input.offers ?? (() => [])
    this.#entered = input.entered
    this.#stations = input.stations ?? []
    this.#boarding = input.boarding ?? (() => undefined)
    this.#homes = input.homes ?? (() => [])
    this.#plan = planOf(this.#world)
    // the parts of the city, read once: a cut is the world file's and never
    // changes while it is being played
    this.#districts = this.#world.districts().map((district) => ({ id: district.id, name: district.name, rects: district.blocks }))
    this.#landmarks = this.#plan.filter((plot) => plot.prominence === 'landmark').map((plot) => plot.id)
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

  /** Put the plan up and draw it now: what walking up to a subway entrance opens. */
  show(): void {
    this.open = true
    this.#hud.show({ window: 'map' })
    this.draw()
  }

  /** Measure the city and push it, whatever the map face is doing. */
  draw(): void {
    const goals = this.#goals()
    const offers = this.#offers()
    const boarding = this.#boarding()
    this.#hud.show({
      map: {
        width: this.#world.grid.width,
        height: this.#world.grid.height,
        plots: this.#plots(goals),
        ...(this.#districts.length ? { districts: this.#districts } : {}),
        marks: [
          this.#here(),
          ...goals.map((goal) => this.#pin(goal, 'goal')),
          // work waiting where the player has not taken it, so somebody
          // holding nothing can read where to start
          ...offers.map((offer) => this.#pin(offer, 'offer')),
          ...this.#ownHomes(),
        ],
        stations: this.#stations,
        ...(boarding ? { boarding } : {}),
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

  #pin(goal: Marked, kind: 'goal' | 'offer'): MapMark {
    const size = this.#world.cellSize
    return { x: goal.x / size, y: goal.z / size, label: goal.label, kind, line: goal.line }
  }

  /** Every place the player owns, on the plot it is inside. A deed to a room the city has lost marks nothing. */
  #ownHomes(): MapMark[] {
    const marks: MapMark[] = []
    for (const interiorId of this.#homes()) {
      const plotId = interiorPlot(this.#world, interiorId)
      const plot = plotId ? this.#world.plot(plotId) : undefined
      if (!plot) continue
      marks.push({
        x: plot.rect.x + plot.rect.w / 2,
        y: plot.rect.y + plot.rect.h / 2,
        label: plot.name,
        kind: 'home',
      })
    }
    return marks
  }

  /**
   * The plan, with the plots that earn a name written on it: the landmarks, the
   * places the quests point at, the places with work waiting in them, and the
   * places the player has walked into. Every other building stays a shape with
   * a hover: a plan with nine hundred names on it is unreadable, and the player
   * has no reason to read most of them.
   */
  #plots(goals: readonly Marked[]): MapPlot[] {
    const named = new Set<string>(this.#landmarks)
    for (const goal of [...goals, ...this.#offers()]) if (goal.plotId) named.add(goal.plotId)
    for (const interiorId of this.#homes()) {
      const plotId = interiorPlot(this.#world, interiorId)
      if (plotId) named.add(plotId)
    }
    for (const interiorId of this.#entered()) {
      const plotId = interiorPlot(this.#world, interiorId)
      if (plotId) named.add(plotId)
    }
    const naming = [...named].toSorted().join('/')
    if (naming === this.#naming && this.#named) return this.#named
    this.#naming = naming
    this.#named = this.#plan.map((plot) => (named.has(plot.id) ? { ...plot, named: true } : plot))
    return this.#named
  }
}

