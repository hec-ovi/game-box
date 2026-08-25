/**
 * Sat down, or lying down.
 *
 * The packs' one seated idle has its soles on the floor, hips 0.542 m up and
 * 0.331 m behind the root. Every seated clip here keeps that root-to-hips
 * offset, so a chair anchor and a stool anchor are placed the same way; the
 * stool clip lifts the whole body onto a taller pad and tucks the feet onto
 * its rail.
 */
import { A_GLASS_IN_THE_LEFT_HAND, LEFT_ARM, TORSO, UPPER } from '../blend.mjs'
import { METRICS } from '../../../game/world/src/metrics.ts'

/** Sat, leaning in, both hands out on the desk. */
const AT_THE_TABLE = {
  spine_02: { back: -14 },
  upperarm_l: { back: 68 },
  lowerarm_l: { back: -34 },
  upperarm_r: { back: 68 },
  lowerarm_r: { back: -34 },
}

/**
 * A body lying down runs along the way it faces, and `LayToIdle` was authored
 * with the hips over the root: the crown ends up 0.89 m behind it and the soles
 * 0.56 m in front. Sliding it forward by half that difference puts the root in
 * the middle of the body, so a sleep anchor is the middle of the mattress
 * rather than a number somebody has to look up.
 */
const CENTRED = 0.165

/**
 * The clip lies the body on the floor of its own file, so the whole thing is
 * lifted onto the bed: the mattress, plus the 9.4 cm the back of the widest
 * coat in the wardrobe reaches behind the spine, so nobody sinks into it.
 * `game/cast/tests/pose.test.ts` measures it on every dressed character.
 */
const ON_THE_MATTRESS = METRICS.furniture.mattressHeight + 0.094

/**
 * From the chair onto the stool: the whole body lifted by the difference in
 * pads (the chair clip's hips sit 2.7 cm into its pad, and a stool's is held
 * to the same give), the shins swung back under the seat and the soles
 * levelled on the rail. The same move serves every seated clip.
 */
const ONTO_THE_STOOL = {
  turn: {
    calf_l: { back: -40 },
    calf_r: { back: -40 },
    foot_l: { back: 38 },
    foot_r: { back: 38 },
  },
  shift: { root: [0, METRICS.furniture.stoolHeight - METRICS.furniture.seatHeight, 0] },
}

/** Breathing, taken off a standing idle, for a body that is doing nothing else. */
const BREATHING = { clip: 'Idle_Loop', bones: TORSO }

export const SEATED = [
  {
    name: 'Sleep_Loop',
    what: 'on their back on the mattress, breathing',
    // the only frame of LayToIdle with the body still on the floor is its first
    base: 'LayToIdle',
    hold: 0,
    add: [BREATHING],
    stretch: 2,
    shift: { root: [0, ON_THE_MATTRESS, CENTRED] },
  },
  {
    name: 'Sitting_Desk_Loop',
    from: 'Sitting_Idle_Loop',
    what: 'sat, leaning in, both hands out on the desk',
    // measured: the wrists land 0.78 m up and 0.22 m in front of the root, so
    // the desk edge belongs under them. See CONTRACT.md.
    turn: AT_THE_TABLE,
  },
  {
    name: 'Sitting_DrinkArm_Loop',
    what: 'the drinking arm on the seated stance; a step on the way to the drink',
    base: 'Sitting_Idle_Loop',
    add: [{ clip: 'Consume', bones: UPPER }],
    stretch: 2.2,
  },
  {
    name: 'Sitting_DrinkReach_Loop',
    from: 'Sitting_DrinkArm_Loop',
    what: 'the drinking arm brought in from arm\'s length; a step on the way to the drink',
    // `Consume` raises the hand to head height half a metre in front of the
    // face: the arm is brought in toward the lips
    turn: { upperarm_l: { left: -20, roll: -40 }, lowerarm_l: { back: -10, left: -50 } },
    upright: A_GLASS_IN_THE_LEFT_HAND,
  },
  {
    name: 'Sitting_Drink_Loop',
    from: 'Sitting_DrinkReach_Loop',
    what: 'sat, raising a glass to the mouth and putting it down again',
    // settled with the levelled glass: the rim meets the lips at the top of
    // the loop and the glass rests over the lap at the bottom, both measured
    // in `tests/props.test.ts`
    turn: { upperarm_l: { back: 10, roll: 20 }, lowerarm_l: { left: -20 } },
    upright: A_GLASS_IN_THE_LEFT_HAND,
  },
  {
    name: 'Sitting_EatArm_Loop',
    what: 'the eating arm on the seated stance; a step on the way to the meal',
    base: 'Sitting_Idle_Loop',
    add: [{ clip: 'Consume', bones: LEFT_ARM }],
    stretch: 2.6,
  },
  {
    name: 'Sitting_EatReach_Loop',
    from: 'Sitting_EatArm_Loop',
    what: 'chin down, one hand on the table, the eating arm brought in from arm\'s length; a step on the way to the meal',
    turn: {
      spine_02: { back: -8 },
      neck_01: { back: -10 },
      Head: { back: -6 },
      upperarm_l: { back: -20, left: -40, roll: -20 },
      lowerarm_l: { back: 20, left: -30 },
      upperarm_r: { back: 62 },
      lowerarm_r: { back: -30 },
    },
  },
  {
    name: 'Sitting_Eat_Loop',
    from: 'Sitting_EatReach_Loop',
    what: 'sat at a table, chin down, one hand on the table and the other bringing food to the mouth',
    // settled: the roll meets the lips at the top of the loop and rests over
    // the lap at the bottom, measured in `tests/props.test.ts`
    turn: { upperarm_l: { back: -10 }, lowerarm_l: { back: 40, left: 10 } },
  },
  {
    name: 'Sitting_PhoneArm_Loop',
    what: 'the phone arm on the seated stance; a step on the way to the call',
    base: 'Sitting_Idle_Loop',
    hold: 0,
    add: [{ clip: 'Idle_Phone_Loop', against: 'Idle_Loop', bones: UPPER }],
  },
  {
    name: 'Sitting_Phone_Loop',
    from: 'Sitting_PhoneArm_Loop',
    what: 'sat, phone at the ear',
    // the seated chest sits differently under the arm than the standing one,
    // which leaves the phone at the jaw, 5 cm off it: brought up to the ear
    turn: { upperarm_r: { back: -20, left: -40, roll: 30 }, lowerarm_r: { left: 10 } },
  },
  {
    name: 'Sitting_Stool_Loop',
    from: 'Sitting_Idle_Loop',
    what: 'sat on a stool, knees up, feet on the rail under the seat',
    ...ONTO_THE_STOOL,
  },
  {
    name: 'Sitting_StoolDrink_Loop',
    from: 'Sitting_Drink_Loop',
    what: 'on a stool, raising a glass to the mouth and putting it down again',
    ...ONTO_THE_STOOL,
  },
  {
    name: 'Sitting_StoolTalk_Loop',
    from: 'Sitting_Talking_Loop',
    what: 'on a stool, talking with the hands',
    ...ONTO_THE_STOOL,
  },
  {
    name: 'Sitting_StoolPhone_Loop',
    from: 'Sitting_Phone_Loop',
    what: 'on a stool, phone at the ear',
    ...ONTO_THE_STOOL,
  },
]
