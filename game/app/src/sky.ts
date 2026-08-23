import type { KitDressing } from '@gb/kitbash'
import { buildLand, type Land } from '@gb/land'
import type { PlayerState } from '@gb/play'
import type { World } from '@gb/world'
import type { Stage } from './renderer.ts'
import type { Ground } from './solids.ts'

/** The playthrough's own clock: the reading the sky and the lit windows follow. */
export type Reading = PlayerState['clock']

/**
 * Sky, hills, water and trees around the town, and the hour they are lit for.
 * The landscape brings its own light, so plain daylight only comes out when
 * there is no landscape: a scene is never unlit.
 */
export class Sky {
  #stage: Stage
  #kit: KitDressing | undefined
  #land: Land | undefined
  #reflectedHour = -1
  #weather: Reading['weather'] | undefined

  constructor(world: World, stage: Stage, options: { hour: number; kit?: KitDressing }) {
    this.#stage = stage
    this.#kit = options.kit

    // built for the hour the playthrough is at, because the environment is
    // prefiltered off this sky before the first frame: built at its default
    // midday, a city opened at midnight would stand under a black sky lit like
    // noon until the hour turned
    const built = buildLand(world, { time: options.hour })
    if (!built.ok) {
      console.warn(`no landscape (${built.error.code}); plain daylight instead`)
      stage.plainDaylight()
      return
    }

    this.#land = built.value
    // The sky lights the scene once. `Land.skyLight` and a prefiltered copy of
    // the same skydome in `scene.environment` are two accounts of one sky, and
    // running both washes the frame out: measured at midday, a shadow takes 39%
    // of the light off what it falls on with the hemisphere alone and 1.4% with
    // both, which is no shadow at all. The environment is the sky done properly,
    // so it stays and the hemisphere goes.
    this.#land.skyLight.visible = false
    stage.scene.add(this.#land.root)
    stage.scene.fog = this.#land.fog
    stage.camera.far = this.#land.cameraFar
    stage.camera.updateProjectionMatrix()
    this.#reflect(options.hour)
  }

  /** True once there are real hills, so the city's stand-in ring can go. */
  get standing(): boolean {
    return this.#land !== undefined
  }

  /** How high the ground is outside the grid, and where it can be stood on. */
  get ground(): Ground | undefined {
    return this.#land
  }

  /** The landscape is not drawn while the player is inside a building. */
  set visible(visible: boolean) {
    if (this.#land) this.#land.root.visible = visible
  }

  /**
   * Follow the playthrough clock. Lit windows follow it indoors too, because
   * they are seen through the doorway; the sky only moves while it is in view.
   */
  follow(seconds: number, clock: Reading, outdoors: boolean): void {
    const hours = clock.hour + clock.minute / 60
    this.#kit?.setTime(hours)
    // the frame is developed for the hour whether or not the sky is in view:
    // indoors the grade holds itself at the room's own light
    this.#stage.grade(hours)
    if (!this.#land || !outdoors) return

    this.#land.setTime(hours)
    if (clock.hour !== this.#reflectedHour) this.#reflect(clock.hour)
    if (clock.weather !== this.#weather) {
      this.#weather = clock.weather
      this.#land.setWeather(clock.weather)
    }
    this.#land.update(seconds, this.#stage.camera.position)
  }

  /**
   * Take the light off the sky, so a window has something to reflect and a wall
   * in shade is not flat. Prefiltering costs about 20 ms, so it happens when
   * the hour turns rather than every frame: the sky does not change faster
   * than that.
   */
  #reflect(hour: number): void {
    if (!this.#land) return
    this.#reflectedHour = hour
    this.#stage.reflect(this.#land.sky)
  }
}
