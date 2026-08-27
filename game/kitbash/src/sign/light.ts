import { SOLID } from './glyphs.ts'
import { luminanceOf } from './palette.ts'
import { outward, SIGN, type Sign, type SignKind } from './sign.ts'

/**
 * A light for every lit thing on a building, so whoever owns the scene can
 * light the walls from them: neon is the light source in this town, and a sign
 * that lights nothing round it reads as a picture of a sign.
 */
export interface LightEmitter {
  readonly kind: SignKind
  /** In the building's own frame, just off the lit face. */
  readonly position: readonly [number, number, number]
  /** Packed 0xRRGGBB, whatever burns: the tubes, or the box behind them. */
  readonly colour: number
  /** Candela at full dark, the way a physically sized three.js point light takes it. */
  readonly intensity: number
  /** Metres past which it is not worth drawing. */
  readonly radius: number
}

/**
 * Candela a square metre of lit surface throws per unit of the luminance it
 * emits, by what is burning. It is read off the luminance rather than off the
 * multiplier on the vertex, because a saturated hue carries a third of a pale
 * one's light at the same reading: a crimson tube and a cyan one that look
 * equally bright throw equally.
 */
const CANDELA: Record<SignKind, number> = { sign: 30, strip: 30, doorlamp: 180, subway: 30 }

/** How much of a letter's cell is tube. */
const INK_COVER = 0.35

/** Lux under which a light is not worth drawing, and how far one is ever worth drawing, which is the wall a sign may climb. */
const FADE = { lux: 0.1, farthest: SIGN.climb } as const

/** How far off a flat panel its light sits, so it reaches the wall round it. */
const OFF = 0.2

export function lightsOf(signs: readonly Sign[]): LightEmitter[] {
  return signs.map(lightOf)
}

function lightOf(sign: Sign): LightEmitter {
  const [tube, box] = sign.glow
  const tubes = tube >= box
  const burning = tubes ? sign.ink : sign.panel
  const emissive = luminanceOf(burning) * Math.max(tube, box)
  const lit = tubes ? litArea(sign) : sign.width * sign.height
  const intensity = lit * emissive * CANDELA[sign.kind]
  const [nx, nz] = outward(sign.right)
  const off = sign.mount === 'flat' ? OFF : 0
  return {
    kind: sign.kind,
    position: [sign.origin[0] + nx * off, sign.origin[1], sign.origin[2] + nz * off],
    colour: burning,
    intensity,
    radius: Math.min(FADE.farthest, Math.sqrt(intensity / FADE.lux)),
  }
}

/** Square metres of tube on the panel: the fills whole, the letters by how much of their cell is ink. */
function litArea(sign: Sign): number {
  return sign.glyphs.reduce((total, written) => total + written.width * written.height * (written.cell === SOLID ? 1 : INK_COVER), 0)
}
