/**
 * How big every piece of street detail is in the real world, in metres.
 *
 * Detail is sized in metres, never in repeats, so a one cell alley and a
 * hundred metre avenue wear the same asphalt and nothing stretches. The
 * reference is what is already on the street at a known size: a 10 m roadway
 * kerb to kerb, a 4 m pavement, and the 0.12 m painted line `MARKING` lays.
 */
export const SURFACE = {
  /** Asphalt chippings. A 0.55 m tile of the fine channel puts a stone at two or three centimetres. */
  aggregate: 0.55,
  /** Staining, tyre dirt and the mottling that stops a road reading as a flat plane. */
  stain: 6,
  /** Standing water: a pool is a few metres across. */
  pool: 12,
  /** A stretch that has been dug up and filled in. */
  repair: 24,
  /** A paving slab, and the joint between two of them. */
  flag: 0.5,
  joint: 0.014,
  /** A kerb stone, seen on the face of the kerb. */
  kerbStone: 1,
  /** How far a wheel track runs in from the kerb, and how wide the polished band is. */
  trackInset: 1.8,
  /* A car in the kerb lane sits 1.75 to 2.5 m off the kerb whatever class the road is, so one number serves them all. */
  trackWidth: 0.85,
  /** How far the gutter's dirt reaches in from the edge of the paved surface. */
  gutterReach: 2.2,
  /** How far the wet film stands above the surface it covers: a centimetre clear of the paint. */
  lift: 0.02,
} as const
