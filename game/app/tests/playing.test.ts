// @vitest-environment jsdom
import type { Driving } from '@gb/drive'
import type { Hud, HudPatch, Notice } from '@gb/hud'
import { PlayerState } from '@gb/play'
import { QuestLog, rewardFor, validateQuest } from '@gb/quest'
import { Greybox, type CityBuild } from '@gb/scene'
import { World } from '@gb/world'
import userEvent from '@testing-library/user-event'
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { Buildings } from '../src/buildings.ts'
import { Chase } from '../src/chase.ts'
import type { Companions } from '../src/companions.ts'
import type { Counters } from '../src/counters.ts'
import type { Locks } from '../src/locks.ts'
import type { Machines } from '../src/machines.ts'
import { Conditions } from '../src/conditions.ts'
import type { Chart } from '../src/chart.ts'
import type { Guide } from '../src/guide.ts'
import { Intents } from '../src/intents.ts'
import { Interaction } from '../src/interaction.ts'
import { Player } from '../src/player.ts'
import type { Stage } from '../src/stage.ts'
import { Reporting } from '../src/reporting.ts'
import type { Sky } from '../src/sky.ts'
import { Stashing } from '../src/stashing.ts'
import type { Street } from '../src/street.ts'
import type { Talking } from '../src/talking.ts'
import type { Travel } from '../src/travel.ts'
import { View } from '../src/view.ts'
import { pick, Targeting, type Target } from '../src/targets.ts'
import type { Vec2 } from '../src/walk.ts'
import { CityArt } from '../src/rooms.ts'
import { anyWorld, doorwaysOnly, fittings, lockUp } from './support/parts.ts'

const nowhere = () => false
let close: Array<() => void> = []

afterEach(() => {
  for (const go of close) go()
  close = []
  document.body.innerHTML = ''
})

function stage(): { camera: THREE.PerspectiveCamera; element: HTMLElement } {
  const element = document.createElement('div')
  document.body.append(element)
  return { camera: new THREE.PerspectiveCamera(), element }
}

describe('riding in a car', () => {
  function body(): Player {
    const { camera, element } = stage()
    const player = new Player(camera, element, nowhere)
    close.push(() => player.dispose())
    return player
  }

  it('reads the same keys walking does, so the car needs no keyboard of its own', async () => {
    const player = body()
    const user = userEvent.setup()

    await user.keyboard('{w>}{Shift>}')
    expect(player.input).toEqual({ forward: 1, strafe: 0, running: true })
    await user.keyboard('{/w}{/Shift}{s>}{a>}')
    expect(player.input).toEqual({ forward: -1, strafe: -1, running: false })
    await user.keyboard('{/s}{/a}')
  })

  it('puts the eye where the seat is, turns the view with the car, and leans it over', () => {
    const player = body()
    player.placeAt(10, 10, 0)

    player.ride({ x: 3, y: 1.16, z: 4, turned: 0.5, roll: 0.08 })
    expect(player.position).toEqual({ x: 3, z: 4 })
    expect(player.heading).toBeCloseTo(0.5, 6)

    // and again next frame, so a car going round a corner carries the view round
    player.ride({ x: 3.2, y: 1.16, z: 4.4, turned: 0.25, roll: 0.08 })
    expect(player.heading).toBeCloseTo(0.75, 6)
  })

  it('will not walk out from under itself while the player is in the seat', async () => {
    const player = body()
    player.placeAt(10, 10, 0)
    await userEvent.setup().keyboard('{w>}')

    player.update(1 / 60)
    expect(player.position.z).toBeLessThan(10)

    player.ride({ x: 3, y: 1.16, z: 4, turned: 0, roll: 0 })
    player.update(1 / 60)
    player.update(1 / 60)
    expect(player.position).toEqual({ x: 3, z: 4 })

    // and walks again the moment they are put back on the pavement
    player.ride(undefined)
    player.placeAt(20, 20, 0)
    player.update(1 / 60)
    expect(player.position.z).toBeLessThan(20)
  })
})

describe('the keys the player presses', () => {
  function bound(input: { aimed?: Target; typing?: boolean } = {}) {
    const { camera, element } = stage()
    const clock = PlayerState.create('world_0001').clock
    const notes: string[] = []
    let got = 0

    const body = new Player(camera, element, nowhere)
    const hud = { typing: input.typing ?? false, show: () => {} } as unknown as Hud
    const driving = { act: () => void got++, aboard: false, view: 'chase', switchView: () => 'seat' } as unknown as Driving
    const interaction = new Interaction({
      element,
      world: {} as World,
      player: {} as PlayerState,
      log: {} as QuestLog,
      hud,
      body,
      buildings: {} as Buildings,
      stashing: {} as Stashing,
      talking: { active: false } as Talking,
      companions: {} as Companions,
      driving,
      chase: new Chase({ camera, driving, hud }),
      locks: {} as Locks,
      machines: {} as Machines,
      openMap: () => {},
      guide: { say: () => 'The Copper Wheel: 40 m, head east' } as Guide,
      conditions: new Conditions(clock),
      report: { note: (text: string) => void notes.push(text) } as unknown as Reporting,
      aimed: () => input.aimed,
    })
    close.push(() => interaction.dispose())
    close.push(() => body.dispose())
    return { body, clock, notes, user: userEvent.setup(), got: () => got }
  }

  const wheel: Target = { kind: 'drive', id: 'car_3', label: 'Get in the taxi', at: { x: 1, z: 1 } }

  it('gets into the car in reach on the act key', async () => {
    const keys = bound({ aimed: wheel })
    await keys.user.keyboard('e')
    expect(keys.got()).toBe(1)
  })

  it('says the way to the quest being followed', async () => {
    const keys = bound()
    await keys.user.keyboard('g')
    expect(keys.notes).toEqual(['The Copper Wheel: 40 m, head east'])
  })

  it('turns the hour, the weather and the clock itself over', async () => {
    const keys = bound()
    await keys.user.keyboard('t')
    expect(keys.clock.hour).toBe(12)

    await keys.user.keyboard('k')
    expect(keys.clock.weather).toBe('overcast')

    await keys.user.keyboard('p')
    expect(keys.clock.paused).toBe(true)
    expect(keys.notes).toEqual(['12:00, the middle of the day', 'Cloud rolls in', 'Time held'])
  })

  it('hears none of it while the player is writing to somebody', async () => {
    const keys = bound({ aimed: wheel, typing: true })
    await keys.user.keyboard('etgkp')
    expect(keys.got()).toBe(0)
    expect(keys.notes).toEqual([])
    expect(keys.clock.hour).toBe(8)
  })

  it('hears none of it once the keys have been handed to the panel over the top', async () => {
    const keys = bound({ aimed: wheel })
    keys.body.setTyping(true)

    // naming a city is typing, and the game is bound on the document under it
    await keys.user.keyboard('etgkp')
    expect(keys.got()).toBe(0)
    expect(keys.clock.hour).toBe(8)
    expect(keys.clock.weather).toBe('clear')

    // and it has them back the moment the panel gives them up
    keys.body.setTyping(false)
    await keys.user.keyboard('t')
    expect(keys.clock.hour).toBe(12)
  })

  it('hears none of it while a text box anywhere on the page has the caret', async () => {
    const keys = bound({ aimed: wheel })
    const box = document.createElement('input')
    box.type = 'text'
    document.body.append(box)
    box.focus()

    // every space would be swallowed as a jump, and the t, the k and the p
    // would turn the hour and the weather over on their way into the box
    await keys.user.type(box, 'quiet coastal town')
    expect(box.value).toBe('quiet coastal town')
    expect(keys.clock.hour).toBe(8)
    expect(keys.clock.weather).toBe('clear')
    expect(keys.clock.rate).toBeGreaterThan(0)
    expect(keys.got()).toBe(0)
  })
})

/**
 * A bar with the ledger lying on one end of the counter and a strongbox at the
 * other, and the job of moving it from one to the other. The world puts the
 * ledger 45 cm to its anchor's own right, which facing south is west of it.
 */
function withALedger() {
  const world = World.create({ name: 'Fordwater', theme: 'plain', seed: 'stash', width: 24, height: 14 })
  const plot = world.addPlot({
    kind: 'bar',
    name: 'The Copper Wheel',
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
    furniture: [],
    anchors: [
      { id: 'anchor_0001', kind: 'serve', roomId: 'room_0001', pos: { x: 3, y: 3 }, rot: 180 },
      { id: 'anchor_0002', kind: 'serve', roomId: 'room_0001', pos: { x: 11, y: 3 }, rot: 180 },
    ],
  })
  if (!inside.ok) throw new Error(JSON.stringify(inside.error))

  const ledger = world.addItem(
    { id: 'item_0001', name: 'Ledger', description: 'A cloth-bound book of debts.', archetype: 'ledger', value: 5, bulk: 'pocket' },
    { at: 'anchor', itemId: 'item_0001', interiorId: 'interior_0001', anchorId: 'anchor_0001' },
  )
  if (!ledger.ok) throw new Error(JSON.stringify(ledger.error))
  return { world, plotId: plot.value.id }
}

/** Whatever came back, or the reason it did not. */
function loaded<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

/** Take the ledger off one end of the counter and leave it at the other. */
function tidyingUp() {
  const doc = {
    format: 'game-box.quest',
    schemaVersion: 1,
    id: 'quest_0001',
    kind: 'main',
    title: 'Out of sight',
    summary: 'The ledger should not be lying where the licensing man can read it.',
    giverNpcId: 'npc_0001',
    difficulty: 'small',
    startStepId: 'step_0001',
    reward: rewardFor('small'),
    steps: [
      { id: 'step_0001', objective: 'Pick the ledger up', kind: 'collect', itemId: 'item_0001', next: ['step_0002'] },
      {
        id: 'step_0002',
        objective: 'Put it in the strongbox',
        kind: 'stash',
        itemId: 'item_0001',
        interiorId: 'interior_0001',
        anchorId: 'anchor_0002',
        next: ['step_0003'],
      },
      { id: 'step_0003', objective: 'Done', kind: 'complete' },
    ],
  }
  const checked = validateQuest(doc, anyWorld)
  if (!checked.ok) throw new Error(JSON.stringify(checked.error))
  return checked.value
}

/**
 * The bar, walked into, with the real key handler bound to it: nothing here
 * reports a quest event of its own, so the only way the job moves is the player
 * pressing the key on something that is actually in front of them.
 */
function inTheBar(kept?: { player: unknown; quests: unknown }) {
  const { world, plotId } = withALedger()
  const quests = [tidyingUp()]
  const player = kept ? loaded(PlayerState.load(kept.player, world.id)) : PlayerState.create(world.id)
  const log = kept ? loaded(QuestLog.load(kept.quests, quests, player)) : QuestLog.create(quests, player)
  if (!kept) log.start('quest_0001')

  const patches: HudPatch[] = []
  const notices: Notice[] = []
  const hud = {
    typing: false,
    show: (patch: HudPatch) => void patches.push(patch),
    announce: (notice: Notice) => void notices.push(notice),
  } as unknown as Hud

  const art = new CityArt(new Greybox())
  const city = doorwaysOnly(world, new Map([[plotId, { x: 11, z: 13 }]]), art)
  const street = { solid: () => () => false, floor: () => () => 0, walkers: () => [] } as unknown as Street
  const report = new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock) })
  const locks = lockUp({ world, player, log, report })
  const buildings = new Buildings({
    world,
    player,
    locks,
    art,
    stage: { show: () => {}, indoors: () => {} } as unknown as Stage,
    body: { setSolid: () => {}, setGround: () => {}, placeAt: () => {}, position: { x: 11, z: 13 } } as unknown as Player,
    city,
    sky: { visible: true } as unknown as Sky,
    street,
    announce: () => {},
    arrived: () => {},
    cameOut: () => {},
    away: () => [],
  })
  buildings.enter(plotId)

  const stashing = new Stashing({ world, log, player, buildings, report })
  const driving = { aboard: false, target: () => undefined, act: () => {} } as unknown as Driving
  const { machines, counters } = fittings({ world, player, log, hud, report, buildings, locks })
  const targeting = new Targeting({ world, city, buildings, stashing, street, driving, locks, machines })

  const { camera, element } = stage()
  // where the player is standing and which way they are looking, so the key
  // acts on whatever the crosshair is actually on
  let standing: { at: Vec2; heading: number } = { at: { x: 7, z: 6 }, heading: 0 }
  const interaction = new Interaction({
    element,
    world,
    player,
    log,
    hud,
    body: new Player(camera, element, nowhere),
    buildings,
    stashing,
    talking: { active: false } as Talking,
    companions: {} as Companions,
    driving,
    chase: new Chase({ camera, driving, hud }),
    locks,
    machines,
    openMap: () => {},
    guide: { say: () => undefined } as unknown as Guide,
    conditions: new Conditions(player.clock),
    report,
    aimed: () => pick(standing.at, standing.heading, targeting.list(standing.at)),
  })
  close.push(() => interaction.dispose())

  return {
    log,
    player,
    patches,
    buildings,
    /** What the player could act on from where they are standing. */
    listed: () => targeting.list(standing.at),
    user: userEvent.setup(),
    /** Everything the playthrough is written down as, for opening the city again. */
    kept: () => JSON.parse(JSON.stringify({ player: player.toJSON(), quests: log.toJSON() })) as { player: unknown; quests: unknown },
    /** Walk up to something and look at it. North is the way the counter is. */
    standAt: (at: Vec2) => void (standing = { at, heading: 0 }),
    prompt: () => pick(standing.at, standing.heading, targeting.list(standing.at))?.label,
  }
}

describe('putting a thing down', () => {
  // the counter runs along the north wall: stand a step south of each end
  const byTheLedger = { x: 2.55, z: 4.2 }
  const byTheStrongbox = { x: 11, z: 4.2 }

  it('finishes a job that says to leave something somewhere, with no key but the one that takes it', async () => {
    const bar = inTheBar()

    bar.standAt(byTheLedger)
    expect(bar.prompt()).toBe('Take the ledger')
    await bar.user.keyboard('e')
    expect(bar.player.inventory()).toEqual(['item_0001'])

    // and now, and only now, the far end of the counter is somewhere to put it
    bar.standAt(byTheStrongbox)
    expect(bar.prompt()).toBe('Leave the ledger here')
    await bar.user.keyboard('e')

    expect(bar.player.inventory()).toEqual([])
    expect(bar.log.status('quest_0001')).toBe('complete')

    // and it is lying on that surface, not gone: the same crosshair that put it
    // down offers it back, which is the only way to see it was ever put down
    expect(bar.prompt()).toBe('Take the ledger')
    await bar.user.keyboard('e')
    expect(bar.player.inventory()).toEqual(['item_0001'])
  })

  it('offers nowhere to leave anything until a job asks for it and the thing is in hand', async () => {
    const bar = inTheBar()
    bar.standAt(byTheStrongbox)

    // empty-handed the strongbox is not a prompt at all: a put-down that
    // appears with nothing to put down is a key that does nothing
    expect(bar.listed().filter((target) => target.kind === 'stash')).toEqual([])
    expect(bar.prompt()).toBeUndefined()

    bar.standAt(byTheLedger)
    await bar.user.keyboard('e')
    bar.standAt(byTheStrongbox)
    expect(bar.prompt()).toBe('Leave the ledger here')

    // and it goes again the moment the thing is out of their hands
    bar.player.drop('item_0001')
    expect(bar.prompt()).toBeUndefined()
  })

  it('is still on the strongbox when the city is opened again, and not back on its shelf as well', async () => {
    const bar = inTheBar()
    bar.standAt(byTheLedger)
    await bar.user.keyboard('e')
    bar.standAt(byTheStrongbox)
    await bar.user.keyboard('e')
    expect(bar.player.inventory()).toEqual([])

    // the page is reloaded: the city is built again from its own file, which
    // says where everything started, and the playthrough says what has moved
    const again = inTheBar(bar.kept())

    again.standAt(byTheLedger)
    expect(again.prompt()).toBeUndefined()
    again.standAt(byTheStrongbox)
    expect(again.prompt()).toBe('Take the ledger')

    // and there is one ledger in the room, not the one the file drew plus the
    // one the player left, either of which could be picked up
    expect(again.listed().filter((target) => target.kind === 'take')).toHaveLength(1)
  })

  it('is not drawn on its shelf as well while the player is carrying it', async () => {
    const bar = inTheBar()
    bar.standAt(byTheLedger)
    await bar.user.keyboard('e')

    const again = inTheBar(bar.kept())
    expect(again.player.inventory()).toEqual(['item_0001'])

    // the same thing in a pocket and on a shelf is two of it, and taking the
    // second one puts a thing in the world twice under one id
    again.standAt(byTheLedger)
    expect(again.prompt()).toBeUndefined()
    expect(again.listed().filter((target) => target.kind === 'take')).toEqual([])
  })

  it('leaves it where the job asked and not at the first surface in the room', async () => {
    const bar = inTheBar()
    bar.standAt(byTheLedger)
    await bar.user.keyboard('e')

    // the shelf it was lying on is not the shelf it belongs on, and putting it
    // back where it came from must not credit the step
    expect(bar.prompt()).toBeUndefined()
    await bar.user.keyboard('e')
    expect(bar.player.inventory()).toEqual(['item_0001'])
    expect(bar.log.status('quest_0001')).toBe('active')
  })
})

describe('what the settings tab does to the screen', () => {
  function tab() {
    const pushed: HudPatch[] = []
    const hud = { show: (patch: HudPatch) => void pushed.push(patch), announce: () => {} } as unknown as Hud
    const player = PlayerState.create('world_0001')
    const log = QuestLog.create([], player)
    const conditions = new Conditions(player.clock)
    let report: Reporting
    const view = new View(() => report.refresh())
    report = new Reporting({ world: World.create({ name: 'Fordwater', theme: 'plain', seed: 'screen', width: 24, height: 14 }), log, player, hud, conditions, view })
    let left = 0
    const intents = new Intents({
      log,
      hud,
      report,
      talking: { say: async () => {}, choose: async () => {}, end: () => {} } as unknown as Talking,
      body: { setTyping: () => {} } as unknown as Player,
      chart: { open: false } as unknown as Chart,
      conditions,
      machines: {} as Machines,
      counters: {} as Counters,
      travel: {} as Travel,
      view,
      leave: () => void left++,
      releasePointer: () => {},
    })
    return { intents, view, pushed, left: () => left, settings: () => pushed.filter((patch) => patch.settings).at(-1)!.settings! }
  }

  it('draws the corner view or takes it off, and the tab reads what the game pushed back', () => {
    const { intents, settings } = tab()
    intents.handle({ kind: 'weather', weather: 'clear' })
    expect(settings().minimap).toBe(true)

    intents.handle({ kind: 'minimap', shown: false })
    expect(settings().minimap).toBe(false)
    intents.handle({ kind: 'minimap', shown: true })
    expect(settings().minimap).toBe(true)
  })

  it('goes full screen through the browser and reads the answer off the document, not off the click', () => {
    const asked: boolean[] = []
    let filling: Element | null = null
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => filling })
    document.documentElement.requestFullscreen = () => {
      asked.push(true)
      return Promise.resolve()
    }
    document.exitFullscreen = () => {
      asked.push(false)
      return Promise.resolve()
    }

    const { intents, view, settings } = tab()
    intents.handle({ kind: 'weather', weather: 'clear' })
    expect(settings().fullscreen).toBe(false)

    // the click is a request, and the browser may refuse it or the player may
    // leave with a key of its own, so nothing is pushed until the document says
    intents.handle({ kind: 'fullscreen', on: true })
    expect(asked).toEqual([true])
    expect(settings().fullscreen).toBe(false)

    filling = document.documentElement
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(settings().fullscreen).toBe(true)

    intents.handle({ kind: 'fullscreen', on: false })
    filling = null
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(asked).toEqual([true, false])
    expect(settings().fullscreen).toBe(false)
    view.dispose()
  })

  it('hands the game back on the answer the interface already asked for, and does nothing with the other one', () => {
    const { intents, left, view } = tab()
    // the interface asks "you sure" in place, so this arrives having been said
    // yes to: asking a second time on the way out would be asking twice
    intents.handle({ kind: 'exit' })
    expect(left()).toBe(1)
    intents.handle({ kind: 'stay' })
    expect(left()).toBe(1)
    view.dispose()
  })
})
