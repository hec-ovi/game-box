import { HUD_HINTS, hintGroups } from '../controls.ts'
import type { ControlHint, HudIntent, HudState } from '../types.ts'
import type { Surface } from './surface.ts'
import { HudWindow } from './window.ts'

/**
 * Every control in one place: what the game says its keys do, then the keys the
 * interface owns. It opens over whatever the player was doing and gives them
 * back to it, so nobody has to leave the street to find out how to walk down it.
 */
export class HelpSurface implements Surface {
  #window: HudWindow
  #key: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#window = new HudWindow({
      className: 'gb-help',
      title: 'Controls',
      onClose: () => emit({ kind: 'help', open: false }),
      onClosed: () => this.#clear(),
    })
  }

  get node(): HTMLElement {
    return this.#window.node
  }

  render(state: HudState): void {
    const hints = [...state.controls, ...HUD_HINTS]
    const key = state.helpOpen ? signature(hints) : this.#key
    if (state.helpOpen && key !== this.#key) {
      this.#key = key
      this.#window.body.replaceChildren(...hintGroups(hints))
    }
    this.#window.set(state.helpOpen)
  }

  trap(back: boolean): boolean {
    return this.#window.trap(back)
  }

  dispose(): void {
    this.#window.dispose()
  }

  #clear(): void {
    this.#key = null
    this.#window.body.replaceChildren()
  }
}

function signature(hints: readonly ControlHint[]): string {
  return hints.map((hint) => `${hint.group ?? ''}:${hint.keys.join('+')}:${hint.text}`).join('|')
}
