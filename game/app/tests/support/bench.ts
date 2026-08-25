import * as THREE from 'three'
import type { Stage } from '../../src/stage.ts'

/**
 * The stage with the GPU taken out: a real camera, a real scene and a real
 * canvas, and nothing drawn. Everything else the game is made of runs without
 * one, so the game built against this is the game the browser builds.
 */
export class Bench implements Stage {
  readonly canvas: HTMLCanvasElement
  readonly camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 500)
  readonly scene = new THREE.Scene()
  showing: THREE.Object3D | undefined
  night = -1
  reflected = 0
  frame: ((seconds: number) => void) | undefined

  constructor(mount: HTMLElement) {
    this.canvas = document.createElement('canvas')
    mount.append(this.canvas)
  }

  plainDaylight(): void {}
  reflect(): void {
    this.reflected += 1
  }
  indoors(): void {}
  grade(night: number): void {
    this.night = night
  }
  show(root: THREE.Object3D): void {
    if (this.showing) this.scene.remove(this.showing)
    this.showing = root
    this.scene.add(root)
  }
  start(frame: (seconds: number) => void): void {
    this.frame = frame
  }
  draw(): void {}
  dispose(): void {
    this.canvas.remove()
  }
}
