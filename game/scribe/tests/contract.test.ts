import { Forge, type WorldSummary } from '@gb/forge'
import { Sidecar } from '@gb/sidecar'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel } from './fake-model.ts'
import { JAIL, charterOf } from './places.ts'

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

/** A history that invents a kind of place no preset is, so the build asks for its charter too. */
const PREMISE = {
  livesOn: 'Container freight off the elevated line.',
  happened: 'The line shut last winter.',
  stake: 'Who gets the freight contract.',
  sides: [
    { name: 'the Vance yards', wants: 'the contract back' },
    { name: 'the Dockhands Local', wants: 'the yards broken up' },
  ],
  common: ['Nothing has moved since November.'],
  build: { moreOf: ['warehouse'], fewerOf: [], mustHave: ['jail'] },
}

describe('Scribe', () => {
  it('asks with a forced tool whose parameters are the contract, and uses the answer', async () => {
    const { sent, sidecar } = fakeModel([{ name: 'Cold Harbour' }])
    const scribe = new Scribe({ sidecar })

    expect(await scribe.nameCity({ theme: 'rain-soaked port', seed: 's' })).toBe('Cold Harbour')
    expect(sent[0]!.toolName).toBe('name_city')
    expect(sent[0]!.parameters).toMatchObject({ type: 'object', properties: { name: { type: 'string' } } })
    expect(sent[0]!.description.length).toBeGreaterThan(0)
    expect(sent[0]!.user).toContain('rain-soaked port')
    expect(scribe.problems()).toEqual([])
  })

  it('tells the model exactly what was wrong and takes the corrected call', async () => {
    const { sent, sidecar } = fakeModel([
      { name: 'x' }, // too short for the contract
      { name: 'Saltmarsh Bend' },
    ])
    const scribe = new Scribe({ sidecar })

    expect(await scribe.nameCity({ theme: 'marsh town', seed: 's' })).toBe('Saltmarsh Bend')
    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('rejected')
    expect(sent[1]!.user).toContain('name')
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['invalid-arguments'])
  })

  it('falls back to the offline narrator when the model will not produce valid data', async () => {
    const { sidecar } = fakeModel([{ name: '' }])
    const scribe = new Scribe({ sidecar, seed: 'fallback' })

    const name = await scribe.nameCity({ theme: 'anywhere', seed: 's' })
    expect(name.length).toBeGreaterThan(3)
    expect(scribe.problems().length).toBeGreaterThan(0)
  })

  it('asks again on the next seed when the model answers in prose, and takes the call it makes then', async () => {
    const { sent, sidecar } = fakeModel(['no-call', { name: 'Saltmere' }])
    const scribe = new Scribe({ sidecar })

    expect(await scribe.nameCity({ theme: 'port', seed: 's' })).toBe('Saltmere')
    expect(sent).toHaveLength(2)
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['no-tool-call'])
  })

  it('records a refusal, an unreachable sidecar, and an answer that is not a call', async () => {
    const refused = fakeModel(['http-500'])
    const scribeA = new Scribe({ sidecar: refused.sidecar, attempts: 1 })
    await scribeA.nameCity({ theme: 't', seed: 's' })
    expect(scribeA.problems()[0]).toMatchObject({ task: 'name_city', at: 'city-name', error: { code: 'refused' } })

    const chatty = fakeModel(['no-call'])
    const scribeB = new Scribe({ sidecar: chatty.sidecar, attempts: 1 })
    await scribeB.nameCity({ theme: 't', seed: 's' })
    expect(scribeB.problems()[0]!.error.code).toBe('no-tool-call')

    const dead = new Sidecar({
      base: 'http://127.0.0.1:1',
      fetch: (async () => {
        throw new Error('connection refused')
      }) as unknown as typeof globalThis.fetch,
    })
    const scribeC = new Scribe({ sidecar: dead, attempts: 1 })
    const name = await scribeC.nameCity({ theme: 't', seed: 's' })
    expect(name.length).toBeGreaterThan(3)
    expect(scribeC.problems()[0]!.error.code).toBe('unreachable')
  })

  it('tells every call the city it is writing into and the names already spent', async () => {
    const { sent, sidecar } = fakeModel((call) =>
      call.toolName === 'name_city'
        ? { name: 'Cold Harbour' }
        : call.toolName === 'name_place'
          ? { name: 'The Anchor' }
          : { name: 'Mara Voss', personality: 'Watches the door.', knowledge: ['The tide is late.', 'Rook is gone.'] },
    )
    const scribe = new Scribe({ sidecar })

    await scribe.nameCity({ theme: 'port', seed: 's' })
    await scribe.namePlace({ kind: 'bar', charter: charterOf('bar'), theme: 'port', index: 0 })
    await scribe.describeNpc({ role: 'bartender', placeKind: 'bar', place: charterOf('bar'), placeName: 'The Anchor', theme: 'port', index: 0 })

    expect(sent[1]!.user).toContain('City: Cold Harbour')
    expect(sent[1]!.user).toContain('Kind of building: bar')
    expect(sent[2]!.user).toContain('City: Cold Harbour')
    expect(sent[2]!.user).toContain('Place: The Anchor, a bar')
    // and each is told what such a place is here, off its charter
    expect(sent[2]!.user).toContain('What a bar is here: a counter at the front with somebody behind it')
    expect(sent[2]!.user).toContain('- The cellar door sticks unless you lift it.')
    // and the name the city already spent comes back as a name not to spend again
    expect(sent[1]!.user).toContain('- Cold Harbour')
    expect(sent[2]!.user).toContain('- The Anchor')
  })

  it('pins every call to a seed drawn from the city seed and its position, and a temperature', async () => {
    const pinsOf = async (seed: string) => {
      const pins: { seed?: number; temperature?: number }[] = []
      const fetch = (async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body))
        pins.push({ seed: body.seed, temperature: body.temperature })
        const tool = body.tools[0].function
        const reply = tool.name === 'name_city' ? { name: 'x' } : { name: 'Saltmere' }
        return Response.json({
          choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'call_1', type: 'function', function: { name: tool.name, arguments: JSON.stringify(reply) } }] } }],
        })
      }) as unknown as typeof globalThis.fetch
      const scribe = new Scribe({ sidecar: new Sidecar({ base: 'http://127.0.0.1:8976', fetch }), seed, attempts: 2 })
      await scribe.nameCity({ theme: 'port', seed })
      await scribe.namePlace({ kind: 'bar', charter: charterOf('bar'), theme: 'port', index: 3 })
      await scribe.namePlace({ kind: 'bar', charter: charterOf('bar'), theme: 'port', index: 4 })
      return pins
    }

    const [first, again, elsewhere] = await Promise.all([pinsOf('harbour'), pinsOf('harbour'), pinsOf('sandbar')])
    // the city's name was refused once, so its two attempts are two calls at one position
    expect(first).toHaveLength(4)
    for (const pin of first) {
      expect(pin.temperature).toBe(0.9)
      expect(pin.seed).toBeGreaterThanOrEqual(0)
      expect(pin.seed).toBeLessThanOrEqual(4294967294)
    }
    // by position: the same on every run of one city, every call its own, and another city another set
    expect(first).toEqual(again)
    expect(new Set(first.map((pin) => pin.seed)).size).toBe(4)
    expect(elsewhere.map((pin) => pin.seed)).not.toEqual(first.map((pin) => pin.seed))
  })

  it('tries again when a call ran out of time or broke off, and gives up on one the caller stopped', async () => {
    // the sidecar's own clock is its business; what this box owes is what it does with the answer
    const answers = (...codes: string[]) => {
      const left = codes.slice()
      return {
        ask: async () => {
          const code = left.shift()
          return code
            ? { ok: false as const, error: { code, phase: 'response', ms: 1 } }
            : { ok: true as const, value: { name: 'Saltmere' } }
        },
      } as unknown as Sidecar
    }

    const late = new Scribe({ sidecar: answers('timeout') })
    expect(await late.nameCity({ theme: 'port', seed: 's' })).toBe('Saltmere')
    expect(late.problems().map((problem) => problem.error.code)).toEqual(['timeout'])

    const cut = new Scribe({ sidecar: answers('broken') })
    expect(await cut.nameCity({ theme: 'port', seed: 's' })).toBe('Saltmere')
    expect(cut.problems().map((problem) => problem.error.code)).toEqual(['broken'])

    const stopped = new Scribe({ sidecar: answers('aborted'), seed: 'stopped' })
    const name = await stopped.nameCity({ theme: 'port', seed: 's' })
    expect(name).not.toBe('Saltmere')
    expect(stopped.problems().map((problem) => problem.error.code)).toEqual(['aborted'])
  })

  it('tells every call what work it is, so the service can route it to the model that job is on', async () => {
    const { sent, sidecar } = fakeModel((call) =>
      call.toolName === 'write_premise' ? PREMISE : call.toolName === 'write_charter' ? JAIL : { name: 'Cold Harbour' },
    )
    const scribe = new Scribe({ sidecar, seed: 'city', attempts: 1 })

    const built = await new Forge(scribe).build({ theme: 'rain-soaked port', seed: 'scribe-city', blocksX: 1, blocksY: 1, blockCells: 16 })
    expect(built.ok).toBe(true)
    // and the calls a build does not make on its own
    await scribe.namePlace({ kind: 'bar', charter: charterOf('bar'), theme: 'port', index: 0 })
    await scribe.describeNpc({ role: 'bartender', placeKind: 'bar', place: charterOf('bar'), placeName: 'The Anchor', theme: 'port', index: 0 })
    await scribe.describeItem({ archetype: 'ledger', theme: 'port', index: 0 })
    await scribe.writeBrief({ want: ['theme'], seed: 's' })

    // read off every request that went out: an untagged one shows up here as its own line
    expect([...new Set(sent.map((call) => `${call.toolName} -> ${call.job}`))].sort()).toEqual([
      'describe_item -> places',
      'describe_npc -> places',
      'name_city -> city',
      'name_districts -> city',
      'name_place -> city',
      'name_signs -> city',
      'write_brief -> history',
      'write_charter -> history',
      'write_instance -> places',
      'write_premise -> history',
      'write_quest -> quests',
    ])
  })

  it('builds a whole city with the model as its narrator, quests included', async () => {
    const { sent, sidecar } = fakeModel([
      {
        name: 'Cold Harbour',
        personality: 'Watches the door more than the glasses.',
        knowledge: ['The tide takes the low road twice a day.', 'Nobody has seen Rook since Tuesday.'],
        description: 'Salt-stained and heavier than it looks.',
        // every tool takes what it needs from this and ignores the rest
      },
    ])
    const scribe = new Scribe({ sidecar, seed: 'city' })

    const built = await new Forge(scribe).build({
      theme: 'rain-soaked port',
      seed: 'scribe-city',
      blocksX: 1,
      blocksY: 1,
      blockCells: 16,
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return

    // the history is the first thing the model is asked for. `writePremise` is optional on
    // the port, so a scribe that stops answering it loses the whole stage silently
    expect(sent[0]!.toolName).toBe('write_premise')
    expect(built.value.world.check()).toEqual([])
    expect(built.value.world.plots().length).toBeGreaterThan(2)
    expect(built.value.world.npcs().length).toBeGreaterThan(0)
    // the measured failure this box shipped: a city with no quests in it, reported as a success
    expect(built.value.quests.length).toBeGreaterThan(0)
    expect(built.value.rejected).toEqual([])
  })
})
