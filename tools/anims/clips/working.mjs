/**
 * At a shelf, a bench or the floor in front of one.
 *
 * The rail clip's root is the front face of the counter: the hands rest
 * 0.02 to 0.13 m past it on the top and the body stands 0.47 m back from it.
 * Everything here keeps that convention, so a kneeling worker is slid back
 * until the hands meet the counter's face instead of its inside.
 */

/** Chin down on what the hands are doing, or on what is on the shelf. */
const LOOKING_DOWN = { neck_01: { back: -14 }, Head: { back: -10 } }

export const WORKING = [
  {
    name: 'Idle_Browse_Loop',
    from: 'Idle_Relaxed_Loop',
    what: 'on their feet, chin down, looking at what is in front of them',
    turn: LOOKING_DOWN,
  },
  {
    name: 'Idle_Bench_Loop',
    from: 'Idle_Rail_Loop',
    what: 'hands on the top, chin down over the work',
    turn: LOOKING_DOWN,
  },
  {
    name: 'Kneel_Fix_Cut',
    from: 'Fixing_Kneeling',
    what: 'the kneeling three seconds of a clip that stands, kneels and stands again; a step on the way to the loop',
    start: 0.9,
    end: 4.0,
    seam: 0.4,
  },
  {
    name: 'Kneel_Fix_Loop',
    from: 'Kneel_Fix_Cut',
    what: 'kneeling, both hands working at something at knee height in front of them',
    // the source kneels with the right shin flat on the floor, which puts a
    // dressed calf 8 cm under it: the shin is angled up off the knee and the
    // body lifted the little the kneecap needs, the planted left leg reaching
    // back down to the floor. The body is slid back so the hands, which work
    // 0.5 m ahead of its hips, land at the counter's face.
    turn: {
      calf_r: { back: -25 },
      calf_l: { back: 10 },
      foot_l: { back: -10 },
    },
    shift: { root: [0, 0.04, -0.5] },
  },
]
