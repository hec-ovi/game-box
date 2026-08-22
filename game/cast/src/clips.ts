import type { AnchorKind } from '@gb/world'

/**
 * What somebody does while they are standing on an anchor. Every name here is
 * a clip in the shipped library, and the tests fail if one goes missing, so a
 * renamed clip is caught at build time rather than as a T-posing NPC.
 */
export const CLIP_FOR_ANCHOR: Record<AnchorKind, string> = {
  stand: 'Idle_Loop',
  sit: 'Sitting_Idle_Loop',
  'sit-drink': 'Sitting_Idle_Loop',
  serve: 'Idle_Rail_Loop',
  cook: 'Idle_Loop',
  'work-desk': 'Sitting_Idle_Loop',
  sleep: 'Sitting_Idle_Loop',
  browse: 'Idle_Loop',
  lean: 'Idle_Rail_Loop',
  guard: 'Idle_FoldArms_Loop',
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

/** Every clip name the game will ever ask for. */
export function clipsUsed(): string[] {
  return [...new Set([...Object.values(CLIP_FOR_ANCHOR), ...Object.values(CLIPS)])].sort()
}
