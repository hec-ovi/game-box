import * as THREE from 'three'
import type { Palette } from './palette.ts'

/** The tones a pin is drawn in. They come off the surface the city is drawn on, like everything else. */
export const PIN_TONES = ['--gb-quest-main', '--gb-quest-side', '--gb-ink', '--gb-accent', '--gb-accent-lit', '--gb-accent-dim'] as const

export type PinTone = (typeof PIN_TONES)[number]
export type PinPalette = Palette<PinTone>

/** Something on the city with a name to be read: where it stands, and how high its label floats over it. */
export interface Pin {
  readonly id: string
  /** In metres, on the ground. */
  readonly x: number
  readonly z: number
  /** How far over the ground the label floats: clear of whatever it stands on. */
  readonly top: number
  readonly tone: PinTone
}

/**
 * A stem standing over every thing the map names, so the leader line the
 * interface draws starts on the thing rather than in the air over it. One
 * buffer per tone, rebuilt whenever the survey changes, which is a handful of
 * lines and not a scene.
 */
export class Pins {
  readonly root = new THREE.Group()
  #palette: PinPalette
  #spent: Array<{ dispose(): void }> = []

  constructor(palette: PinPalette) {
    this.#palette = palette
    this.root.name = 'pins'
  }

  set(pins: readonly Pin[]): void {
    this.#clear()
    const byTone = new Map<PinTone, Pin[]>()
    for (const pin of pins) {
      const standing = byTone.get(pin.tone)
      if (standing) standing.push(pin)
      else byTone.set(pin.tone, [pin])
    }
    for (const [tone, group] of byTone) this.root.add(this.#stems(tone, group))
  }

  dispose(): void {
    this.#clear()
  }

  #clear(): void {
    for (const spent of this.#spent) spent.dispose()
    this.#spent = []
    this.root.clear()
  }

  #stems(tone: PinTone, pins: readonly Pin[]): THREE.Object3D {
    const points = new Float32Array(pins.length * 6)
    for (const [index, pin] of pins.entries()) points.set([pin.x, 0, pin.z, pin.x, pin.top, pin.z], index * 6)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3))
    geometry.computeBoundingSphere()
    const material = new THREE.LineBasicMaterial({ color: this.#palette[tone].colour })
    this.#spent.push(geometry, material)
    const mesh = new THREE.LineSegments(geometry, material)
    mesh.frustumCulled = false
    mesh.renderOrder = 3
    return mesh
  }
}
