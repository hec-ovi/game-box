import { err, ok } from '@gb/kit'
import type { Premise } from '@gb/world'
import type { Bearing } from '../layout/districts.ts'
import { districtNames } from '../narrator/districts.ts'
import type { DistrictRequest, Narrator, PlaceRequest, Written } from '../narrator.ts'
import { premiseLines } from '../premise/render.ts'

/** The longest name a plot record takes: `@gb/world`'s own cap. */
const SIGN_LENGTH = 80

/** One part of the city, as the naming stage has it. */
export interface Zone {
  readonly id: string
  /** Which way it lies from the middle of town. */
  readonly bearing: Bearing
  /** How much of the town it holds. */
  readonly blocks: number
}

/** One door waiting for its sign: what to ask, what stands there if nothing is written, and whether it opens. */
export interface Asking {
  readonly request: PlaceRequest
  /** The sign composed here, which stands wherever nothing is written. */
  readonly composed: string
  /** Whether this is one of the handful of places the town writes whole. */
  readonly opens: boolean
}

/** What the town is called, once its history and its work are written. */
export function askCityName(narrator: Narrator, input: { theme: string; seed: string; premise?: Premise }): Promise<Written<string>> {
  return narrator.nameCity(input)
}

/**
 * What the parts of the town are called, all asked for together. Whatever comes
 * back blank, or twice, is composed from the seed instead, so a city always
 * comes out with every part of it named and no two of them called the same.
 */
export async function askZoneNames(narrator: Narrator, zones: readonly Zone[], town: { theme: string; seed: string; premise?: Premise }): Promise<Written<Map<string, string>>> {
  if (!zones.length) return ok(new Map())
  const story = town.premise ? premiseLines(town.premise) : undefined
  const requests: DistrictRequest[] = zones.map((zone, index) => ({
    index,
    theme: town.theme,
    blocks: zone.blocks,
    bearing: zone.bearing,
    ...(story ? { premise: story } : {}),
  }))
  const answer = narrator.nameDistricts ? await narrator.nameDistricts(requests) : ok([] as readonly string[])
  if (!answer.ok) return err(answer.error)
  const called = districtNames(zones, answer.value, town)
  return ok(new Map(zones.map((zone, index) => [zone.id, called[index]!])))
}

/**
 * The sign over every door this pass put up, asked for in one call.
 *
 * Most of a town is frontage, and a sign over a door nobody opens is written
 * here rather than asked for, because asking a model for each one costs four
 * calls in five of a build for a door with nothing behind it. A narrator that
 * hangs signs itself (`namePlaces`) gets the whole street in one call and its
 * answers stand; one that only answers a place at a time is asked about the
 * handful that open and nothing else. A blank keeps the composed sign.
 */
export async function askSigns(narrator: Narrator, asked: readonly Asking[]): Promise<Written<string[]>> {
  if (!asked.length) return ok([])
  if (narrator.namePlaces) {
    const written = await narrator.namePlaces(asked.map((one) => one.request))
    return written.ok ? ok(asked.map((one, at) => fits(written.value[at]) ?? one.composed)) : err(written.error)
  }
  const written = await Promise.all(asked.map((one) => (one.opens ? narrator.namePlace(one.request) : ok(''))))
  const stopped = written.find((one) => !one.ok)
  if (stopped && !stopped.ok) return err(stopped.error)
  return ok(asked.map((one, at) => fits(written[at]?.ok ? (written[at] as { value: string }).value : undefined) ?? one.composed))
}

/** A sign the world document will take, or nothing: what a narrator writes is never trusted to fit. */
function fits(name: string | undefined): string | undefined {
  const written = name?.trim()
  return written && written.length <= SIGN_LENGTH ? written : undefined
}
