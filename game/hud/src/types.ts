import type { Choice, Objective, QuestKind } from '@gb/quest'

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
  /** `@gb/quest`'s question and its roads, on a step that asks one. */
  readonly choice?: Choice
}

/** How a quest stands as a whole, the same four `@gb/quest` keeps. */
export type QuestStatus = 'unstarted' | 'active' | 'complete' | 'failed'

/**
 * A quest on a clock, in game seconds, as `@gb/quest` publishes it. It moves
 * with the game clock and nowhere else, so every push of the journal sets it.
 */
export interface QuestTimer {
  readonly remaining: number
  readonly total: number
}

/** Why a quest failed, the four ways `@gb/quest` keeps. */
export type FailReason = 'fail-step' | 'time-limit' | 'npc-lost' | 'item-lost'

/**
 * One quest as the quests tab lists it: its title and how far each step got. A
 * journal page from the quest engine is one of these as it stands, which is why
 * the title is read under either name.
 */
export interface QuestEntry {
  readonly questId: string
  readonly questTitle?: string
  readonly title?: string
  /** The story or an errand, as the quest document wrote it. */
  readonly kind?: QuestKind
  /** Left out reads as `active`. */
  readonly status?: QuestStatus
  /** Why it ended badly. Drawn on a failed page, in words. */
  readonly failReason?: FailReason
  readonly timer?: QuestTimer
  readonly steps: readonly QuestStep[]
}

/** A rectangle in grid cells, measured from the north-west corner of the city. */
export interface MapRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** How much a building stands out on the plan. Left out reads as `background`. */
export type MapProminence = 'background' | 'notable' | 'landmark'

/** One building on the plan. Everything not covered by one is street. */
export interface MapPlot {
  readonly id: string
  readonly rect: MapRect
  /** "The Copper Wheel". Read on hover; written on the plan once `named` says so. */
  readonly label?: string
  /** Write the label on the plan: a place entered, a quest target, a landmark. */
  readonly named?: boolean
  readonly prominence?: MapProminence
}

/** Something worth pointing at: where the player is, or where they are headed. */
export interface MapMark {
  readonly x: number
  readonly y: number
  readonly label: string
  readonly kind: 'you' | 'goal'
  /** Radians clockwise from north. Only the player mark is drawn facing. */
  readonly facing?: number
  /** On a goal: the story or an errand, so the two wear different marks. Left out reads as `side`. */
  readonly line?: QuestKind
}

/** The city from above, in grid cells. The game measures it; the map draws it. */
export interface MapView {
  readonly width: number
  readonly height: number
  readonly plots: readonly MapPlot[]
  readonly marks?: readonly MapMark[]
}

/** The place the strip points at: where it is from here, and how far along the walk. */
export interface CompassGoal {
  readonly label: string
  /** Radians clockwise from north, the way the player must set off. */
  readonly bearing: number
  /** Metres along the route. */
  readonly distance: number
  /** Left out reads as `side`. */
  readonly line?: QuestKind
}

/** What the strip along the top draws: which way the player faces, and the tracked goal. */
export interface CompassView {
  /** Radians clockwise from north. */
  readonly facing: number
  readonly goal?: CompassGoal
}

/** How one person stands towards the player, the five steps `@gb/play` keeps. */
export type Disposition = 'hostile' | 'cool' | 'neutral' | 'warm' | 'friendly'

/** A place the player has walked into. */
export interface CodexPlace {
  readonly id: string
  readonly name: string
  /** One line on what it is: "A bar on Lantern Row." */
  readonly text?: string
}

/** One thing to learn about a person. `text` arrives once it is learned; until then the fact is locked. */
export interface CodexFact {
  readonly id: string
  readonly text?: string
}

/** Somebody the player has met, and what they have learned of them so far. */
export interface CodexPerson {
  readonly id: string
  readonly name: string
  /** What they do: "Keeps the bar at The Copper Wheel." */
  readonly role?: string
  readonly disposition: Disposition
  readonly facts: readonly CodexFact[]
}

/** Something the player has been told of the city. */
export interface CodexNote {
  readonly id: string
  readonly title: string
  readonly text: string
}

/** What the player has found out so far. The game keeps the record; the tab reads it. */
export interface CodexView {
  readonly places: readonly CodexPlace[]
  readonly people: readonly CodexPerson[]
  readonly history?: readonly CodexNote[]
}

/** The clock and the sky as the player may set them. */
export interface SettingsView {
  readonly hour: number
  readonly minute: number
  /** True while the clock is held. */
  readonly locked: boolean
  readonly weather: string
  /** Every weather the game can show, in the order it walks them. */
  readonly weathers: readonly string[]
}

/** One named stage of a build: waiting its turn, under way, or finished. */
export interface LoadStage {
  readonly id: string
  readonly label: string
  readonly state: 'waiting' | 'running' | 'done'
  /** How far the running stage has got, where the stage can count. */
  readonly done?: number
  readonly total?: number
}

/** A city being generated: what it is called and how far each stage has got. */
export interface LoaderView {
  readonly title: string
  readonly stages: readonly LoadStage[]
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

/**
 * One turn of the conversation. The player's turns are what they said or
 * picked; the speaker's carry what they said and, when the turn had one, what
 * they did, which is drawn apart from the words.
 */
export interface TalkTurn {
  readonly who: 'you' | 'them'
  readonly says: string
  readonly does?: string
}

/** The conversation as the player sees it. */
export interface TalkState {
  readonly speaker: string
  /** Every turn so far, oldest first. The last one is the turn in front of the player. */
  readonly turns: readonly TalkTurn[]
  /** The moves that are legal this turn. Empty draws no menu at all. */
  readonly moves: readonly TalkMove[]
  /** Between the player answering and the next menu arriving, the menu is quiet. */
  readonly pending: boolean
}

/**
 * A change to the conversation. A `speaker` that differs from the one on screen
 * starts a fresh panel; everything else edits the conversation already open.
 * `reply`, `replyChunk` and `does` edit the speaker's current turn, opening one
 * when the last turn on the transcript is the player's.
 */
export interface TalkPatch {
  readonly speaker?: string
  /** Replace the whole transcript, as the game keeps it. */
  readonly turns?: readonly TalkTurn[]
  /** Replace what the speaker says this turn. */
  readonly reply?: string
  /** Append a piece of the reply as it is spoken. */
  readonly replyChunk?: string
  /** What the speaker does this turn, apart from the words. `null` takes it away. */
  readonly does?: string | null
  /** The older name for `does`; read the same way. */
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
  | { readonly kind: 'model-busy'; readonly retryIn: number; readonly ms?: number }
  | { readonly kind: 'error'; readonly text: string; readonly ms?: number }

export type NoticeKind = Notice['kind']

/**
 * How loudly an announcement lands. A finished quest is `major`: big, slow to
 * go, impossible to miss. Picking up a bottle is `minor`: small and quiet.
 */
export type NoticeTone = 'major' | 'minor'

/**
 * What a notice is about, beyond how loud it is: something being waited for,
 * or something that went wrong. Everything else has no mood.
 */
export type NoticeMood = 'wait' | 'fault'

/** The six faces of the one window. Only one of them is ever up. */
export type HudWindowName = 'quests' | 'map' | 'inventory' | 'codex' | 'settings' | 'controls'

/** What the player did in the interface. */
export type HudIntent =
  | { readonly kind: 'say'; readonly text: string }
  | { readonly kind: 'choose'; readonly key: string }
  | { readonly kind: 'talk-closed' }
  | { readonly kind: 'typing'; readonly typing: boolean }
  | { readonly kind: 'window'; readonly window: HudWindowName | null }
  | { readonly kind: 'track'; readonly questId: string | null }
  | { readonly kind: 'abandon'; readonly questId: string }
  | { readonly kind: 'decide'; readonly questId: string; readonly stepId: string; readonly optionId: string }
  | { readonly kind: 'lock-time'; readonly locked: boolean }
  | { readonly kind: 'skip-time' }
  | { readonly kind: 'weather'; readonly weather: string }
  | { readonly kind: 'exit' }

export interface HudHandlers {
  onIntent(intent: HudIntent): void
}

/**
 * A push of interface state. Fields left out keep the value already on screen;
 * `null` clears the prompt, closes the conversation, shuts the window, stops
 * following a quest, takes the survey, the compass or the loader away.
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
  readonly compass?: CompassView | null
  readonly codex?: CodexView
  readonly settings?: SettingsView
  readonly controls?: readonly ControlHint[]
  readonly window?: HudWindowName | null
  readonly loading?: LoaderView | null
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
  readonly compass: CompassView | undefined
  readonly codex: CodexView
  readonly settings: SettingsView | undefined
  readonly controls: readonly ControlHint[]
  readonly window: HudWindowName | null
  readonly loading: LoaderView | undefined
  readonly notices: readonly LiveNotice[]
  /** True once the player has held a quest, so an empty panel reads right. */
  readonly hadQuest: boolean
}
