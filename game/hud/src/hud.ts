import { el } from './dom.ts'
import { HudError } from './errors.ts'
import { HudStore, NOTICE_MS } from './store.ts'
import { installStyle } from './style.ts'
import { JournalSurface } from './surfaces/journal.ts'
import { NoticesSurface } from './surfaces/notices.ts'
import { ObjectivesSurface } from './surfaces/objectives.ts'
import { PromptSurface } from './surfaces/prompt.ts'
import { PurseSurface } from './surfaces/purse.ts'
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
 * `show` and events with `announce`; the hud decides what that looks like and
 * reports back what the player did.
 */
export class Hud {
  #root = el('div', 'gb-hud')
  #store: HudStore
  #surfaces: readonly Surface[]
  #handlers: HudHandlers
  #typing = false
  #alive = true

  constructor(mount: HTMLElement, handlers: HudHandlers) {
    this.#handlers = handlers
    this.#store = new HudStore(() => this.#render())
    const emit = (intent: HudIntent): void => this.#dispatch(intent)
    this.#surfaces = [
      new ObjectivesSurface(),
      new PurseSurface(),
      new PromptSurface(),
      new NoticesSurface(),
      new TalkSurface(emit),
      new JournalSurface(emit),
    ]

    installStyle(mount.ownerDocument)
    this.#root.append(el('div', 'gb-crosshair'), ...this.#surfaces.map((surface) => surface.node))
    mount.append(this.#root)
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
    this.#store.announce(notice, notice.ms ?? NOTICE_MS)
  }

  /** True while the player is writing, which is when the game must let its keys go. */
  get typing(): boolean {
    return this.#typing
  }

  destroy(): void {
    this.#alive = false
    this.#store.dispose()
    this.#root.remove()
  }

  #dispatch(intent: HudIntent): void {
    // The hud owns its own view state: what the player closes here closes here.
    switch (intent.kind) {
      case 'typing':
        this.#typing = intent.typing
        break
      case 'talk-closed':
        this.#store.apply({ talk: null })
        break
      case 'journal':
        this.#store.apply({ journalOpen: intent.open })
        break
      case 'say':
        break
    }
    this.#handlers.onIntent(intent)
  }

  #render(): void {
    const state = this.#store.state
    for (const surface of this.#surfaces) surface.render(state)
  }
}
