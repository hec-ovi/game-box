import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Forge, OfflineNarrator, summarise } from '../src/index.ts'

async function town(seed = 'dry-gulch', overrides: Record<string, unknown> = {}) {
  const forge = new Forge(new OfflineNarrator(seed))
  const built = await forge.build({ theme: 'dusty western mining town', seed, blocksX: 2, blocksY: 2, blockCells: 14, ...overrides })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 800))
  return { forge, ...built.value }
}

describe('Forge', () => {
  it('builds a sound city with streets, buildings, people and things', async () => {
    const { world } = await town()

    expect(world.check()).toEqual([])
    expect(world.name.length).toBeGreaterThan(3)
    expect(world.plots().length).toBeGreaterThan(8)
    expect(world.npcs().length).toBeGreaterThan(5)
    expect(world.items().length).toBeGreaterThan(5)
    expect(world.interiors().length).toBe(world.plots().length)

    // the staples every town gets
    expect(world.plotsOfKind('bar').length).toBeGreaterThanOrEqual(1)
    expect(world.plotsOfKind('shop').length).toBeGreaterThanOrEqual(1)

    // every bar has somebody behind the counter, and every shop somebody at the till
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
    expect(JSON.stringify(a.world.toJSON())).not.toEqual(JSON.stringify(c.world.toJSON()))
  })

  it('writes quests that pass the quest validator and can be played to the end', async () => {
    const { world, quests } = await town()
    expect(quests.length).toBeGreaterThan(0)

    const quest = quests[0]!
    const player = PlayerState.create(world.id)
    const log = QuestLog.create(quests, player)
    expect(log.start(quest.id).ok).toBe(true)

    for (const step of quest.steps) {
      switch (step.kind) {
        case 'talk':
          log.handle({ kind: 'talked', npcId: step.npcId })
          break
        case 'goto':
          log.handle({ kind: 'arrived', place: step.place })
          break
        case 'collect':
          player.take(step.itemId, { stolen: step.allowSteal })
          log.handle({ kind: 'acquired', itemId: step.itemId, stolen: step.allowSteal })
          break
        case 'deliver':
          log.handle({ kind: 'gave', itemId: step.itemId, npcId: step.toNpcId })
          break
        default:
          break
      }
    }

    expect(log.status(quest.id)).toBe('complete')
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

  it('refuses a brief that does not make sense', async () => {
    const forge = new Forge(new OfflineNarrator('x'))
    const built = await forge.build({ theme: '', seed: 'x', blocksX: 999 })
    expect(built.ok).toBe(false)
    if (!built.ok) expect(built.error.code).toBe('invalid-brief')
  })
})
