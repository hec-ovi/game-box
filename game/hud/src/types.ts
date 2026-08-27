import type { Choice, Objective, QuestKind } from '@gb/quest'

/** What the player would do if they pressed the key, and which key that is. */
export interface Prompt {
  readonly key: string
  readonly text: string
}

/**
 * One thing in the player's hands, or left in a place of theirs. `quest` marks
 * it as wanted by a live quest; `value` is what it is worth, in whole credits.
 */
export interface Carried {
  readonly id: string
  readonly name: string
  readonly quest?: boolean
  readonly value?: number
  /** One line on what it is, as the city wrote it. */
  readonly text?: string
}

/**
 * The thing the player has open in the inventory. The interface asks for one
 * with `inspect` and hands the game a canvas to draw it into; what is in it is
 * the game's, and this only says which thing it is.
 */
export interface Inspecting {
  readonly itemId: string
}

/** A place the player owns, and what they have put in it. */
export interface OwnedPlace {
  readonly id: string
  readonly name: string
  /** One line on what it is: "A flat over Lantern Row." */
  readonly text?: string
  readonly placed: readonly Carried[]
}

/** One thing a seller has on the counter, at the price they ask for it. */
export interface CounterOffer {
  readonly id: string
  readonly name: string
  /** Whole credits. */
  readonly price: number
}

/** A counter the player is standing at: who keeps it and what is on it. */
export interface CounterView {
  readonly seller: string
  readonly offers: readonly CounterOffer[]
}

/** The two games a screen can run. */
export type ScreenGame = 'snake' | 'tetris'

/**
 * What a screen runs once it is open: pages of text the generator wrote, or a
 * game with the best score the playthrough keeps for it.
 */
export type ScreenProgram =
  | { readonly kind: 'text'; readonly title: string; readonly lines: readonly string[] }
  | { readonly kind: ScreenGame; readonly best?: number }

/** A machine the player sits at. Locked, it asks for a password before it runs anything. */
export interface ScreenView {
  readonly machineId: string
  /** What the machine is called: "Front desk terminal". */
  readonly title: string
  readonly locked: boolean
  /** True after the game turned a password down, so the prompt says so. */
  readonly refused?: boolean
  readonly program: ScreenProgram
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

/**
 * Something worth pointing at: where the player is, where a job they are on is
 * sending them, where there is work waiting to be taken, and a place of their
 * own. A `goal` and an `offer` wear the same square in the same colour; the
 * goal wears a ring round it as well, because it is work already on the board.
 */
export interface MapMark {
  readonly x: number
  readonly y: number
  readonly label: string
  readonly kind: 'you' | 'goal' | 'offer' | 'home'
  /** Radians clockwise from north. Only the player mark is drawn facing. */
  readonly facing?: number
  /** On a goal or an offer: the story or an errand, so the two burn in different colours. Left out reads as `side`. */
  readonly line?: QuestKind
}

/**
 * A named part of the city, as a shape rather than a box: the blocks it holds,
 * in grid cells. Their union is the district, so a district can be an L, a Z or
 * anything else the city was cut into, and every plot in the city belongs to
 * exactly one of them.
 */
export interface MapDistrict {
  readonly id: string
  readonly name: string
  /** The rectangles it covers, in cells. Touching rectangles read as one region. */
  readonly rects: readonly MapRect[]
}

/** A rectangle in grid cells. */
export interface MapRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Where fast travel boards: a station on the plan, in cells. */
export interface MapStation {
  readonly id: string
  readonly name: string
  readonly x: number
  readonly y: number
}

/** The city from above, in grid cells. The game measures it; the map draws it. */
export interface MapView {
  readonly width: number
  readonly height: number
  readonly plots: readonly MapPlot[]
  /** The parts of the city, by name. Every plot is inside one; a city not cut into any lists none. */
  readonly districts?: readonly MapDistrict[]
  readonly marks?: readonly MapMark[]
  readonly stations?: readonly MapStation[]
  /** The station the player is standing at, which is when the others can be ridden to. */
  readonly boarding?: string
}

/** A doorway the player has walked through, so a place they know stays findable. */
export interface MinimapDoor {
  readonly id: string
  readonly name: string
  readonly x: number
  readonly y: number
}

/**
 * The streets round the player, north up, in the same cells the map takes. The
 * game windows the city to `radius` and pushes what is inside it; the minimap
 * draws that and nothing else.
 */
export interface MinimapView {
  /** Where the player stands, in cells. */
  readonly x: number
  readonly y: number
  /** Which way they face, radians clockwise from north. */
  readonly facing: number
  /** How many cells either side of the player are on show. */
  readonly radius: number
  /** The buildings inside the radius. */
  readonly plots: readonly MapPlot[]
  /** Where they are headed. A goal outside the radius is pinned to the rim. */
  readonly marks?: readonly MapMark[]
  readonly doors?: readonly MinimapDoor[]
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

/** One thing to learn about a person: `id` is the game's handle (the index in their background, as a string), `text` arrives once it is learned; until then the fact is locked. */
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
  /** Their own face, as an image source. Without one the codex draws a silhouette. */
  readonly portrait?: string
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

/** Where a job's answers come from: a service out on the net, or a server on this machine. */
export type AiFamily = 'external' | 'local'

/** How a provider answered the last time it was asked. */
export type AiHealth = 'unknown' | 'checking' | 'ok' | 'failed'

/** What one real call came back with: the reply and how long it took, or why nothing came. */
export type AiTest = { readonly ms: number; readonly reply: string } | { readonly error: string }

/** One model service the game can put a job on, as the game has it set up. */
export interface AiProvider {
  readonly id: string
  readonly family: AiFamily
  /** What it is called: "OpenRouter", "Local server". */
  readonly label: string
  /** The model it will answer with. */
  readonly model: string
  /** What it offers, when the game could ask it for a list. */
  readonly models?: readonly string[]
  /** Where it is: the base URL, or the host and port. */
  readonly detail: string
  readonly configured: boolean
  /** An external one with no key stored yet. */
  readonly needsKey: boolean
  readonly health: AiHealth
  /** One plain line: why it failed, or what it is waiting on. */
  readonly note?: string
  readonly tested?: AiTest
}

/** The five things a model is asked to write. */
export type AiJobId = 'history' | 'city' | 'places' | 'quests' | 'dialogs'

/** One job, and the provider it is pointed at. */
export interface AiJob {
  readonly id: AiJobId
  /** What the job is, in words: "City history and charters", "Talking in game". */
  readonly label: string
  /** Unset means nothing is assigned and the game falls back on its own. */
  readonly providerId?: string
}

/** Which AI runs which job, and the providers behind them. */
export interface AiView {
  readonly providers: readonly AiProvider[]
  readonly jobs: readonly AiJob[]
}

/** The clock and the sky as the player may set them, and which AI runs which job. */
export interface SettingsView {
  readonly hour: number
  readonly minute: number
  /** True while the clock is held. */
  readonly locked: boolean
  readonly weather: string
  /** Every weather the game can show, in the order it walks them. */
  readonly weathers: readonly string[]
  /** Whether the minimap is on screen. Left out reads as on. */
  readonly minimap?: boolean
  /** Whether the game is full screen. Left out reads as windowed. */
  readonly fullscreen?: boolean
  /** Which AI runs which job. Left out draws none of it. */
  readonly ai?: AiView
}

/**
 * What a "you sure" is asking about. One value per thing that throws work
 * away; leaving the game is the one the interface asks today.
 */
export type ConfirmAsk = 'exit'

/** One named stage of a build: waiting its turn, under way, or finished. */
/** Something being waited for: the word, and what it is called under it. */
export interface LoaderView {
  /** What is being waited for: the city's name, or where a train is going. */
  readonly title: string
  /** A moment rather than a wait, so it is drawn as a veil. */
  readonly veil?: boolean
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
  /** The speaker's own face, as an image the interface can draw. Nothing draws a silhouette instead. */
  readonly portrait?: string
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
  /** The speaker's face, as an image source. Sent with the speaker, or later when it has been drawn. */
  readonly portrait?: string
  /** Replace the whole transcript, as the game keeps it. */
  readonly turns?: readonly TalkTurn[]
  /** Replace what the speaker says this turn. */
  readonly reply?: string
  /** Append a piece of the reply as it is spoken. */
  readonly replyChunk?: string
  /** What the speaker does this turn, apart from the words. `null` takes it away. */
  readonly does?: string | null
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
  /** A part of the city was clicked on the plan: the player is asking to be pointed at it. */
  | { readonly kind: 'district'; readonly districtId: string }
  /** The player opened a thing in the inventory: the game draws it into the canvas the interface holds. */
  | { readonly kind: 'inspect'; readonly itemId: string }
  /** They turned it: where it stands now, in radians, not how far it moved. */
  | { readonly kind: 'turn'; readonly yaw: number; readonly pitch: number }
  | { readonly kind: 'weather'; readonly weather: string }
  /** A provider's model was changed. */
  | { readonly kind: 'ai-model'; readonly providerId: string; readonly model: string }
  /** Its base URL, or its host and port, was changed. */
  | { readonly kind: 'ai-detail'; readonly providerId: string; readonly detail: string }
  /** A key was typed for an external provider. The hud reports it and keeps nothing. */
  | { readonly kind: 'ai-key'; readonly providerId: string; readonly secret: string }
  /** Check whether this provider answers. */
  | { readonly kind: 'ai-health'; readonly providerId: string }
  /** Make one real call through this provider. */
  | { readonly kind: 'ai-test'; readonly providerId: string }
  /** A job was pointed at a provider. */
  | { readonly kind: 'ai-job'; readonly jobId: AiJobId; readonly providerId: string }
  | { readonly kind: 'minimap'; readonly shown: boolean }
  | { readonly kind: 'fullscreen'; readonly on: boolean }
  | { readonly kind: 'exit' }
  | { readonly kind: 'stay' }
  | { readonly kind: 'buy'; readonly itemId: string }
  | { readonly kind: 'counter-closed' }
  | { readonly kind: 'unlock'; readonly machineId: string; readonly password: string }
  | { readonly kind: 'score'; readonly machineId: string; readonly game: ScreenGame; readonly score: number }
  | { readonly kind: 'screen-closed'; readonly machineId: string }
  | { readonly kind: 'travel'; readonly stationId: string }

export interface HudHandlers {
  onIntent(intent: HudIntent): void
}

/**
 * A push of interface state. Fields left out keep the value already on screen;
 * `null` clears the prompt, closes the conversation, the counter or the screen,
 * shuts the window, stops following a quest, takes the survey, the compass or
 * the loader away.
 */
export interface HudPatch {
  readonly objectives?: readonly Objective[]
  readonly prompt?: Prompt | null
  readonly money?: number
  readonly carrying?: readonly Carried[]
  /** The thing open in the inventory, as the game drew it. `null` closes it. */
  readonly inspecting?: Inspecting | null
  readonly homes?: readonly OwnedPlace[]
  readonly counter?: CounterView | null
  readonly screen?: ScreenView | null
  readonly talk?: TalkPatch | null
  readonly quests?: readonly QuestEntry[]
  readonly trackedQuestId?: string | null
  readonly map?: MapView | null
  readonly minimap?: MinimapView | null
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
  readonly inspecting: Inspecting | undefined
  readonly homes: readonly OwnedPlace[]
  readonly counter: CounterView | undefined
  readonly screen: ScreenView | undefined
  readonly talk: TalkState | undefined
  readonly quests: readonly QuestEntry[]
  readonly trackedQuestId: string | undefined
  readonly map: MapView | undefined
  readonly minimap: MinimapView | undefined
  readonly compass: CompassView | undefined
  readonly codex: CodexView
  readonly settings: SettingsView | undefined
  readonly controls: readonly ControlHint[]
  readonly window: HudWindowName | null
  /** The "you sure" in front of the player, put up by the interface itself. */
  readonly confirm: ConfirmAsk | undefined
  readonly loading: LoaderView | undefined
  readonly notices: readonly LiveNotice[]
  /** True once the player has held a quest, so an empty panel reads right. */
  readonly hadQuest: boolean
}
