/**
 * Runs indexed work concurrently, in fixed waves.
 *
 * A wave is `size` calls that go out together and all land before the next wave
 * starts. That is what keeps the model path deterministic while it uses more
 * than one of the engine's slots: results go back in index order rather than
 * arrival order, and what a call is told about the answers before it is the
 * same on every run whatever order those answers came back in. The wall between
 * waves is also the back-pressure: the engine is never handed more work than it
 * has slots for.
 */
export class Waves {
  readonly size: number

  constructor(size: number = defaultWaveSize()) {
    this.size = Math.max(1, Math.floor(size))
  }

  async run<In, Out>(
    items: readonly In[],
    step: (item: In, index: number, earlier: readonly Out[]) => Promise<Out>,
  ): Promise<Out[]> {
    const done: Out[] = []
    for (let start = 0; start < items.length; start += this.size) {
      const wave = await Promise.all(
        items.slice(start, start + this.size).map((item, k) => step(item, start + k, done)),
      )
      done.push(...wave)
    }
    return done
  }
}

/** How many calls the engine behind the sidecar serves at once, from `GAME_BOX_SLOTS`. */
export function defaultWaveSize(): number {
  const set = Number(globalThis.process?.env?.GAME_BOX_SLOTS)
  return Number.isFinite(set) && set >= 1 ? Math.floor(set) : 4
}
