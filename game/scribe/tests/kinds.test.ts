import type { PlaceNeed, PlaceRequest } from '@gb/forge'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'
import { JAIL, STANDING, charterOf } from './places.ts'
import { settledNeeds, writtenPlaces } from './town.ts'
import { stopped, wrote } from './wrote.ts'

/** Everything this town may put behind a door: four of the presets and the kind its history invented. */
const KINDS = [charterOf('shop'), charterOf('bar'), charterOf('house'), charterOf('station'), JAIL]

/**
 * What the town needs of them: a counter, a room to sit in, the trains boarding
 * in two places, and the jail its own history demands.
 */
const NEEDS: PlaceNeed[] = [
  { wants: 'somewhere to buy something over a counter, with stock to sell across it', count: 1 },
  { wants: 'somewhere to sit down and be served, with seats in the room', count: 1 },
  { wants: 'somewhere the trains board', count: 2 },
  { wants: "a kind of place the town's own history says it has", count: 1, kind: 'jail' },
]

/** Six doors the architecture opened, each with its height, its floor and its street. */
const DOORS: PlaceRequest[] = Array.from({ length: 6 }, (_, i) => ({
  index: i,
  theme: 'rain-soaked port',
  ...STANDING,
  storeys: i + 1,
  onAvenue: i === 0,
  street: 'Kettle Row',
  premise: 'Lives on: the freight line.',
}))

const asked = (places = DOORS, needs = NEEDS) => ({ theme: 'rain-soaked port', premise: 'Lives on: the freight line.', kinds: KINDS, needs, places })

/** The words each field of a call may be answered with, through the `$defs` the repeats were hoisted into. */
function fieldsOf(call: Sent, bag: string): Record<string, { enum?: string[]; const?: string; description?: string }> {
  type Field = { enum?: string[]; const?: string; description?: string; $ref?: string }
  const properties = call.parameters['properties'] as Record<string, { properties: Record<string, Field> }>
  const defs = (call.parameters['$defs'] ?? {}) as Record<string, Field>
  return Object.fromEntries(
    Object.entries(properties[bag]!.properties).map(([name, field]) => [name, field.$ref ? defs[field.$ref.split('/').pop()!]! : field]),
  )
}

/** The kind of place the writing says answers each need: a shop, a bar, the station, and the jail the history demanded. */
const SETTLED = { needs: { n0: 'shop', n1: 'bar', n2: 'station', n3: 'jail' } }

describe("saying what each of the town's open doors is", () => {
  it('settles what the town needs first, then asks what the doors are off the closed list, one word per door', async () => {
    const { sent, sidecar } = fakeModel((call) => (call.toolName === 'settle_needs' ? SETTLED : writtenPlaces(call)))
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const written = await wrote(scribe.writePlaces(asked()))

    expect(sent.map((call) => call.toolName)).toEqual(['settle_needs', 'write_places'])
    // the needs call is shown what the town is, the words it may answer with and what it needs of them
    const settling = sent[0]!
    expect(settling.user).toContain('Lives on: the freight line.')
    expect(settling.user).toContain('station: a counter at the front with somebody behind it')
    expect(settling.user).toContain('the trains board here')
    expect(settling.user).toContain('- n2: somewhere the trains board, behind 2 of these doors')
    expect(fieldsOf(settling, 'needs')['n0']!.enum).toEqual(['shop', 'bar', 'house', 'station', 'jail'])

    // and every door came back with one word, the doors the needs took carrying theirs
    expect(written).toHaveLength(6)
    expect(written.filter((word) => word === 'station')).toHaveLength(2)
    expect(written).toContain('shop')
    expect(written).toContain('bar')
    expect(written).toContain('jail')
    expect(scribe.problems()).toEqual([])
  })

  it('pins the doors the needs took to their word, and leaves the rest of the town to the writing', async () => {
    const { sent, sidecar } = fakeModel((call) => (call.toolName === 'settle_needs' ? SETTLED : writtenPlaces(call)))
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    await wrote(scribe.writePlaces(asked()))

    const doors = fieldsOf(sent[1]!, 'places')
    expect(Object.keys(doors)).toEqual(['b0', 'b1', 'b2', 'b3', 'b4', 'b5'])
    // five doors are what the town needs, so they are constants: the model cannot answer past them
    const pinned = Object.entries(doors).filter(([, field]) => field.const)
    expect(pinned.map(([, field]) => field.const).sort()).toEqual(['bar', 'jail', 'shop', 'station', 'station'])
    // the station went to the door on the avenue, where the trains belong
    expect(doors['b0']!.const).toBe('station')
    // and the sixth is a free choice off the closed list
    const free = Object.entries(doors).filter(([, field]) => !field.const)
    expect(free).toHaveLength(1)
    expect(free[0]![1].enum).toEqual(['shop', 'bar', 'house', 'station', 'jail'])
    // the call is shown where every door stands, and what the settled ones already are
    expect(sent[1]!.user).toContain('- b0: 1 storey, 8 by 12 metres on the avenue Kettle Row. Settled: a station, because the town needs somewhere the trains board')
    expect(sent[1]!.user).toContain('- b5: 6 storeys, 8 by 12 metres on Kettle Row')
  })

  it('asks for no more doors than the town opens, and never asks at all once its needs have taken them all', async () => {
    const { sent, sidecar } = fakeModel((call) => (call.toolName === 'settle_needs' ? settledNeeds(call) : writtenPlaces(call)))
    const scribe = new Scribe({ sidecar, seed: 'harbour' })
    const two = DOORS.slice(0, 2)

    // a town of two doors cannot board at four of them, and stopping a build over that would be arithmetic, not writing
    const boarding = await wrote(scribe.writePlaces(asked(two, [{ wants: 'somewhere the trains board', count: 4 }])))
    expect(fieldsOf(sent[0]!, 'needs')['n0']!.description).toContain('The town needs 2 of its open doors to be one')
    // both doors board, so there was nothing left to ask anybody
    expect(boarding).toEqual(['shop', 'shop'])
    expect(sent.map((call) => call.toolName)).toEqual(['settle_needs'])

    // and the jail the history demanded is the only word its own need decodes
    await wrote(scribe.writePlaces(asked(two, [NEEDS[3]!])))
    const pinned = fieldsOf(sent[1]!, 'needs')['n0']!
    expect(pinned.const).toBe('jail')
    expect(pinned.enum).toBeUndefined()
  })

  it('asks the doors alone when the town needs nothing in particular', async () => {
    const { sent, sidecar } = fakeModel((call) => writtenPlaces(call))
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const written = await wrote(scribe.writePlaces(asked(DOORS.slice(0, 2), [])))

    expect(sent.map((call) => call.toolName)).toEqual(['write_places'])
    expect(written).toEqual(['shop', 'shop'])
  })

  it('stops the places stage when the model will not say what the doors are, rather than deciding for it', async () => {
    const { sent, sidecar } = fakeModel(['no-call'])
    const scribe = new Scribe({ sidecar, seed: 'harbour', attempts: 1 })

    const failure = await stopped(scribe.writePlaces(asked()))

    expect(sent).toHaveLength(1)
    expect(failure).toMatchObject({ stage: 'places', at: 'needs', code: 'no-tool-call' })
    expect(failure.message).toContain('the kinds of place the town needs behind its doors could not be written')
  })

  it('stops the places stage when the model will not say what the rest of the doors are', async () => {
    const { sidecar } = fakeModel((call) => (call.toolName === 'settle_needs' ? SETTLED : 'no-call'))
    const scribe = new Scribe({ sidecar, seed: 'harbour', attempts: 1 })

    const failure = await stopped(scribe.writePlaces(asked()))

    expect(failure).toMatchObject({ stage: 'places', at: 'places', code: 'no-tool-call' })
    expect(failure.message).toContain("the kinds of place behind the town's open doors could not be written")
  })
})
