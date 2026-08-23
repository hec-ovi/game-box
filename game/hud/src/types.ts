import type { Objective } from '@gb/quest'

/** What the player would do if they pressed the key, and which key that is. */
export interface Prompt {
  readonly key: string
  readonly text: string
}

/** One thing in the player's hands. `quest` marks it as wanted by a live quest. */
export interface Carried {
  readonly id: string
  readonly name: string
  readonly quest?: boolean
}

/**
 * One line of "these keys do this". The game sends its own so the player can
 * read every control in one place; the interface adds the keys it owns.
 */
export interface ControlHint {
  readonly keys: readonly string[]
  readonly text: string
  /** Heading to file it under: "Move", "World". Ungrouped hints read first. */
  readonly group?: string
}

/**
 * Where a step stands: not reached yet, open now, finished, or on a branch the
 * quest did not take, which a flow running forward can never walk back into.
 */
export type QuestStepState = 'upcoming' | 'open' | 'done' | 'dropped'

/**
 * One step of a quest in the journal. `state` is what the engine says it is;
 * `done` is the short form, where `true` reads as `state: 'done'` and anything
 * else as a step the player can work on now.
 */
export interface QuestStep {
  readonly stepId: string
  readonly text: string
  readonly state?: QuestStepState
  readonly done?: boolean
}

/**
 * One quest as the quests tab lists it: its title and how far each step got. A
 * journal page from the quest engine is one of these as it stands, which is why
 * the title is read under either name.
 */
export interface QuestEntry {
  readonly questId: string
  readonly questTitle?: string
  readonly title?: string
  readonly steps: readonly QuestStep[]
}

/** A rectangle in grid cells, measured from the north-west corner of the city. */
export interface MapRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** One building on the plan. Everything not covered by one is street. */
export interface MapPlot {
  readonly id: string
  readonly rect: MapRect
  /** "The Copper Wheel". Drawn only for the places the player has a reason to see. */
  readonly label?: string
}

/** Something worth pointing at: where the player is, or where they are headed. */
export interface MapMark {
  readonly x: number
  readonly y: number
  readonly label: string
  readonly kind: 'you' | 'goal'
  /** Radians clockwise from north. Only the player mark is drawn facing. */
  readonly facing?: number
}

/** The city from above, in grid cells. The game measures it; the map draws it. */
export interface MapView {
  readonly width: number
  readonly height: number
  readonly plots: readonly MapPlot[]
  readonly marks?: readonly MapMark[]
}

/**
 * One thing the player can do this turn, in words they can click. `key` is the
 * game's own handle for the move and comes straight back on `choose`; `label`
 * is what the button says, and never carries an id.
 */
export interface TalkMove {
  readonly key: string
  readonly label: string
}

/** The conversation as the player sees it. */
export interface TalkState {
  readonly speaker: string
  /** The player's last line, typed or picked, so the exchange reads as one. */
  readonly you: string
  readonly reply: string
  /** What the speaker did this turn: "gave you a job". Empty when they did nothing. */
  readonly acted: string
  /** The moves that are legal this turn. Empty draws no menu at all. */
  readonly moves: readonly TalkMove[]
  /** Between the player answering and the next menu arriving, the menu is quiet. */
  readonly pending: boolean
}

/**
 * A change to the conversation. A `speaker` that differs from the one on screen
 * starts a fresh panel; everything else edits the conversation already open.
 */
export interface TalkPatch {
  readonly speaker?: string
  /** Replace the reply text. */
  readonly reply?: string
  /** Append a piece of the reply as it is spoken. */
  readonly replyChunk?: string
  /** What the speaker did this turn. Replaces the line; `null` takes it away. */
  readonly acted?: string | null
  /** The moves legal right now, in the order they read. Replaces the menu. */
  readonly moves?: readonly TalkMove[]
}

export interface Reward {
  readonly money?: number
  readonly items?: readonly string[]
}

/** Something that happened and has to be announced. The hud writes the words. */
export type Notice =
  | { readonly kind: 'quest-started'; readonly title: string; readonly ms?: number }
  | { readonly kind: 'step-done'; readonly text: string; readonly ms?: number }
  | { readonly kind: 'quest-complete'; readonly title: string; readonly reward?: Reward; readonly ms?: number }
  | { readonly kind: 'quest-failed'; readonly title: string; readonly ms?: number }
  | { readonly kind: 'item-taken'; readonly item: string; readonly ms?: number }
  | { readonly kind: 'money'; readonly delta: number; readonly ms?: number }
  | { readonly kind: 'note'; readonly text: string; readonly ms?: number }

export type NoticeKind = Notice['kind']

/**
 * How loudly an announcement lands. A finished quest is `major`: big, slow to
 * go, impossible to miss. Picking up a bottle is `minor`: small and quiet.
 */
export type NoticeTone = 'major' | 'minor'

/** The four faces of the one window. Only one of them is ever up. */
export type HudWindowName = 'quests' | 'map' | 'items' | 'controls'

/** What the player did in the interface. */
export type HudIntent =
  | { readonly kind: 'say'; readonly text: string }
  | { readonly kind: 'choose'; readonly key: string }
  | { readonly kind: 'talk-closed' }
  | { readonly kind: 'typing'; readonly typing: boolean }
  | { readonly kind: 'window'; readonly window: HudWindowName | null }
  | { readonly kind: 'track'; readonly questId: string | null }
  | { readonly kind: 'abandon'; readonly questId: string }

export interface HudHandlers {
  onIntent(intent: HudIntent): void
}

/**
 * A push of interface state. Fields left out keep the value already on screen;
 * `null` clears the prompt, closes the conversation, shuts the window or stops
 * following a quest.
 */
export interface HudPatch {
  readonly objectives?: readonly Objective[]
  readonly prompt?: Prompt | null
  readonly money?: number
  readonly carrying?: readonly Carried[]
  readonly talk?: TalkPatch | null
  readonly quests?: readonly QuestEntry[]
  readonly trackedQuestId?: string | null
  readonly map?: MapView | null
  readonly controls?: readonly ControlHint[]
  readonly window?: HudWindowName | null
}

/** A notice on screen right now. `leaving` is its last moments as it fades. */
export interface LiveNotice {
  readonly id: number
  readonly notice: Notice
  readonly leaving: boolean
}

/** Everything the surfaces draw from. */
export interface HudState {
  readonly objectives: readonly Objective[]
  readonly prompt: Prompt | undefined
  readonly money: number
  readonly carrying: readonly Carried[]
  readonly talk: TalkState | undefined
  readonly quests: readonly QuestEntry[]
  readonly trackedQuestId: string | undefined
  readonly map: MapView | undefined
  readonly controls: readonly ControlHint[]
  readonly window: HudWindowName | null
  readonly notices: readonly LiveNotice[]
  /** True once the player has held a quest, so an empty panel reads right. */
  readonly hadQuest: boolean
}
