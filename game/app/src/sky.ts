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
 * How far the dome may drift from the copy the scene reflects before another
 * copy is taken. A third of a stop: below what anybody sees in a reflection,
 * and it costs a prefilter only where the sky is actually moving, which is the
 * hour either side of sunrise and sunset.
 */
const DRIFT = 1.35

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
    // The sky does two jobs and they are split, or one of them eats the other.
    // `Land.skyLight` is the light the sky throws: the landscape writes it for
    // the theme and the hour, it is what keeps a face the sun never reaches
    // from going flat by day, and after dark it is the whole of what reaches a
    // wall with no lamp on it. The prefiltered dome is what a surface gives
    // back, and at full strength it is the brighter of the two by an order of
    // magnitude: a cast shadow takes 39% of the light off what it falls on with
    // the hemisphere alone and 1.4% with the dome over it, which is no shadow
    // at all. So the hemisphere carries the light and the dome is turned down
    // to a reflection (`Look.environment`).
    stage.scene.add(this.#land.root)
    stage.scene.fog = this.#land.fog
    stage.camera.far = this.#land.cameraFar
    stage.camera.updateProjectionMatrix()
    this.#reflect()
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
      this.#reflect()
    }
    // One reading of how dark it is, and everything that lights up reads it.
    // `1 - day` is the sun's own crossing on the theme's latitude, full night
    // seven degrees under the horizon and full day eleven above, which is the
    // dusk a player sees; it is what the lamps, the wet street and the grade all
    // move on, so none of them is on an hour of its own.
    const night = this.#land ? 1 - this.#land.light.day : darkness(hours)
    // the street reads both: how wet it is, and how much of what it reflects
    // is lit. Both are one uniform, so they are written every frame.
    if (city) {
      city.night = night
      if (this.#land) city.wetness = this.#land.wetness
    }
    // the frame is developed for how much daylight there is whether or not the
    // sky is in view: indoors the grade holds itself at the room's own light
    this.#stage.grade(night)
    if (!this.#land) return

    // the reflection is kept current indoors as well, so stepping back out onto
    // the pavement is not a frame of the sky the player walked in under
    if (this.#stale()) this.#reflect()
    this.#stage.carrySky(this.#land.light.skyBrightness / this.#reflectedBrightness, this.#land.light.sunYaw - this.#reflectedYaw)
    if (outdoors) this.#land.update(seconds, this.#stage.camera.position)
  }

  /**
   * Take the light off the sky, so a window has something to reflect and a wall
   * in shade is not flat. Prefiltering costs about 20 ms against a 2.5 ms frame,
   * so it happens now and then and `carrySky` rides the gap.
   */
  #reflect(): void {
    if (!this.#land) return
    this.#reflectedHour = Math.floor(this.#land.light.hour)
    this.#stage.reflect(this.#land.sky)
    this.#reflectedYaw = this.#land.light.sunYaw
    this.#reflectedBrightness = this.#land.light.skyBrightness
  }

  /**
   * When the copy has to be taken again. Between rebuilds it is moved rather
   * than remade: turned with the sun and ridden on the dome's own brightness,
   * which costs nothing because the sky's pattern is very nearly rigid about the
   * vertical. That only holds while it is a correction. Measured on the neon
   * theme, the dome brightens forty-fold between 07:00 and 08:00 and collapses
   * to a fiftieth between 16:00 and 17:00, and forty times a starfield is not a
   * dawn sky: held to the hour, the shopfront the player is looking at goes
   * murky and then near-white with nothing else changed. So the copy is taken
   * again when the sky has moved past `DRIFT` either way, which holds the ride
   * to a third of a stop, and on the hour anyway for the colour that moves
   * without the brightness.
   */
  #stale(): boolean {
    const light = this.#land!.light
    if (Math.floor(light.hour) !== this.#reflectedHour) return true
    if (!(this.#reflectedBrightness > 0)) return true
    const moved = light.skyBrightness / this.#reflectedBrightness
    return moved > DRIFT || moved < 1 / DRIFT
  }
}
