import type { SaveStore } from '../session.ts'
import { tidy, type CityBrief } from './brief.ts'

const CITY = 'game-box.city'
const SAVE = 'game-box.save'

/**
 * The browser's own store, or nothing at all. A private window throws on the
 * first read, and a game that will not start because it cannot remember
 * anything is worse than one that forgets.
 */
function store(): Storage | undefined {
  try {
    const probe = globalThis.localStorage
    probe.getItem(CITY)
    return probe
  } catch {
    return undefined
  }
}

/** Where the playthrough of one city is kept. */
export function localSaves(worldId: string): SaveStore {
  const key = `${SAVE}.${worldId}`
  return {
    read: () => {
      const raw = store()?.getItem(key)
      if (!raw) return undefined
      try {
        return JSON.parse(raw)
      } catch {
        return undefined
      }
    },
    write: (value) => store()?.setItem(key, JSON.stringify(value)),
    clear: () => store()?.removeItem(key),
  }
}

/** The city the player was last in, so a refresh comes back to it. */
export function rememberBrief(brief: CityBrief): void {
  store()?.setItem(CITY, JSON.stringify(brief))
}

export function rememberedBrief(): CityBrief | undefined {
  const raw = store()?.getItem(CITY)
  if (!raw) return undefined
  try {
    const kept = JSON.parse(raw) as Partial<CityBrief>
    if (typeof kept.theme !== 'string' || typeof kept.seed !== 'string') return undefined
    return tidy({ theme: kept.theme, seed: kept.seed, blocks: Number(kept.blocks), model: kept.model === true })
  } catch {
    return undefined
  }
}
