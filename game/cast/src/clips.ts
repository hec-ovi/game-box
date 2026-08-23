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
 * Every name here is a clip in the shipped library, and the tests fail if one
 * goes missing, so a renamed clip is caught at build time rather than as a
 * T-posing NPC.
 */
export const CLIPS_FOR_ANCHOR: Record<AnchorKind, readonly [string, ...string[]]> = {
  // loitering: nothing to do and nothing to lean on
  stand: ['Idle_Loop', 'Idle_FoldArms_Loop', 'Idle_TalkingPhone_Loop'],
  sit: ['Sitting_Idle_Loop'],
  'sit-drink': ['Sitting_Idle_Loop'],
  serve: ['Idle_Rail_Loop'],
  cook: ['Idle_Loop'],
  // the two working stances are two bodies: one sits in the chair at the desk,
  // the other stands at the bench with its hands on the top
  'work-desk': ['Sitting_Idle_Loop'],
  'work-bench': ['Idle_Rail_Loop'],
  sleep: ['Sitting_Idle_Loop'],
  browse: ['Idle_Loop', 'Idle_FoldArms_Loop'],
  // propped on a wall: shoulders against it, feet out in front, hands free
  lean: ['Idle_Wall_Loop', 'Idle_WallCross_Loop', 'Idle_WallSmoke_Loop'],
  guard: ['Idle_FoldArms_Loop'],
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
 */
export const GESTURES: readonly string[] = [CLIPS.talk, CLIPS.talkSeated]

/**
 * Every clip name the game will ever ask for. `tools/build-anims.mjs` builds
 * the pack from this list, so a clip that is not named here is not shipped.
 */
export function clipsUsed(): string[] {
  return [...new Set([...Object.values(CLIPS_FOR_ANCHOR).flat(), ...Object.values(CLIPS)])].sort()
}
