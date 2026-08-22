import { PlayerState } from '@gb/play'
import { describe, expect, it } from 'vitest'
import { QuestLog, validateQuest, type QuestDoc, type WorldView } from '../src/index.ts'

/** A world with two people, one warehouse and one ledger. */
const world: WorldView = {
  hasNpc: (id) => ['npc_0001', 'npc_0002', 'npc_0003'].includes(id),
  hasPlot: (id) => id === 'plot_0001',
  hasInterior: (id) => id === 'interior_0001',
  hasItem: (id) => ['item_0001', 'item_0002'].includes(id),
  hasAnchor: (interiorId, anchorId) => interiorId === 'interior_0001' && anchorId === 'anchor_0001',
}

const MARA = 'npc_0001'
const HOLLIS = 'npc_0002'
const LEDGER = 'item_0001'

/** Talk to Mara, go to the warehouse, take the ledger, bring it to Hollis. */
function fetchQuest(overrides: Partial<QuestDoc> = {}): QuestDoc {
  return {
    format: 'game-box.quest',
    schemaVersion: 1,
    id: 'quest_0001',
    kind: 'side',
    title: 'The Missing Ledger',
    summary: 'Mara wants the bar ledger back from the warehouse before Hollis notices it is gone.',
    giverNpcId: MARA,
    startStepId: 'step_0001',
    steps: [
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'], requires: [], effects: [] },
      { id: 'step_0002', kind: 'goto', place: { plotId: 'plot_0001' }, objective: 'Reach the warehouse', next: ['step_0003'], requires: [], effects: [] },
      { id: 'step_0003', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Take the ledger', next: ['step_0004'], requires: [], effects: [] },
      { id: 'step_0004', kind: 'deliver', itemId: LEDGER, toNpcId: HOLLIS, objective: 'Hand the ledger to Hollis', next: ['step_0005'], requires: [], effects: [{ kind: 'set-flag', flag: 'ledger-returned', value: true }] },
      { id: 'step_0005', kind: 'complete', objective: 'Done', next: [], requires: [], effects: [] },
    ],
    reward: { money: 40, reputation: 5, faction: 'town', items: [] },
    ...overrides,
  } as QuestDoc
}

describe('validateQuest', () => {
  it('accepts a flow that can actually be played', () => {
    const result = validateQuest(fetchQuest(), world)
    expect(result.ok).toBe(true)
  })

  it('rejects a quest that names someone or something the world does not have', () => {
    const quest = fetchQuest()
    quest.steps[0] = { ...quest.steps[0]!, npcId: 'npc_0404' } as QuestDoc['steps'][number]
    const result = validateQuest(quest, world)
    expect(result.ok).toBe(false)
    if (!result.ok && result.error.code === 'broken-flow') {
      expect(result.error.problems.some((p) => p.message.includes('npc_0404'))).toBe(true)
    } else {
      throw new Error('expected broken-flow')
    }
  })

  it('rejects asking the player to hand over something they were never given', () => {
    const quest = fetchQuest()
    // drop the collect step: the deliver now comes before the ledger is in hand
    quest.steps = quest.steps.filter((s) => s.id !== 'step_0003')
    quest.steps[1] = { ...quest.steps[1]!, next: ['step_0004'] } as QuestDoc['steps'][number]

    const result = validateQuest(quest, world)
    expect(result.ok).toBe(false)
    if (!result.ok && result.error.code === 'broken-flow') {
      expect(result.error.problems.some((p) => p.message.includes('before the player is guaranteed'))).toBe(true)
    } else {
      throw new Error('expected broken-flow')
    }
  })

  it('rejects escorting someone who never joins', () => {
    const quest = fetchQuest()
    quest.steps[2] = {
      id: 'step_0003',
      kind: 'escort',
      npcId: 'npc_0003',
      place: { plotId: 'plot_0001' },
      objective: 'Walk the witness to the warehouse',
      next: ['step_0005'],
      requires: [],
      effects: [],
    }
    quest.steps = quest.steps.filter((s) => s.id !== 'step_0004')

    const result = validateQuest(quest, world)
    expect(result.ok).toBe(false)
    if (!result.ok && result.error.code === 'broken-flow') {
      expect(result.error.problems.some((p) => p.message.includes('has not joined'))).toBe(true)
    } else {
      throw new Error('expected broken-flow')
    }
  })

  it('rejects loops, dead ends, orphans and quests that never finish', () => {
    const loop = fetchQuest()
    loop.steps[3] = { ...loop.steps[3]!, next: ['step_0002'] } as QuestDoc['steps'][number]
    expect(problems(loop)).toContain('the flow loops back on itself')

    const deadEnd = fetchQuest()
    deadEnd.steps[3] = { ...deadEnd.steps[3]!, next: [] } as QuestDoc['steps'][number]
    expect(problems(deadEnd).join(' ')).toContain('dead end')

    const orphan = fetchQuest()
    orphan.steps.push({ id: 'step_0009', kind: 'talk', npcId: HOLLIS, objective: 'Never reachable', next: ['step_0005'], requires: [], effects: [] })
    expect(problems(orphan).join(' ')).toContain('unreachable')

    const noWin = fetchQuest()
    noWin.steps[4] = { id: 'step_0005', kind: 'fail', objective: 'Too late', next: [], requires: [], effects: [] }
    expect(problems(noWin).join(' ')).toContain('no path reaches a complete step')
  })

  it('rejects a document that is not a quest at all', () => {
    const result = validateQuest({ format: 'nope' }, world)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('invalid-quest')
  })

  function problems(quest: QuestDoc): string[] {
    const result = validateQuest(quest, world)
    if (result.ok) return []
    return result.error.code === 'broken-flow' ? result.error.problems.map((p) => p.message) : [result.error.code]
  }
})

describe('QuestLog', () => {
  function playthrough() {
    const quest = validateQuest(fetchQuest(), world)
    if (!quest.ok) throw new Error('fixture quest is broken')
    const player = PlayerState.create('world_0001')
    return { log: QuestLog.create([quest.value], player), player }
  }

  it('runs a fetch quest from the giver to the reward', () => {
    const { log, player } = playthrough()
    expect(log.offeredBy(MARA).map((q) => q.id)).toEqual(['quest_0001'])

    const started = log.start('quest_0001')
    expect(started.ok).toBe(true)
    expect(log.objectives().map((o) => o.text)).toEqual(['Hear Mara out'])

    log.handle({ kind: 'talked', npcId: MARA })
    expect(log.objectives().map((o) => o.text)).toEqual(['Reach the warehouse'])

    // an event for somewhere else moves nothing
    log.handle({ kind: 'arrived', place: { interiorId: 'interior_0001' } })
    expect(log.objectives().map((o) => o.text)).toEqual(['Reach the warehouse'])

    log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
    player.take(LEDGER, { stolen: true })
    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: true })
    expect(log.objectives().map((o) => o.text)).toEqual(['Hand the ledger to Hollis'])

    const finished = log.handle({ kind: 'gave', itemId: LEDGER, npcId: HOLLIS })
    expect(finished.ok).toBe(true)
    if (finished.ok) {
      expect(finished.value.map((c) => c.kind)).toContain('quest-complete')
    }
    expect(log.status('quest_0001')).toBe('complete')
    expect(log.objectives()).toEqual([])
    expect(player.money).toBe(40)
    expect(player.reputation()).toBe(5)
    expect(player.flag('ledger-returned')).toBe(true)
    expect(log.offeredBy(MARA)).toEqual([])
  })

  it('refuses a stolen pickup when the step does not allow stealing', () => {
    const strict = fetchQuest()
    strict.steps[2] = { ...strict.steps[2]!, allowSteal: false } as QuestDoc['steps'][number]
    const validated = validateQuest(strict, world)
    if (!validated.ok) throw new Error('fixture broken')
    const player = PlayerState.create('world_0001')
    const log = QuestLog.create([validated.value], player)

    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: true })
    expect(log.objectives().map((o) => o.text)).toEqual(['Take the ledger'])

    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: false })
    expect(log.objectives().map((o) => o.text)).toEqual(['Hand the ledger to Hollis'])
  })

  it('holds a step back until its condition is met', () => {
    const gated = fetchQuest()
    gated.steps[3] = {
      ...gated.steps[3]!,
      requires: [{ kind: 'money-at-least', amount: 20 }],
    } as QuestDoc['steps'][number]
    const validated = validateQuest(gated, world)
    if (!validated.ok) throw new Error('fixture broken')
    const player = PlayerState.create('world_0001')
    const log = QuestLog.create([validated.value], player)

    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: false })
    log.handle({ kind: 'gave', itemId: LEDGER, npcId: HOLLIS })
    expect(log.status('quest_0001')).toBe('active')

    player.earn(25)
    log.handle({ kind: 'gave', itemId: LEDGER, npcId: HOLLIS })
    expect(log.status('quest_0001')).toBe('complete')
  })

  it('takes the branch the player chose and can fail a quest', () => {
    const branching = fetchQuest({
      startStepId: 'step_0001',
      steps: [
        {
          id: 'step_0001',
          kind: 'choice',
          prompt: 'Hollis offers you more than Mara did.',
          objective: 'Decide who gets the ledger',
          options: [
            { id: 'keep-word', label: 'Give it to Mara', next: 'step_0002' },
            { id: 'sell-out', label: 'Sell it to Hollis', next: 'step_0003' },
          ],
          next: [],
          requires: [],
          effects: [{ kind: 'give-item', itemId: LEDGER }],
        },
        { id: 'step_0002', kind: 'deliver', itemId: LEDGER, toNpcId: MARA, objective: 'Give Mara the ledger', next: ['step_0004'], requires: [], effects: [] },
        { id: 'step_0003', kind: 'deliver', itemId: LEDGER, toNpcId: HOLLIS, objective: 'Sell out', next: ['step_0005'], requires: [], effects: [{ kind: 'reputation', faction: 'town', delta: -10 }] },
        { id: 'step_0004', kind: 'complete', objective: 'Done', next: [], requires: [], effects: [] },
        { id: 'step_0005', kind: 'fail', objective: 'Mara will hear about this', next: [], requires: [], effects: [] },
      ],
    })
    const validated = validateQuest(branching, world)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return

    const player = PlayerState.create('world_0001')
    const log = QuestLog.create([validated.value], player)
    log.start('quest_0001')
    log.handle({ kind: 'chose', questId: 'quest_0001', stepId: 'step_0001', optionId: 'sell-out' })
    expect(player.has(LEDGER)).toBe(true)
    expect(log.objectives().map((o) => o.text)).toEqual(['Sell out'])

    log.handle({ kind: 'gave', itemId: LEDGER, npcId: HOLLIS })
    expect(log.status('quest_0001')).toBe('failed')
    expect(player.reputation()).toBe(-10)
    expect(player.money).toBe(0)
  })

  it('waits for both branches of a join before moving on', () => {
    const parallel = fetchQuest({
      startStepId: 'step_0001',
      steps: [
        { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Take the job', next: ['step_0002', 'step_0003'], requires: [], effects: [] },
        { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Find the ledger', next: ['step_0004'], requires: [], effects: [] },
        { id: 'step_0003', kind: 'collect', itemId: 'item_0002', allowSteal: true, objective: 'Find the key', next: ['step_0004'], requires: [], effects: [] },
        { id: 'step_0004', kind: 'join', waitFor: ['step_0002', 'step_0003'], objective: 'Have both', next: ['step_0005'], requires: [], effects: [] },
        { id: 'step_0005', kind: 'deliver', itemId: LEDGER, toNpcId: MARA, objective: 'Return to Mara', next: ['step_0006'], requires: [], effects: [] },
        { id: 'step_0006', kind: 'complete', objective: 'Done', next: [], requires: [], effects: [] },
      ],
    })
    const validated = validateQuest(parallel, world)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return

    const log = QuestLog.create([validated.value], PlayerState.create('world_0001'))
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    expect(log.objectives().map((o) => o.text).toSorted()).toEqual(['Find the key', 'Find the ledger'])

    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: false })
    expect(log.objectives().map((o) => o.text)).toEqual(['Find the key'])

    log.handle({ kind: 'acquired', itemId: 'item_0002', stolen: false })
    expect(log.objectives().map((o) => o.text)).toEqual(['Return to Mara'])
  })

  it('treats an item as a quest item only while a live quest still needs it', () => {
    const { log, player } = playthrough()
    expect(log.isQuestItem(LEDGER)).toBe(false)

    log.start('quest_0001')
    expect(log.isQuestItem(LEDGER)).toBe(true)
    expect(log.isQuestItem('item_0002')).toBe(false)

    log.handle({ kind: 'talked', npcId: MARA })
    log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
    player.take(LEDGER)
    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: false })
    expect(log.isQuestItem(LEDGER)).toBe(true)

    log.handle({ kind: 'gave', itemId: LEDGER, npcId: HOLLIS })
    expect(log.status('quest_0001')).toBe('complete')
    expect(log.isQuestItem(LEDGER)).toBe(false)
  })

  it('carries a short marker label and a hint through to the objective', () => {
    const signposted = fetchQuest()
    signposted.steps[1] = {
      ...signposted.steps[1]!,
      markerLabel: 'Warehouse',
      hint: 'It is the long shed at the end of the freight road.',
    } as QuestDoc['steps'][number]
    const validated = validateQuest(signposted, world)
    if (!validated.ok) throw new Error('fixture broken')
    const log = QuestLog.create([validated.value], PlayerState.create('world_0001'))

    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    const objective = log.objectives()[0]!
    expect(objective.markerLabel).toBe('Warehouse')
    expect(objective.hint).toContain('freight road')
  })

  it('resumes exactly where a save left off, and rejects a broken save or event', () => {
    const { log, player } = playthrough()
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    const saved = JSON.parse(JSON.stringify(log.toJSON()))

    const resumed = QuestLog.load(saved, log.quests(), player)
    expect(resumed.ok).toBe(true)
    if (resumed.ok) {
      expect(resumed.value.objectives().map((o) => o.text)).toEqual(['Reach the warehouse'])
      resumed.value.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
      expect(resumed.value.objectives().map((o) => o.text)).toEqual(['Take the ledger'])
    }

    const badSave = QuestLog.load({ format: 'nope' }, log.quests(), player)
    expect(badSave.ok).toBe(false)
    if (!badSave.ok) expect(badSave.error.code).toBe('invalid-progress')

    const badEvent = log.handle({ kind: 'teleported' })
    expect(badEvent.ok).toBe(false)
    if (!badEvent.ok) expect(badEvent.error.code).toBe('invalid-event')

    expect(log.start('nope_0001').ok).toBe(false)
    expect(log.start('quest_0001').ok).toBe(false)
  })
})
