/// <reference lib="dom" />
import type { HudWindowName } from './types.ts'

/** What a key press means to the interface. A window name opens that window; `screen` hands the key to the screen. */
export type KeyAction =
  | 'close'
  | 'send'
  | 'tab'
  | 'shift-tab'
  | 'leave'
  | 'fullscreen'
  | 'confirm'
  | 'screen'
  | HudWindowName

/**
 * Who has the keyboard: nobody, the conversation (its box or its moves), a
 * screen, which takes every key but the one that closes it, or a question in
 * front of the player, which takes every key until it is answered.
 */
export type KeyHold = 'free' | 'typing' | 'screen' | 'confirm'

/** The letter that brings up each window. `?`, `/` and F1 all reach the controls. */
const OPENS: Record<string, KeyAction> = {
  j: 'quests',
  m: 'map',
  i: 'inventory',
  x: 'codex',
  o: 'settings',
  n: 'leave',
  f: 'fullscreen',
}

/**
 * One listener for the whole interface, on the window in the capture phase, so
 * it runs before anything the game has bound anywhere. Two things follow from
 * that: a window can always be closed with a key whatever else is listening,
 * and while the player is writing or at a screen the game hears nothing at
 * all. Keys the interface does not use pass straight through untouched.
 */
export class Keys {
  #on: Window | Document
  #hold: () => KeyHold
  #run: (action: KeyAction, event: KeyboardEvent) => boolean

  constructor(on: Window | Document, hold: () => KeyHold, run: (action: KeyAction, event: KeyboardEvent) => boolean) {
    this.#on = on
    this.#hold = hold
    this.#run = run
    this.#on.addEventListener('keydown', this.#handle, true)
  }

  dispose(): void {
    this.#on.removeEventListener('keydown', this.#handle, true)
  }

  #handle = (event: Event): void => {
    const key = event as KeyboardEvent
    if (key.defaultPrevented) return
    const hold = this.#hold()
    const action = this.#action(key, hold)

    // A held key must not flap a window open and shut, but it stays ours; a
    // screen wants the repeats, because a piece is held down.
    const used = action ? (key.repeat && action !== 'screen' ? true : this.#run(action, key)) : false
    if (used) {
      key.preventDefault()
      key.stopImmediatePropagation()
      return
    }
    // Everything typed into the conversation stops here.
    if (hold !== 'free') key.stopImmediatePropagation()
  }

  #action(event: KeyboardEvent, hold: KeyHold): KeyAction | undefined {
    // A question in front of the player is answered before anything else is
    // heard: Enter says yes, Escape says no, Tab walks the two answers, and
    // every other key stops here rather than moving a player who is deciding.
    if (hold === 'confirm') {
      if (event.key === 'Escape') return 'close'
      if (event.key === 'Enter') return 'confirm'
      if (event.key === 'Tab') return event.shiftKey ? 'shift-tab' : 'tab'
      return undefined
    }
    if (hold === 'screen') return event.key === 'Escape' ? 'close' : 'screen'
    if (hold === 'typing') {
      if (event.key === 'Escape') return 'close'
      if (event.key === 'Enter') return 'send'
      if (event.key === 'Tab') return event.shiftKey ? 'shift-tab' : 'tab'
      return undefined
    }
    // Somewhere else on the page is taking words: none of these keys are ours.
    if (editing(event.target)) return undefined
    if (event.key === 'Escape') return 'close'
    if (event.key === 'Tab') return event.shiftKey ? 'shift-tab' : 'tab'
    if (event.ctrlKey || event.metaKey || event.altKey) return undefined
    if (event.key === 'F1' || event.key === '?' || event.key === '/') return 'controls'
    return OPENS[event.key.toLowerCase()]
  }
}

function editing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}
