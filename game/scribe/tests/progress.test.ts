import type { InstanceRequest, WorldSummary } from '@gb/forge'
import { describe, expect, it } from 'vitest'
import { Scribe, type PlaceRequest, type ScribeProgress } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'
import { backgroundOf, lifeOf, shellOf } from './people.ts'
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
      items: [{ itemId: 'item_0001', name: 'Ledger' }],
    },
  ],
}

const PLACES: InstanceRequest[] = ['bar', 'shop'].map((kind, i) => ({
  index: i,
  kind,
  charter: charterOf(kind),
  theme: 'port',
  rooms: ['main'],
  posts: [{ postId: `anchor_${i}`, role: 'clerk', index: i }],
  things: [],
}))

const FRONTAGE: PlaceRequest[] = Array.from({ length: 3 }, (_, i) => ({ index: i + 2, kind: 'house', charter: charterOf('house'), theme: 'port' }))

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

/** Answers every tool the pipeline uses, taking the ids out of the schema it was handed. */
function model(call: Sent) {
  if (call.toolName === 'write_premise') return PREMISE
  if (call.toolName === 'write_charter') return JAIL
  if (call.toolName === 'name_city') return { name: 'Cold Harbour' }
  if (call.toolName === 'name_signs') {
    const labels = (call.parameters as { properties: { signs: { items: { properties: { building: { enum: string[] } } } } } }).properties.signs.items.properties.building.enum
    return { signs: labels.map((label) => ({ building: label, name: `${label} Row` })) }
  }
  if (call.toolName === 'write_instance') {
    const shell = shellOf(call)
    return {
      name: `The ${shell.letters} House`,
      character: 'A low room that smells of wet rope, with the radio left on.',
      people: shell.posts.map((postId, i) => ({
        postId,
        given: `Given${i}`,
        family: `${shell.letters[i]}orne`,
        personality: 'Watches the door.',
        knowledge: ['The tide is late.', 'The crates are unpaid.'],
        life: lifeOf(`Given${i}`),
        background: backgroundOf(`Given${i}`),
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

/** A whole build, the way the forge runs one: history, name, signs, places, quests. */
async function build(progress?: (step: ScribeProgress) => void) {
  const { sent, sidecar } = fakeModel(model)
  const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 2, ...(progress ? { progress } : {}) })
  await scribe.writePremise({ theme: 'port', seed: 'harbour' })
  await scribe.nameCity({ theme: 'port', seed: 'harbour' })
  await scribe.namePlaces(FRONTAGE)
  await scribe.writeInstances(PLACES)
  await scribe.writeQuests({ summary: CITY, sideQuests: 0 })
  return sent.map((call) => call.user)
}

describe('showing how far the build has got', () => {
  it('publishes the four stages in the order the pipeline runs them, counting every answer in', async () => {
    const seen: ScribeProgress[] = []
    await build((step) => seen.push(step))

    const counts = (stage: string) => seen.filter((step) => step.stage === stage).map((step) => `${step.done}/${step.total}`)
    // the history stage is the premise and then the kinds of place it invented: one bar that grows
    expect(counts('history')).toEqual(['0/1', '0/2', '1/2', '2/2'])
    // the city stage is the name and then the signs, the same way
    expect(counts('city')).toEqual(['0/1', '1/1', '1/4', '2/4', '3/4', '4/4'])
    expect(counts('places')).toEqual(['0/2', '1/2', '2/2'])
    expect(counts('quests')).toEqual(['0/1', '1/1'])
    expect(seen.map((step) => step.stage)).toEqual([
      ...Array(4).fill('history'),
      ...Array(6).fill('city'),
      ...Array(3).fill('places'),
      ...Array(2).fill('quests'),
    ])

    // every stage is complete when it ends, and says what it was working on
    for (const stage of ['history', 'city', 'places', 'quests']) {
      const last = seen.filter((step) => step.stage === stage).at(-1)!
      expect(last.done).toBe(last.total)
    }
    expect(seen[1]!.what).toBe('jail')
    expect(seen[2]!.what).toBe('a jail')
    expect(seen[3]!.what).toBe('Container freight off the elevated line.')
    expect(seen[5]!.what).toBe('Cold Harbour')
    expect(seen[6]!.what).toBe('3 signs')
    expect(seen[7]!.what).toBe('b2 Row, a house')
    expect(seen[11]!.what).toMatch(/^The [A-Z]+ House, a (bar|shop)$/)
    expect(seen.at(-1)!.what).toBe('Errand quest_0001')
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
