import type { WorldSummary } from '@gb/forge'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fetchAndCarry } from './errand.ts'
import { fakeModel } from './fake-model.ts'
import { wrote } from './wrote.ts'

const CITY: WorldSummary = {
  cityName: 'Cold Harbour',
  theme: 'port',
  places: Array.from({ length: 6 }, (_, i) => ({
    plotId: `plot_000${i + 1}`,
    kind: i % 2 === 0 ? ('bar' as const) : ('shop' as const),
    name: `Place ${i + 1}`,
    npcs: [{ npcId: `npc_000${i + 1}`, name: `Person ${i + 1}`, role: i % 2 === 0 ? ('bartender' as const) : ('clerk' as const) }],
    items: [{ itemId: `item_000${i + 1}`, name: `Thing ${i + 1}` }],
  })),
}

/** Answers land back to front, so arrival order is never the order the calls went out in. */
function backwards(total: number) {
  let live = 0
  let peak = 0
  const model = fakeModel(async (call, index) => {
    live++
    peak = Math.max(peak, live)
    await new Promise((resolve) => setTimeout(resolve, (total - index) * 4))
    live--
    return fetchAndCarry(call)
  })
  return { ...model, peak: () => peak }
}

describe('quests written several at a time', () => {
  it('come back in the order they were asked for, never the order they landed in', async () => {
    const model = backwards(6)
    const quests = await wrote(
      new Scribe({ sidecar: model.sidecar, concurrency: 3 }).writeQuests({ summary: CITY, sideQuests: 5 }),
    )

    expect(quests.map((quest) => (quest as { id: string }).id)).toEqual([
      'quest_0001',
      'quest_0002',
      'quest_0003',
      'quest_0004',
      'quest_0005',
      'quest_0006',
    ])
    expect(model.peak()).toBe(3)
  })

  it('never hold the engine more work than it has slots for', async () => {
    const model = backwards(6)
    await wrote(new Scribe({ sidecar: model.sidecar, concurrency: 2 }).writeQuests({ summary: CITY, sideQuests: 5 }))
    expect(model.peak()).toBe(2)
  })

  it('are told the same thing on every run, whatever order the answers came back in', async () => {
    const runs = await Promise.all(
      [1, 2].map(async () => {
        const model = backwards(6)
        await wrote(
          new Scribe({ sidecar: model.sidecar, concurrency: 3, seed: 'harbour' }).writeQuests({ summary: CITY, sideQuests: 5 }),
        )
        return model.sent.map((call) => call.user).sort()
      }),
    )
    expect(runs[0]).toEqual(runs[1])
  })

  it('are told the titles of the wave before them, and nothing from their own wave', async () => {
    const model = backwards(6)
    await wrote(new Scribe({ sidecar: model.sidecar, concurrency: 3 }).writeQuests({ summary: CITY, sideQuests: 5 }))

    const byId = new Map(model.sent.map((call) => [/quest_\d{4}/.exec(call.user)![0], call.user]))
    expect(byId.get('quest_0001')).toContain('None yet.')
    expect(byId.get('quest_0003')).toContain('None yet.')
    expect(byId.get('quest_0004')).toContain('Errand quest_0001')
    expect(byId.get('quest_0004')).not.toContain('Errand quest_0005')
  })

  it('writes one quest per side quest asked for, with no ceiling on how many', async () => {
    const model = backwards(30)
    const quests = await wrote(
      new Scribe({ sidecar: model.sidecar, concurrency: 5 }).writeQuests({ summary: CITY, sideQuests: 29 }),
    )
    expect(quests).toHaveLength(30)
  })
})
