import * as THREE from 'three'
import { smoothstep01 } from './height.ts'

/** How the sun's shadow map is cut. */
export interface ShadowSpec {
  /** Metres from the player to the edge of the map, in every direction. */
  readonly radius: number
  /** Pixels on a side. */
  readonly mapSize: number
  /**
   * Metres the depth slab runs back up the sunbeam past the player.
   *
   * Nothing has to be widened for a tall building upwind: whatever lands its
   * shadow inside the map already stands inside the map's own square, because
   * both are the same point projected along the beam. It only has to be in
   * front of the near plane, and a 40 m building with the sun two degrees up is
   * 1.1 km back along it.
   */
  readonly reach: number
  /** Sine of the sun's elevation at which the shadow is at full strength, and where it is gone. */
  readonly full: number
  readonly gone: number
  /** Metres the sampled point is pushed along its own normal, to keep a surface off its own shadow. */
  readonly normalBias: number
}

/**
 * A hundred metres of near field at 2,048 square, fading out under five degrees
 * of sun.
 *
 * One tight map that rides on the player, not one map stretched over the
 * landscape. Over the 6 to 7 km the land runs, a 2,048 square map gives a texel
 * about 3 m across: a person casts nothing at all and a house casts a smear.
 * Over a 200 m square it gives 9.8 cm, so a 1.8 m person lays down 18 texels of
 * shadow and a 2.1 m door 21, and the soft filter blurs the edge over about
 * 15 cm. A hundred metres is also as far as a shadow reads: past it the haze is
 * already taking the contrast out and a person's shadow is a few pixels.
 *
 * The fade is what keeps dusk from degenerating. A square held square to the
 * beam covers `radius / sin(elevation)` metres of ground along the sun's
 * bearing, so the ground texel stretches the same way: 20 cm at 30 degrees,
 * 1.1 m at five, 6.5 m at one. It stretches along the beam only, which is the
 * axis a low sun makes long anyway, and the ground it is smearing is by then
 * taking under a tenth of the sunlight. So the shadow can ride the sun most of
 * the way down and only dissolves in the last degree, where the geometry has
 * nowhere left to go.
 */
export const SUN_SHADOW: ShadowSpec = {
  radius: 100,
  mapSize: 2048,
  reach: 2000,
  full: 0.09,
  gone: 0.015,
  normalBias: 0.11,
}

/**
 * The layer the shadow camera draws on top of layer 0, and no other camera draws.
 *
 * A shadow pass is charged by the caster, not by the pixel: on the WebGL2
 * fallback every object handed to it costs about 6 us whatever its size. A box
 * that draws one thing as several meshes can put one merged stand-in on this
 * layer, take `castShadow` off the meshes people actually see, and pay one draw
 * for the shadow instead of four. Nothing on this layer is ever visible: a
 * camera's mask is layer 0 alone unless somebody changes it.
 */
export const SHADOW_LAYER = 7

const WORLD_UP = new THREE.Vector3(0, 1, 0)
/** Metres the slab runs on past the player, so ground that falls away under them still receives. */
const BEYOND = 400

/**
 * The sun's shadow map: one tight square of ground that follows the player.
 *
 * Two things have to be right or this looks worse than no shadows at all.
 *
 * The map has to be somewhere useful, so it is centred on the viewer rather
 * than on the town: the player can be six kilometres out and the near field
 * goes with them.
 *
 * And it has to be quantised. The map is a grid pinned to the world, and if it
 * slides by a fraction of a texel every frame then every shadow edge in the
 * scene boils as the player walks. So the centre is snapped to whole texels of
 * the light's own three axes before it is used, which costs three dot products
 * and three rounds a frame.
 */
export class SunShadow {
  readonly spec: ShadowSpec
  /** Metres of ground one texel of the map covers, square to the sunbeam. */
  readonly texel: number

  readonly #light: THREE.DirectionalLight
  readonly #right = new THREE.Vector3()
  readonly #up = new THREE.Vector3()
  readonly #centre = new THREE.Vector3()

  constructor(light: THREE.DirectionalLight, spec: ShadowSpec = SUN_SHADOW) {
    this.spec = spec
    this.texel = (spec.radius * 2) / spec.mapSize
    this.#light = light

    light.castShadow = true
    const shadow = light.shadow
    shadow.mapSize.set(spec.mapSize, spec.mapSize)
    // world metres along the surface normal, so it holds at any distance and at
    // any map size; a constant depth bias would not
    shadow.normalBias = spec.normalBias
    shadow.bias = 0
    shadow.intensity = 1

    const camera = shadow.camera
    camera.left = -spec.radius
    camera.right = spec.radius
    camera.top = spec.radius
    camera.bottom = -spec.radius
    camera.near = 1
    camera.far = spec.reach + BEYOND
    camera.layers.enable(SHADOW_LAYER)
    camera.updateProjectionMatrix()
  }

  /**
   * Point the map at the ground under the viewer, with the sun where it is now.
   *
   * `toLight` is the unit vector towards the sun, `focus` the eye. Both the
   * light and its target are moved, so the direction the light shines is
   * exactly the one it had before: a directional light is a direction, and
   * moving it only decides which hundred metres get a shadow map.
   */
  aim(toLight: THREE.Vector3, focus: THREE.Vector3): void {
    const shadow = this.#light.shadow
    shadow.intensity = smoothstep01((toLight.y - this.spec.gone) / (this.spec.full - this.spec.gone))

    // the three axes of the map, built the way three builds the shadow camera's
    // own: x across the world's up and the beam, y square to both, z the beam
    const right = this.#right.copy(WORLD_UP).cross(toLight)
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
    right.normalize()
    const up = this.#up.copy(toLight).cross(right).normalize()

    const texel = this.texel
    const snap = (axis: THREE.Vector3): number => Math.round(focus.dot(axis) / texel) * texel
    const centre = this.#centre
      .set(0, 0, 0)
      .addScaledVector(right, snap(right))
      .addScaledVector(up, snap(up))
      .addScaledVector(toLight, snap(toLight))

    this.#light.position.copy(centre).addScaledVector(toLight, this.spec.reach)
    this.#light.target.position.copy(centre)
  }
}
