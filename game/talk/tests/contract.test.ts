import { PlayerState } from '@gb/play'
import { QuestLog, validateQuest, type QuestDoc } from '@gb/quest'
import { Sidecar } from '@gb/sidecar'
import { World, type Interior, type Item, type Npc, type Placement } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Conversation, type TalkEvent } from '../src/index.ts'

/** A bar, its bartender Mara, a courier Hollis across the room, and a ledger. */
function bar() {
  const world = World.create({ name: 'Cold Harbour', theme: 'port', seed: 'talk', width: 16, height: 16 })
  world.paint({ x: 0, y: 6, w: 16, h: 1 }, 'sidewalk')
  const plot = world.addPlot({
    kind: 'bar',
    name: 'The Anchor',
    rect: { x: 2, y: 2, w: 4, h: 4 },
    entrance: { cell: { x: 3, y: 6 }, facing: 'south' },
    storeys: 1,
    style: 'port-bar',
  })
  if (!plot.ok) throw new Error('fixture')

  const room = world.mintId('room')
  const serve = world.mintId('anchor')
  const stool = world.mintId('anchor')
  const interior: Interior = {
    id: world.mintId('interior'),
    plotId: plot.value.id,
    kind: 'bar',
    size: { w: 8, h: 8 },
    rooms: [{ id: room, kind: 'main', name: 'Taproom', rect: { x: 0, y: 0, w: 8, h: 8 } }],
    doors: [{ id: world.mintId('door'), from: 'outside', to: room, pos: { x: 4, y: 0 }, rot: 180, locked: false }],
    furniture: [],
    anchors: [
      { id: serve, kind: 'serve', roomId: room, pos: { x: 4, y: 6 }, rot: 180 },
      { id: stool, kind: 'sit-drink', roomId: room, pos: { x: 3, y: 4 }, rot: 0 },
    ],
  }
  world.addInterior(interior)

  const mara: Npc = {
    id: world.mintId('npc'),
    name: 'Mara Cole',
    role: 'bartender',
    appearance: { base: 'female', variant: 1 },
    station: { interiorId: interior.id, anchorId: serve },
    personality: 'Dry, unhurried, watches the door.',
    knowledge: ['The tide takes the low road twice a day.', 'Rook has not been in since Tuesday.'],
  }
  const hollis: Npc = {
    id: world.mintId('npc'),
    name: 'Hollis Vance',
    role: 'courier',
    appearance: { base: 'male', variant: 2 },
    station: { interiorId: interior.id, anchorId: stool },
    personality: 'Always half out the door.',
    knowledge: ['The freight road floods at the bend.'],
  }
  world.addNpc(mara)
  world.addNpc(hollis)

  const ledger: Item = {
    id: world.mintId('item'),
    name: 'Salt-stained ledger',
    description: 'Heavier than it looks.',
    archetype: 'ledger',
    value: 12,
    bulk: 'pocket',
  }
  const placement: Placement = { at: 'anchor', itemId: ledger.id, interiorId: interior.id, anchorId: stool }
  world.addItem(ledger, placement)

  return { world, mara, hollis, ledger, plot: plot.value }
}

/** Mara wants the ledger brought to her. */
function ledgerQuest(mara: string, ledger: string): QuestDoc {
  return {
    format: 'game-box.quest',
    schemaVersion: 1,
    id: 'quest_0001',
    kind: 'side',
    title: 'The Ledger',
    summary: 'Mara wants the ledger off the stool before its owner notices.',
    giverNpcId: mara,
    startStepId: 'step_0001',
    steps: [
      { id: 'step_0001', kind: 'collect', itemId: ledger, allowSteal: true, objective: 'Take the ledger', next: ['step_0002'], requires: [], effects: [] },
      { id: 'step_0002', kind: 'deliver', itemId: ledger, toNpcId: mara, objective: 'Give the ledger to Mara', next: ['step_0003'], requires: [], effects: [] },
      { id: 'step_0003', kind: 'complete', objective: 'Done', next: [], requires: [], effects: [] },
    ],
    reward: { money: 30, reputation: 2, faction: 'town', items: [] },
  } as QuestDoc
}

/** A model that says one line and optionally takes one action. */
function speaker(script: { text?: string; call?: { name: string; args: unknown }; fail?: boolean }) {
  const offered: Array<{ names: string[]; parameters: Record<string, unknown>[] }> = []
  const fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    const tools = (body.tools ?? []) as Array<{ function: { name: string; parameters: Record<string, unknown> } }>
    offered.push({ names: tools.map((t) => t.function.name), parameters: tools.map((t) => t.function.parameters) })
    if (script.fail) return new Response('down', { status: 503 })

    const chunks: unknown[] = []
    if (script.text) {
      chunks.push(chunk({ content: script.text }))
    }
    if (script.call) {
      chunks.push(
        chunk({ tool_calls: [{ id: 'c1', type: 'function', function: { name: script.call.name, arguments: JSON.stringify(script.call.args) } }] }),
      )
    }
    chunks.push(chunk({}, 'stop'))
    const sse = `${chunks.map((c) => `data: ${JSON.stringify(c)}`).join('\n\n')}\n\ndata: [DONE]\n\n`
    return new Response(sse, { headers: { 'content-type': 'text/event-stream' } })
  }) as unknown as typeof globalThis.fetch

  return { offered, sidecar: new Sidecar({ base: 'http://127.0.0.1:8976', fetch }) }

  function chunk(delta: unknown, finish: string | null = null) {
    return { id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta, finish_reason: finish }] }
  }
}

async function collect(stream: AsyncGenerator<TalkEvent>): Promise<TalkEvent[]> {
  const out: TalkEvent[] = []
  for await (const event of stream) out.push(event)
  return out
}

function setup(script: Parameters<typeof speaker>[0], options: { withQuest?: boolean } = {}) {
  const fixture = bar()
  const quest = ledgerQuest(fixture.mara.id, fixture.ledger.id)
  const validated = validateQuest(quest, {
    hasNpc: (id) => fixture.world.hasNpc(id),
    hasPlot: (id) => fixture.world.hasPlot(id),
    hasInterior: (id) => fixture.world.hasInterior(id),
    hasItem: (id) => fixture.world.hasItem(id),
    hasAnchor: () => true,
  })
  if (!validated.ok) throw new Error(JSON.stringify(validated.error))

  const player = PlayerState.create(fixture.world.id)
  const log = QuestLog.create(options.withQuest === false ? [] : [validated.value], player)
  const model = speaker(script)
  const opened = Conversation.open({
    world: fixture.world,
    log,
    player,
    sidecar: model.sidecar,
    npcId: fixture.mara.id,
  })
  if (!opened.ok) throw new Error('conversation did not open')
  return { ...fixture, player, log, model, ...opened.value }
}

describe('Conversation', () => {
  it('greeting someone completes the step that asked the player to talk to them', () => {
    const fixture = bar()
    const player = PlayerState.create(fixture.world.id)
    const talkQuest = {
      ...ledgerQuest(fixture.mara.id, fixture.ledger.id),
      startStepId: 'step_0001',
      steps: [
        { id: 'step_0001', kind: 'talk', npcId: fixture.mara.id, objective: 'Speak to Mara', next: ['step_0002'], requires: [], effects: [] },
        { id: 'step_0002', kind: 'complete', objective: 'Done', next: [], requires: [], effects: [] },
      ],
    } as QuestDoc
    const log = QuestLog.create([talkQuest], player)
    log.start(talkQuest.id)

    const opened = Conversation.open({ world: fixture.world, log, player, sidecar: speaker({}).sidecar, npcId: fixture.mara.id })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.value.changes.map((c) => c.kind)).toContain('quest-complete')
  })

  it('refuses to open on somebody who is not in the world', () => {
    const fixture = bar()
    const player = PlayerState.create(fixture.world.id)
    const opened = Conversation.open({
      world: fixture.world,
      log: QuestLog.create([], player),
      player,
      sidecar: speaker({}).sidecar,
      npcId: 'npc_9999',
    })
    expect(opened.ok).toBe(false)
    if (!opened.ok) expect(opened.error.code).toBe('unknown-npc')
  })

  it('streams what they say, in pieces', async () => {
    const { conversation } = setup({ text: 'We close at midnight.' })
    const events = await collect(conversation.say('when do you close?'))

    expect(events.filter((e) => e.kind === 'said').map((e) => (e as { text: string }).text).join('')).toBe('We close at midnight.')
    expect(conversation.history()).toEqual([
      { role: 'user', content: 'when do you close?' },
      { role: 'assistant', content: 'We close at midnight.' },
    ])
  })

  it('offers only the actions that are legal, with the ids written into the schema', async () => {
    const { conversation, model } = setup({ text: 'Aye.' })
    // before the quest is taken, Mara can hand it out and nothing else
    expect(conversation.available()).toEqual(['give_quest', 'end_talk'])

    await collect(conversation.say('anything going?'))
    const questTool = model.offered[0]!.parameters[0]!
    expect(questTool).toMatchObject({ properties: { questId: { enum: ['quest_0001'] } } })
    expect(model.offered[0]!.names).not.toContain('take_delivery')
  })

  it('hands out a quest by calling for it, and the log moves', async () => {
    const { conversation, log } = setup({ text: 'Fetch me the ledger.', call: { name: 'give_quest', args: { questId: 'quest_0001' } } })

    const events = await collect(conversation.say('anything going?'))
    expect(events).toContainEqual({ kind: 'did', action: 'give_quest', detail: 'quest_0001' })
    expect(events.some((e) => e.kind === 'changed' && e.change.kind === 'quest-started')).toBe(true)
    expect(log.status('quest_0001')).toBe('active')
    expect(log.objectives()[0]!.text).toBe('Take the ledger')
  })

  it('takes a delivery only once the player is actually carrying it, and the quest completes', async () => {
    const { conversation, log, player, ledger } = setup({ call: { name: 'take_delivery', args: { itemId: 'item_0001' } } })
    log.start('quest_0001')

    // empty-handed, the action is not even on the table
    expect(conversation.available()).not.toContain('take_delivery')

    player.take(ledger.id)
    log.handle({ kind: 'acquired', itemId: ledger.id, stolen: true })
    expect(conversation.available()).toContain('take_delivery')

    const events = await collect(conversation.say('here it is'))
    expect(events).toContainEqual({ kind: 'did', action: 'take_delivery', detail: ledger.id })
    expect(player.has(ledger.id)).toBe(false)
    expect(log.status('quest_0001')).toBe('complete')
    expect(player.money).toBe(30)
  })

  it('ignores a call for something the player is not carrying', async () => {
    const { conversation, log, player } = setup({ call: { name: 'take_delivery', args: { itemId: 'item_0001' } } })
    log.start('quest_0001')

    const events = await collect(conversation.say('here it is'))
    expect(events.some((e) => e.kind === 'did')).toBe(false)
    expect(player.money).toBe(0)
  })

  it('walks with the player and stops when asked', async () => {
    const escortFixture = bar()
    const player = PlayerState.create(escortFixture.world.id)
    const escortQuest = {
      ...ledgerQuest(escortFixture.mara.id, escortFixture.ledger.id),
      startStepId: 'step_0001',
      steps: [
        {
          id: 'step_0001',
          kind: 'escort',
          npcId: escortFixture.mara.id,
          place: { plotId: escortFixture.plot.id },
          objective: 'Walk Mara to the dock',
          next: ['step_0002'],
          requires: [],
          effects: [],
        },
        { id: 'step_0002', kind: 'complete', objective: 'Done', next: [], requires: [], effects: [] },
      ],
    } as QuestDoc
    const log = QuestLog.create([escortQuest], player)
    log.start(escortQuest.id)

    const joining = Conversation.open({
      world: escortFixture.world,
      log,
      player,
      sidecar: speaker({ call: { name: 'follow_player', args: {} } }).sidecar,
      npcId: escortFixture.mara.id,
    })
    if (!joining.ok) throw new Error('did not open')
    expect(joining.value.conversation.available()).toContain('follow_player')

    await collect(joining.value.conversation.say('walk with me'))
    expect(player.isCompanion(escortFixture.mara.id)).toBe(true)
    expect(joining.value.conversation.available()).toContain('stop_following')
  })

  it('ends when they end it', async () => {
    const { conversation } = setup({ text: 'Busy.', call: { name: 'end_talk', args: {} } })
    const events = await collect(conversation.say('got a minute?'))

    expect(events).toContainEqual({ kind: 'did', action: 'end_talk' })
    expect(events[events.length - 1]).toEqual({ kind: 'over' })
    expect(conversation.isOpen).toBe(false)
  })

  it('says something true and in character when the model cannot be reached', async () => {
    const { conversation, mara } = setup({ fail: true })
    const events = await collect(conversation.say('hello?'))

    expect(events[0]).toEqual({ kind: 'said', text: mara.knowledge[0] })
    expect(events[events.length - 1]).toEqual({ kind: 'over' })
  })
})
