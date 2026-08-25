import { Forge, OfflineNarrator } from '@gb/forge'
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { questView } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Bundle, type OpenedBundle, type ResumeEntry } from '../src/index.ts'

/**
 * A city built with the model on comes out different every time, the same
 * seed or not, and the save the player wrote against the first build is opened
 * against the second. Two offline authors on one seed stand in for that: the
 * streets are the same, ids are minted in the same order, and what each id
 * names is different, or missing. `SHARED` writes more of everything than
 * `REBUILT`, so every kind of thing has an id the rebuilt town has not got.
 */
const SHARED = 'three'
const REBUILT = 'six'

async function town(author: string): Promise<OpenedBundle> {
  const forge = new Forge(new OfflineNarrator(author))
  const built = await forge.build({ theme: 'harbour town', seed: 'bundle-test', blocksX: 2, blocksY: 2, blockCells: 14 })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 300))
  const opened = await Bundle.open(await Bundle.pack(built.value.world, built.value.quests))
  if (!opened.ok) throw new Error(JSON.stringify(opened.error).slice(0, 300))
  return opened.value
}

/** The ids the first city has and the second has not, and one of each it still has. */
function whatMoved(first: OpenedBundle, second: OpenedBundle) {
  const doc = first.world.toJSON()
  const ids = (list: readonly { id: string }[], has: (id: string) => boolean) => ({
    gone: list.map((one) => one.id).find((id) => !has(id)),
    stays: list.map((one) => one.id).find((id) => has(id)),
  })
  const view = questView(second.world)
  const anchors = doc.interiors.flatMap((room) => room.anchors.map((anchor) => ({ interiorId: room.id, anchorId: anchor.id })))
  return {
    item: ids(doc.items, view.hasItem),
    npc: ids(doc.npcs, view.hasNpc),
    anchor: {
      gone: anchors.find((at) => !view.hasAnchor(at.interiorId, at.anchorId)),
      stays: anchors.find((at) => view.hasAnchor(at.interiorId, at.anchorId)),
    },
  }
}

const has = (entries: readonly ResumeEntry[], entry: ResumeEntry) => entries.some((one) => one.kind === entry.kind && one.id === entry.id)

describe('a save opened in a rebuilt city', () => {
  it('keeps what still resolves, drops the rest, and says which was which', async () => {
    const first = await town(SHARED)
    const second = await town(REBUILT)
    expect(second.contentHash).not.toBe(first.contentHash)
    const moved = whatMoved(first, second)
    const gone = { item: moved.item.gone!, npc: moved.npc.gone!, anchor: moved.anchor.gone! }
    const stays = { item: moved.item.stays!, npc: moved.npc.stays!, anchor: moved.anchor.stays! }
    expect([gone.item, gone.npc, gone.anchor, stays.item, stays.npc, stays.anchor].every(Boolean), 'the two towns differ in every kind of thing').toBe(true)
    const [placedGone, placedStays] = first.world.toJSON().items.map((one) => one.id).filter((id) => id !== stays.item && id !== gone.item && second.world.item(id))
    const quest = first.quests[0]!
    expect(second.quests.find((one) => one.id === quest.id)?.title, 'the rebuilt city reuses the id for other work').not.toBe(quest.title)

    const player = PlayerState.create(first.world.id, 5)
    const log = QuestLog.create(first.quests, player)
    player.earn(20)
    player.setFlag('crossed:plot_0002', true)
    player.adjustReputation(10, 'plot_0002')
    for (const id of [stays.item, gone.item, placedGone!, placedStays!]) player.take(id)
    player.place(placedGone!, gone.anchor)
    player.place(placedStays!, stays.anchor)
    player.addCompanion(stays.npc)
    player.addCompanion(gone.npc)
    player.discover({ place: 'interior_0001' })
    player.discover({ npc: stays.npc })
    player.discover({ npc: gone.npc })
    player.remember(stays.npc, 'bought a round', 'seen')
    player.remember(gone.npc, 'owes a favour', 'told')
    player.warm(stays.npc)
    player.setWhere({ x: 1, z: 1, heading: 0, interiorId: 'interior_0001' })
    log.start(quest.id)
    player.setTracked(quest.id)
    const save = JSON.parse(JSON.stringify(Bundle.save(first, player, log)))

    const resumed = Bundle.resume(second, save)
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
    expect(back.discovered().places).toEqual(['interior_0001'])
    expect(back.discovered().people.map((one) => one.npcId)).toEqual([stays.npc])
    expect(back.memories(stays.npc)).toEqual([{ fact: 'bought a round', source: 'seen' }])
    expect(back.memories(gone.npc)).toEqual([])
    expect(back.disposition(stays.npc)).toBe('warm')
    expect(back.placedAt(placedStays!)).toEqual(stays.anchor)
    expect(back.placedAt(placedGone!)).toBeUndefined()
    expect(back.where?.interiorId).toBe('interior_0001')
    expect(back.tracked).toBeUndefined()
    expect(backLog.status(quest.id)).toBe('unstarted')

    for (const entry of [
      { kind: 'item', id: stays.item },
      { kind: 'companion', id: stays.npc },
      { kind: 'person', id: stays.npc },
      { kind: 'placed', id: placedStays! },
      { kind: 'place', id: 'interior_0001' },
      { kind: 'where', id: 'interior_0001' },
    ] as const) {
      expect(has(report.kept, entry), `kept ${entry.kind} ${entry.id}`).toBe(true)
    }
    for (const entry of [
      { kind: 'item', id: gone.item },
      { kind: 'companion', id: gone.npc },
      { kind: 'person', id: gone.npc },
      { kind: 'placed', id: placedGone! },
      { kind: 'quest', id: quest.id },
      { kind: 'tracked', id: quest.id },
    ] as const) {
      expect(has(report.dropped, entry), `dropped ${entry.kind} ${entry.id}`).toBe(true)
    }

    const sameCity = Bundle.resume(first, save)
    expect(sameCity.ok).toBe(true)
    if (!sameCity.ok) return
    expect(sameCity.value.report.rebuilt).toBe(false)
    expect(sameCity.value.report.dropped).toEqual([])
    expect(sameCity.value.log.status(quest.id)).toBe('active')
    expect(sameCity.value.player.tracked).toBe(quest.id)
  })

  it('puts a player standing in a room the city has not got back at the start', async () => {
    const city = await town(REBUILT)
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
    const first = await town(SHARED)
    const second = await town(REBUILT)
    const quest = first.quests[0]!
    const player = PlayerState.create(first.world.id, 0)
    const log = QuestLog.create(first.quests, player)
    log.start(quest.id)
    const { questTitles: _titles, ...untitled } = Bundle.save(first, player, log)
    expect(quest.steps[0]!.id).toBe(second.quests.find((one) => one.id === quest.id)?.steps[0]?.id)

    const resumed = Bundle.resume(second, JSON.parse(JSON.stringify(untitled)))
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) return
    expect(resumed.value.log.status(quest.id)).toBe('active')
    expect(has(resumed.value.report.kept, { kind: 'quest', id: quest.id })).toBe(true)
  })
})
