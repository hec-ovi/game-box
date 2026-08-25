import { readFileSync } from 'node:fs'
import { OfflineNarrator, type History, type Narrator } from '@gb/forge'
import { Scribe } from '@gb/scribe'

/** Who writes a city: the local model when asked for, the offline narrator otherwise. */
export interface Writers {
  narrator: Narrator
  scribe: Scribe | undefined
}

export function narratorFor(seed: string, model: boolean): Writers {
  const scribe = model ? new Scribe({ seed }) : undefined
  return { narrator: scribe ?? new OfflineNarrator(seed), scribe }
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

  constructor(
    base: Narrator,
    private readonly history: History,
  ) {
    this.nameCity = base.nameCity.bind(base)
    this.namePlace = base.namePlace.bind(base)
    this.describeNpc = base.describeNpc.bind(base)
    this.describeItem = base.describeItem.bind(base)
    this.writeQuests = base.writeQuests.bind(base)
    if (base.writeInstances) this.writeInstances = base.writeInstances.bind(base)
    if (base.namePlaces) this.namePlaces = base.namePlaces.bind(base)
  }

  async writePremise(): Promise<History> {
    return this.history
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
