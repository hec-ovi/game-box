import type { PlaceRequest } from '@gb/forge'
import { SHIPPED_CHARTERS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'
import { STANDING, charterOf } from './places.ts'
import { writtenPlaces } from './town.ts'
import { stopped, wrote } from './wrote.ts'

const KINDS = ['bar', 'shop', 'office', 'warehouse', 'house'] as const

/** `count` buildings that do not open, each on a street. */
function frontage(count: number): PlaceRequest[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    kind: KINDS[i % KINDS.length]!,
    charter: charterOf(KINDS[i % KINDS.length]!),
    theme: 'rain-soaked port',
    ...STANDING,
    street: i % 2 ? 'Kettle Row' : 'Wharf Lane',
    premise: 'Lives on: the freight line.',
  }))
}

/** The words a batch may say a building is, where the batch is the one that decides. */
function kindsIn(call: Sent): string[] | undefined {
  const properties = (call.parameters as Record<string, Record<string, Record<string, Record<string, Record<string, { enum?: string[] }>>>>>)['properties']!
  return properties['signs']!['items']!['properties']!['kind']?.enum
}

/** Just the signs, in the order they were asked for. */
const signsOf = (written: readonly { name: string }[]): string[] => written.map((sign) => sign.name)

/** The labels the batch tool was built around. */
function labelsOf(call: Sent): string[] {
  const properties = (call.parameters as Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, unknown>>>>>>)['properties']!
  return properties['signs']!['items']!['properties']!['building']!['enum'] as unknown as string[]
}

/** A model that names every building in the batch, off a head word of its own per label unless told otherwise. */
function answer(call: Sent, head: (label: string) => string = (label) => `Head${label.slice(1)}`) {
  return { signs: labelsOf(call).map((label) => ({ building: label, name: `${head(label)} Supply` })) }
}

describe('naming the buildings that do not open', () => {
  it('asks for twenty at a time, with the history, the trade and the street of each, and hands the names back in order', async () => {
    const { sent, sidecar } = fakeModel((call) => (call.toolName === 'name_signs' ? answer(call) : { name: 'Cold Harbour' }))
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 2 })
    await wrote(scribe.nameCity({ theme: 'rain-soaked port', seed: 'harbour' }))

    const names = signsOf(await wrote(scribe.namePlaces(frontage(45))))

    expect(names).toHaveLength(45)
    expect(names.slice(0, 3)).toEqual(['Head0 Supply', 'Head1 Supply', 'Head2 Supply'])
    expect(names[44]).toBe('Head44 Supply')
    // one call for the city's name, then three batches: 20, 20 and 5
    expect(sent.slice(1).map((call) => call.toolName)).toEqual(['name_signs', 'name_signs', 'name_signs'])
    expect(sent.slice(1).map((call) => labelsOf(call).length)).toEqual([20, 20, 5])
    const batch = sent[1]!.user
    expect(batch).toContain('City: Cold Harbour')
    expect(batch).toContain('Lives on: the freight line.')
    expect(batch).toContain('- b0: a bar on Wharf Lane')
    expect(batch).toContain('- b1: a shop on Kettle Row')
    expect(scribe.problems()).toEqual([])
  })

  it('tells a batch the words already heading a sign, and refuses one that starts a sign with any of them', async () => {
    const { sent, sidecar } = fakeModel((call, index) =>
      call.toolName === 'name_signs'
        ? answer(call, (label) => (index === 2 && label === 'b21' ? 'Head3' : `Head${label.slice(1)}`))
        : { name: 'Cold Harbour' },
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 1 })
    await wrote(scribe.nameCity({ theme: 'rain-soaked port', seed: 'harbour' }))

    const names = signsOf(await wrote(scribe.namePlaces(frontage(25))))

    // the second batch was told the first batch's heads, repeated one, and was asked again
    expect(sent[2]!.user).toContain('- head3')
    expect(sent).toHaveLength(4)
    expect(sent[3]!.user).toContain('signs.1.name: Head3 Supply starts with head3, which already heads a sign in this city')
    expect(names[21]).toBe('Head21 Supply')
  })

  it('refuses a batch that heads two of its own signs with one word', async () => {
    const { sent, sidecar } = fakeModel((call, index) =>
      answer(call, (label) => (index === 0 && label === 'b2' ? 'The Head1' : `Head${label.slice(1)}`)),
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const names = signsOf(await wrote(scribe.namePlaces(frontage(5))))

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('signs.2.name: The Head1 Supply starts with head1, which already heads another sign in this batch')
    expect(names[2]).toBe('Head2 Supply')
  })

  it('keeps a batch the model would not mend, and asks the model again for the clashing sign alone', async () => {
    // a repeat is worth a second draw, never the other nineteen signs the batch got right
    const { sent, sidecar } = fakeModel((call) =>
      call.toolName === 'name_signs' ? answer(call, (label) => (label === 'b2' ? 'The Head1' : `Head${label.slice(1)}`)) : { name: 'Kettle Rooms' },
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const names = signsOf(await wrote(scribe.namePlaces(frontage(5))))

    // two batch calls, then one call for the one building whose word was spent
    expect(sent.map((call) => call.toolName)).toEqual(['name_signs', 'name_signs', 'name_place'])
    expect(names[0]).toBe('Head0 Supply')
    expect(names[4]).toBe('Head4 Supply')
    expect(names[2]).toBe('Kettle Rooms')
    const heads = names.map((name) => name.toLowerCase().replace(/^the /, '').split(' ')[0])
    expect(new Set(heads).size).toBe(5)
  })

  it('lets no word head two signs in the city, whatever the batches came back with', async () => {
    // two batches in one wave cannot see each other, and this model has one favourite word
    const { sidecar } = fakeModel((call, index) =>
      call.toolName === 'name_signs'
        ? answer(call, (label) => (Number(label.slice(1)) % 20 === 0 ? 'Kettle' : `Head${label.slice(1)}`))
        : { name: `Mend${index} Rooms` },
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour', concurrency: 3, attempts: 1 })

    const names = signsOf(await wrote(scribe.namePlaces(frontage(45))))

    expect(names[0]).toBe('Kettle Supply')
    const heads = names.map((name) => name.toLowerCase().replace(/^the /, '').split(' ')[0])
    expect(new Set(heads).size).toBe(45)
    // the lower index kept the word; the model was asked again for the other two
    expect(names[20]).not.toMatch(/^Kettle/)
    expect(names[40]).not.toMatch(/^Kettle/)
  })

  it('says what a door nobody has spoken about is as well as naming it, and asks nothing of the doors already settled', async () => {
    const kinds = [charterOf('bar'), charterOf('shop')]
    const { sent, sidecar } = fakeModel((call) =>
      call.toolName === 'write_places'
        ? writtenPlaces(call)
        : { signs: labelsOf(call).map((label, at) => ({ building: label, name: `Head${label.slice(1)} Supply`, ...(kindsIn(call) ? { kind: kindsIn(call)![at % 2]! } : {}) })) },
    )
    const scribe = new Scribe({ sidecar, seed: 'harbour' })
    await wrote(scribe.writePlaces({ theme: 'rain-soaked port', kinds, needs: [], places: [{ index: 9, theme: 'rain-soaked port', ...STANDING }] }))

    // a settled door, a bare one, a settled one: the answers come back in the order they were asked for
    const written = await wrote(
      scribe.namePlaces([frontage(1)[0]!, { index: 1, theme: 'rain-soaked port', ...STANDING }, { ...frontage(4)[3]!, work: ['Hand the ledger over.'] }]),
    )

    expect(written).toEqual([{ name: 'Head0 Supply' }, { name: 'Head1 Supply', kind: 'bar' }, { name: 'Head3 Supply' }])
    // two batches: the doors that already are something, then the one that is not
    const batches = sent.filter((call) => call.toolName === 'name_signs')
    expect(batches.map(labelsOf)).toEqual([['b0', 'b3'], ['b1']])
    expect(kindsIn(batches[0]!)).toBeUndefined()
    expect(kindsIn(batches[1]!)).toEqual(['bar', 'shop'])
    // the settled batch is shown the trade and the work the town's quests do there; the bare one, what the architecture left
    expect(batches[0]!.user).toContain('- b3: a warehouse on Kettle Row. What the town\'s work does here: Hand the ledger over.')
    expect(batches[1]!.user).toContain('- b1: 2 storeys, 8 by 12 metres')
    expect(batches[1]!.user).toContain('bar: a counter at the front with somebody behind it')
  })

  it('writes the frontage out of the presets where nothing has settled what this town declares', async () => {
    // a growth that only puts up new land says nothing about what its doors are, and every city declares the presets
    const { sent, sidecar } = fakeModel((call) => ({
      signs: labelsOf(call).map((label) => ({ building: label, name: `Head${label.slice(1)} Supply`, kind: kindsIn(call)![0]! })),
    }))

    const written = await wrote(new Scribe({ sidecar, seed: 'harbour' }).namePlaces([{ index: 0, theme: 'rain-soaked port', ...STANDING }]))

    expect(kindsIn(sent[0]!)).toEqual(SHIPPED_CHARTERS.map((charter) => charter.word))
    expect(written).toEqual([{ name: 'Head0 Supply', kind: 'house' }])
  })

  it('stops the city stage when the model will not write the signs, rather than composing them', async () => {
    const { sent, sidecar } = fakeModel(['no-call'])
    const scribe = new Scribe({ sidecar, seed: 'harbour', attempts: 1 })

    const failure = await stopped(scribe.namePlaces(frontage(30)))

    // the two batches were asked and neither answered; no building is then asked for on its own
    expect(sent).toHaveLength(2)
    expect(failure).toMatchObject({ stage: 'city', at: 'signs:0', code: 'no-tool-call' })
    expect(failure.message).toContain('the signs over the doors could not be written')
    expect(failure.message).toContain('127.0.0.1:8976')
  })

  it('writes the same signs on the same seed whatever order the batches landed in', async () => {
    const runs = await Promise.all(
      [1, 2].map(async () => {
        const { sent, sidecar } = fakeModel(async (call, index) => {
          await new Promise((resolve) => setTimeout(resolve, (3 - index) * 4))
          return answer(call)
        })
        const names = signsOf(await wrote(new Scribe({ sidecar, seed: 'harbour', concurrency: 3 }).namePlaces(frontage(45))))
        return { asked: sent.map((call) => call.user).sort(), names }
      }),
    )
    expect(runs[0]).toEqual(runs[1])
  })
})
