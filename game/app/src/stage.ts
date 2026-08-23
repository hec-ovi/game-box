import type * as THREE from 'three'

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
   * Light every surface with the sky itself. Without this the world is lit by
   * three lamps and nothing else, which is most of why it reads as a cartoon:
   * a metal or glass surface has no surroundings to reflect.
   */
  reflect(sky: THREE.Object3D): void
  /**
   * Light a room, and stop lighting it on the way out. Outdoor light belongs to
   * the landscape and goes dark with it, so without this a building is pitch
   * black inside.
   */
  indoors(on: boolean): void
  /** Develop the frame for this hour of the day: exposure, and how hard neon glows. */
  grade(hours: number): void
  /** Swap what is being rendered: the city, or the inside of a building. */
  show(root: THREE.Object3D): void
  start(frame: (seconds: number) => void): void
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
