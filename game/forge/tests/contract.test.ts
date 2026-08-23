import { readFileSync } from 'node:fs'
import { PlayerState } from '@gb/play'
import { QuestLog, validateQuest, type QuestDoc } from '@gb/quest'
import { questView, World, type WorldDoc } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Forge, OfflineNarrator, summarise } from '../src/index.ts'
import { playThrough } from './drive.ts'
import { buildTown } from './support.ts'

/** A city this box built and sealed before the streets were reseeded. Never regenerated. */
const SEALED = JSON.parse(readFileSync(new URL('./fixtures/sealed-city.json', import.meta.url), 'utf8')) as {
  brief: Record<string, unknown>
  world: WorldDoc
  quests: QuestDoc[]
}

const town = (seed = 'dry-gulch', overrides: Record<string, unknown> = {}) => buildTown(seed, overrides)

describe('Forge', () => {
  it('builds a sound city with streets, buildings, people and things', async () => {
    const { world } = await town()

    expect(world.check()).toEqual([])
    expect(world.name.length).toBeGreaterThan(3)
    expect(world.plots().length).toBeGreaterThan(8)
    expect(world.npcs().length).toBeGreaterThan(5)
    expect(world.items().length).toBeGreaterThan(5)
    expect(world.interiors().length).toBe(world.plots().length)

    // every town has its bar, whatever the theme says
    expect(world.plotsOfKind('bar').length).toBeGreaterThanOrEqual(1)

    // every bar has somebody behind the counter, and every shop somebody at the counter
    for (const bar of world.plotsOfKind('bar')) {
      expect(world.npcsIn(bar.id).some((n) => n.role === 'bartender')).toBe(true)
    }
    for (const shop of world.plotsOfKind('shop')) {
      expect(world.npcsIn(shop.id).some((n) => n.role === 'clerk')).toBe(true)
    }

    // nobody shares a name
    const names = world.npcs().map((n) => n.name)
    expect(new Set(names).size).toBe(names.length)

    // every NPC stands on an anchor that exists, doing something that has a name
    for (const npc of world.npcs()) {
      const interior = world.interior(npc.station!.interiorId)!
      const anchor = interior.anchors.find((a) => a.id === npc.station!.anchorId)!
      expect(anchor).toBeDefined()
      expect(anchor.kind.length).toBeGreaterThan(0)
    }

    // streets, sidewalks and a mountain ring with a way out
    expect(world.grid.count('street')).toBeGreaterThan(100)
    expect(world.grid.count('sidewalk')).toBeGreaterThan(50)
    expect(world.grid.count('mountain')).toBeGreaterThan(100)
    expect(world.grid.at(0, 0)).toBe('mountain')
  })

  it('gives the same city for the same seed and a different one otherwise', async () => {
    const a = await town('same-seed')
    const b = await town('same-seed')
    const c = await town('other-seed')

    expect(JSON.stringify(a.world.toJSON())).toEqual(JSON.stringify(b.world.toJSON()))
    expect(JSON.stringify(a.quests)).toEqual(JSON.stringify(b.quests))
    expect(JSON.stringify(a.world.toJSON())).not.toEqual(JSON.stringify(c.world.toJSON()))
  })

  it('writes quests that pass the quest validator and can be played to the end', async () => {
    const { world, quests } = await town()
    expect(quests.length).toBeGreaterThan(0)

    const quest = quests[0]!
    const player = PlayerState.create(world.id)
    const log = QuestLog.create(quests, player)
    expect(log.start(quest.id).ok).toBe(true)

    expect(playThrough(quest, log, player)).toBe('complete')
    expect(player.money).toBeGreaterThan(0)
  })

  it('hands back the quests it could not verify instead of shipping them', async () => {
    const forge = new Forge({
      nameCity: async () => 'Nowhere',
      namePlace: async () => 'A Place',
      describeNpc: async () => ({ name: 'Someone', personality: 'Vague.', knowledge: [] }),
      describeItem: async () => ({ name: 'A thing', description: 'Unremarkable.' }),
      writeQuests: async () => [
        { format: 'game-box.quest', schemaVersion: 1, id: 'quest_0001', kind: 'side', title: 'Bad', summary: 'Points nowhere.', giverNpcId: 'npc_9999', startStepId: 'step_0001', steps: [{ id: 'step_0001', kind: 'complete', objective: 'x', next: [], requires: [], effects: [] }], reward: { money: 1, reputation: 0, faction: 'town', items: [] } },
        { nonsense: true },
      ],
    })
    const built = await forge.build({ theme: 'test', seed: 'reject', blocksX: 1, blocksY: 1, blockCells: 12 })
    expect(built.ok).toBe(true)
    if (!built.ok) return

    expect(built.value.quests).toEqual([])
    expect(built.value.rejected).toHaveLength(2)
    expect(built.value.rejected[0]!.problems.some((p) => p.message.includes('npc_9999'))).toBe(true)
  })

  it('grows an existing city into its empty space without disturbing it', async () => {
    const { forge, world } = await town()
    const before = {
      plots: world.plots().length,
      npcs: world.npcs().length,
      firstPlot: JSON.stringify(world.plots()[0]),
    }

    const grown = await forge.extend(world, 3)
    expect(grown.ok).toBe(true)
    if (!grown.ok) return

    expect(world.plots().length).toBe(before.plots + grown.value.length)
    expect(world.npcs().length).toBeGreaterThanOrEqual(before.npcs)
    expect(JSON.stringify(world.plots()[0])).toBe(before.firstPlot)
    expect(world.check()).toEqual([])
  })

  it('exports a world that loads back identically', async () => {
    const { world } = await town()
    const exported = JSON.parse(JSON.stringify(world.toJSON()))
    const reloaded = World.load(exported)
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) return
    expect(JSON.stringify(reloaded.value.toJSON())).toEqual(JSON.stringify(exported))
  })

  it('summarises the world as places, people and things for the quest writer', async () => {
    const { world } = await town()
    const summary = summarise(world)
    expect(summary.cityName).toBe(world.name)
    expect(summary.places.length).toBe(world.plots().length)
    const populated = summary.places.filter((p) => p.npcs.length > 0)
    expect(populated.length).toBeGreaterThan(2)
    expect(populated[0]!.npcs[0]!.name.length).toBeGreaterThan(2)
  })

  it('opens a city sealed by an older generator, quests and all', async () => {
    const loaded = World.load(SEALED.world)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    const sealed = loaded.value

    expect(sealed.check()).toEqual([])
    expect(sealed.plots().length).toBeGreaterThan(0)
    expect(SEALED.quests.length).toBeGreaterThan(0)
    for (const quest of SEALED.quests) {
      expect(validateQuest(quest, questView(sealed)).ok, quest.id).toBe(true)
    }

    // and it is genuinely an older city: this generator lays that seed out differently now
    const today = await town(String(SEALED.brief.seed), SEALED.brief)
    expect(today.world.grid.rows().join('')).not.toBe(sealed.grid.rows().join(''))
  })

  it('refuses a brief that does not make sense', async () => {
    const forge = new Forge(new OfflineNarrator('x'))
    const built = await forge.build({ theme: '', seed: 'x', blocksX: 999 })
    expect(built.ok).toBe(false)
    if (!built.ok) expect(built.error.code).toBe('invalid-brief')
  })
})
