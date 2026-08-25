import type { InstanceRequest } from '@gb/forge'
import { BACKGROUND_UNLOCKS, LifeSchema } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'
import { backgroundOf, lifeOf, shellOf } from './people.ts'
import { PLAIN, charterOf } from './places.ts'

/** A model that writes whatever the shell asked for, with the family names it is allowed. */
function answer(call: Sent, options: { name?: string; given?: string; stages?: readonly string[] } = {}) {
  const shell = shellOf(call)
  return {
    name: options.name ?? `The ${shell.letters} House`,
    character: 'A low room that smells of wet rope, with the radio left on.',
    // written back to front, so a caller that zips by position rather than by id gets it wrong
    people: shell.posts.map((postId, i) => ({
      postId,
      given: options.given ?? `Given${i}`,
      family: `${shell.letters[i % shell.letters.length]}orne`,
      personality: 'Watches the door more than the glasses.',
      knowledge: ['The tide is late again.', 'Nobody has paid for the crates.'],
      life: lifeOf(`Given${i}`),
      background: backgroundOf(`Given${i}`).map((fact, k) => (options.stages ? { ...fact, unlockedBy: options.stages[k % options.stages.length]! } : fact)),
    })).reverse(),
    things: shell.things.map((thingId) => ({ thingId, name: `Thing ${thingId}`, description: 'Worn and heavy.' })),
  }
}

const bar: InstanceRequest = {
  index: 0,
  kind: 'bar',
  charter: charterOf('bar'),
  theme: 'rain-soaked port',
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
    charter: charterOf('shop'),
    theme: 'rain-soaked port',
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
    return answer(call)
  })
}

describe('writing a place and its people in one call', () => {
  it('asks once per place and puts the answer back on the posts the shell named', async () => {
    const { sent, sidecar } = fakeModel((call) =>
      call.toolName === 'write_instance' ? answer(call) : { name: 'Cold Harbour' },
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour' })
    await scribe.nameCity({ theme: 'rain-soaked port', seed: 'harbour' })

    const [written] = await scribe.writeInstances([bar])

    expect(sent).toHaveLength(2)
    expect(sent[1]!.toolName).toBe('write_instance')
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
    expect(asked).toContain('The building: a bar')
    expect(asked).toContain('What a bar is here: a counter at the front with somebody behind it; nobody works past the front; it keeps drink, papers, valuables; anybody may walk in. Its\nrooms: Taproom, Cellar.')
    expect(asked).toContain('main, storage')
    expect(asked).toContain('anchor_0001: the bartender')
    expect(asked).toContain('item_0001: a ledger')
    expect(asked).toContain('Nothing here is locked and no screen is on.')
    expect(scribe.problems()).toEqual([])
  })

  it('tells the place what the plan put in it: the locks, the screens, the camera and the sale', async () => {
    const { sent, sidecar } = fakeModel((call) => answer(call))
    const office: InstanceRequest = {
      ...bar,
      has: {
        locked: [{ room: 'Cellar', by: 'key' }, { room: 'Office', by: 'code' }, { room: 'Store', by: 'card' }],
        machines: [{ room: 'Office', program: 'ledger' }, { room: 'Taproom', program: 'snake' }],
        camera: true,
        forSale: 4200,
      },
    }

    await new Scribe({ sidecar, seed: 'harbour' }).writeInstances([office])

    const asked = sent[0]!.user
    expect(asked).toContain('Behind a lock: the Cellar (a key somebody here carries); the Office (a code typed at the door); the Store (a card somebody here carries).')
    expect(asked).toContain('Screens: one in the Office running the ledger; one in the Taproom running a game of snake.')
    expect(asked).toContain('A camera watches the front room.')
    expect(asked).toContain('for sale at 4200 credits')
    expect(asked).toContain('Never write the code itself')
  })

  it('writes every life and codex through the world\'s own schema, and hands them back on the person', async () => {
    const { sent, sidecar } = fakeModel((call) => answer(call))
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const [written] = await scribe.writeInstances([bar])

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
      answer(call, index === 0 ? { stages: ['met', 'talked'] } : {}),
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const [written] = await scribe.writeInstances([bar])

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('people.0.background: no fact is unlocked by quest')
    expect(sent[1]!.user).toContain('people.1.background: no fact is unlocked by told')
    expect(written!.people[0]!.background).toHaveLength(4)
  })

  it('shows each place its own building and nothing about the others', async () => {
    const clinic: InstanceRequest = {
      index: 1,
      kind: 'clinic',
      charter: charterOf('clinic'),
      theme: 'rain-soaked port',
      rooms: ['main'],
      posts: [{ postId: 'anchor_9999', role: 'receptionist', index: 2 }],
      things: [{ thingId: 'item_9999', archetype: 'medkit', index: 1 }],
      has: PLAIN,
    }
    const { sent, sidecar } = fakeModel((call) => answer(call))
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 2 })

    const written = await scribe.writeInstances([bar, clinic])

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
    const { sent, sidecar } = fakeModel((call) => answer(call, { given: 'Mara' }))
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 6 })

    const written = await scribe.writeInstances(places(6))

    const people = written.flatMap((instance) => instance.people.map((person) => person.name))
    expect(people).toHaveLength(12)
    expect(new Set(people).size).toBe(12)
    expect(new Set(written.map((instance) => instance.name)).size).toBe(6)
    // and nobody had to be asked twice: the letters made a collision unwritable
    expect(sent).toHaveLength(6)
    expect(scribe.problems()).toEqual([])
  })

  it('gives a sign two places both wanted to the one asked for first, and asks the other again', async () => {
    const { sent, sidecar } = fakeModel((call) =>
      answer(call, { name: call.user.includes('- The Anchor') ? 'The Second Mate' : 'The Anchor' }),
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 2 })

    const written = await scribe.writeInstances(places(2))

    expect(written.map((instance) => instance.name)).toEqual(['The Anchor', 'The Second Mate'])
    expect(sent).toHaveLength(3)
    expect(sent[2]!.user).toContain('- The Anchor')
  })

  it('lets no word head two signs: a second sign on the same word goes to the offline composer', async () => {
    const { sidecar } = fakeModel((call) =>
      answer(call, { name: call.user.includes('- The Anchor') ? 'Anchor Supply' : 'The Anchor' }),
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 2 })

    const written = await scribe.writeInstances(places(2))

    expect(written[0]!.name).toBe('The Anchor')
    expect(written[1]!.name).not.toMatch(/^(The )?Anchor\b/)
  })

  it('writes the same city on the same seed, whatever order the answers landed in', async () => {
    const runs = await Promise.all(
      [1, 2].map(async () => {
        const model = backwards(6)
        const scribe = new Scribe({ sidecar: model.sidecar, seed: 'harbour', concurrency: 3 })
        const written = await scribe.writeInstances(places(6))
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
      answer(call, { name: `${shellOf(call).posts[0]} House`, given: shellOf(call).posts[0]! }),
    )
    await new Scribe({ sidecar, seed: 'harbour', concurrency: 4 }).writeInstances(places(60))

    // 60 places is 180 names spent; a prompt that grows with the city costs
    // more on every call than the one before it
    expect(sent).toHaveLength(60)
    const names = (call: Sent) =>
      (call.user.split('## Names already spoken for in this city')[1]!.match(/^- /gm) ?? []).length
    expect(names(sent.at(-1)!)).toBeLessThanOrEqual(40)
    expect(names(sent.at(-1)!)).toBeGreaterThan(0)
  })

  it('leaves a place the model will not write to the offline narrator, with every post still filled', async () => {
    const { sent, sidecar } = fakeModel(['no-call'])
    const scribe = new Scribe({ sidecar, seed: 'harbour', attempts: 1 })

    const [written] = await scribe.writeInstances([bar])

    expect(written!.name.length).toBeGreaterThan(2)
    expect(written!.character).toBe('')
    expect(written!.people.map((person) => person.postId)).toEqual(['anchor_0001', 'anchor_0002'])
    expect(written!.people[0]!.personality.length).toBeGreaterThan(0)
    // the offline narrator writes a life and a codex too, so nobody in the town is without one
    expect(written!.people[0]!.life?.reason).toBeTruthy()
    expect(written!.people[0]!.background?.length).toBeGreaterThan(0)
    expect(written!.things.map((thing) => thing.thingId)).toEqual(['item_0001'])
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['no-tool-call'])
    // a model that never answers is not asked a second time for the same place
    expect(sent).toHaveLength(1)
  })
})
