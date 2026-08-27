import type { DistrictRequest } from '@gb/forge'
import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel, type Sent } from './fake-model.ts'
import { stopped, wrote } from './wrote.ts'

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
    await wrote(scribe.nameCity({ theme: 'rain-soaked cargo port', seed: 'harbour' }))

    const names = await wrote(scribe.nameDistricts(cut(5)))

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

    const names = await wrote(scribe.nameDistricts(cut(4)))

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('districts.2.name: Kiln 1 already names another part of this city')
    expect(names[2]).toBe('Kiln 2')
  })

  it('refuses a batch that names one part twice and leaves another unnamed, and takes the corrected cut', async () => {
    const { sent, sidecar } = fakeModel((call, index) => ({
      districts: labelsOf(call).map((label, at) => ({
        district: index === 0 && label === 'd1' ? 'd0' : label,
        name: `Kiln ${at}`,
      })),
    }))
    const scribe = new Scribe({ sidecar, seed: 'harbour' })

    const names = await wrote(scribe.nameDistricts(cut(5)))

    expect(sent).toHaveLength(2)
    expect(sent[1]!.user).toContain('districts: name part d0 exactly once, not 2 times')
    expect(sent[1]!.user).toContain('districts: name part d1 exactly once, not 0 times')
    expect(names).toEqual(['Kiln 0', 'Kiln 1', 'Kiln 2', 'Kiln 3', 'Kiln 4'])
  })

  it('stops the city stage when the model will not name the parts, rather than composing them', async () => {
    const { sent, sidecar } = fakeModel(['no-call'])
    const scribe = new Scribe({ sidecar, seed: 'harbour', attempts: 1 })

    const failure = await stopped(scribe.nameDistricts(cut(6)))

    expect(sent).toHaveLength(1)
    expect(failure).toMatchObject({ stage: 'city', at: 'districts', code: 'no-tool-call' })
    expect(failure.message).toContain('the names of the parts of the city could not be written')
  })
})
