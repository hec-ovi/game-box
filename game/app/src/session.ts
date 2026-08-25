import { Bundle, type OpenedBundle, type ResumeReport } from '@gb/bundle'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'

/** Somewhere a save can be kept between visits. */
export interface SaveStore {
  read(): unknown | undefined
  write(value: unknown): void
  clear(): void
}

/**
 * The playthrough between one visit and the next. A save belongs to the city it
 * was made in, so one that will not resume against this bundle is dropped and
 * the player starts fresh rather than in somebody else's town. One written in
 * an earlier writing of the same city resumes reconciled, and the report says
 * what it lost.
 */
export class Session {
  #bundle: OpenedBundle
  #store: SaveStore

  constructor(bundle: OpenedBundle, store: SaveStore) {
    this.#bundle = bundle
    this.#store = store
  }

  /** Where the player left off, or nothing if there is no save for this city. */
  restore(): { player: PlayerState; log: QuestLog; report: ResumeReport } | undefined {
    const kept = this.#store.read()
    if (kept === undefined) return undefined

    const resumed = Bundle.resume(this.#bundle, kept)
    if (resumed.ok) return resumed.value
    console.warn(`the save does not belong to this city (${resumed.error.code}); starting fresh`)
    this.#store.clear()
    return undefined
  }

  keep(player: PlayerState, log: QuestLog): void {
    try {
      this.#store.write(Bundle.save(this.#bundle, player, log))
    } catch (cause) {
      console.warn(`could not keep the playthrough (${String(cause)})`)
    }
  }
}
