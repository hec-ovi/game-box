/// <reference lib="dom" />
import type { HudWindowName } from './types.ts'

/** What a key press means to the interface. A window name opens that window. */
export type KeyAction = 'close' | 'send' | 'tab' | 'shift-tab' | HudWindowName

/** The letter that brings up each window. `?`, `/` and F1 all reach the controls. */
const OPENS: Record<string, HudWindowName> = { j: 'quests', m: 'map', i: 'items' }

/**
 * One listener for the whole interface, on the window in the capture phase, so
 * it runs before anything the game has bound anywhere. Two things follow from
 * that: a window can always be closed with a key whatever else is listening,
 * and while the player is writing the game hears nothing at all. Keys the
 * interface does not use pass straight through untouched.
 */
export class Keys {
  #on: Window | Document
  #typing: () => boolean
  #run: (action: KeyAction) => boolean

  constructor(on: Window | Document, typing: () => boolean, run: (action: KeyAction) => boolean) {
    this.#on = on
    this.#typing = typing
    this.#run = run
    this.#on.addEventListener('keydown', this.#handle, true)
  }

  dispose(): void {
    this.#on.removeEventListener('keydown', this.#handle, true)
  }

  #handle = (event: Event): void => {
    const key = event as KeyboardEvent
    if (key.defaultPrevented) return
    const action = this.#action(key)

    // A held key must not flap a window open and shut, but it stays ours.
    const used = action ? (key.repeat ? true : this.#run(action)) : false
    if (used) {
      key.preventDefault()
      key.stopImmediatePropagation()
      return
    }
    // Everything typed into the conversation stops here.
    if (this.#typing()) key.stopImmediatePropagation()
  }

  #action(event: KeyboardEvent): KeyAction | undefined {
    if (this.#typing()) return event.key === 'Escape' ? 'close' : event.key === 'Enter' ? 'send' : undefined
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
