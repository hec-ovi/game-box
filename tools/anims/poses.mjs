/**
 * Poses authored on top of clips the library already has.
 *
 * A room reads as a place when some of the people in it are propped against a
 * wall doing nothing. No CC0 pack publishes that on this skeleton, so it is
 * written here: a standing idle with the trailing leg brought forward to match
 * the leading one, the whole body tipped back off the two ankles, and the chin
 * brought down off the ceiling. The source clip's own breathing and weight
 * shift come through untouched, which is what keeps the result alive.
 *
 * Angles are degrees about the character's own axes: `back` about the left-right
 * axis (the top of the bone goes towards its back, so on the spine it tips the
 * chest back and on a hanging arm it swings the hand forward), `left` about the
 * up axis, `roll` about the forward axis. `shift` is metres in the same frame.
 * See tools/anims/derive.mjs.
 */

/** How far off vertical a body propped on a wall stands. */
const LEAN = 8

/**
 * `Idle_Loop` and `Idle_FoldArms_Loop` share one stance: the left foot 0.19 m
 * in front of the hips and the right 0.21 m behind them. Swinging the right
 * thigh through twice its own slant puts both feet the same distance forward
 * and, because the two legs are the same length, back at the same height. Both
 * ankles on one line is what lets the whole body tip about them exactly.
 */
const TRAIL = 29.4

/** The drop that puts both soles back on the floor after the tip. */
const SETTLE = -0.018

/** The body tipped back off both ankles with the soles still flat on the floor. */
const PROPPED = {
  root: { back: LEAN },
  thigh_r: { back: TRAIL },
  foot_l: { back: -LEAN },
  foot_r: { back: -(TRAIL + LEAN) },
  neck_01: { back: -6 },
  Head: { back: -4 },
}

const SETTLED = { root: [0, SETTLE, 0] }

/** Chin down on what the hands are doing, or on what is on the shelf. */
const LOOKING_DOWN = { neck_01: { back: -14 }, Head: { back: -10 } }

export const POSES = [
  {
    name: 'Idle_WallPhone_Loop',
    from: 'Idle_TalkingPhone_Loop',
    what: 'shoulders on the wall, phone at the ear, feet out in front',
    // the phone clip stands in the same footprint as Idle_Loop, so the same tip works on it
    turn: PROPPED,
    shift: SETTLED,
  },
  {
    name: 'Idle_Browse_Loop',
    from: 'Idle_Loop',
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
    name: 'Sitting_Desk_Loop',
    from: 'Sitting_Idle_Loop',
    what: 'sat, leaning in, both hands out on the desk',
    // measured: the wrists land 0.78 m up and 0.22 m in front of the root, so
    // the desk edge belongs under them. See CONTRACT.md.
    turn: {
      spine_02: { back: -14 },
      upperarm_l: { back: 68 },
      lowerarm_l: { back: -34 },
      upperarm_r: { back: 68 },
      lowerarm_r: { back: -34 },
    },
  },
  {
    name: 'Idle_Wall_Loop',
    from: 'Idle_FoldArms_Loop',
    what: 'shoulders on the wall, arms folded, feet out in front',
    turn: PROPPED,
    shift: SETTLED,
  },
  {
    name: 'Idle_WallCross_Loop',
    from: 'Idle_Loop',
    what: 'shoulders on the wall, the right ankle crossed over the left, weight on the other leg',
    turn: {
      ...PROPPED,
      // the right ankle hooks behind and outside the left, knee bent, toe on
      // the floor; the arms come forward off the wall the shoulders are on
      thigh_r: { back: TRAIL, roll: -40 },
      calf_r: { back: -30 },
      foot_r: { back: -(TRAIL + LEAN) + 30, roll: -10 },
      upperarm_r: { back: 20 },
      upperarm_l: { back: 8 },
    },
    shift: SETTLED,
  },
  {
    name: 'Idle_WallSmoke_Loop',
    from: 'Idle_Loop',
    what: 'shoulders on the wall, one hand up at the mouth, the other loose at the hip',
    turn: {
      ...PROPPED,
      upperarm_r: { back: 60, left: 8 },
      lowerarm_r: { back: 80, left: 50 },
      hand_r: { back: 15 },
      upperarm_l: { back: 27 },
      lowerarm_l: { back: 20, left: -75 },
    },
    shift: SETTLED,
  },
]
