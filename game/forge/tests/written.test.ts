import { err, ok } from '@gb/kit'
import { PlayerState } from '@gb/play'
import { validateQuest, type QuestDoc } from '@gb/quest'
import { isMachineProp, questView, ROOM_USES, World, type Item } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Forge, questTargets, summarise, type Instance, type InstanceRequest, type Narrator, type PlaceRequest, type DistrictRequest } from '../src/index.ts'
import { GAMES } from '../src/interior/machines.ts'
import { headOf } from '../src/narrator/places.ts'
import { City } from './city.ts'
import { openLog, playEvery, line } from './playable.ts'
import { Player } from './player.ts'
import { RECORDED_BRIEF, Recorded, recordedCity, recordedHistory } from './recorded.ts'
import { Street } from './street.ts'
import { digest } from './support.ts'

/**
 * The city with its words in it, built out of what the local model actually
 * wrote (`recorded.ts`). Everything a build promises beyond the architecture is
 * measured here: the names over the doors, the people at their posts, what is
 * lying about and what it costs, and the work that strings them together.
 */

const narrator = new Recorded()
const built = await recordedCity(narrator)
const { world, quests } = built

/** Every id a quest names, wherever in the document it is written. */
const idsIn = (quest: QuestDoc): Set<string> => new Set(JSON.stringify(quest).match(/\b(?:npc|item|plot|interior|anchor|door|machine)_\d+\b/g) ?? [])

/** Whether the city holds the thing an id names. */
function resolves(city: World, id: string): boolean {
  const [kind] = id.split('_')
  if (kind === 'npc') return city.npc(id) !== undefined
  if (kind === 'item') return city.item(id) !== undefined
  if (kind === 'plot') return city.plot(id) !== undefined
  if (kind === 'interior') return city.interior(id) !== undefined
  if (kind === 'door') return city.door(id) !== undefined
  if (kind === 'machine') return city.machine(id) !== undefined
  return city.interiors().some((interior) => interior.anchors.some((anchor) => anchor.id === id))
}

/** Everybody one quest names: who hands it out, who it sends the player to, who it wants a thing delivered to. */
function named(quest: QuestDoc): Set<string> {
  const people = new Set([quest.giverNpcId])
  for (const step of quest.steps) {
    if (step.kind === 'talk' || step.kind === 'escort') people.add(step.npcId)
    if (step.kind === 'deliver') people.add(step.toNpcId)
    for (const effect of step.effects) if (effect.kind === 'companion-join') people.add(effect.npcId)
  }
  return people
}

/** Everything inside one place: what lies on its surfaces, and what the people standing in it carry. */
function itemsIn(interiorId: string): Item[] {
  const stationed = new Set(world.npcs().filter((npc) => npc.station?.interiorId === interiorId).map((npc) => npc.id))
  return world
    .placements()
    .filter((placement) => (placement.at === 'anchor' ? placement.interiorId === interiorId : placement.at === 'npc' && stationed.has(placement.npcId)))
    .map((placement) => world.item(placement.itemId)!)
}

/** Every written line in a quest, with the field it was written in. */
function prose(value: unknown, field = '', out: [string, string][] = []): [string, string][] {
  if (typeof value === 'string') out.push([field, value])
  else if (Array.isArray(value)) for (const one of value) prose(one, field, out)
  else if (value && typeof value === 'object') for (const [key, one] of Object.entries(value)) prose(one, key, out)
  return out
}

describe('a city somebody wrote', () => {
  it('builds a sound city with streets, buildings, people and things', () => {
    expect(world.check()).toEqual([])
    expect(world.name.length).toBeGreaterThan(3)
    expect(world.plots().length).toBeGreaterThan(8)
    expect(world.npcs().length).toBeGreaterThan(5)
    expect(world.items().length).toBeGreaterThan(5)
    expect(world.interiors().length).toBeLessThan(world.plots().length)
    expect(built.dropped).toEqual([])

    // every room says which routine dressed it, so a furnisher reads the room and no table of kinds
    for (const interior of world.interiors()) {
      for (const room of interior.rooms) expect(ROOM_USES, `${interior.id}/${room.id} carries no use`).toContain(room.use)
    }
    // every NPC stands on an anchor that exists, doing something that has a name
    for (const npc of world.npcs()) {
      const interior = world.interior(npc.station!.interiorId)!
      const anchor = interior.anchors.find((a) => a.id === npc.station!.anchorId)!
      expect(anchor, `${npc.name} stands nowhere`).toBeDefined()
      expect(anchor.kind.length).toBeGreaterThan(0)
    }
    // nobody shares a name
    const names = world.npcs().map((npc) => npc.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('writes a name over every placeholder the architecture carried', () => {
    expect(world.name).not.toBe('City')
    for (const zone of world.districts()) expect(zone.name, `${zone.id} was never named`).not.toMatch(/^Zone \d+$/)
    for (const plot of world.plots()) expect(plot.name, `${plot.id} was never named`).not.toMatch(/^Instance \d+$/)
    // the pool this box composes a sign from deals each head word out once, so
    // the signs it wrote itself cannot collide; what a narrator answers is taken
    // as written, and on this city the model put one head over two doors twice
    const heads = world.plots().map((plot) => headOf(plot.name).toLowerCase())
    expect(new Set(heads).size).toBeGreaterThan(heads.length - 4)
    // no part of town is called what another part is called
    const zones = world.districts().map((zone) => zone.name.toLowerCase())
    expect(new Set(zones).size).toBe(zones.length)
  })

  it('opens exactly the doors the brief asked for, and closes the rest all the way through', () => {
    const open = new Set(world.interiors().map((interior) => interior.plotId))
    expect(open.size).toBe(world.interiors().length)
    for (const plot of world.plots()) {
      if (open.has(plot.id)) continue
      expect(world.npcsIn(plot.id), `${plot.name} is shut and still has people in it`).toEqual([])
    }
    // and no door opens onto an empty room
    for (const interior of world.interiors()) {
      expect(world.npcsIn(interior.plotId).length, `its ${interior.kind} opens onto an empty room`).toBeGreaterThan(0)
    }
  })

  it('is the architecture the plan draws, with the story written over it', () => {
    const plan = Forge.plan(RECORDED_BRIEF, recordedHistory())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    // the geometry is arithmetic, so both sides are the same town down to the
    // cell: one grid, one road graph, one cut of districts, and every building
    // on the footprint the plan gave it, behind its door, at its height, in its
    // part of town
    const architecture = (city: World) => ({
      grid: city.toJSON().grid,
      roads: city.toJSON().roads,
      districts: city.districts().map((district) => ({ id: district.id, blocks: district.blocks })),
      plots: city.plots().map((plot) => ({ id: plot.id, rect: plot.rect, entrance: plot.entrance, storeys: plot.storeys, district: plot.district })),
    })
    expect(architecture(plan.value)).toEqual(architecture(world))

    // what the writing adds over that is what each of those buildings turned
    // out to be. A plan stands every plot up under the architecture's own word
    // and boards nowhere; the town written over those same plots says which of
    // them is a bar and which is a station, and the kit that dresses a plot
    // follows the word
    expect(new Set(plan.value.plots().map((plot) => plot.kind))).toEqual(new Set(['building']))
    expect(plan.value.stations()).toEqual([])
    expect(new Set(world.plots().map((plot) => plot.kind)).size).toBeGreaterThan(1)
    expect(world.plots().every((plot) => plot.style.endsWith(plot.kind))).toBe(true)
  })

  it('exports a world that loads back identically', () => {
    const exported = JSON.parse(JSON.stringify(world.toJSON()))
    const reloaded = World.load(exported)
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) return
    expect(JSON.stringify(reloaded.value.toJSON())).toEqual(JSON.stringify(exported))
  })

  it('summarises the world as places, people and things for the quest writer', () => {
    const summary = summarise(world)
    expect(summary.cityName).toBe(world.name)
    expect(summary.places.length).toBe(world.plots().length)
    const populated = summary.places.filter((place) => place.npcs.length > 0)
    expect(populated.length).toBeGreaterThan(1)
    expect(populated[0]!.npcs[0]!.name.length).toBeGreaterThan(2)
    for (const item of summary.places.flatMap((place) => place.items)) expect(item.value).toBeGreaterThanOrEqual(0)
  })
})

describe('the work a city hands out', () => {
  it('ships nothing the quest validator will not take', () => {
    expect(quests.length).toBeGreaterThan(0)
    expect(built.rejected).toEqual([])
    for (const quest of quests) expect(validateQuest(quest, questView(world)).ok, quest.id).toBe(true)
  })

  it('names nothing that is not in the world', () => {
    // measured against the local model: offered three people by id, it answered
    // with a fourth that was never in the town
    let ids = 0
    for (const quest of quests) {
      for (const id of idsIn(quest)) {
        ids++
        expect(resolves(world, id), `${quest.title} names ${id}, which is nothing in ${world.name}`).toBe(true)
      }
    }
    expect(ids, 'no quest in this town names anything').toBeGreaterThan(10)
  })

  it('never names somebody who is not standing in the place the step points at', () => {
    // the reason the work is written before anybody is: a quest written over a
    // town that is already full can say "talk to John" and drop a marker on a
    // building with five strangers in it
    const plotOf = (npcId: string) => {
      const station = world.npc(npcId)?.station
      return station ? world.interior(station.interiorId)?.plotId : undefined
    }
    let checked = 0
    for (const quest of quests) {
      for (const step of quest.steps) {
        if (step.kind !== 'talk' && step.kind !== 'deliver') continue
        const npcId = step.kind === 'talk' ? step.npcId : step.toNpcId
        const npc = world.npc(npcId)
        expect(npc, `${quest.title}: "${step.objective}" names ${npcId}, who is nobody`).toBeDefined()
        expect(npc!.station, `${quest.title}: ${npc!.name} stands nowhere`).toBeDefined()
        const plot = world.plot(plotOf(npcId)!)!
        // a marker, where the line carries one, names the building its person is in
        if (step.markerLabel !== undefined) {
          expect(clipped(plot.name), `${quest.title}: "${step.objective}" marks ${step.markerLabel} and points at ${plot.name}`).toBe(step.markerLabel)
        }
        checked++
      }
    }
    expect(checked, 'no quest in this town names anybody').toBeGreaterThan(2)
  })

  it('names every person and every place off the town, never off the architecture it was written against', () => {
    for (const quest of quests) {
      expect(JSON.stringify(quest), `${quest.title} still reads off the blueprint`).not.toMatch(/\b(Zone|Instance|Person|Thing) \d+\b/i)
    }
  })

  it('says nothing to the player in ids, whatever the writer wrote them in', () => {
    const READ = ['title', 'summary', 'objective', 'hint', 'markerLabel', 'prompt', 'label', 'topic']
    for (const quest of quests) {
      for (const [field, text] of prose(quest)) {
        if (!READ.includes(field)) continue
        expect(text, `${quest.title}: ${field} reads "${text}"`).not.toMatch(/\b(plot|interior|npc|item|anchor|door|machine)_\d{3,}\b/)
      }
    }
  })

  it('asks the player for nothing the running game has no verb for', () => {
    // what this box promises about a narrator's work is that it holds up
    // against the city and asks for nothing nobody can do. Measured on the
    // recorded city: no step wants a verb the game has not got, and five of its
    // nine jobs play to the end
    const report = playEvery(world, quests)
    expect(report.runs.flatMap((run) => run.blocked.map((block) => `${block.kind}: ${block.why}`)), 'a step wants a verb nobody has').toEqual([])
    expect(report.absent, 'a job was sent to a room whose person was out walking').toBe(0)
    expect(report.completable, line(report)).toBeGreaterThanOrEqual(5)
    for (const run of report.runs) if (run.completable) expect(run.paid, `${run.title} finished and paid nothing`).toBeGreaterThan(0)
  })

  it('plays the first job in the town to the end', () => {
    const quest = quests[0]!
    const state = PlayerState.create(world.id)
    const log = openLog(quests, state)
    expect(log.start(quest.id).ok).toBe(true)
    const run = new Player(log, state, new City(world)).play(quest)
    expect(run.status, `${quest.title}: ${run.blocked.map((block) => block.why).join('; ')}`).toBe('complete')
    expect(run.paid).toBeGreaterThan(0)
  })

  it('keeps the people a job is waiting on at their posts while the rest of the town walks', () => {
    const state = PlayerState.create(world.id)
    const log = openLog(quests, state)
    for (const quest of quests) log.start(quest.id)
    const targets = questTargets(log.objectives())
    expect(targets.size).toBeGreaterThan(0)
    for (const npcId of targets) expect(world.npc(npcId), `${npcId} is nobody`).toBeDefined()
    for (const objective of log.objectives()) if (objective.npcId) expect(targets.has(objective.npcId)).toBe(true)

    // a job sent to an empty room is not completable, and with the targets kept
    // in it is: the rule the running game is asked to keep
    expect(playEvery(world, quests, 'kept').absent, 'a job was sent to an empty room with its targets kept in').toBe(0)
    expect(playEvery(world, quests, 'loose').absent, 'nothing in this town was ever sent to an empty room').toBeGreaterThan(0)

    // and the town sends a third out without ever emptying a room
    const out = new Street(world).out(targets)
    expect(out.size).toBeGreaterThan(0)
    for (const npcId of targets) expect(out.has(npcId), 'somebody a job waits on was sent out walking').toBe(false)
    for (const interior of world.interiors()) {
      const stationed = world.npcs().filter((npc) => npc.station?.interiorId === interior.id)
      expect(stationed.some((npc) => !out.has(npc.id)), `${interior.id} was emptied`).toBe(true)
    }
  })
})

describe('what the plan puts in a place before anybody writes it', () => {
  const requests = narrator.requests<InstanceRequest>('writeInstances').flat()

  it('asks about every place that opens, once, and about no door that does not', () => {
    expect(narrator.asked.filter((one) => one.method === 'writeInstances').length).toBe(1)
    expect(requests.length).toBe(world.interiors().length)
    expect(new Set(requests.map((request) => request.name)).size).toBe(requests.length)
  })

  it('briefs the writer of a place on its locks, its screens, its camera and its sale', () => {
    for (const request of requests) {
      const interior = world.interiors().find((one) => world.plot(one.plotId)!.name === request.name)!
      expect(interior, `${request.name} was written and never built`).toBeDefined()
      const locked = interior.doors.filter((door) => door.locked)
      expect(request.has.locked.length, `${request.name} was briefed on the wrong number of locks`).toBe(locked.length)
      expect(request.has.camera).toBe(interior.furniture.some((piece) => piece.prop === 'camera'))
      expect(request.has.machines.length).toBe(interior.furniture.filter((piece) => isMachineProp(piece.prop)).length)
      expect(request.has.forSale).toBe(interior.forSale)
      // the writer is handed the stock and nothing else: a thing that opens a
      // door or owns a home is named here off what it opens or owns. What makes
      // one of those is the field, never the archetype, which is why a card
      // lying on a counter as stock is stock: `@gb/world` takes a card that
      // opens nothing and refuses a deed that owns nothing
      const held = itemsIn(interior.id)
      const stock = held.filter((item) => item.opens === undefined && item.deedTo === undefined)
      expect(request.things.length, `${request.name} was asked to name ${request.things.length} of its ${held.length} things`).toBe(stock.length)
    }
    // and the town has something written that way for the brief to leave out
    expect(world.items().filter((item) => item.opens !== undefined || item.deedTo !== undefined).length, 'nothing in this town opens a door or owns a home').toBeGreaterThan(0)
  })

  it('locks nothing in an open place, and puts the key to a shut room in a pocket in front of it', () => {
    let locks = 0
    for (const interior of world.interiors()) {
      const locked = interior.doors.filter((door) => door.locked)
      if (world.charter(interior.kind)!.access === 'open') {
        expect(locked, `${interior.kind} is open and locks a door`).toEqual([])
        continue
      }
      for (const door of locked) {
        locks++
        const key = world.item(door.keyItemId!)!
        expect(key.archetype === 'key' || key.archetype === 'keycard').toBe(true)
        const held = world.placements().find((placement) => placement.itemId === key.id)!
        expect(held.at).toBe('npc')
        const keeper = world.npc((held as { npcId: string }).npcId)!
        expect(keeper.station?.interiorId).toBe(interior.id)
        expect(interior.anchors.find((anchor) => anchor.id === keeper.station!.anchorId)?.roomId, 'the keeper is locked in with the key').not.toBe(door.to)
        expect(key.ownerNpcId).toBe(keeper.id)
      }
    }
    expect(locks + world.interiors().filter((one) => world.charter(one.kind)!.access === 'open').length).toBeGreaterThan(0)
  })

  it('runs a program on every screen, locks the ones that are not games, and hangs a camera where a place keeps watch', () => {
    const ids = new Set<string>()
    for (const interior of world.interiors()) {
      const hosts = new Map(interior.furniture.map((piece) => [piece.id, piece.prop]))
      for (const piece of interior.furniture) {
        if (!isMachineProp(piece.prop)) continue
        const machine = piece.machine!
        expect(ids.has(machine.id), `${machine.id} is taken twice`).toBe(false)
        ids.add(machine.id)
        expect(piece.on, `${piece.prop} stands on nothing`).toBeDefined()
        if (GAMES.includes(machine.program)) {
          expect(hosts.get(piece.on!), 'a game on a working screen').toBe('bar-counter')
          expect(machine.locked).toBe(false)
        } else {
          expect(machine.locked, `${machine.program} is open to anybody`).toBe(true)
          expect(machine.password).toMatch(/^[a-z]+-\d\d$/)
        }
      }
      const charter = world.charter(interior.kind)!
      const camera = interior.furniture.find((piece) => piece.prop === 'camera')
      const keeps = charter.work.includes('watch') || charter.access !== 'open'
      expect(camera !== undefined, `${interior.kind} ${keeps ? 'keeps watch with no camera' : 'hangs a camera for nothing'}`).toBe(keeps)
      if (camera) expect(interior.rooms.some((room) => room.id === camera.watches)).toBe(true)
    }
  })

  it('sells the player a home, with its deed priced on somebody\'s counter', () => {
    const forSale = world.interiors().filter((interior) => interior.forSale !== undefined)
    expect(forSale.length, `${world.name} has nothing for sale`).toBe(1)
    for (const home of forSale) {
      expect(world.charter(home.kind)!.residential).toBe(true)
      expect(home.owner).toBeUndefined()
      // a home on the market is lived in until the deed changes hands
      expect(world.npcs().some((npc) => npc.station?.interiorId === home.id), 'an empty home is on the market').toBe(true)
      const deed = world.items().find((item) => item.deedTo === home.id)!
      expect(deed.archetype).toBe('deed')
      expect(deed.value).toBe(home.forSale)
      expect(deed.name).toBe(`Deed to ${world.plot(home.plotId)!.name}`)
      const lying = world.placements().find((placement) => placement.itemId === deed.id)!
      expect(lying.at).toBe('anchor')
      const { interiorId, anchorId } = lying as { interiorId: string; anchorId: string }
      expect(interiorId).not.toBe(home.id)
      expect(world.interior(interiorId)!.anchors.find((anchor) => anchor.id === anchorId)?.kind).toBe('serve')
      expect(world.npc(deed.ownerNpcId!)?.station?.interiorId).toBe(interiorId)
    }
  })

  it('stands every person the work names at the post that work points at', () => {
    const atPost = new Map(world.npcs().flatMap((npc) => (npc.station ? [[npc.station.anchorId, npc] as const] : [])))
    const byId = new Map(quests.map((quest) => [quest.id, quest]))
    let cast = 0
    for (const request of requests) {
      const posts = new Set(request.posts.map((post) => post.postId))
      for (const casting of request.cast) {
        cast++
        expect(posts.has(casting.postId), `${request.name} was told to cast a post it does not have`).toBe(true)
        const npc = atPost.get(casting.postId)
        expect(npc, `${casting.questTitle} needs somebody at ${casting.postId} and nobody was written there`).toBeDefined()
        expect(byId.get(casting.questId), `${request.name} was cast for ${casting.questId}, which is not in the town`).toBeDefined()
        expect(named(byId.get(casting.questId)!).has(npc!.id), `${casting.questTitle} does not name ${npc!.name}`).toBe(true)
      }
    }
    expect(cast, 'the town wrote work and told nobody they were in it').toBeGreaterThan(0)

    // and everybody the work names was cast for somebody
    const promised = new Set(requests.flatMap((request) => request.cast.map((casting) => casting.postId)))
    const stationed = new Map(world.npcs().flatMap((npc) => (npc.station ? [[npc.id, npc.station.anchorId] as const] : [])))
    for (const quest of quests) {
      for (const npcId of named(quest)) {
        const post = stationed.get(npcId)
        expect(post, `${quest.title} names ${npcId}, who stands nowhere`).toBeDefined()
        expect(promised.has(post!), `${quest.title} names ${world.npc(npcId)!.name}, who was written for nobody`).toBe(true)
      }
    }
  })
})

describe('what the narrator is asked', () => {
  it('asks for every door in the town in one call, each with its street and the town it is in', () => {
    const asked = narrator.requests<PlaceRequest>('namePlaces').flat()
    expect(narrator.asked.filter((one) => one.method === 'namePlaces').length).toBe(1)
    // one request per door in the town, in the order the town put them up, and
    // the question carries a kind only where one is settled: a door that opens
    // was told what it is back at stage 3, and a door that never opens is a
    // building until this answer's own kind makes it a bakery
    const open = new Set(world.interiors().map((interior) => interior.plotId))
    expect(asked.map((request) => request.kind)).toEqual(world.plots().map((plot) => (open.has(plot.id) ? plot.kind : undefined)))
    expect(asked.filter((request) => request.kind === undefined).length, 'every door in this town was told what it is before it was named').toBeGreaterThan(0)
    for (const request of asked) {
      expect(request.street, `plot ${request.index} is on no street`).toBeTruthy()
      expect(request.premise, `plot ${request.index} was asked for knowing nothing about the town`).toBeTruthy()
    }
  })

  it('asks for the whole cut of the city at once, in blocks and bearings and no metre', () => {
    const asked = narrator.requests<DistrictRequest>('nameDistricts').flat()
    expect(asked.length).toBe(world.districts().length)
    expect(asked[0]!.blocks).toBeGreaterThan(0)
    expect(asked.every((request) => request.bearing.length > 0)).toBe(true)
    expect(JSON.stringify(asked)).not.toContain('rect')
  })

  it('shows every place that opens the town it stands in', () => {
    const requests = narrator.requests<InstanceRequest>('writeInstances').flat()
    for (const request of requests) expect(request.premise, `${request.kind} was written knowing nothing about the town`).toBeTruthy()
  })
})

describe('a narrator that will not write', () => {
  it('stops the build at the stage that could not be written, and says so in one sentence', async () => {
    const message = 'the history could not be written: the model at 127.0.0.1:8080 did not answer'
    const stopping: Narrator = Object.assign(new Recorded(), { writePremise: async () => err({ stage: 'history' as const, message }) })
    const stopped = await new Forge(stopping).build(RECORDED_BRIEF)

    expect(stopped.ok).toBe(false)
    if (stopped.ok || stopped.error.code !== 'unwritten') return
    expect(stopped.error.stage).toBe('history')
    expect(stopped.error.message).toBe(message)
  })

  it('stops a build whose work could not be written, rather than shipping a city with nothing to do', async () => {
    const message = 'the main line could not be written: the model wrote prose instead of calling the tool'
    const quiet: Narrator = Object.assign(new Recorded(), { writeQuests: async () => err({ stage: 'quests' as const, message }) })
    const stopped = await new Forge(quiet).build(RECORDED_BRIEF)

    expect(stopped.ok).toBe(false)
    if (stopped.ok || stopped.error.code !== 'unwritten') return
    expect(stopped.error.stage).toBe('quests')
    expect(stopped.error.message).toBe(message)
  })

  it('hands back the quests it could not verify instead of shipping them', async () => {
    // nothing a narrator writes is trusted: a draft naming somebody the city
    // does not hold is rejected with the id in the reason. The two bad drafts go
    // out beside the model's own, because a draft naming nobody casts nobody and
    // the rest of the build is the build it always was
    const ghosts: Narrator = Object.assign(new Recorded(), {
      writeQuests: async (input: Parameters<Narrator['writeQuests']>[0]) => {
        const real = await new Recorded().writeQuests(input)
        if (!real.ok) return real
        return ok([
          ...real.value,
          { format: 'game-box.quest', schemaVersion: 1, id: 'quest_0099', kind: 'side', title: 'Bad', summary: 'Points nowhere.', giverNpcId: 'npc_9999', startStepId: 'step_0001', steps: [{ id: 'step_0001', kind: 'complete', objective: 'x', next: [], requires: [], effects: [] }], reward: { money: 1, reputation: 0, faction: 'town', items: [] } },
          { nonsense: true },
        ])
      },
    })
    const made = await new Forge(ghosts).build(RECORDED_BRIEF)

    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.value.quests).toHaveLength(quests.length)
    expect(made.value.rejected).toHaveLength(2)
    expect(made.value.rejected[0]!.problems.some((problem) => problem.message.includes('npc_9999'))).toBe(true)
  })

  it('keeps the sign it composed over a door the narrator left blank, and a part of town it left blank', async () => {
    // a blank is a narrator saying nothing rather than a narrator stopping, so
    // the sign and the name of the part of town are composed here instead
    const open = new Set(world.interiors().map((interior) => world.plots().findIndex((plot) => plot.id === interior.plotId)))
    const blanking: Narrator = Object.assign(new Recorded(), {
      namePlaces: async (requests: readonly PlaceRequest[]) => {
        const real = await new Recorded().namePlaces!(requests)
        if (!real.ok) return real
        // the doors that open keep the names they were written, so the places
        // this build asks about are the places the recording was asked about
        return ok(requests.map((request, at) => (open.has(request.index) ? real.value[at]! : '')))
      },
      nameDistricts: async (requests: readonly DistrictRequest[]) => ok(requests.map(() => '')),
    })
    const made = await new Forge(blanking).build(RECORDED_BRIEF)

    expect(made.ok).toBe(true)
    if (!made.ok) return
    const shut = made.value.world.plots().filter((plot) => plot.interiorId === undefined)
    expect(shut.length).toBeGreaterThan(10)
    for (const plot of shut) expect(plot.name.length, `${plot.id} has no sign`).toBeGreaterThan(2)
    for (const zone of made.value.world.districts()) expect(zone.name).not.toMatch(/^Zone \d+$/)
    const zones = made.value.world.districts().map((zone) => zone.name.toLowerCase())
    expect(new Set(zones).size, 'two parts of the city came out with one name').toBe(zones.length)
  })

  it('refuses a brief that does not make sense', async () => {
    const made = await new Forge(new Recorded()).build({ theme: '', seed: 'x', blocksX: 999 })
    expect(made.ok).toBe(false)
    if (!made.ok) expect(made.error.code).toBe('invalid-brief')
  })
})

describe('a city written by a narrator answering out of order', () => {
  it('builds the same city however the answers land', async () => {
    const shuffled: Narrator = Object.assign(new Recorded(), {
      writeInstances: async (requests: readonly InstanceRequest[]) => {
        const answer = await new Recorded().writeInstances(requests)
        if (!answer.ok) return answer
        // every answer in the air at once, landing in whatever order the jitter
        // puts them, with the people and things inside each one turned round
        const landed: Instance[] = new Array(answer.value.length)
        await Promise.all(
          answer.value.map(async (one, at) => {
            await new Promise((done) => setTimeout(done, (at * 7) % 5))
            landed[at] = { ...one, people: [...one.people].reverse(), things: [...one.things].reverse() }
          }),
        )
        return ok(landed)
      },
    })
    const again = await recordedCity(shuffled)

    expect(digest(again.world.toJSON())).toBe(digest(world.toJSON()))
    expect(digest(again.quests)).toBe(digest(quests))
  })

  it('leaves a post empty rather than filling it with somebody who was written for another one', async () => {
    const stranger: Narrator = Object.assign(new Recorded(), {
      writeInstances: async (requests: readonly InstanceRequest[]) => {
        const answer = await new Recorded().writeInstances(requests)
        if (!answer.ok) return answer
        return ok(answer.value.map((one) => ({ ...one, people: [...one.people, { ...one.people[0]!, postId: 'anchor_nowhere' }] })))
      },
    })
    const made = await recordedCity(stranger)

    expect(made.world.check()).toEqual([])
    expect(made.world.npcs().length).toBe(world.npcs().length)
    for (const npc of made.world.npcs()) {
      const interior = made.world.interior(npc.station!.interiorId)!
      expect(interior.anchors.some((anchor) => anchor.id === npc.station!.anchorId), `${npc.name} stands nowhere`).toBe(true)
    }
  })
})

/** A marker is capped shorter than a place name, so a long sign is clipped where it is bound. */
const clipped = (name: string): string => (name.length <= 40 ? name : `${name.slice(0, 39).trimEnd()}.`)
