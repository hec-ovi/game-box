import { PlayerState } from '@gb/play'
import { QuestLog, validateQuest, type QuestDoc } from '@gb/quest'
import { Sidecar } from '@gb/sidecar'
import { World, type Interior, type Item, type Npc, type Placement } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Conversation, type TalkEvent } from '../src/index.ts'

/** A bar, its bartender Mara, a courier Hollis across the room, and a ledger. */
function bar(options: { carries?: boolean } = {}) {
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

  return { voice, decisions, fetch, sidecar: new Sidecar({ base: 'http://127.0.0.1:8976', fetch }) }

  function stream(pieces: readonly string[]): Response {
    const chunks = [...pieces.map((piece) => chunk({ content: piece })), chunk({}, 'stop')]
    const sse = `${chunks.map((c) => `data: ${JSON.stringify(c)}`).join('\n\n')}\n\ndata: [DONE]\n\n`
    return new Response(sse, { headers: { 'content-type': 'text/event-stream' } })
  }

  function chunk(delta: unknown, finish: string | null = null) {
    return { id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta, finish_reason: finish }] }
  }
}

/**
 * A model the player cuts in on, and the moment they do it: while the request
 * is going out, while the reply is still being thought about, or once it has
 * been spoken and only the action is left to decide. Until then the model
 * answers in full, so a turn that is not cut short hands the job over.
 */
function cutIn(at: 'request' | 'first-token' | 'decision') {
  const stop = new AbortController()
  const model = speaker({ text: 'Fetch me the ledger.', pick: 2 })

  const fetch = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> }
    const deciding = body.messages[body.messages.length - 1]!.content.includes('Which number?')

    if (at === 'request' || (at === 'decision' && deciding)) {
      stop.abort()
      // a real fetch rejects the moment the signal it was handed fires
      if (init.signal?.aborted) throw new Error('the request was aborted')
    }
    if (at === 'first-token' && !deciding) {
      return new Response(quiet(stop), { headers: { 'content-type': 'text/event-stream' } })
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

function setup(
  script: Script,
  options: { carries?: boolean; heardOut?: boolean; sidecar?: Sidecar; signal?: AbortSignal } = {},
) {
  const fixture = bar(options)
  const write = options.heardOut ? heardOutQuest : ledgerQuest
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

  it('streams what they say, in pieces, and the voice track is offered nothing to call', async () => {
    const { conversation, model, opening } = setup({ text: ['We close ', 'at midnight.'] })
    const events = await collect(conversation.say('when do you close?'))

    expect(events.filter((e) => e.kind === 'said').length).toBeGreaterThan(1)
    expect(said(events)).toBe('We close at midnight.')
    expect(conversation.history()).toEqual([
      { role: 'assistant', content: opening.line },
      { role: 'user', content: 'when do you close?' },
      { role: 'assistant', content: 'We close at midnight.' },
    ])
    // the model answers on top of the line the player already read, not from nothing
    expect(model.voice[0]!.messages[1]).toEqual({ role: 'assistant', content: opening.line })
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
    const { conversation, hollis, world, log, player } = setup({ fail: true })
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

    // conversation is unused beyond opening the fixture
    expect(conversation.isOpen).toBe(true)
  })
  it('credits the talk step with the turn that hands the job over, not the turn before it', async () => {
    const { conversation, log } = setup({ text: 'Fetch me the ledger.', pick: 2 }, { heardOut: true })
    expect(log.objectives()).toEqual([])

    const events = await collect(conversation.say('anything going?'))
    expect(events).toContainEqual({ kind: 'did', action: 'give_quest', detail: 'quest_0001' })
    expect(events.some((e) => e.kind === 'changed' && e.change.kind === 'step-done' && e.change.stepId === 'step_0000')).toBe(true)
    expect(log.objectives().map((o) => o.text)).toEqual(['Take the ledger'])
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

  it('tells the character where they are, when it is, and what the player is worth here', async () => {
    const { conversation, model, player } = setup({ text: 'Aye.' })
    player.clock.setTime(21, 30)
    player.clock.setWeather('rain')
    player.adjustReputation(50)

    await collect(conversation.say('evening'))
    const brief = model.voice[0]!.system
    expect(brief).toContain('The kind of place Cold Harbour is: a fogbound port town')
    expect(brief).toContain('behind the counter')
    expect(brief).toContain('late evening')
    expect(brief).toContain('raining')
    expect(brief).toContain('Hollis Vance the courier')
    expect(brief).toContain('Their name is good in this town')
    expect(brief).not.toMatch(/[a-z]+_\d{4}/)
  })

  it('leaves the decision to the player when the action call comes back with nothing', async () => {
    const { conversation, log } = setup({ text: 'Aye, could be.', pick: '' })

    const events = await collect(conversation.say('yes, I will do it'))
    expect(events).toContainEqual({ kind: 'did', action: 'give_quest', detail: 'quest_0001' })
    expect(log.status('quest_0001')).toBe('active')
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
    const { conversation, mara } = setup({ fail: true }, { heardOut: true })

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
    expect(model.voice[0]!.messages).toContainEqual({ role: 'user', content: 'Take the job: The Ledger' })
  })
})

describe('cutting a turn short', () => {
  it("stops on the player's signal, however far the turn had got", async () => {
    for (const at of ['request', 'first-token', 'decision'] as const) {
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
