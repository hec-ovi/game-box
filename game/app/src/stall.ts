/**
 * Where a slow frame went, said out loud only when a frame was slow enough for
 * the player to feel it.
 *
 * A stall of a second is never in the numbers a bench takes, because it is not
 * arithmetic: it is a pipeline compiled the first time a material is drawn, a
 * texture uploaded, or a room built on the frame the player walked at its door.
 * All of those happen inside one of the segments below, so the segment names
 * which layer to instrument next instead of leaving it to a guess.
 *
 * It costs two clock reads a segment and says nothing at all on a frame that
 * was fine, so it stays on in the running game: a stall nobody can reproduce on
 * demand has to be caught where it happens.
 */

/** Over this many milliseconds, a frame is a stutter the player saw. Two frames at 60hz is 33 ms; this is well past an argument. */
const SLOW_MS = 120

/** No more than one line every this many milliseconds, so a bad stretch cannot flood the console. */
const QUIET_MS = 2_000

export interface StallOptions {
  /** How slow a frame has to be before it is worth a line. */
  readonly over?: number
  /** Where the line goes. The console, unless a test wants to read it. */
  readonly say?: (line: string) => void
  /** The clock. `performance.now` unless a test wants to drive it. */
  readonly now?: () => number
}

export class Stall {
  #over: number
  #say: (line: string) => void
  #now: () => number
  #began = 0
  #last = 0
  #said = Number.NEGATIVE_INFINITY
  #segments: { name: string; ms: number }[] = []

  constructor(options: StallOptions = {}) {
    this.#over = options.over ?? SLOW_MS
    this.#say = options.say ?? ((line) => console.warn(line))
    this.#now = options.now ?? (() => performance.now())
  }

  /** A frame starts. Whatever the last one recorded is thrown away. */
  begin(): void {
    this.#segments = []
    this.#began = this.#now()
    this.#last = this.#began
  }

  /** Everything since the last mark was this. */
  at(name: string): void {
    const now = this.#now()
    this.#segments.push({ name, ms: now - this.#last })
    this.#last = now
  }

  /**
   * The frame is over. If it was slow, say where it went, worst segment first,
   * and only the segments that were worth a millisecond: a line naming eleven
   * segments of nothing hides the one that cost a second.
   */
  end(): void {
    this.at('draw')
    const total = this.#last - this.#began
    if (total < this.#over) return
    if (this.#last - this.#said < QUIET_MS) return
    this.#said = this.#last
    const worst = this.#segments
      .filter((segment) => segment.ms >= 1)
      .sort((one, other) => other.ms - one.ms)
      .map((segment) => `${segment.name} ${Math.round(segment.ms)}`)
      .join(', ')
    this.#say(`slow frame ${Math.round(total)} ms: ${worst}`)
  }
}
