import { PlayerState } from '@gb/play'
import { QuestLog, validateQuest, type QuestDoc } from '@gb/quest'
import { Sidecar } from '@gb/sidecar'
import { World, type Interior, type Item, type Npc, type Placement } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Conversation, Sessions, type TalkEvent } from '../src/index.ts'

/** A bar, its bartender Mara, a courier Hollis across the room, and a ledger. */
function bar(options: { carries?: boolean; hollisAt?: 'sit-drink' | 'dance' } = {}) {
  const world = World.create({ name: 'Cold Harbour', theme: 'a fogbound port town that lives off the tide', seed: 'talk', width: 16, height: 16 })
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
    furniture: [{ id: world.mintId('furniture'), prop: 'bar-counter', roomId: room, pos: { x: 4, y: 7 }, rot: 0 }],
    anchors: [
      { id: serve, kind: 'serve', roomId: room, pos: { x: 4, y: 6 }, rot: 180 },
      { id: stool, kind: options.hollisAt ?? 'sit-drink', roomId: room, pos: { x: 3, y: 4 }, rot: 0 },
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
    life: {
      history: 'Born on the quay, ran freight until the road went bad, took the bar on when Rook could not pay for it.',
      manner: 'Short sentences. Never repeats herself.',
      reason: 'covering the day shift while Rook is away',
    },
    background: [
      { fact: 'wears a sailor knot at the wrist', unlockedBy: 'met' },
      { fact: 'ran the freight road before the bar', unlockedBy: 'talked' },
      { fact: 'owes Rook for the bar and will not say how much', unlockedBy: 'quest' },
    ],
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

  const copy: Item = {
    id: world.mintId('item'),
    name: 'Duplicate ledger',
    description: 'The same book, a year older.',
    archetype: 'ledger',
    value: 8,
    bulk: 'pocket',
  }
  world.addItem(copy, { at: 'anchor', itemId: copy.id, interiorId: interior.id, anchorId: stool })

  const key: Item = {
    id: world.mintId('item'),
    name: 'Brass cellar key',
    description: 'Worn smooth.',
    archetype: 'key',
    value: 2,
    bulk: 'pocket',
  }
  if (options.carries) world.addItem(key, { at: 'npc', itemId: key.id, npcId: mara.id })

  return { world, mara, hollis, ledger, copy, key, plot: plot.value }
}

/** Mara's job opens by asking the player to hear Mara out: what a generated quest does. */
function heardOutQuest(mara: string, ledger: string, copy?: string): QuestDoc {
  return {
    ...ledgerQuest(mara, ledger, copy),
    startStepId: 'step_0000',
    steps: [
      { id: 'step_0000', kind: 'talk', npcId: mara, objective: 'Hear Mara Cole out at The Anchor', next: ['step_0001'], requires: [], effects: [] },
      ...ledgerQuest(mara, ledger, copy).steps,
    ],
  } as QuestDoc
}

/** Mara's job opens with a subject the player has to raise with her by name. */
function topicQuest(mara: string, ledger: string, copy?: string): QuestDoc {
  return {
    ...ledgerQuest(mara, ledger, copy),
    startStepId: 'step_0000',
    steps: [
      {
        id: 'step_0000',
        kind: 'talk',
        npcId: mara,
        topic: 'the missing shipment',
        objective: 'Ask Mara Cole about the missing shipment',
        next: ['step_0001'],
        requires: [],
        effects: [],
      },
      ...ledgerQuest(mara, ledger, copy).steps,
    ],
  } as QuestDoc
}

/** Mara wants the ledger brought to her, or the copy of it that reads the same. */
function ledgerQuest(mara: string, ledger: string, copy = 'item_9999'): QuestDoc {
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
      { id: 'step_0001', kind: 'collect', itemId: ledger, alternates: [copy], allowSteal: true, objective: 'Take the ledger', next: ['step_0002'], requires: [], effects: [] },
      { id: 'step_0002', kind: 'deliver', itemId: ledger, alternates: [copy], toNpcId: mara, objective: 'Give the ledger to Mara', next: ['step_0003'], requires: [], effects: [] },
      { id: 'step_0003', kind: 'complete', objective: 'Done', next: [], requires: [], effects: [] },
    ],
    reward: { money: 30, reputation: 2, faction: 'town', items: [] },
  } as QuestDoc
}

interface Script {
  /** What the voice track says. Left out, the model talks its way out of the turn call and the game's data speaks. */
  readonly text?: string
  /** What the voice track says the body does. */
  readonly does?: string
  /** The number of the fact about themselves the voice track let slip. */
  readonly reveals?: number
  /** What the voice track says the person now holds of the player. */
  readonly remembers?: readonly string[]
  /** How the voice track says the turn left them. */
  readonly mood?: 'warmer' | 'cooler' | 'same'
  /** The line off the menu the action track calls the tool with. 1 is nothing but talk. */
  readonly pick?: number
  /** How the action track reports the reply. Left out is a call that did not say. */
  readonly says?: 'yes' | 'no' | 'neither'
  /** The action track answers with words instead of making the call it was told to make. */
  readonly prose?: string
  /** No sidecar at all. */
  readonly fail?: boolean
}

interface ToolCall {
  readonly name: string
  readonly parameters: { properties: Record<string, unknown>; required?: string[] }
}

interface Call {
  readonly system: string
  readonly user: string
  readonly forced: string
  readonly tool: ToolCall
}

/** A model with two tracks: the turn it takes as the person, and the call it makes off the menu. */
function speaker(script: Script) {
  const voice: Call[] = []
  const decisions: Call[] = []

  const fetch = (async (_url: string, init: RequestInit) => {
    if (script.fail) throw new TypeError('fetch failed')
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string }>
      tools: Array<{ function: ToolCall }>
      tool_choice: { function: { name: string } }
    }
    const tool = body.tools[0]!.function
    const call: Call = { system: body.messages[0]!.content, user: body.messages[body.messages.length - 1]!.content, forced: body.tool_choice.function.name, tool }

    if (tool.name === 'take_turn') {
      voice.push(call)
      if (script.text === undefined) return spoke('...')
      const { does, reveals, remembers, mood } = script
      return called(tool.name, { does, says: script.text, reveals, remembers, mood })
    }
    decisions.push(call)
    return script.prose === undefined ? called(tool.name, { option: script.pick ?? 1, answer: script.says }) : spoke(script.prose)
  }) as unknown as typeof globalThis.fetch

  return { voice, decisions, fetch, sidecar: new Sidecar({ base: 'http://127.0.0.1:8976', fetch }) }

  /** The forced call, made: the answer arrives as arguments, never as text. */
  function called(name: string, args: Record<string, unknown>): Response {
    const call = { id: 'call_0', type: 'function', function: { name, arguments: JSON.stringify(args) } }
    return answer({ role: 'assistant', content: null, tool_calls: [call] }, 'tool_calls')
  }

  /** The model talks its way out of the call it was told to make. */
  function spoke(content: string): Response {
    return answer({ role: 'assistant', content }, 'stop')
  }

  function answer(message: unknown, finish: string): Response {
    const payload = { id: 'x', object: 'chat.completion', created: 0, model: 'm', choices: [{ index: 0, message, finish_reason: finish }] }
    return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } })
  }
}

/**
 * A model the player cuts in on, and the moment they do it: while the request
 * is going out, while the reply is still being thought about, or once it has
 * been spoken and only the action is left to decide. Until then the model
 * answers in full, so a turn that is not cut short hands the job over.
 */
function cutIn(at: 'request' | 'reply' | 'decision') {
  const stop = new AbortController()
  const model = speaker({ text: 'Fetch me the ledger.', pick: 2 })

  const fetch = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { tool_choice: { function: { name: string } } }
    const deciding = body.tool_choice.function.name === 'report_action'

    if (at === 'request' || (at === 'decision' && deciding)) {
      stop.abort()
      // a real fetch rejects the moment the signal it was handed fires
      if (init.signal?.aborted) throw new Error('the request was aborted')
    }
    if (at === 'reply' && !deciding) {
      return new Response(quiet(stop), { headers: { 'content-type': 'application/json' } })
    }
    return model.fetch(url, init)
  }) as unknown as typeof globalThis.fetch

  return { stop, decisions: model.decisions, sidecar: new Sidecar({ base: 'http://127.0.0.1:8976', fetch }) }
}

/** Headers came back and then nothing: the player cuts in and the reply dies with the call. */
function quiet(stop: AbortController): ReadableStream<Uint8Array> {
  return new ReadableStream({
    pull(controller) {
      stop.abort()
      controller.error(new Error('the reply broke off'))
    },
  })
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

const QUESTS = { plain: ledgerQuest, 'heard-out': heardOutQuest, topic: topicQuest }

function setup(
  script: Script,
  options: {
    carries?: boolean
    hollisAt?: 'sit-drink' | 'dance'
    quest?: keyof typeof QUESTS
    sidecar?: Sidecar
    signal?: AbortSignal
    sessions?: Sessions
  } = {},
) {
  const fixture = bar(options)
  const write = QUESTS[options.quest ?? 'plain']
  const quest = write(fixture.mara.id, fixture.ledger.id, fixture.copy.id)
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
    sidecar: options.sidecar ?? model.sidecar,
    npcId: fixture.mara.id,
    sessions: options.sessions,
    signal: options.signal,
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

  it('takes the turn as one call, the body before the words, and answers on top of what was already said', async () => {
    const { conversation, model, opening } = setup({ text: 'We close at midnight.', does: 'wipes the counter' })
    const events = await collect(conversation.say('when do you close?'))

    expect(events).toContainEqual({ kind: 'turn', does: 'wipes the counter', says: 'We close at midnight.' })
    expect(events).toContainEqual({ kind: 'said', text: 'We close at midnight.' })
    expect(conversation.history()).toEqual([
      { role: 'assistant', content: opening.line },
      { role: 'user', content: 'when do you close?' },
      { role: 'assistant', content: 'We close at midnight.' },
    ])

    const call = model.voice[0]!
    expect(call.forced).toBe('take_turn')
    // `does` is decided before `says`: llama writes the fields in the order the schema lists them
    expect(Object.keys(call.tool.parameters.properties).slice(0, 2)).toEqual(['does', 'says'])
    expect(call.tool.parameters.required).toEqual(['says'])
    // the model answers on top of the line the player already read, not from nothing
    expect(call.user).toContain(`Mara Cole: "${opening.line}"`)
    expect(call.user).toContain('Them: "when do you close?"')
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
    for (const text of [menu, model.decisions[0]!.user, model.voice[0]!.system, model.voice[0]!.user]) {
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
    expect(log.status('quest_0001')).toBe('active')
  })

  it('never says an id out loud, even when the model writes one', async () => {
    const { conversation } = setup({ text: 'One job going: quest_0001. The item_0002 is on the stool.', does: 'taps quest_0001' })

    const events = await collect(conversation.say('anything going?'))
    expect(said(events)).toBe('One job going: it. it is on the stool.')
    expect(events).toContainEqual({ kind: 'turn', does: 'taps it', says: 'One job going: it. it is on the stool.' })
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
    expect(said(greeting)).toContain('30 coin')
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
    const { hollis, world, log, player } = setup({ fail: true })
    const chat = Conversation.open({ world, log, player, sidecar: speaker({ fail: true }).sidecar, npcId: hollis.id })
    if (!chat.ok) throw new Error('did not open')

    const first = await collect(chat.value.conversation.say('what do you know?'))
    expect(said(first)).toContain(hollis.knowledge[0])
    expect(said(first)).not.toBe(hollis.knowledge[0])
    expect(said(first)).not.toMatch(/_\d/)
    expect(chat.value.conversation.isOpen).toBe(true)

    const parting = await collect(chat.value.conversation.say('see you later'))
    expect(parting).toContainEqual({ kind: 'did', action: 'end_talk' })
    expect(chat.value.conversation.isOpen).toBe(false)
  })

  it('credits the talk step with the turn that hands the job over, not the turn before it', async () => {
    const { conversation, log } = setup({ text: 'Fetch me the ledger.', pick: 2 }, { quest: 'heard-out' })
    expect(log.objectives()).toEqual([])

    const events = await collect(conversation.say('anything going?'))
    expect(events).toContainEqual({ kind: 'did', action: 'give_quest', detail: 'quest_0001' })
    expect(events.some((e) => e.kind === 'changed' && e.change.kind === 'step-done' && e.change.stepId === 'step_0000')).toBe(true)
    expect(log.objectives().map((o) => o.text)).toEqual(['Take the ledger'])
  })

  it('credits a step that names a subject when the player puts them to it, and not before', async () => {
    const { conversation, log } = setup({ fail: true }, { quest: 'topic' })

    // taking the job opens the step that names the subject; talking has not raised it
    await collect(conversation.say('evening'))
    await collect(conversation.say('yes'))
    expect(log.objectives().map((o) => o.text)).toEqual(['Ask Mara Cole about the missing shipment'])

    // so the subject is a move of its own, in the player's own words
    const ask = conversation.moves().find((move) => move.action === 'ask_about')!
    expect(ask.label).toBe('Ask about the missing shipment')

    const events = await collect(conversation.choose(ask.key))
    expect(events).toContainEqual({ kind: 'did', action: 'ask_about', detail: 'the missing shipment' })
    expect(said(events)).toContain('the missing shipment')
    expect(log.objectives().map((o) => o.text)).toEqual(['Take the ledger'])
  })

  it('does not credit the subject for a conversation that only wandered onto it', async () => {
    const spoken = 'The missing shipment? Everyone in Cold Harbour is asking about the missing shipment.'
    const { conversation, model, log, world, player, mara } = setup({ text: spoken, pick: 1 }, { quest: 'topic' })
    log.start('quest_0001')
    const objective = ['Ask Mara Cole about the missing shipment']
    expect(log.objectives().map((o) => o.text)).toEqual(objective)

    // the subject is on the menu and she does not take it, however much she says about it
    const events = await collect(conversation.say('quiet night'))
    expect(model.decisions[0]!.system).toContain('tell them what you know about the missing shipment')
    expect(events.some((event) => event.kind === 'did')).toBe(false)
    expect(log.objectives().map((o) => o.text)).toEqual(objective)

    // and walking up to her again is talking to her, which is not raising it either
    const again = Conversation.open({ world, log, player, sidecar: speaker({}).sidecar, npcId: mara.id })
    if (!again.ok) throw new Error('did not open')
    expect(again.value.changes).toEqual([])
    expect(log.objectives().map((o) => o.text)).toEqual(objective)
  })

  it('offers the delivery to the person it is owed to, and to nobody else', async () => {
    const { conversation, log, player, ledger, copy, world, hollis, model } = setup({ text: 'Aye.' })
    log.start('quest_0001')
    player.take(ledger.id)
    log.handle({ kind: 'acquired', itemId: ledger.id, stolen: true })

    expect(conversation.available()).toContain('take_delivery')
    const elsewhere = Conversation.open({ world, log, player, sidecar: speaker({}).sidecar, npcId: hollis.id })
    if (!elsewhere.ok) throw new Error('did not open')
    expect(elsewhere.value.conversation.available()).not.toContain('take_delivery')

    await collect(conversation.say('evening'))
    expect(model.voice[0]!.system).toContain('they are carrying the salt-stained ledger you are owed')

    // anything the quest lets stand in for it counts as the delivery too
    player.drop(ledger.id)
    player.take(copy.id)
    expect(conversation.available()).toContain('take_delivery')
  })

  it('fills the template from the room, the hour, the company, the player and the file, and never with an id', async () => {
    const { conversation, model, player, ledger } = setup({ text: 'Aye.' })
    player.clock.setTime(21, 30)
    player.clock.setWeather('rain')
    player.adjustReputation(50)
    player.take(ledger.id)

    await collect(conversation.say('evening'))
    const brief = model.voice[0]!.system
    // the engine's slots, this turn
    expect(brief).toContain('You are Mara Cole, the bartender at The Anchor, in Cold Harbour.')
    expect(brief).toContain('Cold Harbour is a fogbound port town')
    expect(brief).toContain('The room: Taproom: bar counter; duplicate ledger lying about')
    expect(brief).toContain('What you are doing: behind the counter')
    expect(brief).toContain('The hour: late evening')
    expect(brief).toContain('The weather: raining hard enough to hear')
    expect(brief).toContain('Who else is here: Hollis Vance the courier, sat with a drink')
    expect(brief).toContain('The one talking to you is carrying: salt-stained ledger')
    expect(brief).toContain('Their name is good in this town')
    expect(brief).toContain('You feel nothing in particular about them yet.')
    expect(brief).toContain('You have not met them before this.')
    // the generator's slots, once per person
    expect(brief).toContain('- How you come across: Dry, unhurried, watches the door.')
    expect(brief).toContain('- How you talk: Short sentences. Never repeats herself.')
    expect(brief).toContain('- Your story: Born on the quay')
    expect(brief).toContain('- Why you are here right now: covering the day shift while Rook is away')
    expect(brief).toContain('- The tide takes the low road twice a day.')
    // the fixed part: the rule the reported replies broke, and worked examples that vary by the turn
    expect(brief).toContain('The first clause answers what they actually said.')
    expect(brief).toMatch(/They said: ".+"\nRight: ".+"\nWrong: ".+"/)
    await collect(conversation.say('and?'))
    expect(model.voice[1]!.system).not.toBe(brief)
    expect(brief).not.toMatch(/[a-z]+_\d{4}/)
  })

  it('asks for the action as a call the model has to make, with the menu for a schema', async () => {
    const { conversation, model } = setup({ text: 'Aye.' })
    await collect(conversation.say('anything going?'))

    const asked = model.decisions[0]!
    expect(asked.forced).toBe(asked.tool.name)
    // nothing but talk, the job, and the goodbye: an answer off that list cannot come back
    expect(asked.tool.parameters).toMatchObject({
      type: 'object',
      // the reply is the one field the call may leave out: an action is what a quest turns on
      required: ['option'],
      properties: {
        option: { type: 'integer', minimum: 1, maximum: 3 },
        answer: { enum: ['yes', 'no', 'neither'] },
      },
    })
  })

  it("leaves the turn to the player's own words when the action call answers with none of them", async () => {
    // words instead of the call it was told to make
    const prose = setup({ text: 'Aye, could be.', prose: 'give them the job, obviously' })
    expect(await collect(prose.conversation.say('yes, I will do it'))).toContainEqual({
      kind: 'did',
      action: 'give_quest',
      detail: 'quest_0001',
    })
    expect(prose.log.status('quest_0001')).toBe('active')

    // and a number that is not a line on the menu is no more of an answer than prose is
    const off = setup({ text: 'Aye, could be.', pick: 9 })
    expect(await collect(off.conversation.say('yes, I will do it'))).toContainEqual({
      kind: 'did',
      action: 'give_quest',
      detail: 'quest_0001',
    })
    expect(off.log.status('quest_0001')).toBe('active')
  })

  it('takes plain English for an answer with no model running', async () => {
    const yeses = [
      'yes',
      'aye, I will do it',
      "sure, I'll take the job",
      'give me the job',
      'I want the job',
      'alright, count me in',
      "sounds good, I'm in",
      'consider it done',
      'I can do that',
      'deal',
      'okay, what do you need?',
      'yeah go on then',
      'why not',
      "I'll help",
      'hand it to me then',
    ]
    for (const phrase of yeses) {
      const { conversation, log } = setup({ fail: true })
      await collect(conversation.say('evening'))
      const events = await collect(conversation.say(phrase))
      expect(events, phrase).toContainEqual({ kind: 'did', action: 'give_quest', detail: 'quest_0001' })
      expect(log.status('quest_0001'), phrase).toBe('active')
    }
  })

  it('tells the job from the thing on the counter, and does nothing it was not asked for', async () => {
    const job = setup({ fail: true }, { carries: true })
    await collect(job.conversation.say('evening'))
    expect(await collect(job.conversation.say('give me the job'))).toContainEqual({
      kind: 'did',
      action: 'give_quest',
      detail: 'quest_0001',
    })

    const thing = setup({ fail: true }, { carries: true })
    await collect(thing.conversation.say('evening'))
    expect(await collect(thing.conversation.say('give me the key'))).toContainEqual({
      kind: 'did',
      action: 'hand_over',
      detail: thing.key.id,
    })
    expect(thing.log.status('quest_0001')).toBe('unstarted')

    // asked for something she has not got, she hands over nothing at all
    const drink = setup({ fail: true }, { carries: true })
    await collect(drink.conversation.say('evening'))
    const refused = await collect(drink.conversation.say('give me a drink'))
    expect(refused.some((e) => e.kind === 'did')).toBe(false)
    expect(said(refused)).toBe("You've lost me. Say it plain.")

    // and nothing she is able to do answers this either
    const lost = setup({ fail: true })
    const shrug = await collect(lost.conversation.say('follow me'))
    expect(shrug.some((e) => e.kind === 'did')).toBe(false)
    expect(said(shrug)).toBe("You've lost me. Say it plain.")
  })

  it('takes a refusal without walking off', async () => {
    const { conversation, log } = setup({ fail: true })
    await collect(conversation.say('evening'))

    const events = await collect(conversation.say('maybe later'))
    expect(events.some((e) => e.kind === 'did')).toBe(false)
    expect(conversation.isOpen).toBe(true)
    expect(log.status('quest_0001')).toBe('unstarted')
    expect(said(events)).toBe('Suit yourself. The offer stands.')
  })

  it('says the job in its own words instead of reading the screen text out', async () => {
    const { conversation, mara } = setup({ fail: true }, { quest: 'heard-out' })

    const offer = said(await collect(conversation.say('evening')))
    const taken = said(await collect(conversation.say('yes')))
    expect(offer).not.toContain('Hear Mara Cole out')
    expect(taken).not.toContain('Hear Mara Cole out')
    expect(taken).toContain('Take the ledger')

    const chat = said(await collect(conversation.say('quiet night')))
    expect(chat).toContain(mara.knowledge[0])
    expect(chat).not.toBe(mara.knowledge[0])
  })

  it('with no model, the same words give the same conversation every time', async () => {
    const play = async () => {
      const { conversation } = setup({ fail: true })
      const lines: string[] = []
      for (const turn of ['evening', 'anything going?', 'yes', 'what do you know?', 'and?', 'see you']) {
        lines.push(said(await collect(conversation.say(turn))))
      }
      return lines
    }

    const first = await play()
    expect(first).toEqual(await play())
    // the two facts she has are not passed on the same way twice
    expect(new Set(first.slice(3, 5)).size).toBe(2)
  })
})

describe('every person is their own session', () => {
  it('carries on where the two of them left off, and nobody else hears a word of it', async () => {
    const sessions = new Sessions()
    const first = setup({ text: 'Wren. I will remember that.' }, { sessions })
    await collect(first.conversation.say('my name is Wren'))

    const again = Conversation.open({ world: first.world, log: first.log, player: first.player, sidecar: first.model.sidecar, npcId: first.mara.id, sessions })
    if (!again.ok) throw new Error('did not open')
    expect(again.value.conversation.history().slice(0, 3)).toEqual(first.conversation.history().slice(0, 3))
    await collect(again.value.conversation.say('still remember me?'))
    expect(first.model.voice[1]!.user).toContain('Them: "my name is Wren"')

    const other = Conversation.open({ world: first.world, log: first.log, player: first.player, sidecar: first.model.sidecar, npcId: first.hollis.id, sessions })
    if (!other.ok) throw new Error('did not open')
    expect(other.value.conversation.history()).toHaveLength(1)
    await collect(other.value.conversation.say('evening'))
    expect(first.model.voice[2]!.user).not.toContain('Wren')
    expect(first.model.voice[2]!.system).toContain('You are Hollis Vance')

    // with no sessions handed in, a conversation starts from nothing
    const fresh = Conversation.open({ world: first.world, log: first.log, player: first.player, sidecar: first.model.sidecar, npcId: first.mara.id })
    if (!fresh.ok) throw new Error('did not open')
    expect(fresh.value.conversation.history()).toHaveLength(1)
  })

  it('keeps a bounded transcript, newest last', async () => {
    const { conversation } = setup({ fail: true })
    for (let turn = 0; turn < 12; turn++) await collect(conversation.say(`turn ${turn}`))
    const history = conversation.history()
    expect(history).toHaveLength(16)
    expect(history[history.length - 2]).toEqual({ role: 'user', content: 'turn 11' })
  })
})

describe('what a turn leaves behind', () => {
  it('holds what the player told them, warms or cools to them, and puts both in front of them next time', async () => {
    const { conversation, model, player, mara } = setup({
      text: 'Wren, off the freight road. Noted.',
      remembers: ['their name is Wren', 'they came in off the freight road', 'they asked about the tide', 'a fourth thing nobody keeps'],
      mood: 'warmer',
    })
    await collect(conversation.say('I am Wren, came in off the freight road'))

    // three a turn at most, each one theirs alone
    expect(player.memories(mara.id)).toEqual([
      { fact: 'their name is Wren', source: 'told' },
      { fact: 'they came in off the freight road', source: 'told' },
      { fact: 'they asked about the tide', source: 'told' },
    ])
    expect(player.disposition(mara.id)).toBe('warm')

    await collect(conversation.say('so?'))
    const brief = model.voice[1]!.system
    expect(brief).toContain('What you remember of them: they told you their name is Wren; they told you they came in off the freight road')
    expect(brief).toContain('You like them well enough.')

    const cooler = setup({ text: 'Get out.', mood: 'cooler' })
    await collect(cooler.conversation.say('your bar is a dump'))
    expect(cooler.player.disposition(cooler.mara.id)).toBe('cool')
  })

  it('earns the facts seeing them earns on the way in, and lists them as met', () => {
    const { learned, player, mara, world, log, model } = setup({})
    expect(learned).toEqual(['0'])
    expect(player.unlocked(mara.id)).toEqual(['0'])
    expect(player.discovered().people.map((person) => person.npcId)).toContain(mara.id)

    const again = Conversation.open({ world, log, player, sidecar: model.sidecar, npcId: mara.id })
    if (!again.ok) throw new Error('did not open')
    expect(again.value.learned).toEqual([])
  })

  it('lets a fact about themselves slip by its number, and the codex unlocks', async () => {
    const { conversation, model, player, mara } = setup({ text: 'I ran freight before this.', reveals: 1 })
    const events = await collect(conversation.say('what did you do before the bar?'))

    const call = model.voice[0]!
    expect(call.system).toContain('1. ran the freight road before the bar')
    expect(call.system).not.toContain('owes Rook')
    expect(call.tool.parameters.properties.reveals).toMatchObject({ type: 'integer', minimum: 1, maximum: 1 })
    expect(events).toContainEqual({ kind: 'learned', npcId: mara.id, factId: '1' })
    expect(player.unlocked(mara.id)).toEqual(['0', '1'])

    // nothing left to let slip: the field is not even offered
    await collect(conversation.say('and?'))
    expect(model.voice[1]!.system).toContain('- nothing beyond what is written above')
    expect(model.voice[1]!.tool.parameters.properties.reveals).toBeUndefined()
  })

  it('offers the fact a job earns only once their job is done', async () => {
    const { conversation, model, log, player, ledger } = setup({ text: 'Aye.', pick: 2 })
    log.start('quest_0001')
    player.take(ledger.id)
    log.handle({ kind: 'acquired', itemId: ledger.id, stolen: true })

    await collect(conversation.say('here it is'))
    expect(model.voice[0]!.system).not.toContain('owes Rook')
    expect(log.status('quest_0001')).toBe('complete')

    await collect(conversation.say('so what do you owe him?'))
    expect(model.voice[1]!.system).toContain('2. owes Rook for the bar and will not say how much')
  })

  it('with no model, a fact about themselves is earned the moment it is said', async () => {
    const { conversation, mara } = setup({ fail: true })
    await collect(conversation.say('evening'))
    await collect(conversation.say('what do you know?'))
    await collect(conversation.say('and?'))
    const events = await collect(conversation.say('and?'))

    expect(said(events)).toContain('Ran the freight road before the bar.')
    expect(events).toContainEqual({ kind: 'learned', npcId: mara.id, factId: '1' })
  })
})

describe('the first words', () => {
  it('opens with something said and something to click, and asks nothing of the model', () => {
    const forbidden = () => {
      throw new Error('the first words must run on the game data alone')
    }
    const { conversation, opening } = setup({}, { sidecar: { ask: forbidden, converse: forbidden } as unknown as Sidecar })

    expect(opening.line).not.toBe('')
    expect(opening.moves).toEqual(conversation.moves())
    expect(opening.moves.map((move) => move.action)).toEqual(['give_quest', 'end_talk'])
    expect(opening.line).not.toMatch(/[a-z]+_\d{4}/)
    expect(conversation.history()[0]).toEqual({ role: 'assistant', content: opening.line })
  })

  it('greets the same way every time, so a shared world file plays the same everywhere', () => {
    const first = setup({}).opening.line
    expect(setup({}).opening.line).toBe(first)
  })

  it("the hour and the player's name in town are in it", () => {
    const { world, log, player, mara } = setup({})
    const greet = () => {
      const opened = Conversation.open({ world, log, player, sidecar: speaker({}).sidecar, npcId: mara.id })
      if (!opened.ok) throw new Error('did not open')
      return opened.value.opening.line
    }

    player.clock.setTime(21, 30)
    player.adjustReputation(-50)
    const scorned = greet()
    expect(scorned).toMatch(/^(Evening|Late to be out)\./)

    player.adjustReputation(100)
    expect(greet()).not.toBe(scorned)
  })

  it('names the one thing on the menu worth mentioning, and greets without one', () => {
    const { world, log, player, mara, hollis, ledger } = setup({})
    log.start('quest_0001')
    player.take(ledger.id)
    log.handle({ kind: 'acquired', itemId: ledger.id, stolen: true })

    const owed = Conversation.open({ world, log, player, sidecar: speaker({}).sidecar, npcId: mara.id })
    if (!owed.ok) throw new Error('did not open')
    expect(owed.value.opening.moves.map((move) => move.action)).toContain('take_delivery')
    expect(owed.value.opening.line).toContain('salt-stained ledger')

    // somebody with nothing between them and the player still says something
    const idle = Conversation.open({ world, log, player, sidecar: speaker({}).sidecar, npcId: hollis.id })
    if (!idle.ok) throw new Error('did not open')
    expect(idle.value.opening.line).not.toBe('')
    expect(idle.value.opening.moves.map((move) => move.action)).toEqual(['end_talk'])
  })

  it("says their own business when the file gives one, and never the sky", () => {
    const { world, log, player, mara, hollis } = setup({})
    const greet = (npcId: string) => {
      const opened = Conversation.open({ world, log, player, sidecar: speaker({}).sidecar, npcId })
      if (!opened.ok) throw new Error('did not open')
      return opened.value.opening.line
    }

    expect(greet(mara.id)).toContain('Covering the day shift while Rook is away.')
    for (const weather of ['clear', 'overcast', 'rain'] as const) {
      player.clock.setWeather(weather)
      for (let hour = 0; hour < 24; hour += 3) {
        player.clock.setTime(hour)
        for (const line of [greet(mara.id), greet(hollis.id)]) {
          expect(line, `${weather} ${hour}`).not.toMatch(/sky|cloud|grey as stone|rain has set in|coming down/)
        }
      }
    }
  })

  it('falls back to the spot they keep indoors, and to the street only for somebody out walking', () => {
    // an anchor with no line of its own is still indoors
    const { world, log, player, hollis } = setup({}, { hollisAt: 'dance' })
    const indoors = Conversation.open({ world, log, player, sidecar: speaker({}).sidecar, npcId: hollis.id })
    if (!indoors.ok) throw new Error('did not open')
    expect(indoors.value.opening.line).toMatch(/here most days|Same courier as yesterday|On my feet where I always am/)

    const walker: Npc = { id: world.mintId('npc'), name: 'Pell Adair', role: 'courier', appearance: { base: 'male', variant: 3 }, personality: 'Brisk.', knowledge: [] }
    world.addNpc(walker)
    const out = Conversation.open({ world, log, player, sidecar: speaker({}).sidecar, npcId: walker.id })
    if (!out.ok) throw new Error('did not open')
    expect(out.value.opening.line).toMatch(/on my way somewhere|only the courier|Walk with me/)
  })
})

describe('answering yes or no', () => {
  it('publishes a yes on a turn they went along with, however the turn was decided', async () => {
    // the model picks the move off the menu
    const model = setup({ text: "Aye, it's yours.", pick: 2 })
    const decided = await collect(model.conversation.say('give me the job'))
    expect(decided).toContainEqual({ kind: 'answered', answer: 'yes' })
    // the nod belongs to the moment they agree, so it lands before what they did
    expect(decided.findIndex((e) => e.kind === 'answered')).toBeLessThan(decided.findIndex((e) => e.kind === 'did'))

    // the same words with nothing running at all
    const offline = setup({ fail: true })
    const heard = await collect(offline.conversation.say('give me the job'))
    expect(heard).toContainEqual({ kind: 'answered', answer: 'yes' })
    expect(heard).toContainEqual({ kind: 'did', action: 'give_quest', detail: 'quest_0001' })

    // and the same move clicked, which asks nothing of a model either
    const clicked = setup({})
    expect(await collect(clicked.conversation.choose('give_quest#quest_0001'))).toContainEqual({
      kind: 'answered',
      answer: 'yes',
    })
  })

  it('publishes a no when they will not go along with it', async () => {
    // the model reports the refusal on a turn where nothing was carried out
    const model = setup({ text: 'Not tonight.', pick: 1, says: 'no' })
    const refused = await collect(model.conversation.say('walk me to the dock'))
    expect(refused).toContainEqual({ kind: 'answered', answer: 'no' })
    expect(refused.some((e) => e.kind === 'did')).toBe(false)

    // with nothing running, being asked for what they have not got is the no
    const offline = setup({ fail: true }, { carries: true })
    const lost = await collect(offline.conversation.say('give me a drink'))
    expect(lost).toContainEqual({ kind: 'answered', answer: 'no' })
    expect(said(lost)).toBe("You've lost me. Say it plain.")
    expect(lost.some((e) => e.kind === 'did')).toBe(false)
  })

  it("publishes nothing on an ordinary turn, and never reads the player's refusal as theirs", async () => {
    // most of what anybody says is neither way
    const chat = setup({ text: 'Weather does what it likes here.', pick: 1, says: 'neither' })
    expect(await collect(chat.conversation.say('nice weather'))).not.toContainEqual(
      expect.objectContaining({ kind: 'answered' }),
    )

    // a call that left the answer out has not reported one either
    const quiet = setup({ text: 'Aye.', pick: 1 })
    expect(await collect(quiet.conversation.say('nice weather'))).not.toContainEqual(
      expect.objectContaining({ kind: 'answered' }),
    )

    // the player turning the work down is the player's answer, and hers is neither
    const offline = setup({ fail: true })
    const declined = await collect(offline.conversation.say('maybe later'))
    expect(said(declined)).toBe('Suit yourself. The offer stands.')
    expect(declined).not.toContainEqual(expect.objectContaining({ kind: 'answered' }))
  })

  it('publishes a yes that carries no action, because a yes is often only words', async () => {
    const { conversation, log } = setup({ text: "Aye, I'll keep an eye out.", pick: 1, says: 'yes' })
    const events = await collect(conversation.say('keep an eye out for me?'))

    expect(events).toContainEqual({ kind: 'answered', answer: 'yes' })
    expect(events.some((e) => e.kind === 'did')).toBe(false)
    expect(log.status('quest_0001')).toBe('unstarted')
  })
})

describe('Conversation.moves and choose', () => {
  it("offers every legal move in the player's own words, with no id in any of them", () => {
    const { conversation, key } = setup({}, { carries: true })

    expect(conversation.moves()).toEqual([
      { key: 'give_quest#quest_0001', action: 'give_quest', label: 'Take the job: The Ledger' },
      { key: `hand_over#${key.id}`, action: 'hand_over', label: 'Ask for the brass cellar key' },
      { key: 'end_talk', action: 'end_talk', label: 'Say goodbye' },
    ])
    for (const move of conversation.moves()) expect(move.label).not.toMatch(/[a-z]+_\d{4}/)
  })

  it('carries out the move that was clicked and nothing else, speaking before it acts', async () => {
    const { conversation, log, player, key } = setup({}, { carries: true })

    const events = await collect(conversation.choose(`hand_over#${key.id}`))
    expect(events).toContainEqual({ kind: 'did', action: 'hand_over', detail: key.id })
    expect(events.filter((e) => e.kind === 'did')).toHaveLength(1)
    expect(player.has(key.id)).toBe(true)
    expect(log.status('quest_0001')).toBe('unstarted')

    expect(events[0]).toEqual({ kind: 'turn', says: "Here. Don't lose it." })
    expect(said(events)).toBe("Here. Don't lose it.")
    expect(events.findIndex((e) => e.kind === 'said')).toBeLessThan(events.findIndex((e) => e.kind === 'did'))
  })

  it('does nothing at all with a move that has stopped being legal', async () => {
    const { conversation, log, player, ledger } = setup({})
    log.start('quest_0001')
    player.take(ledger.id)
    log.handle({ kind: 'acquired', itemId: ledger.id, stolen: true })
    const delivery = conversation.moves().find((move) => move.key.startsWith('take_delivery'))!
    const before = [...conversation.history()]

    // the player drops it between drawing the menu and clicking it
    player.drop(ledger.id)
    expect(await collect(conversation.choose(delivery.key))).toEqual([])
    expect(conversation.history()).toEqual(before)
    expect(log.status('quest_0001')).toBe('active')
    expect(player.money).toBe(0)
  })

  it('never reaches the sidecar', async () => {
    const forbidden = () => {
      throw new Error('a clicked move must run on the game data alone')
    }
    const { conversation, log } = setup({}, { sidecar: { ask: forbidden, converse: forbidden } as unknown as Sidecar })

    expect(conversation.moves().map((move) => move.key)).toContain('give_quest#quest_0001')
    const events = await collect(conversation.choose('give_quest#quest_0001'))
    expect(events).toContainEqual({ kind: 'did', action: 'give_quest', detail: 'quest_0001' })
    expect(log.status('quest_0001')).toBe('active')
  })

  it('puts a clicked turn in the transcript, so a typed turn after it knows what was clicked', async () => {
    const { conversation, model, opening } = setup({ text: 'Take your time.' })

    await collect(conversation.choose('give_quest#quest_0001'))
    expect(conversation.history()).toEqual([
      { role: 'assistant', content: opening.line },
      { role: 'user', content: 'Take the job: The Ledger' },
      { role: 'assistant', content: "Good. Take the ledger. Come back to me when it's done." },
    ])

    await collect(conversation.say('where do I start?'))
    expect(model.voice[0]!.user).toContain('Them: "Take the job: The Ledger"')
  })
})

describe('cutting a turn short', () => {
  it("stops on the player's signal, however far the turn had got", async () => {
    for (const at of ['request', 'reply', 'decision'] as const) {
      const model = cutIn(at)
      const { conversation, log } = setup({}, { sidecar: model.sidecar, signal: model.stop.signal })

      // words that would take the job outright with nobody listening for the signal
      const events = await collect(conversation.say('give me the job'))

      // whatever got through stands; nothing is decided in the player's place
      expect(said(events), at).toBe(at === 'decision' ? 'Fetch me the ledger.' : '')
      // and the calls stop where the player stopped them: no answer off the menu ever lands
      expect(model.decisions, at).toEqual([])
      expect(events.some((event) => event.kind === 'did'), at).toBe(false)
      expect(log.status('quest_0001'), at).toBe('unstarted')
      expect(conversation.isOpen, at).toBe(true)
    }
  })

  it('says nothing more once the player has cut in', async () => {
    const model = cutIn('request')
    const { conversation, opening } = setup({}, { sidecar: model.sidecar, signal: model.stop.signal })

    await collect(conversation.say('give me the job'))
    expect(await collect(conversation.say('still there?'))).toEqual([])
    expect(conversation.history()).toEqual([
      { role: 'assistant', content: opening.line },
      { role: 'user', content: 'give me the job' },
    ])
  })
})
