import { el } from './dom.ts'
import { HudError } from './errors.ts'
import { Keys, type KeyAction } from './keys.ts'
import { dwell } from './phrase.ts'
import { HudStore } from './store.ts'
import { installStyle } from './style/index.ts'
import { BarSurface } from './surfaces/bar.ts'
import { NoticesSurface } from './surfaces/notices.ts'
import { ObjectivesSurface } from './surfaces/objectives.ts'
import { PanelSurface } from './surfaces/panel.ts'
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
 * how its window opens and closes, and reports back what the player did.
 */
export class Hud {
  #root = el('div', 'gb-hud')
  #store: HudStore
  #surfaces: readonly Surface[]
  #talk: TalkSurface
  #panel: PanelSurface
  #keys: Keys
  #handlers: HudHandlers
  #typing = false
  #alive = true

  constructor(mount: HTMLElement, handlers: HudHandlers) {
    this.#handlers = handlers
    this.#store = new HudStore(() => this.#render())
    const emit = (intent: HudIntent): void => this.#dispatch(intent)
    this.#talk = new TalkSurface(emit)
    this.#panel = new PanelSurface(emit)
    this.#surfaces = [
      new ObjectivesSurface(),
      new PurseSurface(),
      new PromptSurface(),
      new NoticesSurface(),
      new BarSurface(emit, () => this.#typing),
      this.#talk,
      new ScrimSurface(() => this.#closeTop()),
      this.#panel,
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
    const open = this.#store.state.window
    switch (action) {
      case 'close':
        return this.#closeTop()
      case 'send':
        return this.#talk.submit()
      case 'tab':
      case 'shift-tab':
        return this.#panel.trap(action === 'shift-tab')
      default:
        // The key of the window already up puts it away; any other switches.
        this.#dispatch({ kind: 'window', window: open === action ? null : action })
        return true
    }
  }

  /** Close the window in front of the player, and only that one. */
  #closeTop(): boolean {
    const state = this.#store.state
    if (state.window) this.#dispatch({ kind: 'window', window: null })
    else if (state.talk) this.#dispatch({ kind: 'talk-closed' })
    else return false
    return true
  }

  #dispatch(intent: HudIntent): void {
    // The hud owns its own view state: what the player opens here opens here.
    switch (intent.kind) {
      case 'typing':
        if (intent.typing === this.#typing) return
        this.#typing = intent.typing
        break
      case 'talk-closed':
        // Closing the panel lets the box go, which reports typing off, so the
        // game has its keys back before it hears the conversation ended.
        this.#store.apply({ talk: null })
        break
      case 'window':
        this.#store.apply({ window: intent.window })
        break
      case 'track':
        this.#store.apply({ trackedQuestId: intent.questId })
        break
      case 'say':
        break
    }
    this.#handlers.onIntent(intent)
  }

  #render(): void {
    const state = this.#store.state
    this.#root.dataset.modal = String(state.window !== null)
    this.#root.dataset.reach = String(state.prompt !== undefined)
    for (const surface of this.#surfaces) surface.render(state)
  }
}
