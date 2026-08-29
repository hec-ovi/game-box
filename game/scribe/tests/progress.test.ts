import type { InstanceRequest, PlaceRequest, WorldSummary } from '@gb/forge'
import { describe, expect, it } from 'vitest'
import { Scribe, type ScribeProgress } from '../src/index.ts'
import { sheet } from './errand.ts'
import { fakeModel, type Sent } from './fake-model.ts'
import { backgroundOf, lifeOf, shellOf } from './people.ts'
import { JAIL, PLAIN, STANDING, charterOf } from './places.ts'
import { settledNeeds, writtenPlaces } from './town.ts'
import { wrote } from './wrote.ts'

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
  name: `Place ${i}`,
  cast: [],
  charter: charterOf(kind),
  theme: 'port',
  ...STANDING,
  rooms: ['main'],
  posts: [{ postId: `anchor_${i}`, role: 'clerk', index: i }],
  things: [],
  has: PLAIN,
}))

const FRONTAGE: PlaceRequest[] = Array.from({ length: 3 }, (_, i) => ({ index: i + 2, kind: 'house', charter: charterOf('house'), theme: 'port', ...STANDING }))

/** The doors this town opens, before anybody has said what any of them is. */
const DOORS: PlaceRequest[] = Array.from({ length: 2 }, (_, i) => ({ index: i, theme: 'port', ...STANDING }))

/** What the town needs behind those two doors: a counter, and the jail its history demands. */
const NEEDS = [
  { wants: 'somewhere to buy something over a counter, with stock to sell across it', count: 1 },
  { wants: "a kind of place the town's own history says it has", count: 1, kind: 'jail' },
]

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
  if (call.toolName === 'settle_needs') return settledNeeds(call)
  if (call.toolName === 'write_places') return writtenPlaces(call)
  if (call.toolName === 'name_city') return { name: 'Cold Harbour' }
  if (call.toolName === 'name_signs') {
    const labels = (call.parameters as { properties: { signs: { items: { properties: { building: { enum: string[] } } } } } }).properties.signs.items.properties.building.enum
    return { signs: labels.map((label) => ({ building: label, name: `${label} Row` })) }
  }
  if (call.toolName === 'write_instance') {
    const shell = shellOf(call)
    return {
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
  return sheet(/quest_\d{4}/.exec(call.user)![0]!, [{ kind: 'collect', itemId: 'item_0001', objective: 'Take it' }])
}

/** A whole build, the way the forge runs one: history, name, signs, places, quests. */
async function build(progress?: (step: ScribeProgress) => void) {
  const { sent, sidecar } = fakeModel(model)
  const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 2, ...(progress ? { progress } : {}) })
  await wrote(scribe.writePremise({ theme: 'port', seed: 'harbour' }))
  await wrote(scribe.writePlaces({ theme: 'port', kinds: [charterOf('bar'), charterOf('house'), JAIL], needs: NEEDS, places: DOORS }))
  await wrote(scribe.writeQuests({ summary: CITY, sideQuests: 0 }))
  await wrote(scribe.nameCity({ theme: 'port', seed: 'harbour' }))
  await wrote(scribe.namePlaces(FRONTAGE))
  await wrote(scribe.writeInstances(PLACES))
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
    // the places stage runs twice, once for what the doors are and once for what is behind them, and starts over
    expect(counts('places')).toEqual(['0/2', '1/2', '2/2', '0/2', '1/2', '2/2'])
    expect(counts('quests')).toEqual(['0/1', '1/1'])
    expect(seen.map((step) => step.stage)).toEqual([
      ...Array(4).fill('history'),
      ...Array(3).fill('places'),
      ...Array(2).fill('quests'),
      ...Array(6).fill('city'),
      ...Array(3).fill('places'),
    ])

    // every stage is complete when it ends, and says what it was working on
    for (const stage of ['history', 'city', 'places', 'quests']) {
      const last = seen.filter((step) => step.stage === stage).at(-1)!
      expect(last.done).toBe(last.total)
    }
    expect(seen[1]!.what).toBe('jail')
    expect(seen[2]!.what).toBe('a jail')
    expect(seen[3]!.what).toBe('Container freight off the elevated line.')
    expect(seen[4]!.what).toBe('2 doors')
    expect(seen.slice(5, 7).map((step) => step.what)).toEqual(['a bar', 'a jail'])
    expect(seen[8]!.what).toBe('Errand quest_0001')
    expect(seen[10]!.what).toBe('Cold Harbour')
    expect(seen[11]!.what).toBe('3 signs')
    expect(seen[12]!.what).toBe('b2 Row, a house')
    expect(seen.at(-1)!.what).toMatch(/^Place \d, a (bar|shop)$/)
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
