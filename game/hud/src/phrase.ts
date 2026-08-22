import type { Notice, Reward } from './types.ts'

export interface Phrased {
  readonly text: string
  readonly detail: string | undefined
}

/** Turns an event into the line the player reads. All wording lives here. */
export function phrase(notice: Notice): Phrased {
  switch (notice.kind) {
    case 'quest-started':
      return { text: `New quest: ${notice.title}`, detail: undefined }
    case 'step-done':
      return { text: `Done: ${notice.text}`, detail: undefined }
    case 'quest-complete':
      return { text: `Quest complete: ${notice.title}`, detail: reward(notice.reward) }
    case 'quest-failed':
      return { text: `Quest failed: ${notice.title}`, detail: undefined }
    case 'item-taken':
      return { text: `Picked up ${notice.item}`, detail: undefined }
    case 'money':
      return { text: coin(notice.delta), detail: undefined }
    case 'note':
      return { text: notice.text, detail: undefined }
  }
}

function reward(value: Reward | undefined): string | undefined {
  if (!value) return undefined
  const parts: string[] = []
  if (value.money) parts.push(coin(value.money))
  if (value.items?.length) parts.push(value.items.join(', '))
  return parts.length ? parts.join(' · ') : undefined
}

function coin(delta: number): string {
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta)} coin`
}
