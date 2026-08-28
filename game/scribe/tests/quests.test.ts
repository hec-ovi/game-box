import type { WorldSummary } from '@gb/forge'
import { ok } from '@gb/kit'
import { REWARD_TABLE, validateQuest } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'
import { backgroundOf, lifeOf, shellOf } from './people.ts'
import { HACK_JOB, HIGH_SCORE, KEY_RUN, LOCKED, SHOPPING, lockedSheet } from './locked-city.ts'
import { PLAIN, charterOf } from './places.ts'
import { stopped, wrote } from './wrote.ts'

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

/** `CITY` as `@gb/quest` reads it: two plots, neither of them carrying an interior, so neither of them opens. */
const VIEW = {
  hasNpc: (id: string) => id === 'npc_0001' || id === 'npc_0002',
  hasPlot: (id: string) => id === 'plot_0001' || id === 'plot_0002',
  hasInterior: () => false,
  hasItem: (id: string) => id === 'item_0001',
  hasAnchor: () => false,
  hasDoor: () => false,
  hasMachine: () => false,
  opens: () => false,
}

/** A quest as a writer tells it: hear Bez out, take the ledger, hand it to Mara. */
function sheet(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind: id === 'quest_0001' ? ('main' as const) : ('side' as const),
    title: `The Ledger ${id}`,
    summary: 'Bez wants his book back.',
    giverNpcId: 'npc_0002',
    beats: [
      { kind: 'talk', npcId: 'npc_0002', objective: 'Hear Bez out' },
      { kind: 'collect', itemId: 'item_0001', objective: 'Take the ledger' },
      { kind: 'deliver', itemId: 'item_0001', toNpcId: 'npc_0001', objective: 'Give Mara the ledger' },
    ],
    reward: { money: 45, reputation: 3, faction: 'town', items: [] },
    ...extra,
  }
}

/** The same quest as a finished document, the shape a stand-in narrator hands back. */
function sealed(id: string) {
  return {
    format: 'game-box.quest',
    schemaVersion: 1,
    id,
    kind: id === 'quest_0001' ? ('main' as const) : ('side' as const),
    title: `The Ledger ${id}`,
    summary: 'Bez wants his book back.',
    giverNpcId: 'npc_0002',
    difficulty: 'small' as const,
    startStepId: 'step_0001',
    steps: [
      { id: 'step_0001', kind: 'collect', itemId: 'item_0001', objective: 'Take the ledger', next: ['step_0002'] },
      { id: 'step_0002', kind: 'deliver', itemId: 'item_0001', toNpcId: 'npc_0001', objective: 'Give Mara the ledger', next: ['step_0003'] },
      { id: 'step_0003', kind: 'complete', objective: 'Done', next: [] },
    ],
    reward: { money: 45, reputation: 3, faction: 'town', items: [] },
  }
}

/** The id the prompt told the model to use. */
function idIn(call: Sent): string {
  return /quest_\d{4}/.exec(call.user)?.[0] ?? 'quest_0001'
}

describe('writing quests', () => {
  it('sends the quest tool a schema the contract still validates, without the repeats', async () => {
    const { sent, sidecar } = fakeModel((call) => (call.toolName === 'write_quest' ? sheet('quest_0001') : {}))
    await wrote(new Scribe({ sidecar }).writeQuests({ summary: CITY, sideQuests: 0 }))

    const parameters = JSON.stringify(sent[0]!.parameters)
    expect(parameters.length).toBeLessThan(20_000)
    expect(parameters).toContain('$defs')
  })

  it('writes one quest per call, and the quest it hands back is one @gb/quest accepts', async () => {
    const { sent, sidecar } = fakeModel((call) => sheet(idIn(call)))
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: CITY, sideQuests: 1 }))

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
    const { sent, sidecar } = fakeModel((call) => sheet(idIn(call)))
    await wrote(new Scribe({ sidecar, concurrency: 1 }).writeQuests({ summary: CITY, sideQuests: 0 }))

    const band = REWARD_TABLE.small
    expect(sent[0]!.user).toContain(`${band.money.min} to ${band.money.max}`)
    expect(sent[0]!.user).toContain('`epic`')
  })

  it('builds the flow out of beats told in the wrong order, in one call', async () => {
    // measured on two live 3x3 builds: the main line stopped the city because a
    // step asked for an item before the flow guaranteed it. Told as beats, the
    // order is the compiler's to fix and the model is never asked again
    const backToFront = sheet('quest_0001')
    backToFront.beats = [backToFront.beats[0]!, backToFront.beats[2]!, backToFront.beats[1]!]
    const { sent, sidecar } = fakeModel([backToFront])
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: CITY, sideQuests: 0 }))

    expect(sent).toHaveLength(1)
    expect(scribe.problems()).toEqual([])
    expect(validateQuest(quests[0], VIEW).ok).toBe(true)
    expect((quests[0] as { steps: { kind: string }[] }).steps.map((step) => step.kind)).toEqual([
      'talk',
      'collect',
      'deliver',
      'complete',
    ])
  })

  it('reads the tier off the pay, and ships the pay the validator settled', async () => {
    const cheapCar = sheet('quest_0001', { reward: { money: 45, reputation: 3, faction: 'town', items: [], car: 'SportsCar' } })
    const { sent, sidecar } = fakeModel([cheapCar])
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: CITY, sideQuests: 0 }))

    // 45 credits with a car: a car is hard work, and hard work pays at least 200.
    // `@gb/quest` moves the number into the band rather than throwing a playable
    // job away, so it takes one call and the city carries the settled document
    expect(sent).toHaveLength(1)
    expect(quests[0]).toMatchObject({ difficulty: 'hard', reward: { money: REWARD_TABLE.hard.money.min, car: 'SportsCar' } })
    expect(validateQuest(quests[0], VIEW).ok).toBe(true)
    // and the model was never asked for a tier
    expect(JSON.stringify(sent[0]!.parameters)).not.toContain('difficulty')
  })

  it('tells the model what a reward commits the pay to, on the fields that commit it', async () => {
    const { sent, sidecar } = fakeModel((call) => sheet(idIn(call)))
    await wrote(new Scribe({ sidecar, concurrency: 1 }).writeQuests({ summary: LOCKED, sideQuests: 0 }))

    // the prompt's table is read once; this is read where the number is written
    const reward = (sent[0]!.parameters as { properties: { reward: { properties: Record<string, { description?: string }> } } }).properties.reward.properties
    expect(reward['money']!.description).toContain(`epic ${REWARD_TABLE.epic.money.min} to ${REWARD_TABLE.epic.money.max}`)
    expect(reward['deed']!.description).toContain(`at least an epic job, so \`money\` has to be ${REWARD_TABLE.epic.money.min} or more`)
  })

  it('quotes back an id it made up, because a beat can only point at what is in the city', async () => {
    const invented = sheet('quest_0001')
    invented.beats[0] = { kind: 'talk', npcId: 'npc_9999', objective: 'Hear the fixer out' } as never
    const { sent, sidecar } = fakeModel([invented, sheet('quest_0001')])
    await wrote(new Scribe({ sidecar, concurrency: 1 }).writeQuests({ summary: CITY, sideQuests: 0 }))

    expect(sent[1]!.user).toContain('beats.0: npc npc_9999 is not in the world')
  })

  it('drops a side job the model cannot write and keeps the rest of the town\'s work', async () => {
    // measured on a live 3x3 city: one side errand priced under its band refused
    // the whole city, which left the owner with nothing over a job nobody would
    // have missed
    const { sidecar } = fakeModel((call) => (idIn(call) === 'quest_0003' ? 'no-call' : sheet(idIn(call))))
    const scribe = new Scribe({ sidecar, concurrency: 1, attempts: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: CITY, sideQuests: 2 }))

    expect(quests.map((quest) => (quest as { id: string }).id)).toEqual(['quest_0001', 'quest_0002'])
    for (const quest of quests) expect(validateQuest(quest, VIEW).ok).toBe(true)
    // and the town is one job short for a reason the caller can report
    expect(scribe.dropped()).toHaveLength(1)
    expect(scribe.dropped()[0]).toMatchObject({ stage: 'quests', at: 'quest:2', code: 'no-tool-call' })
    expect(scribe.dropped()[0]!.message).toContain('side job 2 could not be written')
  })

  it('stops the stage when the main line cannot be written, whatever the side jobs did', async () => {
    const { sidecar } = fakeModel((call) => (idIn(call) === 'quest_0001' ? 'no-call' : sheet(idIn(call))))
    const scribe = new Scribe({ sidecar, concurrency: 1, attempts: 1 })

    const failure = await stopped(scribe.writeQuests({ summary: CITY, sideQuests: 2 }))

    // the city's spine: a town whose main story the model would not write is not the town that was asked for
    expect(failure).toMatchObject({ stage: 'quests', at: 'quest:0', code: 'no-tool-call' })
    expect(failure.message).toContain('the main line could not be written')
    expect(scribe.dropped()).toEqual([])
  })

  it('takes a quest for every slot from a stand-in a caller hands in, which nothing in the game does', async () => {
    const { sidecar } = fakeModel(['no-call'])
    const standIn = {
      nameCity: async () => ok('Cold Harbour'),
      namePlace: async () => ok('Somewhere'),
      describeNpc: async () => ok({ name: 'Someone', personality: 'Stands there.', knowledge: ['a', 'b'] }),
      describeItem: async () => ok({ name: 'Something', description: 'A thing.' }),
      writeQuests: async () => ok([sealed('quest_0001'), sealed('quest_0002')]),
    }
    const scribe = new Scribe({ sidecar, standIn, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: CITY, sideQuests: 1 }))

    expect(quests.map((quest) => (quest as { id: string }).id)).toEqual(['quest_0001', 'quest_0002'])
    for (const quest of quests) expect(validateQuest(quest, VIEW).ok).toBe(true)
    expect(scribe.problems().length).toBeGreaterThan(0)
  })

  it('quotes back a quest id it did not use, so two slots never ship the same id', async () => {
    const { sent, sidecar } = fakeModel((call, index) => sheet(index === 0 ? 'quest_0009' : idIn(call)))
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: CITY, sideQuests: 0 }))

    expect(sent[1]!.user).toContain("this quest's id is quest_0001")
    expect(quests[0]).toMatchObject({ id: 'quest_0001' })
  })

  it('hands each quest the same corner of the city on every run, and a different one per seed', async () => {
    const cornerFor = async (seed: string) => {
      const { sent, sidecar } = fakeModel((call) => sheet(idIn(call)))
      await wrote(new Scribe({ sidecar, seed, concurrency: 1 }).writeQuests({ summary: BOROUGH, sideQuests: 1 }))
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
    const { sent, sidecar } = fakeModel((call) => sheet(idIn(call)))
    // the drafts this fake writes name ids the corner does not hold, which is
    // beside the point: what is measured is the corner every call was shown
    await new Scribe({ sidecar, seed: 'lopsided', concurrency: 1 }).writeQuests({ summary: lopsided, sideQuests: 4 })

    expect(sent.length).toBeGreaterThanOrEqual(5)
    for (const call of sent) {
      expect(call.user, 'a quest with nobody to ask cannot be written').toMatch(/npc_\d{4}/)
      expect(call.user, 'a quest with nothing to fetch cannot be written').toMatch(/item_\d{4}/)
    }
  })

  it('sets each quest in one neighbourhood, and says how far apart its doors are', async () => {
    const { sent, sidecar } = fakeModel((call) => sheet(idIn(call)))
    await wrote(new Scribe({ sidecar, seed: 'harbour', concurrency: 1 }).writeQuests({ summary: STREET, sideQuests: 3 }))

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
                family: `${shellOf(call).letters[0]}oss`,
                personality: 'Watches the door more than the glasses.',
                knowledge: ['The tide is late.', 'Rook has not been in.'],
                life: lifeOf('Mara'),
                background: backgroundOf('Mara'),
              },
            ],
            things: [],
          }
        : sheet(idIn(call)),
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 1 })

    await wrote(scribe.writeInstances([
      { index: 0, kind: 'bar', name: 'Place 0', cast: [], charter: charterOf('bar'), theme: 'port', rooms: ['main'], posts: [{ postId: 'anchor_0001', role: 'bartender', index: 0 }], things: [], has: PLAIN },
    ]))
    await wrote(scribe.writeQuests({ summary: CITY, sideQuests: 0 }))

    expect(sent.at(-1)!.user).toContain('what it is: A bar the harbour crews drink in before the early tide.')
  })

  it('tells every quest what the town is about, and what the owner asked of the errands', async () => {
    const premise = {
      livesOn: 'Container freight off the elevated line.',
      happened: 'The line shut last winter.',
      stake: 'Who gets the freight contract.',
      sides: [
        { name: 'the Vance yards', wants: 'the contract back' },
        { name: 'the Dockhands Local', wants: 'the yards broken up' },
      ],
      common: ['Nothing has moved since November.'],
      build: { moreOf: ['warehouse' as const], fewerOf: [], mustHave: [] },
    }
    const asks = { mainQuest: 'a missing ledger that both sides want', sideQuests: 'small favours between neighbours', tone: 'tired and funny' }
    const { sent, sidecar } = fakeModel((call) => sheet(idIn(call)))
    await wrote(new Scribe({ sidecar, concurrency: 1 }).writeQuests({ summary: { ...CITY, premise, asks }, sideQuests: 1 }))

    const [main, side] = sent.map((call) => call.user)
    expect(main).toContain('Lives on: Container freight off the elevated line.')
    expect(main).toContain('a missing ledger that both sides want')
    expect(main).not.toContain('small favours between neighbours')
    expect(side).toContain('small favours between neighbours')
    expect(side).not.toContain('a missing ledger that both sides want')
    expect(main).toContain('The tone the owner asked for: tired and funny')
    expect(side).toContain('The tone the owner asked for: tired and funny')

    // and a town with nothing asked of it is asked nothing about it
    const plain = fakeModel((call) => sheet(idIn(call)))
    await wrote(new Scribe({ sidecar: plain.sidecar, concurrency: 1 }).writeQuests({ summary: CITY, sideQuests: 0 }))
    expect(plain.sent[0]!.user).not.toContain('the owner')
    expect(plain.sent[0]!.user).toContain('Nothing has been written about the city itself yet.')
  })

  it('refuses a beat that points somewhere the summary cannot name', async () => {
    const indoors = sheet('quest_0001')
    indoors.beats[1] = { kind: 'goto', where: { interiorId: 'interior_0001' }, objective: 'Go inside' } as never
    const { sent, sidecar } = fakeModel([indoors, sheet('quest_0001')])
    await wrote(new Scribe({ sidecar, concurrency: 1 }).writeQuests({ summary: CITY, sideQuests: 0 }))

    expect(sent[1]!.user).toContain('interior_0001 is not in the world')
  })
})

describe('writing quests through locks, screens and counters', () => {
  it('shows the writer every lock, what opens it, every screen, every price and what is for sale', async () => {
    const { sent, sidecar } = fakeModel(() => lockedSheet(KEY_RUN))
    await wrote(new Scribe({ sidecar, concurrency: 1 }).writeQuests({ summary: LOCKED, sideQuests: 0 }))

    const user = sent[0]!.user
    expect(user).toContain('locked doors: door_0003, the Cellar door, opened by the key item_0001 in Neve Vesper\'s pocket (npc_0002)')
    expect(user).toContain('Vidya Sellers (guard, npc_0003, behind the locked Cellar door door_0003)')
    expect(user).toContain('Worn glass (item_0002, owned by npc_0002, sells for 3, behind the locked Cellar door door_0003)')
    expect(user).toContain('screens: machine_0001 runs snake, open to anybody')
    expect(user).toContain('machine_0002 holds the mail, locked, code "bramble-80"')
    expect(user).toContain('for sale: 4693 credits')
    expect(user).toContain('interior_0003')
    // and the tool offers the four steps, the password effect and the three new rewards
    const parameters = JSON.stringify(sent[0]!.parameters)
    for (const word of ['"unlock"', '"hack"', '"beat-game"', '"buy"', '"give-password"', '"access"', '"car"', '"deed"']) expect(parameters).toContain(word)
    expect(user).toContain('doors opened, at most')
  })

  it.each([
    ['a key run paid with the run of the door', KEY_RUN, { reward: { money: 45, reputation: 3, faction: 'town', items: [], access: [{ doorId: 'door_0003' }] } }],
    ['a hack with the code given first', HACK_JOB, {}],
    ['a bet on the bar screen', HIGH_SCORE, {}],
    ['a purchase the city prices itself', SHOPPING, {}],
    ['the finale that hands over the house', KEY_RUN, { reward: { money: 1200, reputation: 20, faction: 'town', items: [], deed: 'interior_0003' } }],
  ])('takes %s first time', async (_name, beats, extra) => {
    const { sent, sidecar } = fakeModel(() => lockedSheet(beats, extra))
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: LOCKED, sideQuests: 0 }))

    expect(sent).toHaveLength(1)
    expect(scribe.problems()).toEqual([])
    expect(quests).toHaveLength(1)
  })

  it.each([
    // getting a key out of a pocket before a door is bookkeeping, not story: the
    // city knows who carries it, so the conversation goes in and the writer is
    // never asked again
    ['a door the beats never opened', KEY_RUN.slice(1), ['talk', 'unlock', 'collect', 'deliver', 'complete']],
    ['a thing behind a door the beats never opened', [KEY_RUN[2]!, KEY_RUN[3]!], ['talk', 'unlock', 'collect', 'deliver', 'complete']],
    ['a screen hacked without its code', HACK_JOB.slice(1), ['talk', 'hack', 'talk', 'complete']],
  ])('opens the way past %s and takes the quest first time', async (_name, beats, kinds) => {
    const { sent, sidecar } = fakeModel(() => lockedSheet(beats))
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: LOCKED, sideQuests: 0 }))

    expect(sent).toHaveLength(1)
    expect(scribe.problems()).toEqual([])
    expect((quests[0] as { steps: { kind: string }[] }).steps.map((step) => step.kind)).toEqual(kinds)
  })

  it.each([
    ['a lock nobody in the place can be asked about', [{ kind: 'collect', itemId: 'item_0005', objective: 'Take the sealed crate' }, { kind: 'deliver', itemId: 'item_0005', toNpcId: 'npc_0004', objective: 'Bring Vidya the crate' }], {}, 'beats.0.itemId: item_0005 is behind the locked Strongroom door at Halloran Depot (door_0004)'],
    ['a game on a screen that runs none', HIGH_SCORE.map((beat) => (beat.kind === 'beat-game' ? { ...beat, machineId: 'machine_0002' } : beat)), {}, 'beats.0.machineId: machine_0002 runs mail, not a game'],
    ['a giver behind a lock', KEY_RUN, { giverNpcId: 'npc_0003' }, 'giverNpcId: npc_0003 stands behind the locked Cellar door'],
  ])('quotes back %s and takes the corrected quest', async (_name, broken, extra, message) => {
    const { sent, sidecar } = fakeModel([lockedSheet(broken, extra), lockedSheet(KEY_RUN)])
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: LOCKED, sideQuests: 0 }))

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain(message)
    expect(quests).toHaveLength(1)
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['invalid-arguments'])
  })
})

/**
 * A town as it stands when the work is written: laid out, numbered, and named
 * by nobody yet. Every name in it is the placeholder the city was planned
 * under, which is what a line has to say for binding to find it later.
 */
const LAID_OUT: WorldSummary = {
  cityName: 'City',
  theme: 'port',
  districts: [
    { districtId: 'district_0001', name: 'Zone 1' },
    { districtId: 'district_0002', name: 'Zone 2' },
  ],
  places: [
    {
      plotId: 'plot_0001',
      interiorId: 'interior_0001',
      kind: 'bar',
      name: 'Instance 1',
      districtId: 'district_0001',
      door: { x: 0, z: 0 },
      npcs: [{ npcId: 'npc_0001', name: 'Person 1', role: 'bartender' }],
      items: [{ itemId: 'item_0001', name: 'Thing 1' }],
    },
    {
      plotId: 'plot_0002',
      interiorId: 'interior_0002',
      kind: 'shop',
      name: 'Instance 2',
      districtId: 'district_0002',
      door: { x: 60, z: 0 },
      npcs: [{ npcId: 'npc_0002', name: 'Person 2', role: 'clerk' }],
      items: [{ itemId: 'item_0002', name: 'Thing 2' }],
    },
  ],
}

/** The errand as it should be told: every line naming what its own beat points at. */
const TOLD_STRAIGHT = [
  { kind: 'goto', where: { plotId: 'plot_0002' }, objective: 'Walk over to Instance 2 in Zone 2.' },
  { kind: 'talk', npcId: 'npc_0002', objective: 'Ask her what she knows.' },
  { kind: 'collect', itemId: 'item_0002', objective: 'Take Thing 2 from Instance 2.' },
  { kind: 'deliver', itemId: 'item_0002', toNpcId: 'npc_0001', objective: 'Give Person 1 the parcel at Instance 1.' },
]

function laidOutSheet(beats: unknown[]) {
  return {
    id: 'quest_0001',
    kind: 'main' as const,
    title: 'The parcel',
    summary: 'Somebody wants it brought over.',
    giverNpcId: 'npc_0001',
    beats,
    reward: { money: 45, reputation: 3, faction: 'town', items: [] },
  }
}

describe('the words a quest is written in', () => {
  it('takes a draft whose every line names what its own beat points at', async () => {
    const { sent, sidecar } = fakeModel(() => laidOutSheet(TOLD_STRAIGHT))
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: LAID_OUT, sideQuests: 0 }))

    expect(sent).toHaveLength(1)
    expect(scribe.problems()).toEqual([])
    expect(quests).toHaveLength(1)
  })

  it('refuses a line that calls a building something the town has not got', async () => {
    // measured on a live city: a beat pointed at a plot and its line read "the
    // old customs house", a building nobody built. Binding swaps placeholders,
    // so an invented name goes straight to the player with the marker pointing
    // somewhere else
    const invented = [{ kind: 'goto', where: { plotId: 'plot_0002' }, objective: 'Head out to the old customs house.' }, ...TOLD_STRAIGHT.slice(1)]
    const { sent, sidecar } = fakeModel([laidOutSheet(invented), laidOutSheet(TOLD_STRAIGHT)])
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: LAID_OUT, sideQuests: 0 }))

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('beats.0.objective: this beat sends the player to plot_0002, which this town calls Instance 2')
    expect(quests).toHaveLength(1)
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['invalid-arguments'])
  })

  it('refuses a line that names somebody standing in another building', async () => {
    const wrongPerson = [
      TOLD_STRAIGHT[0]!,
      { kind: 'talk', npcId: 'npc_0002', objective: 'Ask Person 1 what she knows.' },
      ...TOLD_STRAIGHT.slice(2),
    ]
    const { sent, sidecar } = fakeModel([laidOutSheet(wrongPerson), laidOutSheet(TOLD_STRAIGHT)])
    const scribe = new Scribe({ sidecar, concurrency: 1 })

    const quests = await wrote(scribe.writeQuests({ summary: LAID_OUT, sideQuests: 0 }))

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('beats.1.objective: Person 1 is not at Instance 2, where this beat happens: name only the people standing there (Person 2)')
    expect(quests).toHaveLength(1)
  })
})
