import { CodexTab } from '../tabs/codex.ts'
import { ControlsTab } from '../tabs/controls.ts'
import { InventoryTab } from '../tabs/inventory.ts'
import { MapTab } from '../tabs/map.ts'
import { QuestsTab } from '../tabs/quests.ts'
import { SettingsTab } from '../tabs/settings.ts'
import type { Tab } from '../tabs/tab.ts'
import type { HudIntent, HudState, HudWindowName } from '../types.ts'
import { tabFor } from '../windows.ts'
import type { Surface } from './surface.ts'
import { TabStrip } from './tabstrip.ts'
import { HudWindow } from './window.ts'

/**
 * The one window, with six faces behind a tab strip. Only one thing is ever
 * open over the street, so there is one scrim, one focus trap and one way out
 * whatever the player is reading, and one frame whatever face is up.
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
    this.#tabs = [
      new QuestsTab(emit),
      new MapTab(emit),
      new InventoryTab(),
      new CodexTab(),
      new SettingsTab(emit),
      new ControlsTab(),
    ]
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
      this.#window.body.dataset.face = open
      this.#tabs.find((tab) => tab.name === open)?.render(state)
    }
    this.#window.set(open !== null)
  }

  trap(back: boolean): boolean {
    return this.#window.trap(back)
  }

  dispose(): void {
    for (const tab of this.#tabs) tab.dispose?.()
    this.#window.dispose()
  }

  #clear(): void {
    this.#face = null
    for (const tab of this.#tabs) tab.clear()
  }
}
