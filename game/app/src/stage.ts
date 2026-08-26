import type * as THREE from 'three'
import type { Stall } from './stall.ts'

/**
 * Where the game draws: the camera it looks through, the scene it hangs the
 * city on, the canvas the mouse and the keys are bound to, and the frame loop.
 *
 * This is the whole of the graphics boundary. Nothing behind it is named here,
 * so what the game holds is a camera, a scene and a canvas rather than a
 * renderer: `createStage` in `renderer.ts` is the one that talks to the GPU.
 */
export interface Stage {
  /** What the mouse and the keys are bound to, and what pointer lock holds. */
  readonly canvas: HTMLElement
  readonly camera: THREE.PerspectiveCamera
  readonly scene: THREE.Scene
  /** Sky, sun and colour for when the landscape is not there to provide them. */
  plainDaylight(): void
  /**
   * Take a copy of the sky for every surface to reflect. Without this a metal
   * or glass surface has no surroundings to give back, which is most of why the
   * city reads as a cartoon. Filtering costs about 20 ms, so it happens now and
   * then and `carrySky` rides the gap.
   */
  reflect(sky: THREE.Object3D): void
  /**
   * Where that copy stands now: how much brighter the dome has got since it was
   * taken, and how far it has turned. Cheap enough for every frame.
   */
  carrySky(brighter: number, turned: number): void
  /**
   * Light a room, and stop lighting it on the way out. Outdoor light belongs to
   * the landscape and goes dark with it, so without this a building is pitch
   * black inside.
   */
  indoors(on: boolean): void
  /** Develop the frame for how dark it is, 0 full daylight to 1 after dark: exposure, and how hard neon glows. */
  grade(night: number): void
  /** Swap what is being rendered: the city, or the inside of a building. */
  show(root: THREE.Object3D): void
  /**
   * Run the frame loop. The callback is handed the elapsed seconds and the
   * frame's own stall watch to mark its segments on; returning `false` skips
   * the draw, which is what a paused game does. The watch is closed after the
   * draw, so a stall inside the renderer is caught with the rest.
   */
  start(frame: (seconds: number, stall?: Stall) => boolean | void): void
  /**
   * Draw a scene of your own once, off screen, and give back what it drew as an
   * image the interface can put in an `<img>`. Used for a face: a portrait is
   * one square of one person, taken once and kept.
   */
  snapshot(scene: THREE.Scene, camera: THREE.Camera, size: number): Promise<string | undefined>
  /** Draw one frame now, whatever the browser is doing with its frame loop. */
  draw(): void
  dispose(): void
}

/**
 * How a stage comes to exist. `createStage` unless something else says
 * otherwise: it is the only part of the game that needs a GPU, so a caller with
 * no graphics to give it hands over its own stage instead.
 */
export type MakeStage = (mount: HTMLElement) => Promise<Stage>
