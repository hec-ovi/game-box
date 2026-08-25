import { CLIPS } from './clips.ts'

/** What a clip does with the body as a whole: which is what leaving it means. */
export type Stance = 'standing' | 'seated' | 'lying'

export function stanceOf(clip: string): Stance {
  if (clip === 'Sleep_Loop') return 'lying'
  if (clip.startsWith('Sitting_') || clip === CLIPS.drive) return 'seated'
  return 'standing'
}

/**
 * The seated idle at the same height as this clip: a body on a stool comes to
 * attention on the stool, not 30 cm down in a chair.
 */
export function seatedIdleOf(clip: string): string {
  return clip.includes('Stool') ? 'Sitting_Stool_Loop' : 'Sitting_Idle_Loop'
}

/** The talk gesture for the body a clip holds; a body lying down talks with its head alone. */
export function talkOf(clip: string): string | undefined {
  switch (stanceOf(clip)) {
    case 'standing':
      return CLIPS.talk
    case 'seated':
      return CLIPS.talkSeated
    case 'lying':
      return undefined
  }
}
