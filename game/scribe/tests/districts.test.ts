import type { DistrictRequest } from '@gb/forge'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'

/** The parts of a city as the forge hands them over: how much of the town each holds, and which way it lies. */
function cut(count: number): DistrictRequest[] {
  const bearings = ['north', 'south-west', 'middle', 'east', 'north-west'] as const
  return Array.from({ length: count }, (_, index) => ({
    index,
    theme: 'rain-soaked cargo port',
    blocks: 30 + index,
    bearing: bearings[index % bearings.length]!,
    premise: 'Lives on: the freight line.',
  }))
}

/** The labels the tool was built around. */
function labelsOf(call: Sent): string[] {
  const properties = call.parameters['properties'] as Record<string, Record<string, Record<string, Record<string, Record<string, unknown>>>>>
  return properties['districts']!['items']!['properties']!['district']!['enum'] as unknown as string[]
}

/** A model that names every part in the call. */
function answer(call: Sent, name: (label: string) => string = (label) => `Kiln ${label.slice(1)}`) {
  return { districts: labelsOf(call).map((label) => ({ district: label, name: name(label) })) }
}

describe('naming the parts of the city', () => {
  it('asks for all of them in one call, with the history and how much of the town each part holds', async () => {
    const { sent, sidecar } = fakeModel((call) => (call.toolName === 'name_districts' ? answer(call) : { name: 'Cold Harbour' }))
    const scribe = new Scribe({ sidecar, seed: 'harbour' })
    await scribe.nameCity({ theme: 'rain-soaked cargo port', seed: 'harbour' })

    const names = await scribe.nameDistricts(cut(5))

    expect(names).toEqual(['Kiln 0', 'Kiln 1', 'Kiln 2', 'Kiln 3', 'Kiln 4'])
    // one call for the city's name, one for every district in it
    expect(sent.map((call) => call.toolName)).toEqual(['name_city', 'name_districts'])
    expect(labelsOf(sent[1]!)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4'])
    const asked = sent[1]!.user
    expect(asked).toContain('parts of Cold Harbour')
    expect(asked).toContain('Lives on: the freight line.')
    expect(asked).toContain('on its north side')
    expect(asked).toContain('in the middle of it')
    // the coarsest handle there is: no metre and no cell reaches the model
    expect(asked).not.toMatch(/\d+\s*(m|cells?)\b/)
    expect(scribe.problems()).toEqual([])
  })

  it('refuses a batch that calls two parts of one city the same thing', async () => {
    const { sent, sidecar } = fakeModel((call, index) => answer(call, (label) => (index === 0 && label === 'd2' ? 'Kiln 1' : `Kiln ${label.slice(1)}`)))
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const names = await scribe.nameDistricts(cut(4))

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('districts.2.name: Kiln 1 already names another part of this city')
    expect(names[2]).toBe('Kiln 2')
  })

  it('composes a name for whatever the model will not write, and still names no two parts alike', async () => {
    // the model keeps every part but one, and heads two of them the same way
    const { sidecar } = fakeModel((call) => ({
      districts: labelsOf(call)
        .filter((label) => label !== 'd1')
        .map((label) => ({ district: label, name: label === 'd3' ? 'Kiln 0' : `Kiln ${label.slice(1)}` })),
    }))
    const scribe = new Scribe({ sidecar, seed: 'harbour', attempts: 1 })

    const names = await scribe.nameDistricts(cut(5))

    expect(names).toHaveLength(5)
    expect(names.every((name) => name.length > 2)).toBe(true)
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(5)
  })

  it('names every part from the offline composer when the model will not answer at all', async () => {
    const { sent, sidecar } = fakeModel(['no-call'])
    const scribe = new Scribe({ sidecar, seed: 'harbour', attempts: 1 })

    const names = await scribe.nameDistricts(cut(6))

    expect(sent).toHaveLength(1)
    expect(names).toHaveLength(6)
    expect(names.every((name) => name.length > 2)).toBe(true)
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(6)
  })
})
