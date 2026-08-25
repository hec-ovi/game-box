import { readFileSync } from 'node:fs'
import { OfflineNarrator, type History, type Narrator } from '@gb/forge'
import { Scribe } from '@gb/scribe'
import type { BuildArgs } from './index.ts'

/** Who writes the city, or why the history file asked for cannot be read. */
export type Writers = { narrator: Narrator; scribe: Scribe | undefined } | { unreadable: string }

/** The local model when asked for, the offline narrator otherwise, and a history file in place of either's story. */
export function narratorFor(args: BuildArgs): Writers {
  const scribe = args.model ? new Scribe({ seed: args.seed }) : undefined
  const base: Narrator = scribe ?? new OfflineNarrator(args.seed)
  if (!args.history) return { narrator: base, scribe }

  const history = readHistory(args.history)
  if (typeof history === 'string') return { unreadable: history }
  return { narrator: new HistoryNarrator(base, history), scribe }
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
