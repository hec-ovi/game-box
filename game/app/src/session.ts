import { Bundle, type OpenedBundle } from '@gb/bundle'
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'

/** Somewhere a save can be kept between visits. */
export interface SaveStore {
  read(): unknown | undefined
  write(value: unknown): void
  clear(): void
}

/**
 * The playthrough between one visit and the next. A save belongs to the city it
 * was made in, so one that will not resume against this bundle is dropped and
 * the player starts fresh rather than in somebody else's town.
 */
export class Session {
  #bundle: OpenedBundle
  #store: SaveStore

  constructor(bundle: OpenedBundle, store: SaveStore) {
    this.#bundle = bundle
    this.#store = store
  }

  /** Where the player left off, or nothing if there is no save for this city. */
  restore(): { player: PlayerState; log: QuestLog } | undefined {
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
