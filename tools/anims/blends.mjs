/**
 * Clips made by laying one clip's movement over another clip's stance.
 *
 * The free packs hold 84 clips and none of them is a person asleep in a bed, a
 * drinker at a bar or a clerk at a desk: they hold a body getting up off the
 * floor, a body drinking on its feet, and a body with its hands on a rail.
 * Each of those is the right movement on the wrong body, so the movement is
 * taken off it and put on a body that is sitting or lying down. See
 * tools/anims/blend.mjs for what the sum is.
 *
 * `base` holds the body, `hold` freezes it at that moment of the clip, `add`
 * is what is laid over it, `against` is the pose that movement is measured
 * from, `stretch` slows the whole thing down and `shift` moves the root in
 * metres of the character's own frame.
 */
import { TORSO, UPPER } from './blend.mjs'
import { METRICS } from '../../game/world/src/metrics.ts'

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
 * `game/cast/tests/pose.test.ts` measures it on all twelve dressed characters.
 */
const ON_THE_MATTRESS = METRICS.furniture.mattressHeight + 0.094

/** Breathing, taken off a standing idle, for a body that is doing nothing else. */
const BREATHING = { clip: 'Idle_Loop', bones: TORSO }

export const BLENDS = [
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
    name: 'Sitting_Drink_Loop',
    what: 'sat, raising a glass to the mouth and putting it down again',
    base: 'Sitting_Idle_Loop',
    hold: 0,
    add: [{ clip: 'Consume', bones: UPPER }],
    stretch: 2.2,
  },
  {
    name: 'Sitting_Phone_Loop',
    what: 'sat, phone at the ear',
    base: 'Sitting_Idle_Loop',
    hold: 0,
    add: [{ clip: 'Idle_TalkingPhone_Loop', against: 'Idle_Loop', bones: UPPER }],
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
    name: 'Idle_Drink_Loop',
    what: 'on their feet, raising a glass to the mouth and putting it down again',
    base: 'Idle_Loop',
    hold: 0,
    add: [{ clip: 'Consume', bones: UPPER }],
    stretch: 2.2,
  },
]
