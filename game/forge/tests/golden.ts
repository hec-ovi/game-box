import { createHash } from 'node:crypto'
import { ok } from '@gb/kit'
import type { Charter } from '@gb/world'
import { Forge, OfflineNarrator, type History, type Narrator } from '../src/index.ts'

/**
 * The fixed seeds crossed with the fixed histories whose cities are pinned in
 * `fixtures/golden.json`: the offline history the seed composes, a history a
 * narrator wrote in the presets' words, and one that invents a kind of place.
 * `pnpm run golden` pins them; the test holds every later build to the pin.
 */

const SEEDS = ['golden-1', 'golden-2', 'golden-3']
const THEME = 'quiet coastal town'

const KILN: Charter = {
  word: 'kiln',
  label: 'kiln',
  blade: 'KILN',
  names: ['{family} Kiln', 'The {adjective} {noun} Works'],
  rumours: ['The kiln is lit before anybody in the street is awake.'],
  share: 2,
  prominence: 'notable',
  residential: false,
  size: { storeys: [1, 2], sprawl: 'wide' },
  street: { frontage: 'industrial', openness: 'sparse', material: 'metal', voice: 'sober' },
  access: 'open',
  service: 'counter',
  work: ['bench'],
  holding: ['goods', 'tools'],
  finish: 'industrial',
  rooms: { main: { use: 'bench-floor', name: 'Kiln floor' }, services: [{ use: 'store', name: 'Clay store', weight: 1 }] },
}

const HISTORIES: Record<string, History | undefined> = {
  offline: undefined,
  wharves: {
    livesOn: 'the wharves, and the freight that used to come over them',
    happened: 'the shipping line moved to a deeper port two years ago and took the work with it',
    stake: 'who ends up holding the empty sheds',
    sides: [
      { name: 'the freight families', wants: 'the sheds kept shut until the boats come back' },
      { name: 'the receivers', wants: 'the whole waterfront sold on before it rots' },
    ],
    common: ['half the sheds on the water belong to somebody who has never been here'],
    build: { moreOf: ['warehouse', 'bar', 'market'], fewerOf: ['office', 'hotel', 'cafe'], mustHave: ['warehouse'] },
  },
  potteries: {
    livesOn: 'the clay under the town and the kilns that fire it',
    happened: 'the big pottery shut and the small ones took its trade',
    stake: 'who gets the clay',
    sides: [
      { name: 'the small kilns', wants: 'the pit shared out' },
      { name: 'the old firm', wants: 'the pit back' },
    ],
    common: ['the smoke still comes off the hill at dawn'],
    build: { moreOf: ['kiln', 'workshop'], fewerOf: ['office'], mustHave: ['kiln'] },
    charters: [KILN],
  },
}

export interface GoldenCase {
  readonly seed: string
  readonly history: string
}

export interface GoldenPin extends GoldenCase {
  readonly world: string
  readonly quests: string
}

export const goldenCases = (): GoldenCase[] => SEEDS.flatMap((seed) => Object.keys(HISTORIES).map((history) => ({ seed, history })))

/** A narrator told a history, offline in every other respect; the offline narrator itself when there is none to tell. */
function narratorFor(seed: string, history: History | undefined): Narrator {
  const offline = new OfflineNarrator(seed)
  if (!history) return offline
  return {
    writePremise: async () => ok(history),
    nameCity: (input) => offline.nameCity(input),
    namePlace: (input) => offline.namePlace(input),
    describeNpc: (input) => offline.describeNpc(input),
    describeItem: (input) => offline.describeItem(input),
    writeInstances: (requests) => offline.writeInstances(requests),
    writeQuests: (input) => offline.writeQuests(input),
  }
}

const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Builds one case and hashes the city and its quests. */
export async function pin(one: GoldenCase): Promise<GoldenPin> {
  const built = await new Forge(narratorFor(one.seed, HISTORIES[one.history])).build({ theme: THEME, seed: one.seed, blocksX: 3, blocksY: 3 })
  if (!built.ok) throw new Error(`${one.seed}/${one.history}: ${JSON.stringify(built.error).slice(0, 300)}`)
  return { ...one, world: digest(built.value.world.toJSON()), quests: digest(built.value.quests) }
}
