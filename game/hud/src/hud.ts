import { el } from './dom.ts'
import { HudError } from './errors.ts'
import { Keys, type KeyAction } from './keys.ts'
import { dwell } from './phrase.ts'
import { HudStore } from './store.ts'
import { installStyle } from './style.ts'
import { BarSurface } from './surfaces/bar.ts'
import { HelpSurface } from './surfaces/help.ts'
import { JournalSurface } from './surfaces/journal.ts'
import { NoticesSurface } from './surfaces/notices.ts'
import { ObjectivesSurface } from './surfaces/objectives.ts'
import { PromptSurface } from './surfaces/prompt.ts'
import { PurseSurface } from './surfaces/purse.ts'
import { ScrimSurface } from './surfaces/scrim.ts'
import type { Surface } from './surfaces/surface.ts'
import { TalkSurface } from './surfaces/talk.ts'
import type { HudHandlers, HudIntent, HudPatch, Notice, NoticeKind } from './types.ts'

const KINDS = new Set<NoticeKind>([
  'quest-started',
  'step-done',
  'quest-complete',
  'quest-failed',
  'item-taken',
  'money',
  'note',
])

/**
 * Everything the player reads over the 3D scene. The game pushes state with
 * `show` and events with `announce`; the hud decides what that looks like, owns
 * how its windows open and close, and reports back what the player did.
 */
export class Hud {
  #root = el('div', 'gb-hud')
  #store: HudStore
  #surfaces: readonly Surface[]
  #talk: TalkSurface
  #journal: JournalSurface
  #help: HelpSurface
  #keys: Keys
  #handlers: HudHandlers
  #typing = false
  #alive = true

  constructor(mount: HTMLElement, handlers: HudHandlers) {
    this.#handlers = handlers
    this.#store = new HudStore(() => this.#render())
    const emit = (intent: HudIntent): void => this.#dispatch(intent)
    this.#talk = new TalkSurface(emit)
    this.#journal = new JournalSurface(emit)
    this.#help = new HelpSurface(emit)
    this.#surfaces = [
      new ObjectivesSurface(),
      new PurseSurface(),
      new PromptSurface(),
      new NoticesSurface(),
      new BarSurface(emit, () => this.#typing),
      this.#talk,
      new ScrimSurface(() => this.#closeTop()),
      this.#journal,
      this.#help,
    ]

    const doc = mount.ownerDocument
    installStyle(doc)
    this.#root.append(el('div', 'gb-crosshair'), ...this.#surfaces.map((surface) => surface.node))
    mount.append(this.#root)
    this.#keys = new Keys(doc.defaultView ?? doc, () => this.#typing, (action) => this.#act(action))
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

  /** True while the player is writing, which is when the game must let its keys go. */
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

  /** A key the interface claims. False hands it back to the game. */
  #act(action: KeyAction): boolean {
    const state = this.#store.state
    switch (action) {
      case 'close':
        return this.#closeTop()
      case 'journal':
        this.#dispatch({ kind: 'journal', open: !state.journalOpen })
        return true
      case 'help':
        this.#dispatch({ kind: 'help', open: !state.helpOpen })
        return true
      case 'send':
        return this.#talk.submit()
      case 'tab':
      case 'shift-tab':
        return this.#help.trap(action === 'shift-tab') || this.#journal.trap(action === 'shift-tab')
    }
  }

  /** Close the window in front of the player, and only that one. */
  #closeTop(): boolean {
    const state = this.#store.state
    if (state.helpOpen) this.#dispatch({ kind: 'help', open: false })
    else if (state.journalOpen) this.#dispatch({ kind: 'journal', open: false })
    else if (state.talk) this.#dispatch({ kind: 'talk-closed' })
    else return false
    return true
  }

  #dispatch(intent: HudIntent): void {
    // The hud owns its own view state: what the player closes here closes here.
    switch (intent.kind) {
      case 'typing':
        if (intent.typing === this.#typing) return
        this.#typing = intent.typing
        break
      case 'talk-closed':
        // The keyboard goes back to the game before the game hears it closed.
        this.#dispatch({ kind: 'typing', typing: false })
        this.#store.apply({ talk: null })
        break
      case 'journal':
        this.#store.apply({ journalOpen: intent.open })
        break
      case 'help':
        this.#store.apply({ helpOpen: intent.open })
        break
      case 'say':
        break
    }
    this.#handlers.onIntent(intent)
  }

  #render(): void {
    const state = this.#store.state
    this.#root.dataset.modal = String(state.journalOpen || state.helpOpen)
    for (const surface of this.#surfaces) surface.render(state)
  }
}
