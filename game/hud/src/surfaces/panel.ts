import { el } from '../dom.ts'
import { CodexTab } from '../tabs/codex.ts'
import { ControlsTab } from '../tabs/controls.ts'
import { InventoryTab } from '../tabs/inventory.ts'
import { MapTab } from '../tabs/map.ts'
import { QuestsTab } from '../tabs/quests.ts'
import { SettingsTab } from '../tabs/settings.ts'
import type { Tab } from '../tabs/tab.ts'
import type { HudIntent, HudState, HudWindowName, MapSurface } from '../types.ts'
import { tabAt, tabFor } from '../windows.ts'
import type { Surface } from './surface.ts'
import { TabStrip } from './tabstrip.ts'
import { HudWindow } from './window.ts'

/**
 * The one window, with six faces behind a tab strip. Only one thing is ever
 * open over the street, so there is one scrim, one focus trap and one way out
 * whatever the player is reading, and one frame whatever face is up.
 *
 * Switching face slides the body in from the side the player moved towards.
 * The face they left is gone on the same tick they asked, because nothing on
 * screen waits for a transition to finish.
 */
export class PanelSurface implements Surface {
  #window: HudWindow
  #strip: TabStrip
  #title = el('h2')
  #tabs: readonly Tab[]
  #inventory: InventoryTab
  #map: MapTab
  #face: HudWindowName | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#strip = new TabStrip((name) => emit({ kind: 'window', window: name }))
    this.#window = new HudWindow({
      lead: this.#title,
      strip: this.#strip.node,
      onClose: () => emit({ kind: 'window', window: null }),
      // A window nobody can see holds no text, so nothing reads a quest that is
      // not on screen. It waits for the leave so the last frame still reads.
      onClosed: () => this.#clear(),
    })
    // held by name as well as in the list, because the game draws into the
    // canvas each of these two holds
    this.#inventory = new InventoryTab(emit)
    this.#map = new MapTab(emit)
    this.#tabs = [new QuestsTab(emit), this.#map, this.#inventory, new CodexTab(), new SettingsTab(emit), new ControlsTab()]
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
      if (open && this.#face) this.#slide(open, this.#face)
      this.#face = open
      for (const tab of this.#tabs) {
        tab.node.hidden = tab.name !== open
        if (tab.name !== open) tab.clear()
      }
    }
    if (open) {
      this.#strip.select(open)
      this.#title.textContent = tabFor(open).title
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

  /** The body comes in from the side the player moved towards along the strip. */
  #slide(to: HudWindowName, from: HudWindowName): void {
    const body = this.#window.body
    body.removeAttribute('data-slide')
    void body.offsetWidth
    body.dataset.slide = tabAt(to) > tabAt(from) ? 'next' : 'prev'
  }

  /** Where the game draws the thing the player has open in the inventory. */
  get itemCanvas(): HTMLCanvasElement {
    return this.#inventory.itemCanvas
  }

  /** The glass the game draws the city on, in the map face. */
  get mapSurface(): MapSurface {
    return this.#map.glass
  }

  #clear(): void {
    this.#face = null
    for (const tab of this.#tabs) tab.clear()
  }
}
