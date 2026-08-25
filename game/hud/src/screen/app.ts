/**
 * One thing a screen runs: the password prompt, a page of text, a game. It
 * draws itself as rows of text, takes every key the screen is handed, and
 * says when something on it changed on its own clock.
 */
export interface ScreenApp {
  /** What the body shows now, top to bottom. The screen pads and clips it. */
  rows(): readonly string[]
  /** The status line under the body: the score, or what the keys do. */
  status(): string
  /** A key, as `KeyboardEvent.key` reads it. Escape never arrives: it closes the screen. */
  key(key: string): void
  dispose(): void
}
