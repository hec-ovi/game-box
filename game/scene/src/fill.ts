import * as THREE from 'three'
import type { LightEmitter } from './lights/emitter.ts'

/**
 * How much of the light a room throws comes back off its own surfaces.
 *
 * A closed room returns `p / (1 - p)` of its direct light through however many
 * bounces it takes to settle, where `p` is what the surfaces reflect. The
 * interior palettes are dark: measured over both languages' floor, wall and
 * ceiling pools, they reflect 0.074 to 0.27 and mostly sit near 0.09, which
 * puts the indirect share at about a tenth. So this is a bounce and not a fill:
 * it keeps a face turned away from every fixture off pure black and does
 * nothing else.
 */
export const BOUNCE = 0.12

/** How much dimmer a downward face's half of the bounce is: it sees the floor, which is the darker half of a lit room. */
const UNDERSIDE = 0.5

/** Metres between the points the floor is read at. */
const STEP = 0.5

/**
 * The bounce in one room, as one hemisphere light.
 *
 * Its strength is not a constant: it is `BOUNCE` of what the room's own
 * fixtures actually lay on its floor, so a room with one lamp in it bounces
 * like a room with one lamp in it. Retuned whenever what lights the room
 * changes, which is once, when the art hands its fixtures over.
 */
export class RoomBounce {
  readonly light = new THREE.HemisphereLight(0xffffff, 0xffffff, 0)

  constructor() {
    this.light.name = 'bounce'
  }

  /** Tune it to what these fixtures lay on the floor of a room this size. */
  lit(emitters: readonly LightEmitter[], size: { w: number; h: number }): void {
    const colour = colourOf(emitters)
    this.light.color.copy(colour)
    this.light.groundColor.copy(colour).multiplyScalar(UNDERSIDE)
    this.light.intensity = BOUNCE * floorLux(emitters, size)
  }

  dispose(): void {
    this.light.dispose()
  }
}

/**
 * What these fixtures lay on an upward face at floor level, averaged over the
 * whole footprint: the same inverse square with the same cutoff the renderer
 * runs, so the number the bounce is taken off is the light that is really
 * there.
 */
function floorLux(emitters: readonly LightEmitter[], size: { w: number; h: number }): number {
  const across = Math.max(2, Math.round(size.w / STEP))
  const down = Math.max(2, Math.round(size.h / STEP))
  let total = 0

  for (let column = 0; column < across; column++) {
    for (let row = 0; row < down; row++) {
      const x = ((column + 0.5) / across) * size.w
      const z = ((row + 0.5) / down) * size.h
      for (const emitter of emitters) {
        const up = emitter.position[1]
        const away = Math.hypot(emitter.position[0] - x, up, emitter.position[2] - z)
        if (up <= 0 || away >= emitter.radius || away < 1e-4) continue
        // three's own punctual falloff: inverse square, windowed to nothing at the emitter's reach
        const window = Math.max(0, 1 - (away / emitter.radius) ** 4)
        total += (emitter.intensity * (up / away) * window * window) / Math.max(away * away, 0.01)
      }
    }
  }
  return total / (across * down)
}

/** The colour of the light in the room: every fixture's own, weighted by how hard it burns. */
function colourOf(emitters: readonly LightEmitter[]): THREE.Color {
  const mixed = new THREE.Color(0, 0, 0)
  const one = new THREE.Color()
  let candela = 0
  for (const emitter of emitters) {
    mixed.add(one.setHex(emitter.colour).multiplyScalar(emitter.intensity))
    candela += emitter.intensity
  }
  return candela > 0 ? mixed.multiplyScalar(1 / candela) : mixed.setHex(0xffffff)
}
