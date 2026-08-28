import { readFileSync } from 'node:fs'
import type { History, Narrator, Written } from '@gb/forge'
import { Scribe } from '@gb/scribe'

/** Who writes a city. A model writes every word of one, so there is only ever this. */
export interface Writers {
  narrator: Narrator
  scribe: Scribe
}

export function narratorFor(seed: string): Writers {
  const scribe = new Scribe({ seed })
  return { narrator: scribe, scribe }
}

/** The same writer answering the history from a file, or one line saying why the file is not one. */
export function storied(base: Narrator, file: string): Narrator | string {
  const history = readHistory(file)
  return typeof history === 'string' ? history : new HistoryNarrator(base, history)
}

/**
 * A narrator that answers the history from a file and everything else from the
 * narrator behind it. The file is taken as a narrator's answer: the forge
 * trusts nothing a narrator writes, so a charter that fails its gate is dropped
 * with its reason on the report rather than refused here.
 */
class HistoryNarrator implements Narrator {
  readonly nameCity: Narrator['nameCity']
  readonly namePlace: Narrator['namePlace']
  readonly describeNpc: Narrator['describeNpc']
  readonly describeItem: Narrator['describeItem']
  readonly writeQuests: Narrator['writeQuests']
  readonly writeInstances?: NonNullable<Narrator['writeInstances']>
  readonly namePlaces?: NonNullable<Narrator['namePlaces']>

  readonly #history: History

  // written out rather than as a constructor parameter property: `gb` runs
  // under node's strip-only TypeScript, which refuses one outright
  constructor(base: Narrator, history: History) {
    this.#history = history
    this.nameCity = base.nameCity.bind(base)
    this.namePlace = base.namePlace.bind(base)
    this.describeNpc = base.describeNpc.bind(base)
    this.describeItem = base.describeItem.bind(base)
    this.writeQuests = base.writeQuests.bind(base)
    if (base.writeInstances) this.writeInstances = base.writeInstances.bind(base)
    if (base.namePlaces) this.namePlaces = base.namePlaces.bind(base)
  }

  async writePremise(): Promise<Written<History>> {
    return { ok: true, value: this.#history }
  }
}

/** The file as a history, or one line saying why it is not one. */
function readHistory(file: string): History | string {
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${file} is not a history: expected a JSON object`
    return value as History
  } catch (cause) {
    return `${file} cannot be read: ${(cause as Error).message}`
  }
}
