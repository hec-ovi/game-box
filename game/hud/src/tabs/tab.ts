import type { HudState, HudWindowName } from '../types.ts'

/**
 * One face of the window. It owns a node, is handed the whole state while it is
 * the face on show, and empties itself when the window has finished closing so
 * nothing reads a quest the player cannot see.
 */
export interface Tab {
  readonly name: HudWindowName
  readonly node: HTMLElement
  render(state: HudState): void
  clear(): void
}
