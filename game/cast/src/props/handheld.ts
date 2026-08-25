/**
 * Which clips are posed around something, and what goes in the hand for them.
 *
 * A clip posed to hold a phone with nothing in the hand reads as a broken
 * wrist, so a clip that mimes an object gets the object for as long as it
 * plays. The thing is parented to a bone of that person's own skeleton; the
 * offsets live with each prop and are measured against the rig in
 * `tests/props.test.ts`.
 */
export type PropKind = 'phone' | 'cigarette' | 'glass' | 'food' | 'torch' | 'trolley'

export type Hand = 'hand_l' | 'hand_r'

export interface Held {
  readonly prop: PropKind
  /** The bone it hangs off, or `body` for something pushed along in front with both hands. */
  readonly bone: Hand | 'body'
}

const PHONE: Held = { prop: 'phone', bone: 'hand_r' }
const GLASS: Held = { prop: 'glass', bone: 'hand_l' }

/**
 * The hands a clip has committed to something, whether they hold a thing,
 * push one or are on the head: a gesture layered over the clip leaves those
 * arms where they are, so a phone is not waved about and a scratching hand
 * stays on the scalp.
 */
export function busyHandsOf(clip: string): readonly Hand[] {
  if (clip === 'Idle_Scratch_Loop') return ['hand_r']
  const held = HANDHELD[clip]
  if (!held) return []
  return held.bone === 'body' ? ['hand_l', 'hand_r'] : [held.bone]
}

export const HANDHELD: Readonly<Record<string, Held>> = {
  Idle_Phone_Loop: PHONE,
  Idle_WallPhone_Loop: PHONE,
  Sitting_Phone_Loop: PHONE,
  Sitting_StoolPhone_Loop: PHONE,
  Idle_WallSmoke_Loop: { prop: 'cigarette', bone: 'hand_r' },
  Idle_Drink_Loop: GLASS,
  Sitting_Drink_Loop: GLASS,
  Sitting_StoolDrink_Loop: GLASS,
  Sitting_Eat_Loop: { prop: 'food', bone: 'hand_l' },
  Idle_Torch_Loop: { prop: 'torch', bone: 'hand_l' },
  Push_Loop: { prop: 'trolley', bone: 'body' },
}
