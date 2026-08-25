import type { SaveStore } from '../session.ts'

const SAVE = 'game-box.save'

/**
 * The browser's own store, or nothing at all. A private window throws on the
 * first read, and a game that will not start because it cannot remember
 * anything is worse than one that forgets.
 */
function store(): Storage | undefined {
  try {
    const probe = globalThis.localStorage
    probe.getItem(SAVE)
    return probe
  } catch {
    return undefined
  }
}

/**
 * Where the playthrough of one city is kept, by the library's key for it. Every
 * generated city calls itself `world_0001`, so the key is the one name that
 * tells two cities apart.
 */
export function localSaves(key: string): SaveStore {
  const name = `${SAVE}.${key}`
  return {
    read: () => {
      const raw = store()?.getItem(name)
      if (!raw) return undefined
      try {
        return JSON.parse(raw)
      } catch {
        return undefined
      }
    },
    write: (value) => store()?.setItem(name, JSON.stringify(value)),
    clear: () => store()?.removeItem(name),
  }
}
