import type { Notice, NoticeTone, Reward } from './types.ts'

export interface Phrased {
  readonly text: string
  readonly detail: string | undefined
  readonly tone: NoticeTone
}

/** How long each kind of event stays on screen, in milliseconds. */
const DWELL: Record<NoticeTone, number> = { major: 5200, minor: 2600 }

/** Finishing a quest is not the same event as picking up a bottle. */
const MAJOR = new Set<Notice['kind']>(['quest-started', 'quest-complete', 'quest-failed'])

/** On the quest that carries the story rather than an errand. */
export const MAIN_TAG = 'Main'

/** On a step the quest went past: the road nobody took. */
export const DROPPED_TAG = 'Not taken'

/** On an open decision in the corner panel: the answer is in the journal. */
export const DECIDE_TAG = 'Decide'

/**
 * The foot of the corner panel: what else is running, and whether the story is
 * waiting in it while the player follows an errand.
 */
export function moreQuests(rest: number, mainWaiting: boolean): string | null {
  if (rest === 0) return null
  const many = `${rest} more quest${rest === 1 ? '' : 's'}`
  if (!mainWaiting) return many
  return rest === 1 ? `${many}, the main line` : `${many}, one is the main line`
}

/** Turns an event into the line the player reads. All wording lives here. */
export function phrase(notice: Notice): Phrased {
  const tone = MAJOR.has(notice.kind) ? 'major' : 'minor'
  switch (notice.kind) {
    case 'quest-started':
      return { text: `New quest: ${notice.title}`, detail: undefined, tone }
    case 'step-done':
      return { text: `Done: ${notice.text}`, detail: undefined, tone }
    case 'quest-complete':
      return { text: `Quest complete: ${notice.title}`, detail: reward(notice.reward), tone }
    case 'quest-failed':
      return { text: `Quest failed: ${notice.title}`, detail: undefined, tone }
    case 'item-taken':
      return { text: `Picked up ${notice.item}`, detail: undefined, tone }
    case 'money':
      return { text: coin(notice.delta), detail: undefined, tone }
    case 'note':
      return { text: notice.text, detail: undefined, tone }
  }
}

/** How long it stays when the caller does not say. */
export function dwell(notice: Notice): number {
  return DWELL[MAJOR.has(notice.kind) ? 'major' : 'minor']
}

/**
 * The objectives panel with nothing on it. A player who has never taken work
 * needs to be pointed at somebody; one between jobs already knows how it works.
 */
export function noObjectives(hadQuest: boolean): string {
  return hadQuest ? 'No step open right now. Ask around for the next job.' : 'Nothing yet. Find someone to talk to.'
}

/** The journal with no quest under way, read the same two ways. */
export function noQuests(hadQuest: boolean): string {
  return hadQuest ? 'Nothing under way. Ask around for the next job.' : 'No quests yet. Find someone with work.'
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
