/** What the player has been told of the city: premise lines and announcements, in the order heard. */

/** How many lines are kept; the oldest goes when a new one arrives. */
export const HISTORY_CAP = 60
/** The longest line kept, in characters. */
export const HISTORY_LENGTH = 400

export class Told {
  #lines: string[] = []

  static from(lines: readonly string[] | undefined): Told {
    const told = new Told()
    for (const line of lines ?? []) told.add(line)
    return told
  }

  /** Keep one line, once, trimmed. Blank or over-long lines are ignored. */
  add(text: string): void {
    const line = text.trim()
    if (line.length === 0 || line.length > HISTORY_LENGTH || this.#lines.includes(line)) return
    this.#lines.push(line)
    if (this.#lines.length > HISTORY_CAP) this.#lines.shift()
  }

  list(): readonly string[] {
    return [...this.#lines]
  }

  get any(): boolean {
    return this.#lines.length > 0
  }
}
