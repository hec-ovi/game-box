import * as THREE from 'three'
import { reflectSky } from '../../src/night.ts'
import type { Stage } from '../../src/stage.ts'
import type { Stall } from '../../src/stall.ts'

/**
 * The stage with the GPU taken out: a real camera, a real scene and a real
 * canvas, and nothing drawn. Everything else the game is made of runs without
 * one, so the game built against this is the game the browser builds. How much
 * of the sky lights the scene is a number rather than a picture, so it is
 * written here the same way the renderer writes it and can be read off the
 * scene.
 */
export class Bench implements Stage {
  readonly canvas: HTMLCanvasElement
  readonly camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 500)
  readonly scene = new THREE.Scene()
  showing: THREE.Object3D | undefined
  night = -1
  inside = false
  brighter = 1
  turned = 0
  reflected = 0
  frame: ((seconds: number, stall?: Stall) => boolean | void) | undefined

  constructor(mount: HTMLElement) {
    this.canvas = document.createElement('canvas')
    mount.append(this.canvas)
  }

  plainDaylight(): void {}
  reflect(): void {
    this.reflected += 1
  }
  carrySky(brighter: number, turned: number): void {
    this.brighter = brighter
    this.turned = turned
    this.#sky()
  }
  indoors(on: boolean): void {
    this.inside = on
    this.#sky()
  }
  grade(night: number): void {
    this.night = night
    this.#sky()
  }
  show(root: THREE.Object3D): void {
    if (this.showing) this.scene.remove(this.showing)
    this.showing = root
    this.scene.add(root)
  }
  start(frame: (seconds: number, stall?: Stall) => boolean | void): void {
    this.frame = frame
  }
  /** No GPU here, so a face comes back as nothing and the panel draws its silhouette. */
  async snapshot(): Promise<string | undefined> {
    return undefined
  }
  draw(): void {}
  dispose(): void {
    this.canvas.remove()
  }

  #sky(): void {
    reflectSky(this.scene, { night: this.night, inside: this.inside, brighter: this.brighter, turned: this.turned })
  }
}
