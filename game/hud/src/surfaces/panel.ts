import { ControlsTab } from '../tabs/controls.ts'
import { ItemsTab } from '../tabs/items.ts'
import { MapTab } from '../tabs/map.ts'
import { QuestsTab } from '../tabs/quests.ts'
import type { Tab } from '../tabs/tab.ts'
import type { HudIntent, HudState, HudWindowName } from '../types.ts'
import { tabFor } from '../windows.ts'
import type { Surface } from './surface.ts'
import { TabStrip } from './tabstrip.ts'
import { HudWindow } from './window.ts'

/**
 * The one window, with four faces behind a tab strip. Only one thing is ever
 * open over the street, so there is one scrim, one focus trap and one way out
 * whatever the player is reading.
 */
export class PanelSurface implements Surface {
  #window: HudWindow
  #strip: TabStrip
  #tabs: readonly Tab[]
  #face: HudWindowName | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#strip = new TabStrip((name) => emit({ kind: 'window', window: name }))
    this.#window = new HudWindow({
      lead: this.#strip.node,
      onClose: () => emit({ kind: 'window', window: null }),
      // A window nobody can see holds no text, so nothing reads a quest that is
      // not on screen. It waits for the fade so the last frame still reads.
      onClosed: () => this.#clear(),
    })
    this.#tabs = [new QuestsTab(emit), new MapTab(), new ItemsTab(), new ControlsTab()]
    this.#window.body.setAttribute('role', 'tabpanel')
    this.#window.body.append(...this.#tabs.map((tab) => tab.node))
  }

  get node(): HTMLElement {
    return this.#window.node
  }

  render(state: HudState): void {
    const open = state.window
    // Only the face on show holds anything, so nothing in the body reads a
    // quest the player is not looking at.
    if (open !== this.#face) {
      this.#face = open
      for (const tab of this.#tabs) {
        tab.node.hidden = tab.name !== open
        if (tab.name !== open) tab.clear()
      }
    }
    if (open) {
      this.#strip.select(open)
      this.#window.label(tabFor(open).title)
      this.#tabs.find((tab) => tab.name === open)?.render(state)
    }
    this.#window.set(open !== null)
  }

  trap(back: boolean): boolean {
    return this.#window.trap(back)
  }

  dispose(): void {
    this.#window.dispose()
  }

  #clear(): void {
    this.#face = null
    for (const tab of this.#tabs) tab.clear()
  }
}
