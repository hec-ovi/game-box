import type * as THREE from 'three'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { pass, uniform } from 'three/tsl'
import { RenderPipeline, type WebGPURenderer } from 'three/webgpu'
import { DAY, INDOORS, lookOf, type Look } from './night.ts'
import { graded } from './tint.ts'

/**
 * Multisampling on the scene pass. The renderer's own `antialias` only covers
 * the frame buffer, and once the chain is in the way nothing is drawn there but
 * a full screen quad, which has no edges to soften. Without this every wall
 * corner in the city crawls.
 */
const SAMPLES = 4

/**
 * The frame between the scene and the screen: bloom, colour, then tone mapping.
 *
 * The chain is one full screen quad. The scene renders into a half float target
 * and stays in linear light the whole way, so a sign brighter than white is
 * still brighter than white when the halo is taken off it; the tone map is the
 * last thing that happens, which is why a halo rolls off instead of clipping to
 * a flat disc.
 *
 * The glow is taken off the finished frame rather than off an emissive-only
 * pass, so what glows is anything bright: a sign, a lit window, a lamp lens,
 * and the sign again where the wet road is mirroring it.
 */
export class Grade {
  #renderer: WebGPURenderer
  #pipeline: RenderPipeline
  #bloom: ReturnType<typeof bloom>
  #cold = uniform(DAY.cold)
  #saturation = uniform(DAY.saturation)
  #night = 0
  #inside = false

  constructor(renderer: WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.#renderer = renderer
    const drawn = pass(scene, camera, { samples: SAMPLES }).getTextureNode('output')
    this.#bloom = bloom(drawn, DAY.strength, DAY.radius, DAY.threshold)
    this.#pipeline = new RenderPipeline(renderer)
    // the glow is graded with the frame, so a halo is the colour of the night
    // it hangs in rather than a bright patch of its own
    this.#pipeline.outputNode = graded(drawn.add(this.#bloom), this.#cold, this.#saturation)
    this.#apply(DAY)
  }

  /** Grade for how dark it is, 0 full daylight to 1 after dark. Cheap enough for every frame: six uniforms. */
  setNight(night: number): void {
    if (!Number.isFinite(night) || night === this.#night) return
    this.#night = night
    if (!this.#inside) this.#apply(lookOf(night))
  }

  /** Indoors the sky is not what is lighting the frame, so the hour stops driving it. */
  set indoors(inside: boolean) {
    if (inside === this.#inside) return
    this.#inside = inside
    this.#apply(inside ? INDOORS : lookOf(this.#night))
  }

  /** Draw the scene through the chain. Stands in for `renderer.render`. */
  render(): void {
    this.#pipeline.render()
  }

  dispose(): void {
    this.#pipeline.dispose()
  }

  #apply(look: Look): void {
    this.#renderer.toneMappingExposure = look.exposure
    this.#bloom.strength.value = look.strength
    this.#bloom.radius.value = look.radius
    this.#bloom.threshold.value = look.threshold
    this.#cold.value = look.cold
    this.#saturation.value = look.saturation
  }
}
