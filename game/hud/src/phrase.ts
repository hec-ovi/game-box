import type { Disposition, FailReason, Notice, NoticeMood, NoticeTone, QuestStatus, Reward } from './types.ts'

export interface Phrased {
  readonly text: string
  readonly detail: string | undefined
  readonly tone: NoticeTone
  readonly mood: NoticeMood | undefined
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

/** On a quest page that has ended, one way or the other. A live page wears none. */
export const STATUS_TAG: Partial<Record<QuestStatus, string>> = { complete: 'Done', failed: 'Failed' }

/** Why a failed quest failed, in the player's words. */
export const FAIL_REASON: Record<FailReason, string> = {
  'fail-step': 'It went the wrong way',
  'time-limit': 'Ran out of time',
  'npc-lost': 'Somebody it needed is gone',
  'item-lost': 'Something it needed was destroyed',
}

/** Beside the clock on a timed quest. */
export const TIME_LEFT = 'Time left'

/** "1 h 12 min", "36 min", "45 s": a span of game time, the way the clock reads it. */
export function timeSpan(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
  if (minutes > 0) return `${minutes} min`
  return `${whole} s`
}

/** The busy notice: the line, and the words before the countdown. */
export const BUSY = { text: 'The model is busy', retry: 'Trying again in' } as const

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
  const said: Phrased = { text: '', detail: undefined, tone: MAJOR.has(notice.kind) ? 'major' : 'minor', mood: undefined }
  switch (notice.kind) {
    case 'quest-started':
      return { ...said, text: `New quest: ${notice.title}` }
    case 'step-done':
      return { ...said, text: `Done: ${notice.text}` }
    case 'quest-complete':
      return { ...said, text: `Quest complete: ${notice.title}`, detail: reward(notice.reward) }
    case 'quest-failed':
      return { ...said, text: `Quest failed: ${notice.title}` }
    case 'item-taken':
      return { ...said, text: `Picked up ${notice.item}` }
    case 'money':
      return { ...said, text: coin(notice.delta) }
    case 'note':
      return { ...said, text: notice.text }
    case 'model-busy':
      return { ...said, text: BUSY.text, mood: 'wait' }
    case 'error':
      return { ...said, text: notice.text, mood: 'fault' }
  }
}

/**
 * How long it stays when the caller does not say. A wait lasts as long as the
 * wait; something that went wrong stays as long as a finished quest would.
 */
export function dwell(notice: Notice): number {
  if (notice.kind === 'model-busy') return Math.max(DWELL.minor, notice.retryIn * 1000)
  if (notice.kind === 'error') return DWELL.major
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

/** The codex before the player has found anything out. */
export const NO_CODEX = 'Nothing recorded yet. The places you enter and the people you meet are written here.'

/** A background fact the player has not earned. Never blank: a locked line says there is something to learn. */
export const LOCKED_FACT = 'Not learned yet'

/** "2 of 5 known", beside a person's name. */
export function factsKnown(known: number, total: number): string {
  return `${known} of ${total} known`
}

/** How a person stands towards the player, in a word. */
export const DISPOSITION: Record<Disposition, string> = {
  hostile: 'Hostile',
  cool: 'Cool',
  neutral: 'Neutral',
  warm: 'Warm',
  friendly: 'Friendly',
}

/** The compass strip's four points, clockwise from north. */
export const CARDINALS = ['N', 'E', 'S', 'W'] as const

/** "140 m", "1.2 km": how far along the walk. */
export function distanceText(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`
  return `${(metres / 1000).toFixed(1)} km`
}

/** The map's four tools, and the key each answers to while the map has focus. */
export const MAP_TOOLS = { in: 'Zoom in', out: 'Zoom out', fit: 'Fit', you: 'You' } as const
export const MAP_KEYS = { in: '+', out: '-', fit: '0', you: 'Y' } as const

/** The unit money is counted in, wherever a number of it is read. */
export const CREDITS = 'credits'

/** "40 credits": a price or a value beside the thing it belongs to. */
export function priceText(value: number): string {
  return `${value} ${CREDITS}`
}

/** The inventory with nothing in it. */
export const NO_ITEMS = 'Your pockets are empty.'

/** The inventory's second heading, and its two empty lines: no place owned, a place with nothing in it. */
export const HOMES = {
  head: 'Your places',
  none: 'No place of your own yet.',
  empty: 'Nothing placed here yet.',
} as const

/** The counter's words: what the player has to spend, the button, and a counter with nothing on it. */
export const COUNTER = {
  credits: 'Your credits',
  buy: 'Buy',
  short: 'Not enough credits',
  none: 'Nothing for sale today.',
} as const

/** The map's second list: where fast travel boards, and how to use it. */
export const STATIONS = {
  head: 'Stations',
  travel: 'Travel',
  here: 'Here',
  walk: 'Walk up to a station entrance to ride.',
} as const

/** What a screen says: the lock, the reader, and the two games. */
export const SCREEN_WORDS = {
  lock: {
    title: 'LOCKED',
    ask: 'Password',
    wrong: 'Wrong password. Try again.',
    status: 'Type the password, Enter to try',
  },
  read: { status: 'Arrows scroll', end: 'End of file' },
  snake: {
    title: 'SNAKE',
    start: 'Arrows to start',
    over: 'GAME OVER',
    again: 'Enter to play again',
    keys: 'Arrows steer',
  },
  tetris: {
    title: 'TETRIS',
    start: 'Any key to start',
    over: 'GAME OVER',
    again: 'Enter to play again',
    keys: 'Arrows move, Up turns, Space drops',
    next: 'NEXT',
  },
} as const

/** The map with no survey and no step pointing anywhere. */
export const NO_BEARINGS = 'Nothing to head for yet.'

/** The settings tab before the game has pushed the clock and the sky. */
export const NO_SETTINGS = 'The clock and the weather can be set once the city is running.'

/** Codex headings, one per kind of thing found, in reading order. */
export const CODEX_HEADS = { places: 'Places', people: 'People', history: 'History' } as const

/** The settings tab's words. */
export const SETTINGS = {
  time: 'Time',
  lock: 'Lock time',
  locked: 'Time locked',
  skip: 'Skip ahead',
  weather: 'Weather',
  exit: 'Exit game',
} as const

/** "07:30", the way a clock on a wall reads. */
export function clockFace(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function reward(value: Reward | undefined): string | undefined {
  if (!value) return undefined
  const parts: string[] = []
  if (value.money) parts.push(coin(value.money))
  if (value.items?.length) parts.push(value.items.join(', '))
  return parts.length ? parts.join(' · ') : undefined
}

function coin(delta: number): string {
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta)} ${CREDITS}`
}
