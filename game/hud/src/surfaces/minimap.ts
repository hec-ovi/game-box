import { el } from '../dom.ts'
import { NearPlan } from '../map/near.ts'
import { MINIMAP } from '../phrase.ts'
import { Reveal } from '../reveal.ts'
import type { HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * The streets round the player in the corner, north up, always on while the
 * game pushes them. It answers "where am I" the way the compass answers
 * "which way": the player's arrow at the centre, the goals they are headed
 * for, and the doorways of the places they have been. It draws what it is
 * handed and takes no clicks, so the scene hears every one of them.
 */
export class MinimapSurface implements Surface {
  readonly node = el('section', 'gb-minimap gb-plate gb-cut-alt gb-edged')
  #plan = new NearPlan()
  #reveal: Reveal

  constructor() {
    this.node.setAttribute('aria-label', MINIMAP.label)
    this.node.append(this.#plan.node, el('span', 'gb-minimap-north gb-t0', MINIMAP.north), el('span', 'gb-ticks'))
    this.#reveal = new Reveal(this.node, { kind: 'corner' })
  }

  render(state: HudState): void {
    const view = state.minimap
    // Off in settings is off on screen, whatever the game keeps pushing.
    const on = state.settings?.minimap !== false
    if (view && on) this.#plan.draw(view)
    else if (this.#reveal.open) this.#plan.clear()
    this.#reveal.set(view !== undefined && on)
  }

  dispose(): void {
    this.#reveal.dispose()
  }
}
