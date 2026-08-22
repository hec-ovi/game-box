import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Forge } from '@gb/forge'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { Sidecar } from '@gb/sidecar'
import { Scribe } from '../src/index.ts'

/** The sidecar's own published request schema, read from its box. */
const chatRequestSchema = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', '..', 'api', 'schema', 'chat-request.json'), 'utf8'),
)
const validateChatRequest = new Ajv2020({ strict: false }).compile(chatRequestSchema)

interface Sent {
  readonly toolName: string
  readonly parameters: Record<string, unknown>
  readonly user: string
}

/** A stand-in model that answers whatever the next scripted reply says. */
function fakeModel(replies: Array<unknown | 'no-call' | 'http-500'>) {
  const sent: Sent[] = []
  const fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    expect(validateChatRequest(body), `request off the sidecar contract: ${JSON.stringify(validateChatRequest.errors)}`).toBe(true)

    const tool = body.tools[0].function
    sent.push({ toolName: tool.name, parameters: tool.parameters, user: body.messages[1].content })
    expect(body.tool_choice).toEqual({ type: 'function', function: { name: tool.name } })

    const reply = replies.length > 1 ? replies.shift() : replies[0]
    if (reply === 'http-500') {
      return new Response('engine on fire', { status: 500 })
    }
    if (reply === 'no-call') {
      return Response.json({ choices: [{ message: { role: 'assistant', content: 'here you go' } }] })
    }
    return Response.json({
      choices: [
        {
          message: {
            role: 'assistant',
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: tool.name, arguments: JSON.stringify(reply) } }],
          },
        },
      ],
      })
  }) as unknown as typeof globalThis.fetch

  return { sent, sidecar: new Sidecar({ base: 'http://127.0.0.1:8976', fetch }) }
}

describe('Scribe', () => {
  it('asks with a forced tool whose parameters are the contract, and uses the answer', async () => {
    const { sent, sidecar } = fakeModel([{ name: 'Cold Harbour' }])
    const scribe = new Scribe({ sidecar })

    expect(await scribe.nameCity({ theme: 'rain-soaked port', seed: 's' })).toBe('Cold Harbour')
    expect(sent[0]!.toolName).toBe('name_city')
    expect(sent[0]!.parameters).toMatchObject({ type: 'object', properties: { name: { type: 'string' } } })
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
    expect(scribe.problems().map((p) => p.error.code)).toEqual(['invalid-arguments'])
  })

  it('falls back to the offline narrator when the model will not produce valid data', async () => {
    const { sidecar } = fakeModel([{ name: '' }])
    const scribe = new Scribe({ sidecar, seed: 'fallback' })

    const name = await scribe.nameCity({ theme: 'anywhere', seed: 's' })
    expect(name.length).toBeGreaterThan(3)
    expect(scribe.problems().length).toBeGreaterThan(0)
  })

  it('records a refusal, an unreachable sidecar, and an answer that is not a call', async () => {
    const refused = fakeModel(['http-500'])
    const scribeA = new Scribe({ sidecar: refused.sidecar, attempts: 1 })
    await scribeA.nameCity({ theme: 't', seed: 's' })
    expect(scribeA.problems()[0]!.error.code).toBe('refused')

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

  it('writes one quest per call, sealed and ready for the validator', async () => {
    const draft = {
      id: 'quest_0001',
      kind: 'main',
      title: 'The Ledger',
      summary: 'Someone wants a book back.',
      giverNpcId: 'npc_0001',
      startStepId: 'step_0001',
      steps: [
        { id: 'step_0001', kind: 'talk', npcId: 'npc_0001', objective: 'Talk', next: ['step_0002'], requires: [], effects: [] },
        { id: 'step_0002', kind: 'complete', objective: 'Done', next: [], requires: [], effects: [] },
      ],
      reward: { money: 10, reputation: 1, faction: 'town', items: [] },
    }
    const { sent, sidecar } = fakeModel([draft])
    const scribe = new Scribe({ sidecar })

    const quests = await scribe.writeQuests({
      summary: {
        cityName: 'Cold Harbour',
        theme: 'port',
        places: [
          { plotId: 'plot_0001', kind: 'bar', name: 'The Anchor', npcs: [{ npcId: 'npc_0001', name: 'Mara', role: 'bartender' }], items: [] },
          { plotId: 'plot_0002', kind: 'shop', name: 'Dunn Supply', npcs: [], items: [{ itemId: 'item_0001', name: 'Ledger' }] },
        ],
      },
      sideQuests: 1,
    })

    expect(quests).toHaveLength(2)
    expect(quests[0]).toMatchObject({ format: 'game-box.quest', schemaVersion: 1, id: 'quest_0001' })
    // the world it must write about is in the prompt, by id
    expect(sent[0]!.user).toContain('npc_0001')
    expect(sent[0]!.user).toContain('item_0001')
    expect(sent[0]!.user).toContain('The Anchor')
    expect(sent[1]!.user).toContain('quest_0002')
  })

  it('builds a whole city with the model as its narrator', async () => {
    const { sidecar } = fakeModel([
      {
        name: 'Cold Harbour',
        personality: 'Watches the door more than the glasses.',
        knowledge: ['The tide takes the low road twice a day.', 'Nobody has seen Rook since Tuesday.'],
        description: 'Salt-stained and heavier than it looks.',
        // every tool takes what it needs from this and ignores the rest
      },
    ])
    const scribe = new Scribe({ sidecar, seed: 'city' })

    const built = await new Forge(scribe).build({ theme: 'rain-soaked port', seed: 'scribe-city', blocksX: 1, blocksY: 1, blockCells: 12 })
    expect(built.ok).toBe(true)
    if (!built.ok) return

    expect(built.value.world.check()).toEqual([])
    expect(built.value.world.plots().length).toBeGreaterThan(2)
    expect(built.value.world.npcs().length).toBeGreaterThan(0)
  })
})
