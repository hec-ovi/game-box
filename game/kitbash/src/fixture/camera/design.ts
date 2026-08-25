/**
 * The security camera, in numbers: a stub bracket off the wall and a housing
 * on the end of it, pitched down at the doorstep. Metres, origin where the
 * bracket meets the wall, +Z out of the wall.
 */
export const CAMERA = {
  /** The bracket: how far it reaches off the wall, and how thick it is. */
  bracket: { out: 0.16, thick: 0.035 },
  /** The housing on it: across, up and along the way it looks; and the hood round the lens. */
  body: [0.1, 0.1, 0.22],
  hood: [0.075, 0.075, 0.04],
  /** How far the housing looks down, in radians. */
  pitch: 0.45,
  /** Where it hangs on the front: this far over the door head, and this far past the door lamp beside the frame. */
  over: 0.45,
  beside: 0.5,
  /** The patch of wall it claims, so no sign is hung through it. */
  claim: 0.3,
  /** What it is made of, in the kit's own name: dark, and in the shipped pack. */
  material: 'MI_Asphalt',
} as const
