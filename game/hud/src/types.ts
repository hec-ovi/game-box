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

export interface JournalStep {
  readonly stepId: string
  readonly text: string
  readonly done: boolean
}

export interface JournalQuest {
  readonly questId: string
  readonly title: string
  readonly steps: readonly JournalStep[]
}

/** The conversation as the player sees it. */
export interface TalkState {
  readonly speaker: string
  readonly reply: string
  /** What the speaker just did, oldest first: "gave you a job". */
  readonly acted: readonly string[]
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
  /** Add a line to what the speaker just did. */
  readonly acted?: string
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

/** What the player did in the interface. */
export type HudIntent =
  | { readonly kind: 'say'; readonly text: string }
  | { readonly kind: 'talk-closed' }
  | { readonly kind: 'typing'; readonly typing: boolean }
  | { readonly kind: 'journal'; readonly open: boolean }

export interface HudHandlers {
  onIntent(intent: HudIntent): void
}

/**
 * A push of interface state. Fields left out keep the value already on screen;
 * `null` clears the prompt or closes the conversation.
 */
export interface HudPatch {
  readonly objectives?: readonly Objective[]
  readonly prompt?: Prompt | null
  readonly money?: number
  readonly carrying?: readonly Carried[]
  readonly talk?: TalkPatch | null
  readonly journal?: readonly JournalQuest[]
  readonly journalOpen?: boolean
}

/** A notice that is on screen right now, with the id its timer will drop. */
export interface LiveNotice {
  readonly id: number
  readonly notice: Notice
}

/** Everything the surfaces draw from. */
export interface HudState {
  readonly objectives: readonly Objective[]
  readonly prompt: Prompt | undefined
  readonly money: number
  readonly carrying: readonly Carried[]
  readonly talk: TalkState | undefined
  readonly journal: readonly JournalQuest[]
  readonly journalOpen: boolean
  readonly notices: readonly LiveNotice[]
}
