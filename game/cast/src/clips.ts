import type { AnchorKind } from '@gb/world'
import { hash01 } from './hash.ts'

/**
 * What somebody does while they are standing on an anchor.
 *
 * A kind may offer more than one clip. An anchor names a stance, not a person,
 * and a room where every stance is done exactly one way reads as a diagram of
 * a room: five people standing about all shift their weight on the same frame.
 * So the kind picks the shelf and the person's own id picks off it, which keeps
 * a shared world file looking the same to everyone who opens it.
 *
 * The first clip of a shelf is the plainest reading of that stance, because it
 * is what a caller with nobody in mind gets.
 *
 * Every name here is a clip in the shipped library, and the tests fail if one
 * goes missing, so a renamed clip is caught at build time rather than as a
 * T-posing NPC.
 */
export const CLIPS_FOR_ANCHOR: Record<AnchorKind, readonly [string, ...string[]]> = {
  // loitering: nothing to do and nothing to lean on
  stand: ['Idle_Loop', 'Idle_FoldArms_Loop', 'Idle_TalkingPhone_Loop', 'Idle_Drink_Loop'],
  sit: ['Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Sitting_Phone_Loop'],
  'sit-drink': ['Sitting_Drink_Loop', 'Sitting_Talking_Loop', 'Sitting_Idle_Loop'],
  // hands on the counter, and the same stance calling an order across it
  serve: ['Idle_Rail_Loop', 'Idle_Rail_Call'],
  cook: ['Idle_Bench_Loop', 'Farm_Watering'],
  // the two working stances are two bodies: one sits in the chair at the desk,
  // the other stands at the bench with its hands on the top
  'work-desk': ['Sitting_Desk_Loop', 'Sitting_Phone_Loop', 'Sitting_Idle_Loop'],
  'work-bench': ['Idle_Rail_Loop', 'Idle_Bench_Loop'],
  sleep: ['Sleep_Loop'],
  browse: ['Idle_Browse_Loop', 'Idle_Loop', 'Idle_FoldArms_Loop'],
  // propped on a wall: shoulders against it, feet out in front, hands free
  lean: ['Idle_Wall_Loop', 'Idle_WallCross_Loop', 'Idle_WallSmoke_Loop', 'Idle_WallPhone_Loop'],
  guard: ['Idle_FoldArms_Loop', 'Idle_Loop', 'Idle_TalkingPhone_Loop'],
}

/**
 * Which of a stance's clips this person does. The same id always draws the
 * same one, so a city looks the same every time it is opened; with no id the
 * stance's first clip is the answer, which is what a caller with nobody in
 * mind wants.
 */
export function clipForAnchor(kind: AnchorKind, npcId = ''): string {
  const shelf = CLIPS_FOR_ANCHOR[kind] ?? [CLIPS.idle]
  if (shelf.length === 1 || !npcId) return shelf[0]!
  return shelf[Math.floor(hash01(`${npcId}/${kind}`) * shelf.length)]!
}

/** Clips the game asks for by name outside the anchor table. */
export const CLIPS = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Jog_Fwd_Loop',
  talk: 'Idle_Talking_Loop',
  talkSeated: 'Sitting_Talking_Loop',
  carry: 'Walk_Carry_Loop',
  pickUp: 'PickUp_Table',
  give: 'Interact',
  drive: 'Driving_Loop',
} as const

/**
 * The clips that may be layered over another one. A gesture is added to the
 * pose the base clip holds, so only a clip that stays near its own starting
 * pose can be one: a whole-body action such as a reach or a pick-up adds its
 * full travel on top of whatever the arms are already doing, which folds an
 * elbow through the head. Those are played on the whole body instead.
 *
 * `talk` and `talkSeated` are the same conversation on two bodies; the other
 * two are answers, so anybody in a conversation can agree or refuse without
 * leaving the stance they are in. A drink, a wave and a nod that throws a hand
 * up are all whole-arm movements and are not here: laid over a stance that
 * already has its hands up, they put a forearm through the head, which
 * `tests/pose.test.ts` measures on every clip against every gesture.
 */
export const GESTURES: readonly string[] = [
  CLIPS.talk,
  CLIPS.talkSeated,
  /** a nod */
  'Idle_Yes_Loop',
  /** a slow shake of the head */
  'Idle_No_Loop',
]

/**
 * Every clip name the game will ever ask for. `tools/build-anims.mjs` builds
 * the pack from this list, so a clip that is not named here is not shipped.
 */
export function clipsUsed(): string[] {
  return [
    ...new Set([...Object.values(CLIPS_FOR_ANCHOR).flat(), ...Object.values(CLIPS), ...GESTURES]),
  ].sort()
}
