import { PlayerState } from '@gb/play'
import { validateQuest, type QuestDoc } from '@gb/quest'
import { isMachineProp, questView, type Interior, type World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Forge, OfflineNarrator, summarise, type InstanceRequest } from '../src/index.ts'
import { GAMES } from '../src/interior/machines.ts'
import { stationsWanted } from '../src/layout/stations.ts'
import { City } from './city.ts'
import { buildTold, LOCKUP } from './histories.ts'
import { Player } from './player.ts'
import { meeting, openLog } from './playable.ts'
import { buildTown } from './support.ts'

/**
 * The instance brief: what a place's plan says it contains beyond its people
 * and its stock, so the quest writer downstream can build a line on it. A lock
 * with its key in somebody's pocket, a screen with a program and a code, a
 * camera over the door, a home for sale with its deed on a counter, somewhere
 * to board.
 */

/** The offline narrator, keeping every place it was asked to write. */
class Recording extends OfflineNarrator {
  readonly requests: InstanceRequest[] = []
  override async writeInstances(requests: readonly InstanceRequest[]) {
    this.requests.push(...requests)
    return super.writeInstances(requests)
  }
}

const narrator = new Recording('club-1')
const club = await new Forge(narrator).build({ theme: 'dense neon port city', seed: 'club-1', blocksX: 3, blocksY: 3 })
if (!club.ok) throw new Error(JSON.stringify(club.error).slice(0, 400))
const neon = club.value.world
const lockup = await buildTold('lockup-brief', LOCKUP)
const towns = await Promise.all([
  buildTown('brief-1'),
  buildTown('brief-2', { blocksX: 4, blocksY: 4 }),
  buildTown('brief-3', { theme: 'dense neon port city', blocksX: 5, blocksY: 5 }),
  buildTown('brief-4', { theme: 'quiet coastal town', blocksX: 8, blocksY: 8 }),
])

/** The one interior of a kind that opens. */
const inside = (world: World, kind: string): Interior => {
  const found = world.interiors().find((interior) => interior.kind === kind)
  if (!found) throw new Error(`no ${kind} opens`)
  return found
}

const doorsLocked = (interior: Interior) => interior.doors.filter((door) => door.locked)

describe('locks', () => {
  it('locks a room the charter marks shut, puts its key in the pocket of somebody in front of the door, and something worth having behind it', () => {
    // the offline disco admits people only so far: its cellar is shut
    const disco = inside(neon, 'disco')
    const [cellar, ...more] = doorsLocked(disco)
    expect(cellar, 'nothing in the disco is locked').toBeDefined()
    expect(more).toEqual([])
    expect(cellar!.from).not.toBe('outside')
    expect(disco.rooms.find((room) => room.id === cellar!.to)?.name).toBe('Cellar')
    expect(cellar!.password, 'a disco has no keypad').toBeUndefined()

    const key = neon.item(cellar!.keyItemId!)!
    expect(key.archetype).toBe('key')
    expect(key.opens).toEqual({ doorId: cellar!.id })
    expect(key.name).toBe('Cellar key')
    const held = neon.placements().find((placement) => placement.itemId === key.id)!
    expect(held.at).toBe('npc')
    const keeper = neon.npc((held as { npcId: string }).npcId)!
    expect(keeper.station?.interiorId).toBe(disco.id)
    expect(disco.anchors.find((anchor) => anchor.id === keeper.station!.anchorId)?.roomId, 'the keeper is locked in with the key').not.toBe(cellar!.to)
    expect(key.ownerNpcId).toBe(keeper.id)

    // a worn place bars its locked door, and a camera watches the way in
    expect(disco.furniture.find((piece) => piece.prop === 'bars-door')?.doorId).toBe(cellar!.id)
    const camera = disco.furniture.find((piece) => piece.prop === 'camera')!
    expect(camera.watches).toBe(disco.doors.find((door) => door.from === 'outside')!.to)
    expect(camera.lift).toBeGreaterThan(2)

    // and there is something in the cellar to lock up
    const behind = neon.placements().filter((placement) => placement.at === 'anchor' && placement.interiorId === disco.id && disco.anchors.find((anchor) => anchor.id === placement.anchorId)?.roomId === cellar!.to)
    expect(behind.length).toBeGreaterThan(0)
    expect(neon.check()).toEqual([])
  })

  it('locks the street door of a private place behind a code, with a card for the whole interior in a pocket inside', () => {
    const villa = inside(lockup.world, 'villa')
    const street = villa.doors.find((door) => door.from === 'outside')!
    expect(street.locked).toBe(true)
    expect(street.password).toMatch(/^[a-z]+-\d\d$/)
    const card = lockup.world.item(street.keyItemId!)!
    expect(card.archetype).toBe('keycard')
    expect(card.opens).toEqual({ interiorId: villa.id })
    const held = lockup.world.placements().find((placement) => placement.itemId === card.id)!
    expect(held.at).toBe('npc')
    expect(lockup.world.npc((held as { npcId: string }).npcId)?.station?.interiorId).toBe(villa.id)
    expect(villa.furniture.some((piece) => piece.prop === 'camera')).toBe(true)
    // whose home it is: the person who lives there
    expect(villa.owner).toBe((held as { npcId: string }).npcId)

    // a place that works at desks writes a code beside the key, in the finish that issues cards, behind bars in a civic one
    const jail = inside(lockup.world, 'jail')
    const evidence = doorsLocked(jail).find((door) => door.from !== 'outside')!
    expect(jail.rooms.find((room) => room.id === evidence.to)?.name).toBe('Evidence room')
    expect(evidence.password).toBeDefined()
    expect(lockup.world.item(evidence.keyItemId!)?.archetype).toBe('keycard')
    expect(jail.furniture.find((piece) => piece.prop === 'bars-door')?.doorId).toBe(evidence.id)
    expect(lockup.world.check()).toEqual([])
  })

  it('locks nothing in an open place, whatever its rooms are called', () => {
    for (const { world } of towns) {
      for (const interior of world.interiors()) {
        if (world.charter(interior.kind)!.access === 'open') expect(doorsLocked(interior), `${interior.kind} locks a door`).toEqual([])
      }
    }
  })
})

describe('screens and cameras', () => {
  const every = [neon, lockup.world, ...towns.map((town) => town.world)]

  it('puts a screen on every office desk, the reception counter, the bar and the household desk, each with a program and a code', () => {
    let desks = 0
    let games = 0
    for (const world of every) {
      const ids = new Set<string>()
      for (const interior of world.interiors()) {
        const hosts = new Map(interior.furniture.map((piece) => [piece.id, piece.prop]))
        for (const piece of interior.furniture) {
          if (!isMachineProp(piece.prop)) continue
          const machine = piece.machine!
          expect(ids.has(machine.id), `${machine.id} is taken twice`).toBe(false)
          ids.add(machine.id)
          expect(piece.on, `${piece.prop} stands on nothing`).toBeDefined()
          const host = hosts.get(piece.on!)
          if (host === 'desk') desks++
          if (GAMES.includes(machine.program)) {
            games++
            expect(host, 'a game on a working screen').toBe('bar-counter')
            expect(machine.locked).toBe(false)
          } else {
            expect(machine.locked, `${machine.program} is open to anybody`).toBe(true)
            expect(machine.password).toMatch(/^[a-z]+-\d\d$/)
          }
        }
        // a place that works at desks has a screen on every desk somebody sits at
        if (world.charter(interior.kind)!.work.includes('desk')) {
          const chairs = interior.furniture.filter((piece) => piece.prop === 'office-chair').length
          const screens = interior.furniture.filter((piece) => isMachineProp(piece.prop) && hosts.get(piece.on!) === 'desk').length
          expect(screens, `${interior.kind} has ${chairs} chairs at desks and ${screens} screens`).toBe(chairs)
        }
        if (interior.kind === 'bar') expect(interior.furniture.some((piece) => piece.prop === 'monitor' && GAMES.includes(piece.machine!.program)), 'a bar with no game on the counter').toBe(true)
        if (world.charter(interior.kind)!.residential && interior.furniture.some((piece) => piece.prop === 'office-chair')) {
          expect(interior.furniture.some((piece) => piece.prop === 'laptop'), `a home desk somebody sits at with nothing on it`).toBe(true)
        }
      }
    }
    expect(desks).toBeGreaterThan(5)
    expect(games).toBeGreaterThan(1)
  })

  it('hangs a camera where a place keeps watch or admits people only so far, and one screen there shows it', () => {
    let watched = 0
    for (const world of every) {
      for (const interior of world.interiors()) {
        const charter = world.charter(interior.kind)!
        const camera = interior.furniture.find((piece) => piece.prop === 'camera')
        const keeps = charter.work.includes('watch') || charter.access !== 'open'
        expect(camera !== undefined, `${interior.kind} ${keeps ? 'keeps watch with no camera' : 'hangs a camera for nothing'}`).toBe(keeps)
        if (!camera) continue
        watched++
        expect(interior.rooms.some((room) => room.id === camera.watches)).toBe(true)
        const feeds = interior.furniture.filter((piece) => piece.machine?.program === 'camera-feed')
        const screens = interior.furniture.filter((piece) => piece.machine && !GAMES.includes(piece.machine.program))
        expect(feeds.length, `${interior.kind} has a camera and ${screens.length} screens, none showing it`).toBe(screens.length ? 1 : 0)
      }
    }
    expect(watched).toBeGreaterThan(2)
  })
})

describe('a home for the player, and somewhere to board', () => {
  it('puts one home up for sale in every town, more in a bigger one, its deed priced on a counter, and gives every other home to whoever lives there', () => {
    const sales = new Map<string, number>()
    for (const { world } of [...towns, club.value]) {
      const forSale = world.interiors().filter((interior) => interior.forSale !== undefined)
      expect(forSale.length, `${world.name} has nothing for sale`).toBeGreaterThan(0)
      sales.set(world.name, forSale.length)
      for (const home of forSale) {
        expect(world.charter(home.kind)!.residential).toBe(true)
        expect(home.owner).toBeUndefined()
        expect(world.npcs().some((npc) => npc.station?.interiorId === home.id), `${world.name} sells a home with somebody in it`).toBe(false)
        const deed = world.items().find((item) => item.deedTo === home.id)!
        expect(deed.archetype).toBe('deed')
        expect(deed.value).toBe(home.forSale)
        expect(deed.name).toBe(`Deed to ${world.plot(home.plotId)!.name}`)
        // on a counter, with somebody to sell it
        const lying = world.placements().find((placement) => placement.itemId === deed.id)!
        expect(lying.at).toBe('anchor')
        const { interiorId, anchorId } = lying as { interiorId: string; anchorId: string }
        expect(interiorId).not.toBe(home.id)
        expect(world.interior(interiorId)!.anchors.find((anchor) => anchor.id === anchorId)?.kind).toBe('serve')
        expect(deed.ownerNpcId).toBeDefined()
        expect(world.npc(deed.ownerNpcId!)?.station?.interiorId).toBe(interiorId)
      }
      for (const interior of world.interiors()) {
        if (!world.charter(interior.kind)!.residential || interior.forSale !== undefined) continue
        const living = world.npcs().filter((npc) => npc.station?.interiorId === interior.id)
        if (!living.length) continue
        expect(living.map((npc) => npc.id)).toContain(interior.owner)
        for (const npc of living) expect(npc.homePlotId).toBe(interior.plotId)
      }
    }
    expect(Math.max(...sales.values())).toBeGreaterThan(Math.min(...sales.values()))
    // and the bigger town keeps one home lived in beside the ones on the market
    const city = towns[3]!.world
    expect(city.interiors().filter((interior) => city.charter(interior.kind)!.residential && interior.forSale === undefined && interior.owner !== undefined).length).toBeGreaterThan(0)
  })

  it('puts a station in any town of four blocks, two at twenty, a walk apart', async () => {
    expect(stationsWanted(1)).toBe(0)
    expect(stationsWanted(4)).toBe(1)
    expect(stationsWanted(20)).toBe(2)
    expect(stationsWanted(400)).toBe(21)
    const [four, twenty] = await Promise.all([buildTown('stations-4', { blocksX: 2, blocksY: 2 }), buildTown('stations-20', { blocksX: 4, blocksY: 5 })])
    expect(four.world.stations().length).toBeGreaterThanOrEqual(1)
    const stations = twenty.world.stations()
    expect(stations.length).toBeGreaterThanOrEqual(2)
    const apart = Math.max(...stations.flatMap((a) => stations.map((b) => Math.hypot(a.entrance.cell.x - b.entrance.cell.x, a.entrance.cell.y - b.entrance.cell.y))))
    expect(apart * twenty.world.cellSize, 'the stations are on one corner').toBeGreaterThan(100)
    for (const station of stations) expect(twenty.world.charter(station.kind)?.transit).toBe('subway')
  })
})

describe('what the writers are told', () => {
  it('briefs the narrator on the locks, the screens, the camera and the sale of every place it writes', () => {
    const disco = narrator.requests.find((request) => request.kind === 'disco')!
    expect(disco.has.locked).toEqual([{ room: 'Cellar', by: 'key' }])
    expect(disco.has.camera).toBe(true)
    expect(disco.has.machines.length).toBeGreaterThan(0)
    // the key is named here, never by the narrator
    expect(disco.things.some((thing) => thing.archetype === 'key')).toBe(false)
    const sale = narrator.requests.find((request) => request.has.forSale !== undefined)!
    expect(sale.posts).toEqual([])
    expect(neon.interiors().find((interior) => interior.forSale === sale.has.forSale)).toBeDefined()
    const office = narrator.requests.find((request) => request.kind === 'office')!
    expect(office.has.machines.map((machine) => machine.program)).toContain('ledger')
  })

  it('summarises the locks, the screens, the prices and the sale for the quest writer', () => {
    const summary = summarise(neon, neon.premise())
    const disco = summary.places.find((place) => place.kind === 'disco' && place.interiorId)!
    const [lock] = disco.locks!
    expect(lock!.room).toBe('Cellar')
    expect(lock!.keeperNpcId).toBeDefined()
    expect(disco.npcs.map((npc) => npc.npcId)).toContain(lock!.keeperNpcId)
    expect(lock!.behind.length).toBeGreaterThan(0)
    expect(summary.places.some((place) => place.forSale !== undefined)).toBe(true)
    const feeds = [lockup.world, ...towns.map((town) => town.world)].flatMap((world) => summarise(world).places.flatMap((place) => (place.machines ?? []).filter((machine) => machine.program === 'camera-feed')))
    expect(feeds.length, 'no screen anywhere shows a camera').toBeGreaterThan(0)
    for (const feed of feeds) expect(feed.locked && feed.password !== undefined).toBe(true)
    for (const item of summary.places.flatMap((place) => place.items)) expect(item.value).toBeGreaterThanOrEqual(0)
  })
})

describe('the harness at a locked door', () => {
  const disco = inside(neon, 'disco')
  const cellar = doorsLocked(disco)[0]!
  const behind = neon.placements().find((placement) => placement.at === 'anchor' && placement.interiorId === disco.id && disco.anchors.find((anchor) => anchor.id === placement.anchorId)?.roomId === cellar.to)!
  const keeper = (neon.placements().find((placement) => placement.itemId === cellar.keyItemId) as { npcId: string }).npcId
  const giver = neon.npcs().find((npc) => npc.station?.interiorId !== disco.id)!

  /** A fetch of the thing in the cellar, written with or without a way through the door. */
  function fetch(withKey: boolean): QuestDoc {
    const steps = [
      ...(withKey
        ? [
            { id: 'step_0001', kind: 'talk', npcId: keeper, objective: 'Ask for the key', effects: [{ kind: 'give-item', itemId: cellar.keyItemId }], next: ['step_0002'] },
            { id: 'step_0002', kind: 'unlock', doorId: cellar.id, objective: 'Open the cellar', next: ['step_0003'] },
          ]
        : []),
      { id: 'step_0003', kind: 'collect', itemId: behind.itemId, allowSteal: true, objective: 'Take it', next: ['step_0004'] },
      { id: 'step_0004', kind: 'deliver', itemId: behind.itemId, toNpcId: giver.id, objective: 'Bring it back', next: ['step_0005'] },
      { id: 'step_0005', kind: 'complete', objective: 'Done' },
    ]
    const doc = {
      format: 'game-box.quest', schemaVersion: 1, id: 'quest_0099', kind: 'side', title: withKey ? 'With the key' : 'Without the key', summary: 'The thing in the cellar.',
      giverNpcId: giver.id, startStepId: steps[0]!.id, steps, reward: { money: 20, reputation: 2, faction: 'town', items: [] },
    }
    const valid = validateQuest(doc, questView(neon))
    if (!valid.ok) throw new Error(JSON.stringify(valid.error).slice(0, 400))
    return valid.value
  }

  function play(quest: QuestDoc) {
    const state = PlayerState.create(neon.id)
    meeting(quest, state)
    const log = openLog([quest], state)
    expect(log.start(quest.id).ok).toBe(true)
    return new Player(log, state, new City(neon)).play(quest)
  }

  it('reports a thing behind a lock as out of reach, and the same thing reachable once the key is in hand', () => {
    const shut = play(fetch(false))
    expect(shut.completable).toBe(false)
    expect(shut.shut).toEqual(['step_0003'])
    expect(shut.stranded).toEqual([])

    const opened = play(fetch(true))
    expect(opened.completable, JSON.stringify(opened)).toBe(true)
    expect(opened.shut).toEqual([])
  })

  it('buys over a counter only with the money in hand, and takes off the shelf otherwise', () => {
    // a thing with a price and an owner, out in front of any lock
    const priced = neon.items().find((item) => item.ownerNpcId && item.value > 0 && item.opens === undefined && item.deedTo === undefined && neon.placements().some((placement) => placement.itemId === item.id && placement.at === 'anchor' && placement.interiorId !== disco.id))!
    const seller = neon.npc(priced.ownerNpcId!)!
    const doc = {
      format: 'game-box.quest', schemaVersion: 1, id: 'quest_0098', kind: 'side', title: 'Shopping', summary: 'Buy it.', giverNpcId: giver.id, startStepId: 'step_0001',
      steps: [
        { id: 'step_0001', kind: 'buy', itemId: priced.id, objective: 'Buy it', next: ['step_0002'] },
        { id: 'step_0002', kind: 'complete', objective: 'Bought' },
      ],
      reward: { money: 20, reputation: 2, faction: 'town', items: [] },
      requires: [{ kind: 'money-at-least', amount: priced.value }],
    }
    const valid = validateQuest(doc, questView(neon))
    if (!valid.ok) throw new Error(JSON.stringify(valid.error).slice(0, 400))
    const quest = valid.value

    // with the money: bought, and paid for
    const rich = PlayerState.create(neon.id)
    meeting(quest, rich)
    const log = openLog([quest], rich)
    expect(log.start(quest.id).ok).toBe(true)
    const bought = new Player(log, rich, new City(neon)).play(quest)
    expect(bought.completable).toBe(true)
    expect(rich.isStolen(priced.id)).toBe(false)
    expect(seller.id).toBe(priced.ownerNpcId)

    // without it: the thing is lifted, and a buy is not credited by a theft
    const poor = PlayerState.create(neon.id)
    const log2 = openLog([quest], poor)
    expect(log2.start(quest.id).ok).toBe(false)
  })
})
