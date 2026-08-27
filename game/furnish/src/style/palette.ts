import { luminanceOf, type Look } from '../build/look.ts'

/**
 * The two interior languages, as twelve surfaces each.
 *
 * **Corpo** is an open floor: polished concrete, graphite structure, pale
 * laminate tops, a teal panel on the desk pods, and cool white strips read as
 * architecture rather than lamps.
 *
 * **Home** is closer to a ship cabin: moulded plastic in warm off-white and
 * plum, dark chrome frames, and warm red coves under the seating and round the
 * edges of things.
 *
 * Both paint the same twelve roles, so a builder never asks which language it is
 * in: it asks for a shell, a top, an accent, and the palette answers.
 */
export type FurnishStyle = 'corpo' | 'home'

export const FURNISH_STYLES: readonly FurnishStyle[] = ['corpo', 'home']

export interface Palette {
  /** The body of a piece: the carcass, the pedestal, the plinth. */
  readonly shell: Look
  /** The lining a wall is panelled in: lighter than the wall behind it, so the rhythm reads. */
  readonly board: Look
  /** The surface a body meets: a worktop, a desk, a table. */
  readonly top: Look
  /** The one saturated panel a piece is allowed. */
  readonly accent: Look
  /** Legs, rails, handles, the frame under a desk. */
  readonly frame: Look
  /** Upholstery: a seat pad, a back, a mattress. */
  readonly soft: Look
  /** A light strip. Architecture, not a lamp, and the thing that lights the room. */
  readonly glow: Look
  /** A screen: a till display, a television, a lit sign. */
  readonly screen: Look
  /** The glass of a machine somebody works at, lit and idle: what its program is printed over. */
  readonly readout: Look
  /** What a window shows: the city outside, after dark. */
  readonly pane: Look
  readonly foliage: Look
  readonly pot: Look
}

/**
 * How bright a light strip reads: luminance in the renderer's working space,
 * not a multiplier.
 *
 * A multiplier is not a brightness. 0xbdf0ff carries 0.80 of luminance and
 * 0xff6478 carries 0.32, so one strength over both made a corpo cove emit 2.57
 * and a home cove 1.02, one of them over the app's indoor bloom threshold and
 * the other under it, and a home cove read as a painted line rather than as the
 * thing lighting the room. Authored as a luminance, both clear it, and the
 * corpo strength comes out where it was set by hand.
 */
const STRIP = 2.57

/** The strength a lens has to carry to emit that luminance in its own colour. */
function strip(colour: number): number {
  return STRIP / luminanceOf(colour)
}

const SCREEN = 1.6
/** A desktop's glass at rest: lit enough to read as on, dark enough for what is printed on it to show. */
const READOUT = 0.5
/** A window is the city three streets away, not a lamp: bright enough to read, dim enough to sit under. */
const PANE = 0.45

export const PALETTES: Record<FurnishStyle, Palette> = {
  corpo: {
    shell: { colour: 0x2b2f34, roughness: 0.55, metalness: 0.15 },
    board: { colour: 0x6d747b, roughness: 0.45, metalness: 0.2 },
    top: { colour: 0xc7c3b9, roughness: 0.45, metalness: 0 },
    accent: { colour: 0x1f6f7a, roughness: 0.5, metalness: 0.1 },
    frame: { colour: 0x17191c, roughness: 0.35, metalness: 0.8 },
    soft: { colour: 0x2f3338, roughness: 0.95, metalness: 0 },
    glow: { colour: 0x0e1416, glow: 0xbdf0ff, glowStrength: strip(0xbdf0ff), roughness: 0.4, metalness: 0 },
    screen: { colour: 0x0a0d10, glow: 0x63c8ff, glowStrength: SCREEN, roughness: 0.2, metalness: 0 },
    readout: { colour: 0x06101a, glow: 0x1f6b8a, glowStrength: READOUT, roughness: 0.2, metalness: 0 },
    pane: { colour: 0x08111a, glow: 0x2f7fb4, glowStrength: PANE, roughness: 0.08, metalness: 0.1 },
    foliage: { colour: 0x37703f, roughness: 0.9, metalness: 0 },
    pot: { colour: 0x3d4146, roughness: 0.7, metalness: 0 },
  },
  home: {
    shell: { colour: 0xc3b7b4, roughness: 0.3, metalness: 0.05 },
    board: { colour: 0xb0a3a4, roughness: 0.28, metalness: 0.05 },
    top: { colour: 0xd9cfc4, roughness: 0.3, metalness: 0 },
    accent: { colour: 0x8e2338, roughness: 0.4, metalness: 0.05 },
    frame: { colour: 0x2a2528, roughness: 0.25, metalness: 0.85 },
    soft: { colour: 0x5d5563, roughness: 0.9, metalness: 0 },
    glow: { colour: 0x1a1013, glow: 0xff6478, glowStrength: strip(0xff6478), roughness: 0.35, metalness: 0 },
    screen: { colour: 0x0d0a0c, glow: 0xff8ba0, glowStrength: SCREEN, roughness: 0.2, metalness: 0 },
    readout: { colour: 0x140b12, glow: 0x7a3a5a, glowStrength: READOUT, roughness: 0.2, metalness: 0 },
    pane: { colour: 0x100c14, glow: 0x5d84ae, glowStrength: PANE, roughness: 0.08, metalness: 0.1 },
    foliage: { colour: 0x3f7c48, roughness: 0.9, metalness: 0 },
    pot: { colour: 0xa89a94, roughness: 0.4, metalness: 0 },
  },
}
