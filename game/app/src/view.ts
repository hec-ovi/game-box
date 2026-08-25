/**
 * What the player set about the screen rather than about the city: whether the
 * corner view is drawn, and whether the game fills the screen.
 *
 * Full screen is the browser's to grant and the player's to leave with a key of
 * its own, so what is pushed back is read off the document rather than off the
 * click: the interface's button says what the game is actually doing, and a
 * refused request reads as still windowed.
 */
export class View {
  #changed: () => void
  #minimap = true

  constructor(changed: () => void = () => {}) {
    this.#changed = changed
    document.addEventListener('fullscreenchange', this.#moved)
  }

  dispose(): void {
    document.removeEventListener('fullscreenchange', this.#moved)
  }

  /** The view as the settings tab reads it. */
  get settings(): { minimap: boolean; fullscreen: boolean } {
    return { minimap: this.#minimap, fullscreen: document.fullscreenElement !== null }
  }

  /** Draw the corner view, or take it off the screen. */
  set minimap(shown: boolean) {
    this.#minimap = shown
    this.#changed()
  }

  /** Fill the screen, or come back out of it. A browser that refuses leaves the game as it was. */
  fullscreen(on: boolean): void {
    const asked = on ? document.documentElement.requestFullscreen() : document.exitFullscreen()
    void asked?.catch((cause: unknown) => console.warn(`the browser would not change the screen (${String(cause)})`))
  }

  #moved = (): void => {
    this.#changed()
  }
}
