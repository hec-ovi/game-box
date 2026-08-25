/** The stages a city is written in, in the order they run. */
export type ScribeStage = 'history' | 'city' | 'places' | 'quests'

/** Where a build has got to, published as it goes. */
export interface ScribeProgress {
  readonly stage: ScribeStage
  /** Answers in so far. */
  readonly done: number
  /** Answers this stage is waiting for. */
  readonly total: number
  /** What it is working on, in words somebody waiting can read. */
  readonly what: string
}

/** Somewhere to show it. `@gb/app` gives one; a build without one is unchanged. */
export type ProgressPort = (progress: ScribeProgress) => void

/**
 * Publishes how far the build has got.
 *
 * Nothing here is read back: a stage's count is written out and forgotten, so
 * what the model is asked cannot depend on it and a build with a loader on it
 * writes the same city as a build without one. A port that throws is a broken
 * loader, never a broken city, so it is caught here and dropped.
 */
export class Progress {
  #port: ProgressPort | undefined
  #stage: ScribeStage | undefined
  #total = 0
  #done = 0

  constructor(port?: ProgressPort) {
    this.#port = port
  }

  /**
   * A stage opens with this many answers to wait for. The same stage opened
   * again grows instead of starting over: the city stage is the name and then
   * the signs, asked for in two calls, and a loader should see one bar.
   */
  open(stage: ScribeStage, total: number, what: string): void {
    if (stage !== this.#stage) {
      this.#stage = stage
      this.#done = 0
      this.#total = 0
    }
    this.#total += total
    this.#publish(what)
  }

  /** One answer is in. */
  finished(what: string): void {
    this.#done++
    this.#publish(what)
  }

  #publish(what: string): void {
    if (!this.#port || !this.#stage) return
    try {
      this.#port({ stage: this.#stage, done: this.#done, total: this.#total, what })
    } catch {
      this.#port = undefined
    }
  }
}
