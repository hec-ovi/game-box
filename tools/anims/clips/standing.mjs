/**
 * On their feet, doing nothing in particular.
 *
 * The packs' standing idle is a ready stance: the feet 0.53 m apart with the
 * left 0.39 m ahead, both knees bent 14 to 27 degrees, the elbows bent 30 to
 * 45 with the hands held 0.3 m off the hips, one forward and one back. Nobody
 * waits for a bus like that. The relaxed idles here start from that clip and
 * bring the feet level and the knees straight, then hang the arms; its own
 * breathing and weight shift come through, so the result is still alive.
 *
 * Angles are degrees about the character's own axes: `back` about the
 * left-right axis (the top of the bone goes towards its back, so on the spine
 * it tips the chest back and on a hanging arm it swings the hand forward),
 * `left` about the up axis, `roll` about the forward axis. `shift` is metres
 * in the same frame. See tools/anims/derive.mjs.
 */
import { A_GLASS_IN_THE_LEFT_HAND, LEFT_ARM, RIGHT_ARM, TORSO } from '../blend.mjs'

/** Both feet level under the hips and the knees nearly straight. */
const AT_EASE_LEGS = {
  thigh_l: { back: -14 },
  thigh_r: { back: 13 },
  calf_l: { back: 14 },
  calf_r: { back: 12 },
  foot_l: { back: 0 },
  foot_r: { back: -25 },
}

/** Elbows nearly straight, hands loose by the thighs. */
const HANGING_ARMS = {
  upperarm_l: { roll: 18 },
  upperarm_r: { back: 18, roll: -18 },
  lowerarm_l: { back: -22 },
  lowerarm_r: { back: -32 },
}

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

export const STANDING = [
  {
    name: 'Idle_Relaxed_Loop',
    from: 'Idle_Loop',
    what: 'on their feet, weight on both, arms hanging with the hands loose by the thighs',
    turn: { ...AT_EASE_LEGS, ...HANGING_ARMS },
    // the straightened knees reach 2.6 cm further than the bent ones did
    shift: { root: [0, 0.026, 0] },
  },
  {
    name: 'Idle_Folded_Loop',
    from: 'Idle_FoldArms_Loop',
    what: 'on their feet, weight on both, arms folded',
    turn: AT_EASE_LEGS,
    shift: { root: [0, 0.026, 0] },
  },
  {
    name: 'Idle_Pockets_Loop',
    from: 'Idle_Relaxed_Loop',
    what: 'on their feet, both hands in the trouser pockets',
    turn: {
      upperarm_l: { back: -10, left: 10 },
      lowerarm_l: { back: 40, left: -25 },
      upperarm_r: { back: 5, left: -30 },
      lowerarm_r: { back: 25, left: 40 },
    },
  },
  {
    name: 'Idle_Hip_Loop',
    from: 'Idle_Relaxed_Loop',
    what: 'on their feet, weight on the right hip, the left knee soft',
    // the hips tip and slide over the right leg, the chest tips back to
    // upright, the legs keep their footing and the left knee gives
    turn: {
      pelvis: { roll: 6 },
      spine_01: { roll: -4 },
      spine_02: { roll: -3 },
      thigh_l: { roll: -10 },
      thigh_r: { roll: -10 },
      calf_l: { back: -18 },
      foot_l: { back: 14 },
    },
    shift: { pelvis: [-0.06, 0, 0] },
  },
  {
    name: 'Idle_Phone_Loop',
    from: 'Idle_TalkingPhone_Loop',
    what: 'on their feet, the phone at the ear',
    // the phone clip stands in the ready stance too, and holds the hand
    // 0.21 m off the middle of the head: the arm is brought in to 0.15, which
    // puts the phone in the palm against the ear
    turn: { ...AT_EASE_LEGS, upperarm_r: { left: -10, roll: 50 } },
    shift: { root: [0, 0.026, 0] },
  },
  {
    name: 'Idle_ScratchArm_Loop',
    what: 'the phone arm on the relaxed stance; a step on the way to the scratch',
    base: 'Idle_Relaxed_Loop',
    add: [{ clip: 'Idle_TalkingPhone_Loop', against: 'Idle_Loop', bones: RIGHT_ARM }],
  },
  {
    name: 'Idle_Scratch_Loop',
    from: 'Idle_ScratchArm_Loop',
    what: 'on their feet, one hand scratching the back of the head',
    turn: {
      upperarm_r: { back: 80, left: -20, roll: -20 },
      lowerarm_r: { back: 60, left: -60 },
      Head: { back: 6 },
    },
  },
  {
    name: 'Idle_Yes_Loop',
    what: 'on their feet, nodding',
    // `Yes` nods and throws a hand up with it, and a gesture is added to
    // whatever the arms are already doing, so only the nod is kept
    base: 'Idle_Loop',
    add: [{ clip: 'Yes', bones: TORSO }],
  },
  {
    name: 'Idle_DrinkArm_Loop',
    what: 'the drinking arm on the relaxed stance; a step on the way to the drink',
    base: 'Idle_Relaxed_Loop',
    add: [{ clip: 'Consume', bones: LEFT_ARM }],
    stretch: 2.2,
  },
  {
    name: 'Idle_DrinkReach_Loop',
    from: 'Idle_DrinkArm_Loop',
    what: 'the drinking arm brought in from arm\'s length; a step on the way to the drink',
    // `Consume` raises the hand to head height half a metre in front of the
    // face: the arm is brought in toward the lips
    turn: { upperarm_l: { back: -10, left: -50, roll: -30 }, lowerarm_l: { back: 30, left: -60 } },
    upright: A_GLASS_IN_THE_LEFT_HAND,
  },
  {
    name: 'Idle_Drink_Loop',
    from: 'Idle_DrinkReach_Loop',
    what: 'on their feet, raising a glass to the mouth and putting it down again',
    // settled with the levelled glass: the rim meets the lips at the top of
    // the loop and the glass rests in front of the chest at the bottom, both
    // measured in `tests/props.test.ts`
    turn: { upperarm_l: { back: -20, roll: 20 }, lowerarm_l: { back: 20, left: -30 } },
    upright: A_GLASS_IN_THE_LEFT_HAND,
  },
  {
    name: 'Idle_Wall_Loop',
    from: 'Idle_FoldArms_Loop',
    what: 'shoulders on the wall, arms folded, feet out in front',
    turn: PROPPED,
    shift: SETTLED,
  },
  {
    name: 'Idle_WallPhone_Loop',
    from: 'Idle_Phone_Loop',
    what: 'shoulders on the wall, phone at the ear, feet out in front',
    // the phone clip's legs are already level, so only the tip and the lift
    turn: { root: { back: LEAN }, foot_l: { back: -LEAN }, foot_r: { back: -LEAN }, neck_01: { back: -6 }, Head: { back: -4 } },
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
  {
    name: 'Dance_Slow_Loop',
    from: 'Dance_Loop',
    what: 'the same dance at two thirds of the speed, so a floor is not in step',
    start: 0,
    end: 1,
    seam: 0.1,
    stretch: 1.5,
  },
]
