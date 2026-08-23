import type { WorldSummary } from '@gb/forge'
import { REWARD_TABLE, validateQuest } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'

const CITY: WorldSummary = {
  cityName: 'Cold Harbour',
  theme: 'port',
  places: [
    {
      plotId: 'plot_0001',
      kind: 'bar',
      name: 'The Anchor',
      npcs: [{ npcId: 'npc_0001', name: 'Mara', role: 'bartender' }],
      items: [],
    },
    {
      plotId: 'plot_0002',
      kind: 'shop',
      name: 'Dunn Supply',
      npcs: [{ npcId: 'npc_0002', name: 'Bez', role: 'clerk' }],
      items: [{ itemId: 'item_0001', name: 'Ledger' }],
    },
  ],
}

/** A city too big to put in one prompt, so a quest is handed a corner of it. */
const BOROUGH: WorldSummary = {
  cityName: 'Cold Harbour',
  theme: 'port',
  places: Array.from({ length: 20 }, (_, i) => ({
    plotId: `plot_${String(i + 1).padStart(4, '0')}`,
    kind: 'shop' as const,
    name: `Place ${i + 1}`,
    npcs: [{ npcId: `npc_${String(i + 1).padStart(4, '0')}`, name: `Person ${i + 1}`, role: 'clerk' as const }],
    items: [{ itemId: `item_${String(i + 1).padStart(4, '0')}`, name: `Thing ${i + 1}` }],
  })),
}

/** A city strung out along one road, so which places are near which is a fact and not a feeling. */
const STREET: WorldSummary = {
  cityName: 'Cold Harbour',
  theme: 'port',
  places: Array.from({ length: 20 }, (_, i) => ({
    plotId: `plot_${String(i + 1).padStart(4, '0')}`,
    kind: 'shop' as const,
    name: `Place ${i + 1}`,
    door: { x: i * 60, z: 0 },
    npcs: [{ npcId: `npc_${String(i + 1).padStart(4, '0')}`, name: `Person ${i + 1}`, role: 'clerk' as const }],
    items: [{ itemId: `item_${String(i + 1).padStart(4, '0')}`, name: `Thing ${i + 1}` }],
  })),
}

const VIEW = {
  hasNpc: (id: string) => id === 'npc_0001' || id === 'npc_0002',
  hasPlot: (id: string) => id === 'plot_0001' || id === 'plot_0002',
  hasInterior: () => false,
  hasItem: (id: string) => id === 'item_0001',
  hasAnchor: () => false,
}

/** A quest that says what its steps do: talk, take the ledger, hand it over, done. */
function draft(id: string) {
  return {
    id,
    kind: id === 'quest_0001' ? ('main' as const) : ('side' as const),
    title: `The Ledger ${id}`,
    summary: 'Bez wants his book back.',
    giverNpcId: 'npc_0002',
    difficulty: 'small' as const,
    startStepId: 'step_0001',
    steps: [
      { id: 'step_0001', kind: 'talk', npcId: 'npc_0002', objective: 'Hear Bez out', next: ['step_0002'] },
      { id: 'step_0002', kind: 'collect', itemId: 'item_0001', objective: 'Take the ledger', next: ['step_0003'] },
      {
        id: 'step_0003',
        kind: 'deliver',
        itemId: 'item_0001',
        toNpcId: 'npc_0001',
        objective: 'Give Mara the ledger',
        next: ['step_0004'],
      },
      { id: 'step_0004', kind: 'complete', objective: 'Done', next: [] },
    ],
    reward: { money: 45, reputation: 3, faction: 'town', items: [] },
  }
}

/** The same quest as a finished document, the shape a fallback narrator hands back. */
function sealed(id: string) {
  return { format: 'game-box.quest', schemaVersion: 1, ...draft(id) }
}

/** The id the prompt told the model to use. */
function idIn(call: Sent): string {
  return /quest_\d{4}/.exec(call.user)?.[0] ?? 'quest_0001'
}

describe('writing quests', () => {
  it('sends the quest tool a schema the contract still validates, without the repeats', async () => {
    const { sent, sidecar } = fakeModel((call) => (call.toolName === 'write_quest' ? draft('quest_0001') : {}))
    await new Scribe({ sidecar }).writeQuests({ summary: CITY, sideQuests: 0 })

    const parameters = JSON.stringify(sent[0]!.parameters)
    expect(parameters.length).toBeLessThan(20_000)
    expect(parameters).toContain('$defs')
  })

  it('writes one quest per call, and the quest it hands back is one @gb/quest accepts', async () => {
    const { sent, sidecar } = fakeModel((call) => draft(idIn(call)))
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await scribe.writeQuests({ summary: CITY, sideQuests: 1 })

    expect(quests).toHaveLength(2)
    for (const quest of quests) {
      const checked = validateQuest(quest, VIEW)
      expect(checked.ok, `the quest a build ships must validate: ${JSON.stringify(checked)}`).toBe(true)
    }
    expect(quests[0]).toMatchObject({ format: 'game-box.quest', schemaVersion: 1, id: 'quest_0001' })
    expect(quests[1]).toMatchObject({ id: 'quest_0002' })
    expect(scribe.problems()).toEqual([])

    // the corner of the city it must write about is in the prompt, by id
    expect(sent[0]!.user).toContain('npc_0001')
    expect(sent[0]!.user).toContain('item_0001')
    expect(sent[0]!.user).toContain('The Anchor')
    // and the numbering agrees with itself
    expect(sent[0]!.user).toContain('quest_0001')
    expect(sent[0]!.user).not.toContain('quest 1 of')
    expect(sent[1]!.user).toContain('side errand 1 of 1')
  })

  it('tells the model the pay bands from the table the validator uses', async () => {
    const { sent, sidecar } = fakeModel((call) => draft(idIn(call)))
    await new Scribe({ sidecar, concurrency: 1 }).writeQuests({ summary: CITY, sideQuests: 0 })

    const band = REWARD_TABLE.small
    expect(sent[0]!.user).toContain(`${band.money.min} to ${band.money.max}`)
    expect(sent[0]!.user).toContain('`epic`')
  })

  it('quotes back a dead end and takes the corrected quest', async () => {
    const deadEnd = draft('quest_0001')
    deadEnd.steps[1]!.next = []
    const { sent, sidecar } = fakeModel([deadEnd, draft('quest_0001')])
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await scribe.writeQuests({ summary: CITY, sideQuests: 0 })

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('steps.1.next')
    expect(sent[1]!.user).toContain('dead end')
    expect(validateQuest(quests[0], VIEW).ok).toBe(true)
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['invalid-arguments'])
  })

  it('quotes back pay that does not fit the difficulty and takes the corrected quest', async () => {
    const unpaid = draft('quest_0001')
    unpaid.reward.money = 0
    const { sent, sidecar } = fakeModel([unpaid, draft('quest_0001')])
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await scribe.writeQuests({ summary: CITY, sideQuests: 0 })

    expect(sent[1]!.user).toContain('reward.money')
    expect(sent[1]!.user).toContain('at least 10')
    expect(validateQuest(quests[0], VIEW).ok).toBe(true)
  })

  it('quotes back an id it made up, because a step can only point at what is in the city', async () => {
    const invented = draft('quest_0001')
    invented.steps[0]!.npcId = 'npc_9999'
    const { sent, sidecar } = fakeModel([invented, draft('quest_0001')])
    await new Scribe({ sidecar, concurrency: 1 }).writeQuests({ summary: CITY, sideQuests: 0 })

    expect(sent[1]!.user).toContain('npc_9999 is not in the world')
  })

  it('fills a slot the model cannot write from the fallback rather than shipping no quest', async () => {
    const { sidecar } = fakeModel(['no-call'])
    const fallback = {
      nameCity: async () => 'Cold Harbour',
      namePlace: async () => 'Somewhere',
      describeNpc: async () => ({ name: 'Someone', personality: 'Stands there.', knowledge: ['a', 'b'] }),
      describeItem: async () => ({ name: 'Something', description: 'A thing.' }),
      writeQuests: async () => [sealed('quest_0001'), sealed('quest_0002')],
    }
    const scribe = new Scribe({ sidecar, fallback, concurrency: 1 })

    const quests = await scribe.writeQuests({ summary: CITY, sideQuests: 1 })

    expect(quests.map((quest) => (quest as { id: string }).id)).toEqual(['quest_0001', 'quest_0002'])
    for (const quest of quests) expect(validateQuest(quest, VIEW).ok).toBe(true)
    expect(scribe.problems().length).toBeGreaterThan(0)
  })

  it('quotes back a quest id it did not use, so two slots never ship the same id', async () => {
    const { sent, sidecar } = fakeModel((call, index) => draft(index === 0 ? 'quest_0009' : idIn(call)))
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await scribe.writeQuests({ summary: CITY, sideQuests: 0 })

    expect(sent[1]!.user).toContain("this quest's id is quest_0001")
    expect(quests[0]).toMatchObject({ id: 'quest_0001' })
  })

  it('hands each quest the same corner of the city on every run, and a different one per seed', async () => {
    const cornerFor = async (seed: string) => {
      const { sent, sidecar } = fakeModel((call) => draft(idIn(call)))
      await new Scribe({ sidecar, seed, concurrency: 1 }).writeQuests({ summary: BOROUGH, sideQuests: 1 })
      return sent.map((call) => call.user)
    }
    const [first, again, elsewhere] = await Promise.all([
      cornerFor('harbour'),
      cornerFor('harbour'),
      cornerFor('sandbar'),
    ])

    expect(first).toEqual(again)
    expect(first).not.toEqual(elsewhere)
    // a corner, not the whole borough
    expect(first[0]!.match(/plot_\d{4}/g)!.length).toBeLessThan(20)
  })

  it.each([
    ['people are rare', (i: number) => i >= 38, (i: number) => i < 38],
    ['things are rare', (i: number) => i < 38, (i: number) => i >= 38],
  ])('always puts somebody to ask and something to fetch in the corner it hands over (%s)', async (_name, hasPeople, hasThings) => {
    const lopsided: WorldSummary = {
      cityName: 'Cold Harbour',
      theme: 'port',
      places: Array.from({ length: 40 }, (_, i) => ({
        plotId: `plot_${String(i + 1).padStart(4, '0')}`,
        kind: 'house' as const,
        name: `Place ${i + 1}`,
        npcs: hasPeople(i)
          ? [{ npcId: `npc_${String(i + 1).padStart(4, '0')}`, name: `Person ${i}`, role: 'resident' as const }]
          : [],
        items: hasThings(i) ? [{ itemId: `item_${String(i + 1).padStart(4, '0')}`, name: `Thing ${i}` }] : [],
      })),
    }
    const { sent, sidecar } = fakeModel((call) => draft(idIn(call)))
    await new Scribe({ sidecar, seed: 'lopsided', concurrency: 1 }).writeQuests({ summary: lopsided, sideQuests: 4 })

    expect(sent.length).toBeGreaterThanOrEqual(5)
    for (const call of sent) {
      expect(call.user, 'a quest with nobody to ask cannot be written').toMatch(/npc_\d{4}/)
      expect(call.user, 'a quest with nothing to fetch cannot be written').toMatch(/item_\d{4}/)
    }
  })

  it('sets each quest in one neighbourhood, and says how far apart its doors are', async () => {
    const { sent, sidecar } = fakeModel((call) => draft(idIn(call)))
    await new Scribe({ sidecar, seed: 'harbour', concurrency: 1 }).writeQuests({ summary: STREET, sideQuests: 3 })

    for (const call of sent) {
      const home = /- (Place \d+), a shop \(plot_\d{4}\)\. The errand starts here\./.exec(call.user)![1]!
      const at = (name: string) => Number(/\d+/.exec(name)![0])
      const listed = [...call.user.matchAll(/- (Place \d+), a shop/g)].map((match) => at(match[1]!))
      const away = listed.map((one) => Math.abs(one - at(home))).sort((a, b) => a - b)

      // eight places out of twenty, and all but the one that crosses town are
      // the home's own neighbours: a shuffle of the city would not be
      expect(listed).toHaveLength(8)
      expect(away.slice(0, 7).at(-1)).toBeLessThanOrEqual(8)
      // and the walk between two doors is in the prompt, in metres
      expect(call.user).toMatch(new RegExp(`\\d+ m from ${home}`))
    }
  })

  it('tells the quest writer what the instance pass said each place is', async () => {
    const { sent, sidecar } = fakeModel((call) =>
      call.toolName === 'write_instance'
        ? {
            name: 'The Anchor',
            character: 'A bar the harbour crews drink in before the early tide.',
            people: [
              {
                postId: 'anchor_0001',
                given: 'Mara',
                family: `${/\^\[([A-Z])/.exec(String(((call.parameters as Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, unknown>>>>>>)['properties']!)['people']!['items']!['properties']!['family']!['pattern']))![1]}oss`,
                personality: 'Watches the door more than the glasses.',
                knowledge: ['The tide is late.', 'Rook has not been in.'],
              },
            ],
            things: [],
          }
        : draft(idIn(call)),
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 1 })

    await scribe.writeInstances([
      { kind: 'bar', theme: 'port', rooms: ['main'], posts: [{ postId: 'anchor_0001', role: 'bartender' }], things: [] },
    ])
    await scribe.writeQuests({ summary: CITY, sideQuests: 0 })

    expect(sent.at(-1)!.user).toContain('what it is: A bar the harbour crews drink in before the early tide.')
  })

  it('refuses a step that points somewhere the summary cannot name', async () => {
    const indoors = draft('quest_0001')
    indoors.steps[1] = {
      id: 'step_0002',
      kind: 'goto',
      place: { interiorId: 'interior_0001' },
      objective: 'Go inside',
      next: ['step_0003'],
    } as never
    const { sent, sidecar } = fakeModel([indoors, draft('quest_0001')])
    await new Scribe({ sidecar, concurrency: 1 }).writeQuests({ summary: CITY, sideQuests: 0 })

    expect(sent[1]!.user).toContain('interior_0001 is not in the world')
  })
})
