import type { SaveStore } from '../session.ts'

const SAVE = 'game-box.save'
const SETTINGS = 'game-box.settings'

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
 * What the player set that belongs to them rather than to any city: the source
 * their televisions play, when they gave one. It is kept here and nowhere else,
 * so a city they send somebody carries nothing of it.
 */
export interface Settings {
  readonly screens: string
}

const NOTHING_SET: Settings = { screens: '' }

/** What this browser remembers about the player. Anything it cannot read is nothing set. */
export function localSettings(): Settings {
  const raw = store()?.getItem(SETTINGS)
  if (!raw) return NOTHING_SET
  try {
    const held = JSON.parse(raw) as Partial<Settings>
    return { screens: typeof held.screens === 'string' ? held.screens : '' }
  } catch {
    return NOTHING_SET
  }
}

export function keepSettings(settings: Settings): void {
  store()?.setItem(SETTINGS, JSON.stringify(settings))
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
    write: (save) => {
      store()?.setItem(name, JSON.stringify(save))
    },
    clear: () => {
      store()?.removeItem(name)
    },
  }
}

const HAS_SHELF = 'game-box.has-shelf'

export function localHasShelf(): boolean {
  return store()?.getItem(HAS_SHELF) === 'true'
}

export function keepHasShelf(has: boolean): void {
  if (has) {
    store()?.setItem(HAS_SHELF, 'true')
  } else {
    store()?.removeItem(HAS_SHELF)
  }
}
