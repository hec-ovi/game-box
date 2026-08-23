import type { Rng } from '@gb/kit'
import * as THREE from 'three'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import { smoothstep01 } from './height.ts'
import { buildMoon } from './moon.ts'
import { SunShadow, type ShadowSpec } from './shadow.ts'
import { buildStars } from './stars.ts'
import type { LandTheme } from './theme.ts'
import { WEATHER, type Weather } from './weather.ts'

/**
 * The skydome draws before everything and writes no depth, so it is the one
 * object here that is allowed to ignore the depth buffer: it is a background,
 * not a thing at a distance.
 */
const SKY_ORDER = -1000
/** A cube's corners stand this much further out than its faces. */
const DIAGONAL = Math.sqrt(3)
/** Share of the reach the dome's corners take, leaving headroom under the far plane. */
const DOME = 0.98
/** The grey a storm pulls the haze and the light towards. */
const STORM = new THREE.Color(0x8b96a0)
const COLD = new THREE.Color(0xb9c7d4)

/**
 * Sky, sun, moon and haze, driven by a time of day and a weather.
 *
 * Nothing here is rebuilt when either changes: the sun and moon move, the sky's
 * uniforms are written, and the lights and the fog are edited in place, so the
 * app can set the time every frame. The skydome is a node material, which is
 * what the WebGPU renderer needs and what its WebGL2 backend compiles for
 * itself; the stars, the moon and the lights are ordinary three.js objects that
 * work the same on both.
 *
 * The dome, the stars and the moon are hung on the eye rather than on the town,
 * because that is where a sky is: at infinity, centred on whoever is looking.
 * `follow` moves them, and it moves the sun's shadow map with them: the moon
 * stays on the town, since a directional light that casts nothing is a
 * direction and its position says nothing.
 */
export class Atmosphere {
  readonly sky: SkyMesh
  readonly sun: THREE.DirectionalLight
  readonly moon: THREE.DirectionalLight
  readonly skyLight: THREE.HemisphereLight
  readonly stars: THREE.Points
  readonly moonDisc: THREE.Sprite
  readonly fog: THREE.FogExp2
  /** Everything to hang in the scene, in the order it should be added. */
  readonly objects: readonly THREE.Object3D[]

  readonly #theme: LandTheme
  readonly #centre: THREE.Vector3
  /** Where the sky is centred: the last viewer it was given, the town until then. */
  readonly #eye: THREE.Vector3
  readonly #sunward = new THREE.Vector3()
  readonly #moonward = new THREE.Vector3()
  readonly #moonReach: number
  readonly #shadow: SunShadow
  readonly #warm: THREE.Color
  readonly #day: { sun: THREE.Color; sky: THREE.Color; bounce: THREE.Color; haze: THREE.Color }
  readonly #night: { sky: THREE.Color; bounce: THREE.Color; haze: THREE.Color }
  #time = 12
  #weather: Weather = 'clear'

  constructor(theme: LandTheme, centre: { x: number; z: number }, radius: number, rng: Rng, shadow?: ShadowSpec) {
    this.#theme = theme
    this.#centre = new THREE.Vector3(centre.x, 0, centre.z)
    this.#eye = this.#centre.clone()

    const light = theme.light
    this.#warm = new THREE.Color(light.lowSun)
    this.#day = {
      sun: new THREE.Color(light.sun),
      sky: new THREE.Color(light.skyColour),
      bounce: new THREE.Color(light.bounceColour),
      haze: new THREE.Color(light.haze),
    }
    this.#night = {
      sky: new THREE.Color(light.nightSky),
      bounce: new THREE.Color(light.nightBounce),
      haze: new THREE.Color(light.nightHaze),
    }

    this.sky = new SkyMesh()
    this.sky.name = 'land:sky'
    // scaled by its own diagonal, so the eight corners land on the reach instead
    // of 1.73 times past it: the whole dome fits inside the far plane
    this.sky.scale.setScalar((radius * DOME * 2) / DIAGONAL)
    this.sky.position.copy(this.#eye)
    this.sky.renderOrder = SKY_ORDER
    this.sky.material.fog = false
    this.sky.material.depthTest = false
    this.sky.turbidity.value = theme.sky.turbidity
    this.sky.rayleigh.value = theme.sky.rayleigh
    this.sky.mieCoefficient.value = theme.sky.mie
    this.sky.mieDirectionalG.value = theme.sky.mieDirection
    this.sky.cloudScale.value = theme.sky.cloudScale
    this.sky.cloudElevation.value = theme.sky.cloudElevation

    this.stars = buildStars(radius * 0.96, rng)
    this.stars.position.copy(this.#eye)
    this.#moonReach = radius * 0.92
    // forked after the stars are hung, so retuning the moon cannot move them
    this.moonDisc = buildMoon(radius * 0.018, rng.fork('moon'))

    this.sun = new THREE.DirectionalLight(light.sun, light.sunIntensity)
    this.sun.name = 'land:sun'
    this.sun.target.name = 'land:sun-target'
    this.#shadow = new SunShadow(this.sun, shadow)

    this.moon = new THREE.DirectionalLight(light.moon, light.moonIntensity)
    this.moon.name = 'land:moon'
    this.moon.target.name = 'land:moon-target'
    this.moon.target.position.copy(this.#centre)

    this.skyLight = new THREE.HemisphereLight(light.skyColour, light.bounceColour, light.ambient)
    this.skyLight.name = 'land:skylight'

    this.fog = new THREE.FogExp2(light.haze, light.density)
    this.objects = [
      this.sky,
      this.stars,
      this.moonDisc,
      this.sun,
      this.sun.target,
      this.moon,
      this.moon.target,
      this.skyLight,
    ]
    this.apply()
  }

  /** The sun's shadow map: how much ground it covers and how fine it is. */
  get shadow(): SunShadow {
    return this.#shadow
  }

  get time(): number {
    return this.#time
  }

  get weather(): Weather {
    return this.#weather
  }

  /** 0 at midnight, 24 at midnight again. Anything outside wraps. */
  setTime(hours: number): void {
    const wrapped = ((hours % 24) + 24) % 24
    if (wrapped === this.#time) return
    this.#time = wrapped
    this.apply()
  }

  setWeather(weather: Weather): void {
    if (weather === this.#weather) return
    this.#weather = weather
    this.apply()
  }

  /**
   * Centre the sky on the eye, in all three axes.
   *
   * A sky is at infinity, so the observer stands at the middle of it: the dome,
   * the star sphere and the moon all move with the camera, which is what keeps
   * the constellations still while the player walks and keeps the horizon at
   * eye level while they climb. It also fixes what the sky costs the far plane:
   * the furthest corner of the dome is always the same distance away, whether
   * the player is in the square or kilometres out on the plateau.
   */
  follow(viewer: THREE.Vector3): void {
    if (viewer.equals(this.#eye)) return
    this.#eye.copy(viewer)
    this.#shadow.aim(this.#sunward, viewer)
    this.sky.position.copy(viewer)
    this.stars.position.copy(viewer)
    this.moonDisc.position.copy(this.#moonward).multiplyScalar(this.#moonReach).add(viewer)
  }

  /** Write the time and the weather into the sky, the lights and the fog. */
  apply(): void {
    const theme = this.#theme
    const look = WEATHER[this.#weather]
    sunward(this.#time, theme.sky.noonElevation, this.#sunward)
    this.#moonward.copy(this.#sunward).negate()

    // full night below seven degrees under the horizon, full day eleven above it
    const day = smoothstep01((this.#sunward.y + 0.12) / 0.32)
    const low = 1 - smoothstep01((this.#sunward.y - 0.05) / 0.3)
    const cloud = look.cloud

    this.sky.sunPosition.value.copy(this.#sunward)
    this.sky.cloudCoverage.value = theme.sky.cloudCoverage + (1 - theme.sky.cloudCoverage) * cloud
    this.sky.cloudDensity.value = theme.sky.cloudDensity + (1 - theme.sky.cloudDensity) * cloud * 0.9

    this.#shadow.aim(this.#sunward, this.#eye)
    this.sun.color.copy(this.#day.sun).lerp(this.#warm, low).lerp(COLD, look.grey * 0.6)
    this.sun.intensity = theme.light.sunIntensity * day * look.light
    this.sun.visible = this.sun.intensity > 0.002

    // cloud takes less off the moon than off the sun, because a wet night still
    // has to be a night you can walk through
    this.moon.position.copy(this.#moonward).multiplyScalar(400).add(this.#centre)
    this.moon.intensity = theme.light.moonIntensity * (1 - day) * (0.45 + 0.55 * look.light)
    this.moon.visible = this.moon.intensity > 0.002

    this.skyLight.color.copy(this.#night.sky).lerp(this.#day.sky, day).lerp(STORM, look.grey * 0.5)
    this.skyLight.groundColor.copy(this.#night.bounce).lerp(this.#day.bounce, day)
    this.skyLight.intensity = (theme.light.nightAmbient + (theme.light.ambient - theme.light.nightAmbient) * day) * look.ambient

    this.fog.color.copy(this.#night.haze).lerp(this.#day.haze, day).lerp(STORM, look.grey)
    this.fog.density = theme.light.density * look.fog * (1.25 - 0.25 * day)

    // stars go out as the sun comes up to the horizon, before the sky itself brightens
    const showNight = (1 - smoothstep01((this.#sunward.y + 0.22) / 0.24)) * (1 - cloud * 0.85)
    this.stars.rotation.y = (this.#time / 24) * Math.PI * 2
    setFade(this.stars.material as THREE.PointsMaterial, showNight, this.stars)
    this.moonDisc.position.copy(this.#moonward).multiplyScalar(this.#moonReach).add(this.#eye)
    setFade(this.moonDisc.material, showNight, this.moonDisc)
  }
}

/** Which way the sun is, at this hour, for a place whose noon sun stands this high. */
export function sunward(hours: number, noonElevation: number, out: THREE.Vector3): THREE.Vector3 {
  const elevation = THREE.MathUtils.degToRad(noonElevation) * Math.sin(((hours - 6) / 12) * Math.PI)
  const azimuth = THREE.MathUtils.degToRad(90 + (hours - 6) * 15)
  return out.setFromSphericalCoords(1, Math.PI / 2 - elevation, azimuth)
}

function setFade(material: THREE.Material & { opacity: number }, opacity: number, object: THREE.Object3D): void {
  material.opacity = opacity
  object.visible = opacity > 0.02
}

