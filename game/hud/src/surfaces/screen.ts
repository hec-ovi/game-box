import { HUD_KEYS } from '../controls.ts'
import { el, setText } from '../dom.ts'
import { FocusReturn } from '../focus.ts'
import { Reveal } from '../reveal.ts'
import type { ScreenApp } from '../screen/app.ts'
import { LockApp } from '../screen/lock.ts'
import { ReaderApp } from '../screen/reader.ts'
import { body, fit } from '../screen/size.ts'
import { SnakeApp } from '../screen/snake.ts'
import { TetrisApp } from '../screen/tetris.ts'
import type { HudIntent, HudState, ScreenView } from '../types.ts'
import { closeButton } from '../ui/act.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import type { Surface } from './surface.ts'

/**
 * The machine the player sits at: a screen of fixed size in the middle of
 * the view, drawn as text, running one thing at a time. Locked, it asks for
 * the password and hands what is typed to the game; open, it runs what the
 * game pushed: pages of text, or a game that reports its score when it ends.
 * Every key goes to the screen while it is up; Escape and the button close it.
 */
export class ScreenSurface implements Surface {
  readonly node = el('div', 'gb-screen-room')
  #frame = el('section', 'gb-screen gb-cut gb-edged')
  #title = el('h3', 'gb-head-name gb-t5')
  #text = el('pre', 'gb-screen-text')
  #emit: (intent: HudIntent) => void
  #reveal: Reveal
  #focus = new FocusReturn()
  #app: ScreenApp | undefined
  #built: string | null = null
  #view: ScreenView | undefined

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.#frame.setAttribute('role', 'dialog')
    this.#frame.setAttribute('aria-modal', 'true')
    this.#frame.tabIndex = -1
    this.#text.setAttribute('aria-live', 'polite')
    const close = closeButton(HUD_KEYS.close, 'Close screen (Escape)')
    close.addEventListener('click', () => this.#closed())
    const head = el('header', 'gb-head')
    head.append(icon('screen', ICON_PX.button), this.#title, close)
    this.#frame.append(head, this.#text, el('span', 'gb-ticks'))
    this.node.append(this.#frame)
    this.#reveal = new Reveal(this.#frame, { kind: 'fade', onClosed: () => this.#clear() })
  }

  render(state: HudState): void {
    const screen = state.screen
    if (screen) this.#draw(screen)
    if (screen && !this.#reveal.open) this.#start()
    if (!screen && this.#reveal.open) this.#end()
  }

  /** A key while the screen is up. The screen takes every one. */
  key(event: KeyboardEvent): boolean {
    this.#app?.key(event.key)
    return true
  }

  dispose(): void {
    this.#app?.dispose()
    this.#reveal.dispose()
  }

  #draw(screen: ScreenView): void {
    this.#view = screen
    setText(this.#title, screen.title)
    this.#frame.setAttribute('aria-label', screen.title)
    const key = built(screen)
    if (key !== this.#built) {
      this.#built = key
      this.#app?.dispose()
      this.#app = this.#build(screen)
    } else if (this.#app instanceof LockApp) this.#app.refused(screen.refused ?? false)
    else if (this.#app instanceof SnakeApp || this.#app instanceof TetrisApp) {
      this.#app.best(screen.program.kind === 'text' ? undefined : screen.program.best)
    }
    this.#paint()
  }

  #build(screen: ScreenView): ScreenApp {
    const changed = (): void => this.#paint()
    const over = (score: number): void => {
      if (screen.program.kind !== 'text') this.#emit({ kind: 'score', machineId: screen.machineId, game: screen.program.kind, score })
    }
    if (screen.locked) {
      return new LockApp(screen.refused ?? false, {
        changed,
        try: (password) => this.#emit({ kind: 'unlock', machineId: screen.machineId, password }),
      })
    }
    const program = screen.program
    if (program.kind === 'text') return new ReaderApp(program.title, program.lines, { changed })
    if (program.kind === 'snake') return new SnakeApp(program.best, { changed, over })
    return new TetrisApp(program.best, { changed, over })
  }

  #paint(): void {
    const app = this.#app
    if (!app) return
    setText(this.#text, [...body(app.rows()), fit(app.status())].join('\n'))
  }

  #closed(): void {
    if (this.#view) this.#emit({ kind: 'screen-closed', machineId: this.#view.machineId })
  }

  #start(): void {
    this.#focus.remember(this.#frame)
    this.#reveal.set(true)
    this.#frame.focus()
  }

  #end(): void {
    this.#app?.dispose()
    this.#app = undefined
    this.#built = null
    this.#reveal.set(false)
    this.#focus.restore(this.#frame)
  }

  #clear(): void {
    this.#view = undefined
    setText(this.#title, '')
    setText(this.#text, '')
  }
}

/** What an app is built from: a change to any of it is a new app; `best` and `refused` are written into the one running. */
function built(screen: ScreenView): string {
  const program = screen.program
  const text = program.kind === 'text' ? `${program.title}\n${program.lines.join('\n')}` : ''
  return `${screen.machineId}|${screen.locked}|${program.kind}|${text}`
}
