import type { InstanceRequest } from '@gb/forge'
import { BACKGROUND_UNLOCKS, LifeSchema } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'
import { backgroundOf, lifeOf, shellOf } from './people.ts'
import { PLAIN, STANDING, charterOf } from './places.ts'
import { writtenPlace } from './town.ts'
import { stopped, wrote } from './wrote.ts'

const bar: InstanceRequest = {
  index: 0,
  kind: 'bar',
  name: 'Place 0',
  cast: [],
  charter: charterOf('bar'),
  theme: 'rain-soaked port',
  ...STANDING,
  rooms: ['main', 'storage'],
  posts: [
    { postId: 'anchor_0001', role: 'bartender', index: 0 },
    { postId: 'anchor_0002', role: 'patron', index: 1 },
  ],
  things: [{ thingId: 'item_0001', archetype: 'ledger', index: 0 }],
  has: PLAIN,
  premise: 'Lives on: the freight line.',
}

/** A city of `count` places, each with its own posts and stock. */
function places(count: number): InstanceRequest[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    kind: 'shop' as const,
    name: `Place ${i}`,
    cast: [],
    charter: charterOf('shop'),
    theme: 'rain-soaked port',
    ...STANDING,
    rooms: ['main' as const],
    posts: [
      { postId: `anchor_${i}_1`, role: 'clerk' as const, index: i * 2 },
      { postId: `anchor_${i}_2`, role: 'worker' as const, index: i * 2 + 1 },
    ],
    things: [{ thingId: `item_${i}`, archetype: 'box' as const, index: i }],
    has: PLAIN,
  }))
}

/** Answers land back to front, so arrival order is never the order the calls went out in. */
function backwards(total: number) {
  return fakeModel(async (call, index) => {
    await new Promise((resolve) => setTimeout(resolve, (total - index) * 4))
    return writtenPlace(call)
  })
}

describe('writing a place and its people in one call', () => {
  it('asks once per place and puts the answer back on the posts the shell named', async () => {
    const { sent, sidecar } = fakeModel((call) =>
      call.toolName === 'write_instance' ? writtenPlace(call) : { name: 'Cold Harbour' },
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour' })
    await wrote(scribe.nameCity({ theme: 'rain-soaked port', seed: 'harbour' }))

    const [written] = await wrote(scribe.writeInstances([bar]))

    expect(sent).toHaveLength(2)
    expect(sent[1]!.toolName).toBe('write_instance')
    // the sign was written in the naming pass and handed in: this call never wrote one
    expect(written!.name).toBe('Place 0')
    expect(sent[1]!.parameters).not.toHaveProperty('properties.name')
    expect(written!.character.length).toBeGreaterThan(0)
    expect(written!.people.map((person) => [person.postId, person.role])).toEqual([
      ['anchor_0001', 'bartender'],
      ['anchor_0002', 'patron'],
    ])
    expect(written!.people[0]!.name).toMatch(/^Given0 /)
    expect(written!.people[0]!.knowledge).toHaveLength(2)
    expect(written!.things).toEqual([
      { thingId: 'item_0001', name: 'Thing item_0001', description: 'Worn and heavy.' },
    ])

    // and the call was told the building it is writing into, and nothing else
    const asked = sent[1]!.user
    expect(asked).toContain('City: Cold Harbour')
    expect(asked).toContain('Lives on: the freight line.')
    expect(asked).toContain('The building: Place 0, a bar')
    expect(asked).toContain('What a bar is here: a counter at the front with somebody behind it; nobody works past the front; it keeps drink, papers, valuables; anybody may walk in. Its\nrooms: Taproom, Cellar.')
    expect(asked).toContain('main, storage')
    expect(asked).toContain('anchor_0001: the bartender')
    expect(asked).toContain('item_0001: a ledger')
    expect(asked).toContain('Nothing here is locked and no screen is on.')
    expect(scribe.problems()).toEqual([])
  })

  it('tells the place what the plan put in it: the locks, the screens, the camera and the sale', async () => {
    const { sent, sidecar } = fakeModel((call) => writtenPlace(call))
    const office: InstanceRequest = {
      ...bar,
      has: {
        locked: [{ room: 'Cellar', by: 'key' }, { room: 'Office', by: 'code' }, { room: 'Store', by: 'card' }],
        machines: [{ room: 'Office', program: 'ledger' }, { room: 'Taproom', program: 'snake' }],
        camera: true,
        forSale: 4200,
      },
    }

    await wrote(new Scribe({ sidecar, seed: 'harbour' }).writeInstances([office]))

    const asked = sent[0]!.user
    expect(asked).toContain('Behind a lock: the Cellar (a key somebody here carries); the Office (a code typed at the door); the Store (a card somebody here carries).')
    expect(asked).toContain('Screens: one in the Office running the ledger; one in the Taproom running a game of snake.')
    expect(asked).toContain('A camera watches the front room.')
    expect(asked).toContain('for sale at 4200 credits')
    expect(asked).toContain('Never write the code itself')
  })

  it('tells the place which of its posts the town\'s work already sends the player to', async () => {
    const { sent, sidecar } = fakeModel((call) => writtenPlace(call))
    const wanted: InstanceRequest = {
      ...bar,
      cast: [
        { postId: 'anchor_0001', part: 'giver', questId: 'quest_0001', questTitle: 'The Long Way Round', questKind: 'main', line: 'Ask about the freight.' },
        { postId: 'anchor_0002', part: 'deliver-to', questId: 'quest_0003', questTitle: 'Short Change', questKind: 'side', line: 'Bring them the ledger.' },
      ],
    }

    await wrote(new Scribe({ sidecar, seed: 'harbour' }).writeInstances([wanted]))

    const asked = sent[0]!.user
    expect(asked).toContain('anchor_0001: the bartender; hands the main job out')
    expect(asked).toContain('anchor_0002: the patron; a side job has the player bring them something')
    // the job is named by its kind, never by its title: a title is prose the
    // model could hang over this very door
    expect(asked).not.toContain('The Long Way Round')
  })

  it('writes every life and codex through the world\'s own schema, and hands them back on the person', async () => {
    const { sent, sidecar } = fakeModel((call) => writtenPlace(call))
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const [written] = await wrote(scribe.writeInstances([bar]))

    // the parameters are `@gb/world`'s Life and BackgroundFact, every part of a life asked for
    const person = shellOf(sent[0]!).person
    const life = person['life'] as { properties: Record<string, unknown>; required: string[] }
    expect(Object.keys(life.properties)).toEqual(Object.keys(LifeSchema.shape))
    expect(life.required).toEqual(Object.keys(LifeSchema.shape))
    const fact = (person['background'] as { items: { properties: Record<string, { enum: string[] }> } }).items
    expect(fact.properties['unlockedBy']!.enum).toEqual([...BACKGROUND_UNLOCKS])

    expect(written!.people[0]!.life).toEqual(lifeOf('Given0'))
    expect(written!.people[0]!.background).toEqual(backgroundOf('Given0'))
    expect(written!.people[1]!.life?.reason).toMatch(/^I /)
  })

  it('sends a codex with a stage nothing is behind back with the stage named', async () => {
    const { sent, sidecar } = fakeModel((call, index) =>
      writtenPlace(call, index === 0 ? { stages: ['met', 'talked'] } : {}),
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const [written] = await wrote(scribe.writeInstances([bar]))

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('people.0.background: no fact is unlocked by quest')
    expect(sent[1]!.user).toContain('people.1.background: no fact is unlocked by told')
    expect(written!.people[0]!.background).toHaveLength(4)
  })

  it('shows each place its own building and nothing about the others', async () => {
    const clinic: InstanceRequest = {
      index: 1,
      kind: 'clinic',
      name: 'Place 1',
      cast: [],
      charter: charterOf('clinic'),
      theme: 'rain-soaked port',
      ...STANDING,
      rooms: ['main'],
      posts: [{ postId: 'anchor_9999', role: 'receptionist', index: 2 }],
      things: [{ thingId: 'item_9999', archetype: 'medkit', index: 1 }],
      has: PLAIN,
    }
    const { sent, sidecar } = fakeModel((call) => writtenPlace(call))
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 2 })

    const written = await wrote(scribe.writeInstances([bar, clinic]))

    const [first, second] = sent.map((call) => call.user)
    expect(first).toContain('anchor_0001')
    expect(first).not.toContain('anchor_9999')
    expect(first).not.toContain('clinic')
    expect(second).not.toContain('anchor_0001')
    expect(second).not.toContain('a bar')
    // neither of them was told what the other came back with
    expect(first).not.toContain(written[1]!.name)
    expect(second).not.toContain(written[0]!.name)
  })

  it('gives every person in the city a name of their own, however many places are written at once', async () => {
    // a model with one favourite first name, which is what a blind agent does
    const { sent, sidecar } = fakeModel((call) => writtenPlace(call, { given: 'Mara' }))
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 6 })

    const written = await wrote(scribe.writeInstances(places(6)))

    const people = written.flatMap((instance) => instance.people.map((person) => person.name))
    expect(people).toHaveLength(12)
    expect(new Set(people).size).toBe(12)
    // and nobody had to be asked twice: the letters made a collision unwritable
    expect(sent).toHaveLength(6)
    expect(scribe.problems()).toEqual([])
  })

  it('writes the same city on the same seed, whatever order the answers landed in', async () => {
    const runs = await Promise.all(
      [1, 2].map(async () => {
        const model = backwards(6)
        const scribe = new Scribe({ sidecar: model.sidecar, seed: 'harbour', concurrency: 3 })
        const written = await wrote(scribe.writeInstances(places(6)))
        return { asked: model.sent.map((call) => call.user).sort(), written }
      }),
    )
    expect(runs[0]!.asked).toEqual(runs[1]!.asked)
    expect(runs[0]!.written).toEqual(runs[1]!.written)
  })

  it('never carries the whole city into one call, however many places have been written', async () => {
    // every place and everybody in it named after its own post, so nothing
    // here is ever asked twice and the list is the only thing that grows
    const { sent, sidecar } = fakeModel((call) =>
      writtenPlace(call, { given: shellOf(call).posts[0]! }),
    )
    await wrote(new Scribe({ sidecar, seed: 'harbour', concurrency: 4 }).writeInstances(places(60)))

    // 60 places is 180 names spent; a prompt that grows with the city costs
    // more on every call than the one before it
    expect(sent).toHaveLength(60)
    const names = (call: Sent) =>
      (call.user.split('## Names already spoken for in this city')[1]!.match(/^- /gm) ?? []).length
    expect(names(sent.at(-1)!)).toBeLessThanOrEqual(40)
    expect(names(sent.at(-1)!)).toBeGreaterThan(0)
  })

  it('stops the places stage when the model will not write a place, naming the place it stopped at', async () => {
    const { sent, sidecar } = fakeModel(['no-call'])
    const scribe = new Scribe({ sidecar, seed: 'harbour', attempts: 1 })

    const failure = await stopped(scribe.writeInstances([bar]))

    expect(failure).toMatchObject({ stage: 'places', at: 'place:0', code: 'no-tool-call' })
    expect(failure.message).toContain('the bar and the people in it could not be written')
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['no-tool-call'])
    // a model that never answers is not asked a second time for the same place
    expect(sent).toHaveLength(1)
  })
})
