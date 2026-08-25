import { Rng } from '@gb/kit'
import { SHIPPED_CHARTERS, type Charter, type Premise } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Forge, OfflineNarrator } from '../src/index.ts'
import { drawOf } from '../src/interior/draw.ts'
import type { History, Narrator } from '../src/index.ts'
import { kindWeights, stapleKinds } from '../src/theme/plot-mix.ts'
import { buildTown } from './support.ts'

/** A kind of place the engine has no word for, written the way a history would write it. */
const JAIL: Charter = {
  word: 'jail',
  label: 'jail',
  blade: 'JAIL',
  names: ['{family} Holding', 'The {adjective} {noun} House'],
  rumours: ['Somebody in the cells has not been charged with anything.', 'The duty desk keeps two ledgers.'],
  share: 1,
  prominence: 'landmark',
  residential: false,
  size: { storeys: [2, 3], sprawl: 'block' },
  street: { frontage: 'blank', openness: 'sparse', material: 'masonry', voice: 'sober' },
  access: 'open',
  service: 'desk',
  work: ['watch'],
  holding: ['papers'],
  finish: 'civic',
  rooms: {
    hall: { use: 'waiting-room', name: 'Duty desk' },
    main: { use: 'ward', name: 'Cells' },
    services: [{ use: 'private-office', name: 'Warden office', weight: 1, spare: true }],
  },
}

/** A town whose history says there is a jail, and says what a jail is. */
const LOCKUP: History = {
  livesOn: 'the county court, and everybody who has to come to it',
  happened: 'the assizes moved here from the city and brought the cells with them',
  stake: 'who is inside when the door shuts',
  sides: [
    { name: 'the court', wants: 'the cells full and the ledger clean' },
    { name: 'the families outside', wants: 'somebody to tell them who is in there' },
  ],
  common: ['the jail takes in more on market day than the court ever sees'],
  build: { moreOf: ['jail', 'office'], fewerOf: ['hotel'], mustHave: ['jail'] },
  charters: [JAIL],
}

/** A narrator told the town's history, offline in every other respect. */
class Told implements Narrator {
  #offline: OfflineNarrator
  #history: unknown
  constructor(seed: string, history: unknown) {
    this.#offline = new OfflineNarrator(seed)
    this.#history = history
  }
  async writePremise(): Promise<History> {
    return this.#history as History
  }
  nameCity = (input: Parameters<Narrator['nameCity']>[0]) => this.#offline.nameCity(input)
  namePlace = (input: Parameters<Narrator['namePlace']>[0]) => this.#offline.namePlace(input)
  describeNpc = (input: Parameters<Narrator['describeNpc']>[0]) => this.#offline.describeNpc(input)
  describeItem = (input: Parameters<Narrator['describeItem']>[0]) => this.#offline.describeItem(input)
  writeQuests = (input: Parameters<Narrator['writeQuests']>[0]) => this.#offline.writeQuests(input)
  writeInstances = (requests: Parameters<NonNullable<Narrator['writeInstances']>>[0]) => this.#offline.writeInstances(requests)
}

async function build(seed: string, history: unknown, blocks = 3) {
  const built = await new Forge(new Told(seed, history)).build({ theme: 'quiet market town', seed, blocksX: blocks, blocksY: blocks })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  return built.value
}

describe('a kind of place the history invents', () => {
  it('gets a plot of that kind with rooms, staff and a sign, and the file says what it is', async () => {
    const { world, dropped } = await build('lockup', LOCKUP)
    expect(dropped).toEqual([])
    expect(world.check()).toEqual([])
    expect(world.charter('jail')?.blade).toBe('JAIL')
    expect(world.charters().length).toBe(SHIPPED_CHARTERS.length + 1)

    const jails = world.plotsOfKind('jail')
    expect(jails.length, 'the town has no jail').toBeGreaterThan(0)
    for (const jail of jails) {
      expect(jail.storeys).toBeGreaterThanOrEqual(2)
      expect(jail.name.length).toBeGreaterThan(2)
    }
    // the story means the player to walk into it, so one of them opens
    const open = jails.flatMap((jail) => world.interiors().filter((interior) => interior.plotId === jail.id))
    expect(open.length, 'no jail opens').toBeGreaterThan(0)
    const inside = open[0]!
    expect(inside.finish).toBe('civic')
    expect(inside.rooms.map((room) => room.use)).toContain('ward')
    expect(inside.rooms.map((room) => room.name)).toContain('Cells')
    expect(inside.anchors.map((anchor) => anchor.kind)).toContain('sleep')
    expect(inside.anchors.map((anchor) => anchor.kind)).toContain('guard')
    const roles = world.npcsIn(inside.plotId).map((npc) => npc.role)
    expect(roles, 'nobody on the duty desk').toContain('receptionist')
    expect(roles, 'nobody on the door').toContain('guard')
    // and its people talk about it in the charter's own words
    const said = world.npcsIn(inside.plotId).flatMap((npc) => npc.knowledge)
    expect(said.some((line) => JAIL.rumours.some((rumour) => line.includes(rumour)))).toBe(true)
  })

  it('drops a charter that fails the shape, strips the word from the build, and keeps the history', async () => {
    const bad = { ...JAIL, word: 'vault', blade: 'vault', rooms: { main: { use: 'ward', name: 'Vault' }, services: [] } }
    const { world, dropped } = await build('vault', { ...LOCKUP, charters: [JAIL, bad], build: { moreOf: ['vault'], fewerOf: [], mustHave: ['jail', 'vault'] } })
    expect(dropped.map((one) => one.word)).toEqual(['vault'])
    expect(dropped[0]!.reason).toContain('blade')
    expect(world.charter('vault')).toBeUndefined()
    expect(world.premise()?.build).toEqual({ moreOf: [], fewerOf: [], mustHave: ['jail'] })
    expect(world.premise()?.livesOn).toBe(LOCKUP.livesOn)
    expect(world.plotsOfKind('jail').length).toBeGreaterThan(0)
  })

  it('draws every other kind the same with one more kind declared', () => {
    // every per-kind draw is forked on the word, so declaring a jail moves no
    // house, bar or chapel the seed already rolled
    const extra: Charter = { ...JAIL, word: 'annexe', prominence: 'background', service: 'none', work: [], residential: true }
    const build: Premise['build'] = { moreOf: [], fewerOf: ['hotel'], mustHave: [] }
    for (const seed of ['one', 'two', 'three']) {
      const alone = kindWeights('plain', new Rng(seed), SHIPPED_CHARTERS, build)
      const joined = kindWeights('plain', new Rng(seed), [...SHIPPED_CHARTERS, { ...extra, ...SHIPPED_CHARTERS[0]!, ...extra }], build)
      expect(joined.filter(([word]) => word !== 'annexe')).toEqual(alone)
      expect(stapleKinds('plain', new Rng(seed), [...SHIPPED_CHARTERS, { ...SHIPPED_CHARTERS[0]!, ...extra }])).toEqual(stapleKinds('plain', new Rng(seed), SHIPPED_CHARTERS))
    }
  })

  it('weighs two different jails in one process as two different places', () => {
    const cells = drawOf(JAIL)
    const dormitory = drawOf({ ...JAIL, service: 'none', work: [], rooms: { main: { use: 'bedroom', name: 'Dormitory' }, services: [] } })
    expect(cells.counter).toBeGreaterThan(0)
    expect(dormitory.counter).toBe(0)
    expect(drawOf(JAIL)).toEqual(cells)
  })

  it('founds a town written around its clubs with a disco, and people dancing in it', async () => {
    // the offline history for a neon town's clubs declares the disco itself
    const { world, dropped } = await buildTown('club-1', { theme: 'dense neon port city', blocksX: 3, blocksY: 3 })
    expect(dropped).toEqual([])
    expect(world.charter('disco')?.label).toBe('disco')
    const discos = world.plotsOfKind('disco')
    expect(discos.length).toBeGreaterThan(0)
    const inside = world.interiors().find((interior) => discos.some((disco) => disco.id === interior.plotId))
    expect(inside, 'no disco opens').toBeDefined()
    expect(inside!.anchors.map((anchor) => anchor.kind)).toContain('dance')
    expect(inside!.anchors.map((anchor) => anchor.kind)).toContain('guard')
    expect(world.npcsIn(inside!.plotId).map((npc) => npc.role)).toContain('bartender')
  })
})
