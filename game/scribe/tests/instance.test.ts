import type { InstanceRequest } from '../src/index.ts'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'

/** The shell the tool was built around, read back off the schema the model was handed. */
function shellOf(call: Sent) {
  const properties = (call.parameters as Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, unknown>>>>>>)['properties']!
  const person = properties['people']!['items']!['properties']!
  return {
    posts: person['postId']!['enum'] as unknown as string[],
    things: properties['things']!['items']!['properties']!['thingId']!['enum'] as unknown as string[],
    letters: /\^\[([A-Z]+)]/.exec(String(person['family']!['pattern']))![1]!,
  }
}

/** A model that writes whatever the shell asked for, with the family names it is allowed. */
function answer(call: Sent, options: { name?: string; given?: string } = {}) {
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
    })).reverse(),
    things: shell.things.map((thingId) => ({ thingId, name: `Thing ${thingId}`, description: 'Worn and heavy.' })),
  }
}

const bar: InstanceRequest = {
  kind: 'bar',
  theme: 'rain-soaked port',
  rooms: ['main', 'storage'],
  posts: [
    { postId: 'anchor_0001', role: 'bartender' },
    { postId: 'anchor_0002', role: 'patron' },
  ],
  things: [{ thingId: 'item_0001', archetype: 'ledger' }],
}

/** A city of `count` places, each with its own posts and stock. */
function places(count: number): InstanceRequest[] {
  return Array.from({ length: count }, (_, i) => ({
    kind: 'shop' as const,
    theme: 'rain-soaked port',
    rooms: ['main' as const],
    posts: [{ postId: `anchor_${i}_1`, role: 'clerk' as const }, { postId: `anchor_${i}_2`, role: 'worker' as const }],
    things: [{ thingId: `item_${i}`, archetype: 'box' as const }],
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
    expect(asked).toContain('a bar')
    expect(asked).toContain('main, storage')
    expect(asked).toContain('anchor_0001: the bartender')
    expect(asked).toContain('item_0001: a ledger')
    expect(scribe.problems()).toEqual([])
  })

  it('shows each place its own building and nothing about the others', async () => {
    const clinic: InstanceRequest = {
      kind: 'clinic',
      theme: 'rain-soaked port',
      rooms: ['main'],
      posts: [{ postId: 'anchor_9999', role: 'receptionist' }],
      things: [{ thingId: 'item_9999', archetype: 'medkit' }],
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

  it('gives a name two places both wanted to the one asked for first, and asks the other again', async () => {
    const { sent, sidecar } = fakeModel((call) =>
      answer(call, { name: call.user.includes('- The Anchor') ? 'The Second Mate' : 'The Anchor' }),
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 2 })

    const written = await scribe.writeInstances(places(2))

    expect(written.map((instance) => instance.name)).toEqual(['The Anchor', 'The Second Mate'])
    expect(sent).toHaveLength(3)
    expect(sent[2]!.user).toContain('- The Anchor')
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

  it('leaves a place the model will not write to the offline narrator, with every post still filled', async () => {
    const { sent, sidecar } = fakeModel(['no-call'])
    const scribe = new Scribe({ sidecar, seed: 'harbour', attempts: 1 })

    const [written] = await scribe.writeInstances([bar])

    expect(written!.name.length).toBeGreaterThan(2)
    expect(written!.character).toBe('')
    expect(written!.people.map((person) => person.postId)).toEqual(['anchor_0001', 'anchor_0002'])
    expect(written!.people[0]!.personality.length).toBeGreaterThan(0)
    expect(written!.things.map((thing) => thing.thingId)).toEqual(['item_0001'])
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['no-tool-call'])
    // a model that never answers is not asked a second time for the same place
    expect(sent).toHaveLength(1)
  })
})
