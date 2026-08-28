import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { questView } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Bundle, type ResumeEntry } from '../src/index.ts'
import { errand, grow, laidOut, type Has } from './town.ts'

/**
 * A city built with the model on comes out different every time, the same seed
 * or not, and the save the player wrote against the first build is opened
 * against the second. Two growths on one town plan stand in for that: the
 * streets are the same and ids are minted in the same order, and what each id
 * names is different, or missing. `SHARED` puts more in the place that opens
 * than `REBUILT`, so every kind of thing has an id the rebuilt town has not got.
 */
const SHARED: Has = { anchors: 3, people: 2, things: 5 }
const REBUILT: Has = { anchors: 2, people: 1, things: 4 }

async function town(has: Has, title: string) {
  const world = laidOut('bundle-test')
  const [place] = grow(world, 1, has)
  const opened = await Bundle.open(await Bundle.pack(world, [errand('quest_0001', title, place!)]))
  if (!opened.ok) throw new Error(JSON.stringify(opened.error).slice(0, 300))
  return { city: opened.value, place: place! }
}

const has = (entries: readonly ResumeEntry[], entry: ResumeEntry) => entries.some((one) => one.kind === entry.kind && one.id === entry.id)

describe('a save opened in a rebuilt city', () => {
  it('keeps what still resolves, drops the rest, and says which was which', async () => {
    const first = await town(SHARED, 'The thing on the shelf')
    const second = await town(REBUILT, 'Another errand under the same number')
    expect(second.city.contentHash).not.toBe(first.city.contentHash)

    const gone = { item: first.place.itemIds[4]!, npc: first.place.npcIds[1]!, anchor: { interiorId: first.place.interiorId, anchorId: first.place.anchorIds[2]! } }
    const stays = { item: second.place.itemIds[0]!, npc: second.place.npcIds[0]!, anchor: { interiorId: second.place.interiorId, anchorId: second.place.anchorIds[0]! } }
    const [placedGone, placedStays] = [second.place.itemIds[1]!, second.place.itemIds[2]!]
    const view = questView(second.city.world)
    expect(second.city.world.item(gone.item), 'the rebuilt town still holds every thing the first did').toBeUndefined()
    expect(second.city.world.npc(gone.npc), 'the rebuilt town still holds everybody the first did').toBeUndefined()
    expect(view.hasAnchor(gone.anchor.interiorId, gone.anchor.anchorId), 'the rebuilt town still has every surface the first did').toBe(false)
    const quest = first.city.quests[0]!
    expect(second.city.quests.find((one) => one.id === quest.id)?.title, 'the rebuilt city reuses the id for other work').not.toBe(quest.title)

    const player = PlayerState.create(first.city.world.id, 5)
    const log = QuestLog.create(first.city.quests, player)
    player.earn(20)
    player.setFlag('crossed:plot_0002', true)
    player.adjustReputation(10, 'plot_0002')
    for (const id of [stays.item, gone.item, placedGone, placedStays]) player.take(id)
    player.place(placedGone, gone.anchor)
    player.place(placedStays, stays.anchor)
    player.addCompanion(stays.npc)
    player.addCompanion(gone.npc)
    player.discover({ place: first.place.interiorId })
    player.discover({ npc: stays.npc })
    player.discover({ npc: gone.npc })
    player.remember(stays.npc, 'bought a round', 'seen')
    player.remember(gone.npc, 'owes a favour', 'told')
    player.warm(stays.npc)
    player.setWhere({ x: 1, z: 1, heading: 0, interiorId: first.place.interiorId })
    log.start(quest.id)
    player.setTracked(quest.id)
    const save = JSON.parse(JSON.stringify(Bundle.save(first.city, player, log)))

    const resumed = Bundle.resume(second.city, save)
    expect(resumed.ok, JSON.stringify('error' in resumed ? resumed.error : '')).toBe(true)
    if (!resumed.ok) return
    const { player: back, log: backLog, report } = resumed.value

    expect(report.rebuilt).toBe(true)
    expect(back.money).toBe(25)
    expect(back.flag('crossed:plot_0002')).toBe(true)
    expect(back.reputation('plot_0002')).toBe(10)
    expect(back.has(stays.item)).toBe(true)
    expect(back.has(gone.item)).toBe(false)
    expect(back.isCompanion(stays.npc)).toBe(true)
    expect(back.isCompanion(gone.npc)).toBe(false)
    expect(back.discovered().places).toEqual([first.place.interiorId])
    expect(back.discovered().people.map((one) => one.npcId)).toEqual([stays.npc])
    expect(back.memories(stays.npc)).toEqual([{ fact: 'bought a round', source: 'seen' }])
    expect(back.memories(gone.npc)).toEqual([])
    expect(back.disposition(stays.npc)).toBe('warm')
    expect(back.placedAt(placedStays)).toEqual(stays.anchor)
    expect(back.placedAt(placedGone)).toBeUndefined()
    expect(back.where?.interiorId).toBe(first.place.interiorId)
    expect(back.tracked).toBeUndefined()
    expect(backLog.status(quest.id)).toBe('unstarted')

    for (const entry of [
      { kind: 'item', id: stays.item },
      { kind: 'companion', id: stays.npc },
      { kind: 'person', id: stays.npc },
      { kind: 'placed', id: placedStays },
      { kind: 'place', id: first.place.interiorId },
      { kind: 'where', id: first.place.interiorId },
    ] as const) {
      expect(has(report.kept, entry), `kept ${entry.kind} ${entry.id}`).toBe(true)
    }
    for (const entry of [
      { kind: 'item', id: gone.item },
      { kind: 'companion', id: gone.npc },
      { kind: 'person', id: gone.npc },
      { kind: 'placed', id: placedGone },
      { kind: 'quest', id: quest.id },
      { kind: 'tracked', id: quest.id },
    ] as const) {
      expect(has(report.dropped, entry), `dropped ${entry.kind} ${entry.id}`).toBe(true)
    }

    const sameCity = Bundle.resume(first.city, save)
    expect(sameCity.ok).toBe(true)
    if (!sameCity.ok) return
    expect(sameCity.value.report.rebuilt).toBe(false)
    expect(sameCity.value.report.dropped).toEqual([])
    expect(sameCity.value.log.status(quest.id)).toBe('active')
    expect(sameCity.value.player.tracked).toBe(quest.id)
  })

  it('puts a player standing in a room the city has not got back at the start', async () => {
    const { city } = await town(REBUILT, 'The thing on the shelf')
    const player = PlayerState.create(city.world.id, 0)
    player.setWhere({ x: 2, z: 3, heading: 1, interiorId: 'interior_0001' })
    const save = Bundle.save(city, player, QuestLog.create(city.quests, player))
    const elsewhere = { ...save, player: { ...save.player, where: { ...save.player.where!, interiorId: 'interior_0099' } } }

    const resumed = Bundle.resume(city, JSON.parse(JSON.stringify(elsewhere)))
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) return
    expect(resumed.value.player.where).toBeUndefined()
    expect(resumed.value.report.dropped).toEqual([{ kind: 'where', id: 'interior_0099' }])
  })

  it('resolves a quest by id alone when the save was written before titles were recorded', async () => {
    const first = await town(SHARED, 'The thing on the shelf')
    const second = await town(REBUILT, 'Another errand under the same number')
    const quest = first.city.quests[0]!
    const player = PlayerState.create(first.city.world.id, 0)
    const log = QuestLog.create(first.city.quests, player)
    log.start(quest.id)
    const { questTitles: _titles, ...untitled } = Bundle.save(first.city, player, log)
    expect(quest.steps[0]!.id).toBe(second.city.quests.find((one) => one.id === quest.id)?.steps[0]?.id)

    const resumed = Bundle.resume(second.city, JSON.parse(JSON.stringify(untitled)))
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) return
    expect(resumed.value.log.status(quest.id)).toBe('active')
    expect(has(resumed.value.report.kept, { kind: 'quest', id: quest.id })).toBe(true)
  })
})
