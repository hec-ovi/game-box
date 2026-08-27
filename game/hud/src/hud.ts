import { el } from './dom.ts'
import { HudError } from './errors.ts'
import { Keys, type KeyAction, type KeyHold } from './keys.ts'
import { dwell } from './phrase.ts'
import { HudStore } from './store.ts'
import { installStyle } from './style/index.ts'
import { BarSurface } from './surfaces/bar.ts'
import { CompassSurface } from './surfaces/compass.ts'
import { ConfirmSurface } from './surfaces/confirm.ts'
import { CounterSurface } from './surfaces/counter.ts'
import { LoaderSurface } from './surfaces/loader.ts'
import { MinimapSurface } from './surfaces/minimap.ts'
import { NoticesSurface } from './surfaces/notices.ts'
import { ObjectivesSurface } from './surfaces/objectives.ts'
import { PanelSurface } from './surfaces/panel.ts'
import { PromptSurface } from './surfaces/prompt.ts'
import { ScreenSurface } from './surfaces/screen.ts'
import { ScrimSurface } from './surfaces/scrim.ts'
import type { Surface } from './surfaces/surface.ts'
import { TalkSurface } from './surfaces/talk.ts'
import type { ConfirmAsk, HudHandlers, HudIntent, HudPatch, Notice, NoticeKind } from './types.ts'

const KINDS = new Set<NoticeKind>([
  'quest-started',
  'step-done',
  'quest-complete',
  'quest-failed',
  'item-taken',
  'money',
  'note',
  'model-busy',
  'error',
])

/**
 * What each question sends out, whichever way it is answered. One entry per
 * `ConfirmAsk`, so a new thing worth asking about is a line here and a line of
 * wording, and nothing else.
 */
const ANSWERS: Record<ConfirmAsk, { readonly yes: HudIntent; readonly no: HudIntent }> = {
  exit: { yes: { kind: 'exit' }, no: { kind: 'stay' } },
}

/**
 * Everything the player reads over the 3D scene. The game pushes state with
 * `show` and events with `announce`; the hud decides what that looks like, owns
 * how its window opens and closes, and reports back what the player did.
 */
export class Hud {
  #root = el('div', 'gb-hud')
  #store: HudStore
  #surfaces: readonly Surface[]
  #talk: TalkSurface
  #counter: CounterSurface
  #panel: PanelSurface
  #screen: ScreenSurface
  #confirm: ConfirmSurface
  #keys: Keys
  #handlers: HudHandlers
  /** Where the game draws a thing the player has opened in the inventory. */
  get itemCanvas(): HTMLCanvasElement {
    return this.#panel.itemCanvas
  }

  /** True while focus is somewhere in the conversation. */
  #talkHeld = false
  /** What was last reported: the conversation or a screen holding the keyboard. */
  #typing = false
  #alive = true

  constructor(mount: HTMLElement, handlers: HudHandlers) {
    this.#handlers = handlers
    this.#store = new HudStore(() => this.#render())
    const emit = (intent: HudIntent): void => this.#dispatch(intent)
    this.#talk = new TalkSurface(emit)
    this.#counter = new CounterSurface(emit)
    this.#panel = new PanelSurface(emit)
    this.#screen = new ScreenSurface(emit)
    this.#confirm = new ConfirmSurface((ask, yes) => this.#answer(ask, yes))
    this.#surfaces = [
      new ObjectivesSurface(),
      new PromptSurface(),
      new MinimapSurface(),
      new CompassSurface(),
      new NoticesSurface(),
      new BarSurface(emit, () => this.#typing),
      this.#talk,
      new ScrimSurface(() => this.#closeTop()),
      this.#counter,
      this.#panel,
      this.#screen,
      this.#confirm,
      new LoaderSurface(),
    ]

    const doc = mount.ownerDocument
    installStyle(doc)
    // the conversation's moves stand at the foot of the screen rather than in
    // the panel, so they are mounted beside it and not inside it
    this.#root.append(...this.#surfaces.map((surface) => surface.node), this.#talk.aside)
    mount.append(this.#root)
    this.#keys = new Keys(
      doc.defaultView ?? doc,
      () => this.#hold(),
      (action, event) => this.#act(action, event),
    )
    this.#render()
  }

  /** Push interface state. Anything left out of the patch stays as it is. */
  show(patch: HudPatch): void {
    if (!this.#alive) throw new HudError('hud-destroyed')
    this.#store.apply(patch)
  }

  /** Announce something that just happened. It clears itself. */
  announce(notice: Notice): void {
    if (!this.#alive) throw new HudError('hud-destroyed')
    if (!KINDS.has(notice.kind)) throw new HudError('unknown-notice', notice.kind)
    if (notice.kind === 'money' && notice.delta === 0) return
    this.#store.announce(notice, notice.ms ?? dwell(notice))
  }

  /** True while the conversation or a screen holds the keyboard, which is when the game must let its keys go. */
  get typing(): boolean {
    return this.#typing
  }

  destroy(): void {
    this.#alive = false
    this.#keys.dispose()
    this.#store.dispose()
    for (const surface of this.#surfaces) surface.dispose?.()
    this.#root.remove()
  }

  /** Who has the keyboard right now. */
  #hold(): KeyHold {
    if (this.#store.state.confirm) return 'confirm'
    if (this.#store.state.screen) return 'screen'
    return this.#talkHeld ? 'typing' : 'free'
  }

  /** A key the interface claims. False hands it back to the game. */
  #act(action: KeyAction, event: KeyboardEvent): boolean {
    const state = this.#store.state
    switch (action) {
      case 'screen':
        return this.#screen.key(event)
      case 'close':
        return this.#closeTop()
      case 'send':
        return this.#talk.submit()
      case 'confirm':
        return this.#confirm.answer(true)
      case 'fullscreen':
        this.#dispatch({ kind: 'fullscreen', on: state.settings?.fullscreen !== true })
        return true
      case 'tab':
      case 'shift-tab': {
        // Whatever is in front takes it: the question, then the window, then
        // the counter, then the conversation, which has a ring of its own as
        // soon as it has moves to step through.
        const back = action === 'shift-tab'
        if (state.confirm) return this.#confirm.trap(back)
        if (state.window) return this.#panel.trap(back)
        if (state.counter) return this.#counter.trap(back)
        return state.talk !== undefined && this.#talk.cycle(back)
      }
      case 'leave':
        this.#dispatch({ kind: 'exit' })
        return true
      default:
        // The key of the window already up puts it away; any other switches.
        this.#dispatch({ kind: 'window', window: state.window === action ? null : action })
        return true
    }
  }

  /** Close what is in front of the player, and only that: the question, the screen, the window, the counter, the conversation. */
  #closeTop(): boolean {
    const state = this.#store.state
    if (state.confirm) return this.#confirm.answer(false)
    if (state.screen) this.#dispatch({ kind: 'screen-closed', machineId: state.screen.machineId })
    else if (state.window) this.#dispatch({ kind: 'window', window: null })
    else if (state.counter) this.#dispatch({ kind: 'counter-closed' })
    else if (state.talk) this.#dispatch({ kind: 'talk-closed' })
    else return false
    return true
  }

  #dispatch(intent: HudIntent): void {
    // The hud owns its own view state: what the player opens here opens here.
    // Everything else, the clock, the sky and the way out included, is the
    // game's to act on, so it goes out as it is.
    switch (intent.kind) {
      case 'typing':
        this.#talkHeld = intent.typing
        this.#syncTyping()
        return
      case 'talk-closed':
        // Closing the panel lets the box go, which reports typing off, so the
        // game has its keys back before it hears the conversation ended.
        this.#store.apply({ talk: null })
        break
      case 'counter-closed':
        this.#store.apply({ counter: null })
        break
      case 'screen-closed':
        this.#store.apply({ screen: null })
        break
      case 'window':
        this.#store.apply({ window: intent.window })
        break
      case 'exit':
        // Every way out lands here: the bar, its key and the settings tab.
        // Leaving throws the walk away, so the interface asks in place and
        // only the answer goes out, from #answer.
        this.#store.ask('exit')
        return
      case 'track':
        this.#store.apply({ trackedQuestId: intent.questId })
        break
      case 'say':
        this.#store.answered(intent.text)
        break
      case 'choose':
        // The player's own line goes up whichever way they gave it, so a picked
        // move reads as something they said rather than a silent state change.
        this.#store.answered(this.#label(intent.key))
        break
    }
    this.#handlers.onIntent(intent)
  }

  /**
   * The player answered the question in front of them. It goes straight out
   * rather than through `#dispatch`, because `exit` on the way in is a request
   * to ask and on the way out is the answer.
   */
  #answer(ask: ConfirmAsk, yes: boolean): void {
    this.#store.ask(null)
    this.#handlers.onIntent(yes ? ANSWERS[ask].yes : ANSWERS[ask].no)
  }

  /** What the button said, so the transcript carries the player's own words. */
  #label(key: string): string {
    return this.#store.state.talk?.moves.find((move) => move.key === key)?.label ?? ''
  }

  /** Reported on change only: the conversation with focus, or a screen up, holds the keyboard. */
  #syncTyping(): void {
    const typing = this.#talkHeld || this.#store.state.screen !== undefined
    if (typing === this.#typing) return
    this.#typing = typing
    this.#handlers.onIntent({ kind: 'typing', typing })
  }

  #render(): void {
    const state = this.#store.state
    this.#root.dataset.modal = String(
      state.window !== null || state.counter !== undefined || state.screen !== undefined || state.confirm !== undefined,
    )
    this.#root.dataset.talk = String(state.talk !== undefined)
    for (const surface of this.#surfaces) surface.render(state)
    this.#syncTyping()
  }
}
