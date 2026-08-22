import type { HudState } from '../types.ts'

/**
 * One region of the interface. Every surface owns a node, is handed the whole
 * state on every change, and decides for itself what that means on screen.
 */
export interface Surface {
  readonly node: HTMLElement
  render(state: HudState): void
  /** Drop anything still ticking. Only surfaces that animate need one. */
  dispose?(): void
}
