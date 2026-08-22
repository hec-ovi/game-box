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

interface Script {
  /** What the voice track says, in the pieces it streams. */
  readonly text?: string | readonly string[]
  /** What the action track answers when it is shown the menu. */
  readonly pick?: string | number
  /** No sidecar at all. */
  readonly fail?: boolean
}

/** A model with two tracks: a line it speaks, and the number it picks off the menu. */
function speaker(script: Script) {
  const voice: Array<{ system: string; messages: Array<{ role: string; content: string }> }> = []
  const decisions: Array<{ system: string; user: string }> = []

  const fetch = (async (_url: string, init: RequestInit) => {
    if (script.fail) throw new TypeError('fetch failed')
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string }>
      tools?: unknown[]
    }
    const system = body.messages[0]!.content
    const last = body.messages[body.messages.length - 1]!.content

    if (last.includes('Which number?')) {
      decisions.push({ system, user: last })
      return stream([String(script.pick ?? 1)])
    }
    voice.push({ system, messages: body.messages })
    const said = script.text === undefined ? [] : typeof script.text === 'string' ? [script.text] : [...script.text]
    return stream(said)
  }) as unknown as typeof globalThis.fetch

  return { voice, decisions, sidecar: new Sidecar({ base: 'http://127.0.0.1:8976', fetch }) }

  function stream(pieces: readonly string[]): Response {
    const chunks = [...pieces.map((piece) => chunk({ content: piece })), chunk({}, 'stop')]
    const sse = `${chunks.map((c) => `data: ${JSON.stringify(c)}`).join('\n\n')}\n\ndata: [DONE]\n\n`
    return new Response(sse, { headers: { 'content-type': 'text/event-stream' } })
  }

  function chunk(delta: unknown, finish: string | null = null) {
    return { id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta, finish_reason: finish }] }
  }
}

async function collect(stream: AsyncGenerator<TalkEvent>): Promise<TalkEvent[]> {
  const out: TalkEvent[] = []
  for await (const event of stream) out.push(event)
  return out
}

function said(events: readonly TalkEvent[]): string {
  return events
    .filter((event) => event.kind === 'said')
    .map((event) => event.text)
    .join('')
}

function setup(script: Script) {
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
  const log = QuestLog.create([validated.value], player)
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

  it('streams what they say, in pieces, and the voice track is offered nothing to call', async () => {
    const { conversation, model } = setup({ text: ['We close ', 'at midnight.'] })
    const events = await collect(conversation.say('when do you close?'))

    expect(events.filter((e) => e.kind === 'said').length).toBeGreaterThan(1)
    expect(said(events)).toBe('We close at midnight.')
    expect(conversation.history()).toEqual([
      { role: 'user', content: 'when do you close?' },
      { role: 'assistant', content: 'We close at midnight.' },
    ])
    expect(model.voice[0]!.messages.some((m) => m.role === 'user' && m.content === 'when do you close?')).toBe(true)
  })

  it('puts only the legal moves to the decider, in plain words, with no ids anywhere', async () => {
    const { conversation, model } = setup({ text: 'Aye.' })
    // before the quest is taken, Mara can hand it out and nothing else
    expect(conversation.available()).toEqual(['give_quest', 'end_talk'])

    await collect(conversation.say('anything going?'))
    const menu = model.decisions[0]!.system
    expect(menu).toContain('1. nothing but talk')
    expect(menu).toContain('2. hand them the job: The Ledger')
    expect(menu).toContain('3. be done with them')
    expect(menu).not.toContain('take the salt-stained ledger')
    for (const text of [menu, model.decisions[0]!.user, model.voice[0]!.system]) {
      expect(text).not.toMatch(/[a-z]+_\d{4}/)
    }
  })

  it('hands out a quest when the decider picks it, and the log moves', async () => {
    const { conversation, log } = setup({ text: 'Fetch me the ledger.', pick: 2 })

    const events = await collect(conversation.say('anything going?'))
    expect(events).toContainEqual({ kind: 'did', action: 'give_quest', detail: 'quest_0001' })
    expect(events.some((e) => e.kind === 'changed' && e.change.kind === 'quest-started')).toBe(true)
    expect(log.status('quest_0001')).toBe('active')
    expect(log.objectives()[0]!.text).toBe('Take the ledger')
  })

  it('does nothing when nothing is called for, and the conversation goes on', async () => {
    const { conversation, log } = setup({ text: 'Weather does what it likes here.', pick: 1 })

    const events = await collect(conversation.say('nice weather'))
    expect(events.some((e) => e.kind === 'did')).toBe(false)
    expect(events.some((e) => e.kind === 'over')).toBe(false)
    expect(conversation.isOpen).toBe(true)
    expect(log.status('quest_0001')).toBe('unstarted')
  })

  it('takes a delivery only once the player is actually carrying it, and the quest completes', async () => {
    const { conversation, log, player, ledger } = setup({ pick: 2 })
    log.start('quest_0001')

    // empty-handed, the move is not even on the menu
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

  it('refuses an action that was never on the menu, however the decider answers', async () => {
    // Mara is owed the ledger, but the player is not carrying it: taking it is not offered.
    const { conversation, log, player } = setup({ pick: 9 })
    log.start('quest_0001')

    expect(await collect(conversation.say('here it is'))).not.toContainEqual(
      expect.objectContaining({ kind: 'did' }),
    )
    expect(player.money).toBe(0)

    // and prose instead of a number is not an action either
    const prose = setup({ pick: 'give them the job, obviously' })
    expect(await collect(prose.conversation.say('anything going?'))).not.toContainEqual(
      expect.objectContaining({ kind: 'did' }),
    )
    expect(prose.log.status('quest_0001')).toBe('unstarted')
  })

  it('never says an id out loud, even when the model writes one', async () => {
    const { conversation } = setup({ text: ['One job going: qu', 'est_0001. The item_00', '02 is on the stool.'] })

    const events = await collect(conversation.say('anything going?'))
    expect(said(events)).toBe('One job going: it. it is on the stool.')
    expect(said(events)).not.toMatch(/_\d/)
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
      sidecar: speaker({ pick: 2 }).sidecar,
      npcId: escortFixture.mara.id,
    })
    if (!joining.ok) throw new Error('did not open')
    expect(joining.value.conversation.available()).toContain('follow_player')

    await collect(joining.value.conversation.say('walk with me'))
    expect(player.isCompanion(escortFixture.mara.id)).toBe(true)
    expect(joining.value.conversation.available()).toContain('stop_following')
  })

  it('ends when they end it', async () => {
    const { conversation } = setup({ text: 'Busy.', pick: 3 })
    const events = await collect(conversation.say('got a minute?'))

    expect(events).toContainEqual({ kind: 'did', action: 'end_talk' })
    expect(events[events.length - 1]).toEqual({ kind: 'over' })
    expect(conversation.isOpen).toBe(false)
  })

  it('with no sidecar at all, the job is still offered, taken and delivered', async () => {
    const { conversation, log, player, ledger } = setup({ fail: true })

    const greeting = await collect(conversation.say('hello'))
    expect(said(greeting)).toContain('The Ledger')
    expect(said(greeting)).toContain('Take the ledger. Say the word.')
    expect(greeting.some((e) => e.kind === 'over')).toBe(false)

    const accepted = await collect(conversation.say('yes'))
    expect(accepted).toContainEqual({ kind: 'did', action: 'give_quest', detail: 'quest_0001' })
    expect(log.status('quest_0001')).toBe('active')

    player.take(ledger.id)
    log.handle({ kind: 'acquired', itemId: ledger.id, stolen: true })

    const delivered = await collect(conversation.say('here you go'))
    expect(delivered).toContainEqual({ kind: 'did', action: 'take_delivery', detail: ledger.id })
    expect(log.status('quest_0001')).toBe('complete')
    expect(player.money).toBe(30)
  })

  it('with no sidecar, someone with nothing to give still talks and never says an id', async () => {
    const { conversation, hollis, world, log, player } = setup({ fail: true })
    const chat = Conversation.open({ world, log, player, sidecar: speaker({ fail: true }).sidecar, npcId: hollis.id })
    if (!chat.ok) throw new Error('did not open')

    const first = await collect(chat.value.conversation.say('what do you know?'))
    expect(said(first)).toBe(hollis.knowledge[0])
    expect(said(first)).not.toMatch(/_\d/)
    expect(chat.value.conversation.isOpen).toBe(true)

    const parting = await collect(chat.value.conversation.say('see you later'))
    expect(parting).toContainEqual({ kind: 'did', action: 'end_talk' })
    expect(chat.value.conversation.isOpen).toBe(false)

    // conversation is unused beyond opening the fixture
    expect(conversation.isOpen).toBe(true)
  })
})
