/**
 * The street lamp, in numbers. Every dimension the geometry cuts and every
 * colour the material burns lives here, so re-aiming the lamp is one file and
 * nothing else.
 *
 * The lamp is generated, not modelled: a tapered column, an outreach arm and a
 * flat head, which is what a street light has looked like since the sodium
 * lantern went away. Metres, base on y = 0, column on the origin. The arm
 * reaches +Z, which is the road: `LampSpot.rotationY` turns the lamp so that
 * +Z lands on the kerb it was placed against.
 */

/** Which surface a vertex is on. One material shades all three. */
export const PART = { post: 0, lens: 1, mark: 2 } as const

/**
 * Which fitting a vertex belongs to. `always` is on every lamp in the city; the
 * rest are per-lamp, and a lamp that does not carry one collapses its vertices
 * onto the lamp's own base, so a fitting nobody has costs no fragment.
 */
export const GROUP = { always: 0, head: 1, strip: 2, camera: 3, box: 4 } as const

export type Group = (typeof GROUP)[keyof typeof GROUP]

/** The vertex attributes the lamp rides on, and the per-lamp ones beside them. */
export const LAMP_ATTRIBUTES = {
  /** Per vertex: which surface, one of `PART`. */
  part: 'lampPart',
  /** Per vertex: which fitting, one of `GROUP`. */
  group: 'lampGroup',
  /** Per lamp: `x` the fittings it carries as a bitmask, `y` how cool its light is. */
  variant: 'lampVariant',
  /** Per lamp: where its base stands, which is where an absent fitting collapses to. */
  base: 'lampBase',
} as const

/** The shape of the lamp and the light on it, in metres. */
export const STREETLIGHT = {
  /** The column: a shoe at the pavement, then a taper to the springing point. */
  mast: { height: 6.05, sides: 8, footHeight: 0.3, footRadius: 0.125, baseRadius: 0.085, topRadius: 0.055 },
  /** The arm out over the road, rising as it goes. */
  arm: { reach: 1.55, rise: 0.35, sides: 6, rootRadius: 0.055, tipRadius: 0.036 },
  /** The flat head on the end of it, and the lit panel under it. */
  head: { length: 0.6, width: 0.26, depth: 0.085, past: 0.16, pitch: 0.1, lens: { length: 0.5, width: 0.2, depth: 0.032, drop: 0.014 } },
  /** The other kind: no arm and no head, one lit line up the face of the column. */
  strip: { from: 2.3, to: 5.7, width: 0.055, depth: 0.022, stand: 0.008 },
  /** A camera on a stub bracket, looking down the street. */
  camera: { at: 4.6, out: 0.24, bracket: 0.02, body: [0.17, 0.09, 0.09], pitch: -0.35, eye: 0.045 },
  /** The service box strapped to the shaft, on the side away from the road. */
  box: { at: 1.15, size: [0.2, 0.36, 0.13] },
} as const

/**
 * What the lamp is painted and how hard it burns after dark.
 *
 * The head is authored just under clipping and the app's bloom pass makes the
 * glow, which is how the signage is authored too: a lamp that carries its own
 * halo in its geometry blows out twice over on a wet road, once for itself and
 * once for its reflection.
 */
export const LOOK = {
  /** The mast, the arm, the head shell and the fittings. Pale grey, never lit. */
  post: 0x565d64,
  /** The two ends of the light: cool white, and a colder one with cyan in it. */
  warm: 0xdcefff,
  cool: 0x9fe4ff,
  /** The camera's status light. */
  mark: 0xff5a3c,
  /** How much brighter than its own colour a lit panel burns. Held just under clipping. */
  glow: 2.2,
  /** And the status light, which only has to survive as a dot. */
  markGlow: 1,
  /**
   * What the lamp throws back on its own mast, so the column is a pale grey
   * line after dark rather than a black one. Neutral on purpose: a mast that
   * wears the light's own colour reads as a neon tube.
   */
  spill: 0x9fb0bd,
  spillStrength: 0.16,
  /** Roughness: the panel is glass, the mast is painted metal. */
  lensRoughness: 0.22,
  postRoughness: 0.5,
} as const

/**
 * The wet air round a lit head. It is one additive quad per lamp, sized to the
 * thing that is lit: a small disc under a head, a tall sliver beside a strip.
 * Held low, because the bloom pass is what makes the glow.
 */
export const HALO = { head: [1.15, 0.8], strip: [0.55, 3.6], strength: 0.38 } as const
