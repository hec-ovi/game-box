import type { KitDressing } from '@gb/kitbash'
import { buildLand, type Land } from '@gb/land'
import type { PlayerState } from '@gb/play'
import type { CityBuild } from '@gb/scene'
import type { World } from '@gb/world'
import { darkness } from './night.ts'
import type { Stage } from './stage.ts'
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
  #reflectedYaw = 0
  #reflectedBrightness = 1
  #weather: Reading['weather']

  constructor(world: World, stage: Stage, options: { hour: number; weather: Reading['weather']; kit?: KitDressing }) {
    this.#stage = stage
    this.#kit = options.kit
    this.#weather = options.weather

    // built for the hour and the sky the playthrough is at, because the
    // environment is prefiltered off this sky before the first frame: built at
    // its default midday, a city opened at midnight would stand under a black
    // sky lit like noon until the hour turned
    const built = buildLand(world, { time: options.hour, weather: options.weather })
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
  follow(seconds: number, clock: Reading, outdoors: boolean, city?: CityBuild): void {
    // whole hours and whole minutes only move once a game minute, which at the
    // default rate is four times a second: the sun would hop two thirds of its
    // own width each kick, and the gradient, the fog and the stars with it
    const hours = clock.secondsOfDay / 3600
    this.#kit?.setTime(hours)
    // the landscape is told the hour whether or not it is in view, so the
    // windows, the lamps and the grade read the same sky the player steps out
    // into, and the sun has not jumped while they were inside
    this.#land?.setTime(hours)
    if (this.#land && clock.weather !== this.#weather) {
      this.#weather = clock.weather
      this.#land.setWeather(clock.weather)
      // a change of sky is a different dome: the copy the scene reflects is
      // taken again rather than carried from the old one
      this.#reflect(clock.hour)
    }
    // the street reads both: how wet it is, and how much of what it reflects
    // is lit. Both are one uniform, so they are written every frame.
    if (city) {
      city.night = this.#land ? this.#land.light.dark : darkness(hours)
      if (this.#land) city.wetness = this.#land.wetness
    }
    // the frame is developed for how much daylight there is whether or not the
    // sky is in view: indoors the grade holds itself at the room's own light
    this.#stage.grade(this.#land ? 1 - this.#land.light.day : darkness(hours))
    if (!this.#land || !outdoors) return

    if (clock.hour !== this.#reflectedHour) this.#reflect(clock.hour)
    this.#carry()
    this.#land.update(seconds, this.#stage.camera.position)
  }

  /**
   * Take the light off the sky, so a window has something to reflect and a wall
   * in shade is not flat. Prefiltering costs about 20 ms against a 2.5 ms frame,
   * so it happens when the hour turns or the weather changes and not oftener.
   */
  #reflect(hour: number): void {
    if (!this.#land) return
    this.#reflectedHour = hour
    this.#stage.reflect(this.#land.sky)
    this.#reflectedYaw = this.#land.light.sunYaw
    this.#reflectedBrightness = this.#land.light.skyBrightness
  }

  /**
   * Between rebuilds the map is moved rather than remade. Held still for a whole
   * game hour while the dome overhead keeps turning, it falls an hour behind and
   * catches up in one frame: crossing sunrise the sun in the reflection triples
   * in a single frame. Turning the map with the sun and riding the dome's own
   * brightness carries that across the hour for nothing, because the sky's
   * pattern is very nearly rigid about the vertical, and the rebuild is then a
   * correction rather than a step.
   */
  #carry(): void {
    if (!this.#land) return
    const scene = this.#stage.scene
    scene.environmentRotation.y = this.#land.light.sunYaw - this.#reflectedYaw
    scene.environmentIntensity = this.#land.light.skyBrightness / this.#reflectedBrightness
  }
}
