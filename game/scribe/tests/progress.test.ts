import type { WorldSummary } from '@gb/forge'
import { describe, expect, it } from 'vitest'
import { Scribe, type InstanceRequest, type ScribeProgress } from '../src/index.ts'
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
      items: [{ itemId: 'item_0001', name: 'Ledger' }],
    },
  ],
}

const PLACES: InstanceRequest[] = ['bar', 'shop'].map((kind, i) => ({
  kind: kind as 'bar',
  theme: 'port',
  rooms: ['main'],
  posts: [{ postId: `anchor_${i}`, role: 'clerk' }],
  things: [],
}))

/** Answers every tool the pipeline uses, taking the ids out of the schema it was handed. */
function model(call: Sent) {
  if (call.toolName === 'name_city') return { name: 'Cold Harbour' }
  if (call.toolName === 'write_instance') {
    const properties = (call.parameters as Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, unknown>>>>>>)['properties']!
    const person = properties['people']!['items']!['properties']!
    const letters = /\^\[([A-Z]+)]/.exec(String(person['family']!['pattern']))![1]!
    return {
      name: `The ${letters} House`,
      character: 'A low room that smells of wet rope, with the radio left on.',
      people: (person['postId']!['enum'] as unknown as string[]).map((postId, i) => ({
        postId,
        given: `Given${i}`,
        family: `${letters[i]}orne`,
        personality: 'Watches the door.',
        knowledge: ['The tide is late.', 'The crates are unpaid.'],
      })),
      things: [],
    }
  }
  const id = /quest_\d{4}/.exec(call.user)![0]
  return {
    id,
    kind: 'main',
    title: `Errand ${id}`,
    summary: 'Somebody wants something moved.',
    giverNpcId: 'npc_0001',
    difficulty: 'small',
    startStepId: 'step_0001',
    steps: [
      { id: 'step_0001', kind: 'collect', itemId: 'item_0001', objective: 'Take it', next: ['step_0002'] },
      { id: 'step_0002', kind: 'complete', objective: 'Done' },
    ],
    reward: { money: 45, reputation: 3, faction: 'town', items: [] },
  }
}

async function build(progress?: (step: ScribeProgress) => void) {
  const { sent, sidecar } = fakeModel(model)
  const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 2, ...(progress ? { progress } : {}) })
  await scribe.nameCity({ theme: 'port', seed: 'harbour' })
  await scribe.writeInstances(PLACES)
  await scribe.writeQuests({ summary: CITY, sideQuests: 0 })
  return sent.map((call) => call.user)
}

describe('showing how far the build has got', () => {
  it('publishes each stage in the order the pipeline runs it, counting the answers in', async () => {
    const seen: ScribeProgress[] = []
    await build((step) => seen.push(step))

    expect(seen.map((step) => step.stage)).toEqual([
      'city', 'city',
      'instances', 'instances', 'instances',
      'quests', 'quests',
    ])
    expect(seen.filter((step) => step.stage === 'instances').map((step) => `${step.done}/${step.total}`)).toEqual([
      '0/2',
      '1/2',
      '2/2',
    ])
    expect(seen[1]!.what).toBe('Cold Harbour')
    expect(seen.at(-1)!.what).toBe('Errand quest_0001')
    // and it says what it is working on, not just how many are left
    expect(seen[3]!.what).toMatch(/^The [A-Z]+ House, a (bar|shop)$/)
  })

  it('writes the same city with a loader on it as without, and a loader that throws is dropped', async () => {
    let published = 0
    const [plain, watched] = await Promise.all([
      build(),
      build(() => {
        published++
        throw new Error('the loader is broken')
      }),
    ])

    expect(watched).toEqual(plain)
    // the first throw takes the port out rather than being thrown again on every stage
    expect(published).toBe(1)
  })
})
