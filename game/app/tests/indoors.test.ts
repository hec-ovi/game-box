// @vitest-environment jsdom
import type { Hud, HudPatch, Notice } from '@gb/hud'
import { CityNav } from '@gb/nav'
import { PlayerState } from '@gb/play'
import { QuestLog, rewardFor, validateQuest } from '@gb/quest'
import { FurnishDressing, furnishKit } from '@gb/furnish'
import { buildInterior, Greybox, type CityBuild } from '@gb/scene'
import { World } from '@gb/world'
import userEvent from '@testing-library/user-event'
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { Buildings } from '../src/buildings.ts'
import { Companions } from '../src/companions.ts'
import { Conditions } from '../src/conditions.ts'
import { Intents } from '../src/intents.ts'
import { Interaction } from '../src/interaction.ts'
import { Player } from '../src/player.ts'
import { Reporting } from '../src/reporting.ts'
import { Screens } from '../src/screens.ts'
import { Driving } from '@gb/drive'
import { Garage } from '../src/garage.ts'
import { Rewards } from '../src/rewards.ts'
import { atTheKerb } from '../src/spawn.ts'
import { Talking } from '../src/talking.ts'
import type { Attending } from '../src/attending.ts'
import { Stashing } from '../src/stashing.ts'
import type { Sky } from '../src/sky.ts'
import type { Stage } from '../src/stage.ts'
import type { Street } from '../src/street.ts'
import type { Chart } from '../src/chart.ts'
import { pick, Targeting } from '../src/targets.ts'
import type { Solid, Vec2 } from '../src/walk.ts'
import { Sidecar } from '@gb/sidecar'
import type { TalkMove } from '@gb/talk'
import { CityArt } from '../src/rooms.ts'
import { anyWorld, doorwaysOnly, fittings, lockUp } from './support/parts.ts'

let close: Array<() => void> = []

afterEach(() => {
  for (const go of close) go()
  close = []
  document.body.innerHTML = ''
})

/** Whatever came back, or the reason it did not. */
function loaded<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

/**
 * A town of three doors. The shop is open and keeps a counter: the office card,
 * the deed to the house and a cup are on it, all the shopkeeper's and all
 * priced. The office is locked to that card, its back room is locked to a word
 * and has a gate of bars across it, and it has two screens on its desks: a
 * locked terminal running the ledger and a laptop with a game on it. The house
 * is for sale and its own door is locked to a word nobody hands out, so the
 * only way in is the deed.
 */
function threeDoors() {
  const world = World.create({ name: 'Fordwater', theme: 'plain', seed: 'locks', width: 30, height: 20 })
  const shop = loaded(
    world.addPlot({ kind: 'shop', name: 'Kell Supply', rect: { x: 1, y: 2, w: 6, h: 4 }, entrance: { cell: { x: 4, y: 6 }, facing: 'south' }, storeys: 1, style: 'brick' }),
  )
  const office = loaded(
    world.addPlot({ kind: 'office', name: 'Ferro Works', rect: { x: 10, y: 2, w: 6, h: 4 }, entrance: { cell: { x: 13, y: 6 }, facing: 'south' }, storeys: 2, style: 'brick' }),
  )
  const house = loaded(
    world.addPlot({ kind: 'house', name: '12 Anchor Lane', rect: { x: 20, y: 2, w: 4, h: 4 }, entrance: { cell: { x: 22, y: 6 }, facing: 'south' }, storeys: 1, style: 'brick' }),
  )

  loaded(
    world.addInterior({
      id: 'interior_0001',
      plotId: shop.id,
      kind: 'shop',
      size: { w: 12, h: 8 },
      rooms: [{ id: 'room_0001', kind: 'main', name: 'The shop floor', rect: { x: 0, y: 0, w: 12, h: 8 } }],
      doors: [{ id: 'door_0001', from: 'outside', to: 'room_0001', pos: { x: 6, y: 8 }, rot: 0 }],
      furniture: [],
      anchors: [{ id: 'anchor_0001', kind: 'serve', roomId: 'room_0001', pos: { x: 6, y: 3 }, rot: 180 }],
    }),
  )

  loaded(
    world.addInterior({
      id: 'interior_0002',
      plotId: office.id,
      kind: 'office',
      size: { w: 12, h: 10 },
      rooms: [
        { id: 'room_0002', kind: 'main', name: 'The front office', rect: { x: 0, y: 4, w: 12, h: 6 } },
        { id: 'room_0003', kind: 'office', name: 'The back office', rect: { x: 0, y: 0, w: 12, h: 4 } },
      ],
      doors: [
        { id: 'door_0002', from: 'outside', to: 'room_0002', pos: { x: 6, y: 10 }, rot: 0, locked: true, keyItemId: 'item_0001' },
        { id: 'door_0003', from: 'room_0002', to: 'room_0003', pos: { x: 6, y: 4 }, rot: 0, locked: true, password: 'quiet-street' },
      ],
      furniture: [
        { id: 'prop_0001', prop: 'bars-door', roomId: 'room_0002', pos: { x: 6, y: 4 }, rot: 0, doorId: 'door_0003' },
        { id: 'prop_0002', prop: 'desk', roomId: 'room_0002', pos: { x: 3, y: 7 }, rot: 0 },
        {
          id: 'prop_0003',
          prop: 'terminal',
          roomId: 'room_0002',
          pos: { x: 3, y: 7 },
          rot: 0,
          on: 'prop_0002',
          lift: 0.75,
          machine: { id: 'machine_0001', locked: true, password: 'ledger-key', program: 'ledger' },
        },
        {
          id: 'prop_0004',
          prop: 'laptop',
          roomId: 'room_0002',
          pos: { x: 9, y: 7 },
          rot: 0,
          machine: { id: 'machine_0002', program: 'snake' },
        },
        { id: 'prop_0005', prop: 'camera', roomId: 'room_0002', pos: { x: 11, y: 5 }, rot: 90, lift: 2.4, watches: 'room_0003' },
        {
          id: 'prop_0006',
          prop: 'monitor',
          roomId: 'room_0002',
          pos: { x: 6, y: 6 },
          rot: 0,
          machine: { id: 'machine_0003', program: 'camera-feed' },
        },
        {
          id: 'prop_0007',
          prop: 'tablet',
          roomId: 'room_0002',
          pos: { x: 11, y: 6 },
          rot: 0,
          machine: { id: 'machine_0004', program: 'mail' },
        },
      ],
      anchors: [{ id: 'anchor_0002', kind: 'work-desk', roomId: 'room_0003', pos: { x: 6, y: 2 }, rot: 0 }],
    }),
  )

  loaded(
    world.addInterior({
      id: 'interior_0003',
      plotId: house.id,
      kind: 'house',
      forSale: 40,
      size: { w: 8, h: 6 },
      rooms: [{ id: 'room_0004', kind: 'main', name: 'The front room', rect: { x: 0, y: 0, w: 8, h: 6 } }],
      doors: [{ id: 'door_0004', from: 'outside', to: 'room_0004', pos: { x: 4, y: 6 }, rot: 0, locked: true, password: 'nobody-says' }],
      furniture: [
        { id: 'prop_0008', prop: 'tablet', roomId: 'room_0004', pos: { x: 4, y: 2 }, rot: 0, machine: { id: 'machine_0005', program: 'blank' } },
      ],
      anchors: [{ id: 'anchor_0003', kind: 'stand', roomId: 'room_0004', pos: { x: 4, y: 3 }, rot: 0 }],
    }),
  )

  loaded(
    world.addNpc({
      id: 'npc_0001',
      name: 'Wren Ashby',
      role: 'vendor',
      appearance: { base: 'female', variant: 2 },
      personality: 'Busy.',
      knowledge: ['The office shuts at six.'],
      station: { interiorId: 'interior_0001', anchorId: 'anchor_0001' },
    }),
  )
  loaded(
    world.addNpc({
      id: 'npc_0002',
      name: 'Dov Ferro',
      role: 'clerk',
      appearance: { base: 'male', variant: 1 },
      personality: 'Careful.',
      knowledge: ['Nobody comes in the back.'],
      station: { interiorId: 'interior_0002', anchorId: 'anchor_0002' },
    }),
  )

  const onTheCounter = (id: string, name: string, archetype: 'keycard' | 'deed' | 'cup', value: number, extra: object) =>
    loaded(
      world.addItem(
        { id, name, description: `A ${name.toLowerCase()}.`, archetype, value, bulk: 'pocket', ownerNpcId: 'npc_0001', ...extra },
        { at: 'anchor', itemId: id, interiorId: 'interior_0001', anchorId: 'anchor_0001' },
      ),
    )
  onTheCounter('item_0001', 'Works card', 'keycard', 20, { opens: { doorId: 'door_0002' } })
  onTheCounter('item_0002', 'Deed to 12 Anchor Lane', 'deed', 40, { deedTo: 'interior_0003' })
  onTheCounter('item_0003', 'Tin cup', 'cup', 3, {})

  return { world, shop: shop.id, office: office.id, house: house.id }
}

/** A quest through the office: unlock the door, crack the terminal, beat the game on the laptop. */
const breakIn = loaded(
  validateQuest(
    {
      format: 'game-box.quest',
      schemaVersion: 1,
      id: 'quest_0001',
      kind: 'main',
      title: 'A quiet word with the Works',
      summary: 'Ferro keeps his books behind a locked door.',
      giverNpcId: 'npc_0002',
      difficulty: 'standard',
      startStepId: 'step_0001',
      reward: rewardFor('standard'),
      steps: [
        { id: 'step_0001', objective: 'Get through the works door', kind: 'unlock', doorId: 'door_0002', next: ['step_0002'] },
        { id: 'step_0002', objective: 'Open the terminal', kind: 'hack', machineId: 'machine_0001', next: ['step_0003'] },
        { id: 'step_0003', objective: 'Beat the game on the laptop', kind: 'beat-game', machineId: 'machine_0002', score: 100, next: ['step_0004'] },
        { id: 'step_0004', objective: 'Done', kind: 'complete' },
      ],
    },
    anyWorld,
  ),
)

/** And a errand that says to buy the card off the counter it is lying on. */
const shopping = loaded(
  validateQuest(
    {
      format: 'game-box.quest',
      schemaVersion: 1,
      id: 'quest_0002',
      kind: 'side',
      title: 'Buy the card',
      summary: 'Wren has the works card behind her counter.',
      giverNpcId: 'npc_0001',
      difficulty: 'errand',
      startStepId: 'step_0001',
      reward: rewardFor('errand'),
      steps: [
        { id: 'step_0001', objective: 'Buy the works card', kind: 'buy', itemId: 'item_0001', next: ['step_0002'] },
        { id: 'step_0002', objective: 'Done', kind: 'complete' },
      ],
    },
    anyWorld,
  ),
)

/** The doorsteps of the three, in city metres. */
const doorsteps = { shop: { x: 9, z: 13 }, office: { x: 27, z: 13 }, house: { x: 45, z: 13 } }

/**
 * The town, opened, with the real key handler bound to it and a stubbed street.
 * Nothing here reports an event of its own: the only way anything moves is the
 * player pressing the key on what is actually in front of them, or the
 * interface reporting what they clicked.
 */
function inTown(options: { quest?: boolean; money?: number } = {}) {
  const { world, shop, office, house } = threeDoors()
  const player = PlayerState.create(world.id, options.money ?? 100)
  const log = QuestLog.create(options.quest ? [breakIn, shopping] : [], player)
  if (options.quest) {
    log.start('quest_0001')
    log.start('quest_0002')
  }

  const patches: HudPatch[] = []
  const notices: Notice[] = []
  const hud = {
    typing: false,
    show: (patch: HudPatch) => void patches.push(patch),
    announce: (notice: Notice) => void notices.push(notice),
  } as unknown as Hud

  const visits: { npcId: string; at?: Vec2; interiorId?: string; left?: boolean }[] = []
  let walking: { id: string; x: number; z: number; interiorId?: string }[] = []
  const street = {
    solid: () => () => false,
    floor: () => () => 0,
    walkers: () => [],
    walkable: true,
    following: () => walking,
    follow: (npc: { id: string }, from: { at?: Vec2 }) => {
      walking = [...walking.filter((each) => each.id !== npc.id), { id: npc.id, x: from.at?.x ?? 0, z: from.at?.z ?? 0 }]
    },
    stopFollowing: (npcId: string) => void (walking = walking.filter((each) => each.id !== npcId)),
    visit: (npcId: string, stay: { interiorId: string; at: Vec2 }) => {
      visits.push({ npcId, at: stay.at, interiorId: stay.interiorId })
      walking = walking.map((each) => (each.id === npcId ? { ...each, ...stay.at, interiorId: stay.interiorId } : each))
    },
    leave: (npcId: string) => {
      visits.push({ npcId, left: true })
      walking = walking.map((each) => (each.id === npcId ? { id: each.id, x: 0, z: 0 } : each))
    },
  } as unknown as Street

  const art = new CityArt(new Greybox())
  const city = doorwaysOnly(
    world,
    new Map([
      [shop, doorsteps.shop],
      [office, doorsteps.office],
      [house, doorsteps.house],
    ]),
    art,
  )

  let solid: Solid = () => false
  let stood: Vec2 = { x: 0, z: 0 }
  const body = {
    setSolid: (next: Solid) => void (solid = next),
    setGround: () => {},
    placeAt: (x: number, z: number) => void (stood = { x, z }),
    position: { x: 9, z: 15 },
    heading: 0,
  } as unknown as Player

  const nav = CityNav.from(world)
  const report = new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock) })
  const locks = lockUp({ world, player, log, report, nav })
  const buildings = new Buildings({
    world,
    player,
    locks,
    art,
    stage: { show: () => {}, indoors: () => {} } as unknown as Stage,
    body,
    city,
    sky: { visible: true } as unknown as Sky,
    street,
    announce: () => {},
    arrived: (at) => void report.report(log.handle({ kind: 'arrived', place: at })),
    wentIn: (built, interior) => companions.comeIn(interior.id, built.visitorCells, built.inward),
    cameOut: (at) => companions.comeOut(at),
    away: () => [],
  })
  const companions = new Companions({ world, player, street, buildings, riding: () => [], note: () => {} })
  const stashing = new Stashing({ world, log, player, buildings, report })
  const { machines, counters } = fittings({ world, player, log, hud, report, buildings, locks })
  const driving = { aboard: false, target: () => undefined, act: () => {} } as unknown as import('@gb/drive').Driving
  const targeting = new Targeting({ world, city, buildings, stashing, street, driving, locks, machines })

  // nothing is listening on the sidecar, so every line is the city's own and
  // every move is carried out with no model call
  const talking = new Talking({
    world,
    log,
    player,
    sidecar: new Sidecar({ fetch: () => Promise.reject(new Error('nothing listening')) }),
    hud,
    body: { setTyping: () => {} } as unknown as Player,
    attending: { hold: () => {}, release: () => {} } as unknown as Attending,
    wares: (npcId) => counters.open(npcId),
    granted: (grant) => locks.handed(grant),
    over: () => counters.closed(),
    report,
  })

  const element = document.createElement('div')
  document.body.append(element)
  let standing: { at: Vec2; heading: number } = { at: { x: 6, z: 4 }, heading: 0 }
  const interaction = new Interaction({
    element,
    world,
    player,
    log,
    hud,
    body,
    buildings,
    stashing,
    talking,
    companions,
    driving,
    locks,
    machines,
    chart: {} as import('../src/chart.ts').Chart,
    guide: { say: () => undefined } as unknown as import('../src/guide.ts').Guide,
    conditions: new Conditions(player.clock),
    report,
    aimed: () => pick(standing.at, standing.heading, targeting.list()),
  })
  const intents = new Intents({
    log,
    hud,
    talking: {} as Talking,
    report,
    body,
    chart: { open: false } as unknown as Chart,
    conditions: new Conditions(player.clock),
    machines,
    counters,
    travel: {} as import('../src/travel.ts').Travel,
    leave: () => {},
    releasePointer: () => {},
  })
  close.push(() => interaction.dispose())

  return {
    world,
    player,
    log,
    nav,
    locks,
    counters,
    talking,
    buildings,
    companions,
    targeting,
    intents,
    patches,
    notices,
    visits,
    plots: { shop, office, house },
    user: userEvent.setup(),
    /** What stops the player where they are standing, as the room last handed it over. */
    solid: () => solid,
    /** Where the body was last put down. */
    stood: () => stood,
    /** Stand somewhere in the room and look north. */
    standAt: (at: Vec2, heading = 0) => void (standing = { at, heading }),
    prompt: () => pick(standing.at, standing.heading, targeting.list())?.label,
    /** Walk up to a doorstep out in the street and look at the door. */
    outside: (plotId: string) => {
      const at = city.doorsteps.get(plotId)!
      standing = { at: { x: at.x, z: at.z }, heading: 0 }
    },
    /** The last patch that carried this field. */
    last: <K extends keyof HudPatch>(field: K): HudPatch[K] | undefined => patches.filter((patch) => field in patch).at(-1)?.[field],
  }
}

describe('a locked door', () => {
  it('is a wall until the card that opens it is in hand, and then it is a door', async () => {
    const town = inTown()
    town.outside(town.plots.office)
    await town.user.keyboard('e')
    expect(town.buildings.outdoors).toBe(true)
    expect(town.notices.at(-1)).toEqual({ kind: 'note', text: 'Locked: it takes the works card' })

    // the card is on the shop counter: buy it, walk back, and the same key opens
    town.buildings.enter(town.plots.shop)
    town.counters.open('npc_0001')
    town.intents.handle({ kind: 'buy', itemId: 'item_0001' })
    expect(town.player.has('item_0001')).toBe(true)
    town.buildings.leave()

    town.outside(town.plots.office)
    await town.user.keyboard('e')
    expect(town.buildings.place).toMatchObject({ kind: 'interior', plotId: town.plots.office })
    expect(town.notices.at(-1)).toEqual({ kind: 'note', text: 'Unlocked with the works card' })
  })

  it('opens for the word the player was given, and tells the quest log its lock came off', async () => {
    const town = inTown({ quest: true })
    town.player.take('item_0001', { opens: { doorId: 'door_0002' } })
    town.outside(town.plots.office)
    await town.user.keyboard('e')
    expect(town.log.objectives().map((step) => step.stepId)).toContain('step_0002')

    // the back room is a second lock, and the word is the quest's to hand out
    town.standAt({ x: 6, z: 5 })
    expect(town.prompt()).toBe('Unlock the door to The back office')
    await town.user.keyboard('e')
    expect(town.notices.at(-1)).toEqual({ kind: 'note', text: 'Locked: it takes a word' })
    town.player.learn('quiet-street', { questId: 'quest_0001' })
    await town.user.keyboard('e')
    expect(town.nav.locked('door_0003')).toBe(false)
    expect(town.prompt()).toBeUndefined()
  })

  it('cuts the way through for `@gb/nav` while it is shut, and gives it back when it opens', () => {
    const town = inTown()
    expect(town.nav.locked('door_0003')).toBe(true)
    expect(town.locks.locked('door_0003')).toBe(true)

    town.player.learn('quiet-street', { questId: 'quest_0001' })
    const door = town.world.door('door_0003')!
    expect(town.locks.open(door.interiorId, door.door)).toBe(true)
    expect(town.nav.locked('door_0003')).toBe(false)
  })

  it('stands a gate of bars across the doorway while its door is locked, and drops it when it opens', () => {
    const town = inTown()
    town.player.take('item_0001', { opens: { doorId: 'door_0002' } })
    town.buildings.enter(town.plots.office)

    // the gate stands at the door's own cell, a metre across the opening
    const gate = { x: 6, z: 4 }
    expect(town.solid()(gate.x, gate.z)).toBe(true)
    // and it is the gate and not the room: a step into the front office is clear
    expect(town.solid()(gate.x + 3, gate.z + 2)).toBe(false)

    town.player.learn('quiet-street', { questId: 'quest_0001' })
    const door = town.world.door('door_0003')!
    town.locks.open(door.interiorId, door.door)
    // the same test, asked again: the room was not rebuilt and the way is clear
    expect(town.solid()(gate.x, gate.z)).toBe(false)
  })

  it('opens for whoever owns the place, whatever the file says', () => {
    const town = inTown()
    town.outside(town.plots.house)
    town.buildings.enter(town.plots.house)
    expect(town.buildings.outdoors).toBe(true)

    town.player.own('interior_0003')
    town.buildings.enter(town.plots.house)
    expect(town.buildings.place).toMatchObject({ kind: 'interior', plotId: town.plots.house })
  })

  it('puts the locks back where the playthrough left them when the city is built again', () => {
    const town = inTown()
    town.player.take('item_0001', { opens: { doorId: 'door_0002' } })
    town.player.grant({ doorId: 'door_0003' })
    expect(town.nav.locked('door_0002')).toBe(true)

    town.locks.restore()
    expect(town.nav.locked('door_0002')).toBe(false)
    expect(town.nav.locked('door_0003')).toBe(false)
  })
})

describe('the machine on the desk', () => {
  // the desk stands in the front office; a step south of it is close enough to sit down
  const atTheDesk = { x: 3, z: 8 }

  function office(options: { quest?: boolean } = {}) {
    const town = inTown(options)
    town.player.take('item_0001', { opens: { doorId: 'door_0002' } })
    town.buildings.enter(town.plots.office)
    return town
  }

  it('opens the screen it is running when the player walks up and presses the key', async () => {
    const town = office()
    town.standAt(atTheDesk)
    expect(town.prompt()).toBe('Use the terminal')

    await town.user.keyboard('e')
    expect(town.last('screen')).toMatchObject({ machineId: 'machine_0001', title: 'The front office terminal', locked: true })
  })

  it('asks for the word, refuses the wrong one, and credits the hack with the right one', async () => {
    const town = office({ quest: true })
    town.standAt(atTheDesk)
    await town.user.keyboard('e')

    town.intents.handle({ kind: 'unlock', machineId: 'machine_0001', password: 'open-sesame' })
    expect(town.last('screen')).toMatchObject({ locked: true, refused: true })
    expect(town.log.objectives().map((step) => step.stepId)).toContain('step_0002')

    town.intents.handle({ kind: 'unlock', machineId: 'machine_0001', password: 'ledger-key' })
    expect(town.last('screen')).toMatchObject({ locked: false })
    expect(town.log.objectives().map((step) => step.stepId)).toContain('step_0003')
  })

  it('opens on sight for a word the player was already given, and draws the ledger off the city', async () => {
    const town = office()
    town.player.learn('ledger-key', { questId: 'quest_0001' })
    town.standAt(atTheDesk)
    await town.user.keyboard('e')

    // a word handed out by a job is a word the player has read: the screen is
    // open the moment they sit down, running what the file says it runs
    const screen = town.last('screen')
    expect(screen).toMatchObject({ locked: false, program: { kind: 'text', title: 'Ledger' } })
    // and the page is the city's own: the shop's stock is not this building's,
    // and this building has nothing standing on a surface in it
    expect(screen?.program).toMatchObject({ lines: ['Nothing on the books.'] })
  })

  it('plays the game on the glass, keeps the best score and credits the job that asked for it', async () => {
    const town = office({ quest: true })
    // the laptop is the machine with a game on it, and it is not locked
    town.standAt({ x: 9, z: 8 })
    expect(town.prompt()).toBe('Use the laptop')
    await town.user.keyboard('e')
    expect(town.last('screen')).toMatchObject({ machineId: 'machine_0002', locked: false, program: { kind: 'snake' } })

    town.intents.handle({ kind: 'score', machineId: 'machine_0002', game: 'snake', score: 40 })
    expect(town.player.bestScore('machine_0002', 'snake')).toBe(40)
    expect(town.last('screen')).toMatchObject({ program: { kind: 'snake', best: 40 } })

    // the step wants a hundred, so forty is a run and not the job: the terminal
    // is cracked first and then the game is beaten
    town.standAt(atTheDesk)
    await town.user.keyboard('e')
    town.intents.handle({ kind: 'unlock', machineId: 'machine_0001', password: 'ledger-key' })
    town.intents.handle({ kind: 'score', machineId: 'machine_0002', game: 'snake', score: 120 })
    expect(town.player.bestScore('machine_0002', 'snake')).toBe(120)
    expect(town.log.status('quest_0001')).toBe('complete')
  })

  it('forgets the machine when the player gets up, so a word typed after it does nothing', async () => {
    const town = office()
    town.standAt(atTheDesk)
    await town.user.keyboard('e')
    town.intents.handle({ kind: 'screen-closed', machineId: 'machine_0001' })

    const pushes = town.patches.filter((patch) => 'screen' in patch).length
    town.intents.handle({ kind: 'unlock', machineId: 'machine_0001', password: 'ledger-key' })
    expect(town.patches.filter((patch) => 'screen' in patch)).toHaveLength(pushes)
  })
})

describe('what a screen is running', () => {
  it('draws every program off the city around it, and a machine with none says so', async () => {
    const town = inTown()
    town.player.take('item_0001', { opens: { doorId: 'door_0002' } })
    town.buildings.enter(town.plots.office)

    // what the cameras of this building watch, and who is standing in there
    town.standAt({ x: 6, z: 7.2 })
    expect(town.prompt()).toBe('Use the monitor')
    await town.user.keyboard('e')
    expect(town.last('screen')?.program).toMatchObject({ title: 'Cameras', lines: ['The back office   Dov Ferro'] })

    // and a line from everybody who works here, in the words the city gave them
    town.standAt({ x: 11, z: 7.2 })
    await town.user.keyboard('e')
    expect(town.last('screen')?.program).toMatchObject({ title: 'Mail', lines: ['Dov Ferro   Nobody comes in the back.'] })

    // the house is the player's once they hold the deed, and the tablet in it
    // is running nothing at all
    town.buildings.leave()
    town.player.own('interior_0003')
    town.buildings.enter(town.plots.house)
    town.standAt({ x: 4, z: 3.2 })
    await town.user.keyboard('e')
    expect(town.last('screen')?.program).toMatchObject({ title: 'System', lines: ['No program is installed on this machine.'] })
  })
})

describe('the counter', () => {
  /** Walk up to the shopkeeper and ask what she sells, the way the interface offers it. */
  async function askedForTheStock(town: ReturnType<typeof inTown>) {
    town.buildings.enter(town.plots.shop)
    await town.talking.start('npc_0001')
    const moves = (town.last('talk')?.moves ?? []) as readonly TalkMove[]
    const move = moves.find((each) => each.action === 'show_wares')
    expect(move).toBeDefined()
    await town.talking.choose(move!.key)
  }

  it('opens with what they sell and what it costs when they name their stock', async () => {
    const town = inTown()
    await askedForTheStock(town)
    expect(town.last('counter')).toEqual({
      seller: 'Wren Ashby',
      offers: [
        { id: 'item_0001', name: 'Works card', price: 20 },
        { id: 'item_0002', name: 'Deed to 12 Anchor Lane', price: 40 },
        { id: 'item_0003', name: 'Tin cup', price: 3 },
      ],
    })
  })

  it('pays for a thing, puts it in the player\'s hands and takes it off the counter', async () => {
    const town = inTown({ quest: true })
    await askedForTheStock(town)

    town.intents.handle({ kind: 'buy', itemId: 'item_0001' })
    expect(town.player.inventory()).toEqual(['item_0001'])
    // the errand said to buy it, and buying it is what credits the step, which
    // finishes the errand and pays for it
    expect(town.log.status('quest_0002')).toBe('complete')
    expect(town.player.money).toBe(100 - 20 + shopping.reward.money)
    // and the counter goes back out without the thing sold on it
    expect(town.last('counter')?.offers.map((offer) => offer.id)).toEqual(['item_0002', 'item_0003'])
    expect(town.last('carrying')).toEqual([{ id: 'item_0001', name: 'Works card', quest: false, value: 20 }])
  })

  it('goes with the conversation it was opened from', async () => {
    const town = inTown()
    await askedForTheStock(town)
    expect(town.last('counter')).toBeTruthy()

    // walking away ends the conversation, and the counter is theirs, not the
    // room's: it goes with them
    town.talking.end()
    expect(town.last('counter')).toBeNull()
  })

  it('leaves a price the player cannot meet on the counter to read', async () => {
    const town = inTown({ money: 10 })
    await askedForTheStock(town)

    town.intents.handle({ kind: 'buy', itemId: 'item_0002' })
    expect(town.player.money).toBe(10)
    expect(town.player.inventory()).toEqual([])
    expect(town.notices.at(-1)).toEqual({ kind: 'note', text: 'Not enough credits for the deed to 12 anchor lane' })
  })

  it('makes the house the player\'s when they buy its deed, and its door opens for them', async () => {
    const town = inTown()
    await askedForTheStock(town)
    town.intents.handle({ kind: 'buy', itemId: 'item_0002' })

    // whose a place is lives in the city file, so the purchase is written there
    expect(town.world.interior('interior_0003')?.owner).toBe('player')
    expect(town.world.interior('interior_0003')?.forSale).toBeUndefined()
    expect(town.world.home()?.id).toBe('interior_0003')
    expect(town.player.owns('interior_0003')).toBe(true)
    // and the door it names, locked to a word nobody hands out, is theirs
    expect(town.nav.locked('door_0004')).toBe(false)
    town.buildings.enter(town.plots.house)
    expect(town.buildings.place).toMatchObject({ kind: 'interior', plotId: town.plots.house })
    // the inventory reads it back as a place of their own
    expect(town.last('homes')).toEqual([{ id: 'interior_0003', name: '12 Anchor Lane', text: 'Your house', placed: [] }])
  })
})

describe('whoever came in with you', () => {
  it('stands in the room where the room says a visitor may stand, and comes back out with the player', () => {
    const town = inTown()
    town.player.addCompanion('npc_0002')

    town.buildings.enter(town.plots.shop)
    const spot = town.buildings.room('interior_0001')!.visitorCells[0]!
    expect(town.visits).toEqual([{ npcId: 'npc_0002', interiorId: 'interior_0001', at: { x: spot.x, z: spot.z } }])

    // and out again with them: the crowd puts the body back on the doorstep
    town.buildings.leave()
    expect(town.visits.at(-1)).toEqual({ npcId: 'npc_0002', left: true })
  })

  it('takes the first spot the room offers, then the second', () => {
    const town = inTown()
    town.player.addCompanion('npc_0002')
    town.player.addCompanion('npc_0001')

    town.buildings.enter(town.plots.shop)
    const cells = town.buildings.room('interior_0001')!.visitorCells
    expect(town.visits.map((visit) => visit.at)).toEqual([
      { x: cells[0]!.x, z: cells[0]!.z },
      { x: cells[1]!.x, z: cells[1]!.z },
    ])
  })
})

describe('a car a job paid out', () => {
  /** An epic job that hands over the house and a car to put outside it. */
  const payday = loaded(
    validateQuest(
      {
        format: 'game-box.quest',
        schemaVersion: 1,
        id: 'quest_0003',
        kind: 'main',
        title: 'The Ferro business',
        summary: 'Ferro settles up in full.',
        giverNpcId: 'npc_0002',
        difficulty: 'epic',
        startStepId: 'step_0001',
        reward: { ...rewardFor('epic'), car: 'SUV', deed: 'interior_0003' },
        steps: [{ id: 'step_0001', objective: 'Settle up', kind: 'complete' }],
      },
      anyWorld,
    ),
  )

  function paid() {
    const { world, house } = threeDoors()
    const player = PlayerState.create(world.id)
    const log = QuestLog.create([payday], player)
    const city = { doorsteps: new Map([[house, doorsteps.house]]) } as unknown as CityBuild

    const { hud } = (() => {
      const patches: HudPatch[] = []
      return { hud: { show: (patch: HudPatch) => void patches.push(patch), announce: () => {} } as unknown as Hud }
    })()
    const report = new Reporting({
      world,
      log,
      player,
      hud,
      conditions: new Conditions(player.clock),
      paid: (reward) => rewards.paid(reward),
    })
    const locks = lockUp({ world, player, log, report })

    const element = document.createElement('div')
    document.body.append(element)
    const body = new Player(new THREE.PerspectiveCamera(), element, () => false)
    close.push(() => body.dispose())

    const driving = new Driving({ rider: body, solid: () => false })
    const garage = new Garage({
      player,
      driving,
      where: () => {
        const home = world.home()
        return (home ? atTheKerb(world, city, home.plotId) : undefined) ?? body.position
      },
    })
    const rewards = new Rewards({ world, player, locks, garage, report })

    // the town's cars, none of them, and the pool a car body comes from
    const parked: { position: { x: number; y: number; z: number }; rotation: { y: number } }[] = []
    const bodies = {
      acquire: () => {
        const car = { position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } }
        parked.push(car)
        return car
      },
      release: () => void parked.pop(),
    }
    garage.open(bodies)
    // the town's cars with the player's own among them: `@gb/drive` reads one
    // feed and never knows which of them was parked for the player
    driving.open(garage.over({ cars: () => [], handOver: () => undefined }), bodies)

    return { world, player, log, report, rewards, driving, garage, body, parked }
  }

  it('is kept, put out at the door of the house the same job handed over, and driven away', () => {
    const town = paid()
    // the job is taken and finishes on its own first step: the quest log pays
    // the playthrough and the game hears what it paid
    town.report.report(town.log.start('quest_0003'))

    // the playthrough holds the car, the city holds the house, and the car is
    // standing at its door
    expect(town.player.cars()).toEqual(['SUV'])
    expect(town.player.carOut).toBe('SUV')
    expect(town.world.home()?.id).toBe('interior_0003')
    expect(town.garage.car).toMatchObject({ model: 'SUV', ...doorsteps.house })
    expect(town.parked).toHaveLength(1)
    expect(town.parked[0]!.position).toMatchObject(doorsteps.house)

    // and it is a car like any other: walk up to it and the same key gets in
    town.body.placeAt(doorsteps.house.x, doorsteps.house.z + 1)
    expect(town.driving.target()?.kind).toBe('drive')
    town.driving.act()
    expect(town.driving.aboard).toBe(true)
    // the body it was standing in the street as is back in the pool: the one
    // the player is sitting in is `@gb/drive`'s now
    expect(town.garage.rolling()).toEqual([])
  })

  it('writes the places the playthrough owns back into the city it was built again from', () => {
    const town = paid()
    // the file says the house is for sale; the save says it was bought
    expect(town.world.interior('interior_0003')?.owner).toBeUndefined()
    town.player.own('interior_0003')

    town.rewards.restore()
    expect(town.world.home()?.id).toBe('interior_0003')
    expect(town.world.interior('interior_0003')?.forSale).toBeUndefined()
  })
})

describe('coming back to a room behind a lock', () => {
  it('opens the door the save was behind, and leaves the player on the pavement when it will not open', () => {
    const town = inTown()
    // the works door is locked and the card is in the player's pocket
    town.player.take('item_0001', { opens: { doorId: 'door_0002' } })
    town.locks.restore()
    town.buildings.enter(town.plots.office)
    expect(town.buildings.outdoors).toBe(false)

    // the card is put back down: a lock that has come off stays off for the
    // rest of the playthrough, so the door does not bolt itself behind them
    town.buildings.leave()
    town.player.drop('item_0001')
    town.buildings.enter(town.plots.office)
    expect(town.buildings.outdoors).toBe(false)

    // a house they have never been in and hold nothing for stays shut
    town.buildings.leave()
    town.buildings.enter(town.plots.house)
    expect(town.buildings.outdoors).toBe(true)
  })
})

describe('what is playing on the televisions', () => {
  /** A bar with a set on the wall, drawn by the furniture pack so its glass is where the pack says. */
  function bar() {
    const world = World.create({ name: 'Anchorage', theme: 'plain', seed: 'screens', width: 24, height: 14 })
    const plot = world.addPlot({
      kind: 'bar',
      name: 'The Bright Anchor',
      rect: { x: 1, y: 2, w: 8, h: 4 },
      entrance: { cell: { x: 5, y: 6 }, facing: 'south' },
      storeys: 1,
      style: 'brick',
    })
    if (!plot.ok) throw new Error(JSON.stringify(plot.error))
    const inside = world.addInterior({
      id: 'interior_0001',
      plotId: plot.value.id,
      kind: 'bar',
      size: { w: 14, h: 8 },
      rooms: [{ id: 'room_0001', kind: 'main', name: 'The bar', rect: { x: 0, y: 0, w: 14, h: 8 } }],
      doors: [{ id: 'door_0001', from: 'outside', to: 'room_0001', pos: { x: 7, y: 8 }, rot: 0, locked: false }],
      furniture: [{ id: 'prop_0001', prop: 'tv', roomId: 'room_0001', pos: { x: 4, y: 1 }, rot: 0 }],
      anchors: [],
    })
    if (!inside.ok) throw new Error(JSON.stringify(inside.error))
    const interior = world.interior('interior_0001')!
    return { interior, built: buildInterior(world, interior, new FurnishDressing(furnishKit(), new Greybox())) }
  }

  /** A source that comes up, or one that does not: the element answers either way. */
  async function source(answer: 'canplay' | 'error') {
    const screens = new Screens('https://example.invalid/loop.mp4')
    const video = document.createElement('video')
    const playing = screens.open(video)
    video.dispatchEvent(new Event(answer))
    return { screens, playing: await playing }
  }

  it('plays the source on every set in the room, inside the glass the pack drew', async () => {
    const { interior, built } = bar()
    const { screens, playing } = await source('canplay')
    expect(playing).toBe(true)

    screens.dress(built, interior)
    const set = built.props.get('prop_0001')!
    const picture = set.getObjectByName('screen:prop_0001') as THREE.Mesh
    expect(picture).toBeDefined()

    // the glass of `@gb/furnish`'s set is 0.97 m across and 0.5 m tall, its face
    // 0.115 m out from the middle of the piece: the picture is that rectangle,
    // a whisker proud of it
    const size = new THREE.Box3().setFromObject(picture).getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(0.97, 2)
    expect(size.y).toBeCloseTo(0.5, 2)
    expect(picture.position.z).toBeGreaterThan(0.115)
    expect(picture.position.z).toBeLessThan(0.12)

    // asked again, it does not hang a second picture on the same set
    screens.dress(built, interior)
    expect(set.children.filter((child) => child.name === 'screen:prop_0001')).toHaveLength(1)
    screens.close()
  })

  it('leaves the town on its own schedule when the source will not play', async () => {
    const { interior, built } = bar()
    const { screens, playing } = await source('error')
    expect(playing).toBe(false)

    screens.dress(built, interior)
    expect(built.props.get('prop_0001')!.getObjectByName('screen:prop_0001')).toBeUndefined()
  })
})
