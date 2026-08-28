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

/** How many bad frames are kept for the owner to read back on demand. */
const KEPT = 10

/** A frame slow enough to keep, and where its time went. */
export interface SlowFrame {
  readonly ms: number
  readonly segments: readonly { readonly name: string; readonly ms: number }[]
}

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
  #worst: SlowFrame[] = []

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
    this.#keep(total)
    if (this.#last - this.#said < QUIET_MS) return
    this.#said = this.#last
    const worst = this.#segments
      .filter((segment) => segment.ms >= 1)
      .sort((one, other) => other.ms - one.ms)
      .map((segment) => `${segment.name} ${Math.round(segment.ms)}`)
      .join(', ')
    this.#say(`slow frame ${Math.round(total)} ms: ${worst}`)
  }

  /**
   * The worst frames since the last time they were read, worst first, and the
   * list is emptied by the reading. A stall the player felt is gone from the
   * console by the time they alt-tab to it, so it is kept here for them to ask
   * for after they have walked the street that stuttered.
   */
  worst(): readonly SlowFrame[] {
    const kept = this.#worst
    this.#worst = []
    return kept
  }

  /** Every kept frame as one line each, worst first. */
  report(): readonly string[] {
    const kept = this.worst()
    if (!kept.length) return ['no frame over the last reading was slow enough to keep']
    return kept.map((frame) => {
      const where = frame.segments
        .filter((segment) => segment.ms >= 1)
        .sort((one, other) => other.ms - one.ms)
        .map((segment) => `${segment.name} ${Math.round(segment.ms)}`)
        .join(', ')
      return `${Math.round(frame.ms)} ms: ${where || 'nothing over a millisecond'}`
    })
  }

  #keep(ms: number): void {
    this.#worst.push({ ms, segments: [...this.#segments] })
    this.#worst.sort((one, other) => other.ms - one.ms)
    if (this.#worst.length > KEPT) this.#worst.length = KEPT
  }
}
