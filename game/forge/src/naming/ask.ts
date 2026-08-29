import { err, ok } from '@gb/kit'
import type { Charter, Premise, ResolvedCharter } from '@gb/world'
import type { Bearing } from '../layout/districts.ts'
import { districtNames } from '../narrator/districts.ts'
import type { DistrictRequest, Narrator, PlaceNeed, PlaceRequest, PlaceSign, Written, WrittenPlace } from '../narrator.ts'
import { instanceName } from './placeholders.ts'
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
 * What each of the town's open buildings is, asked for in one call before a
 * word of work is written.
 *
 * This is the stage the whole order exists for: the architecture cut the doors
 * and the writing says which of them is the bar, which is the station and which
 * is somebody's home. Everything behind those doors is then built to the
 * answer, so there is nothing to fall back on: a building nobody wrote a kind
 * for stops the build, and so does a word the city does not declare.
 */
export async function askKinds(
  narrator: Narrator,
  input: { theme: string; premise?: string; kinds: readonly Charter[]; needs: readonly PlaceNeed[]; places: readonly PlaceRequest[] },
  declared: readonly ResolvedCharter[],
): Promise<Written<ResolvedCharter[]>> {
  if (!input.places.length) return ok([])
  const written = await narrator.writePlaces(input)
  if (!written.ok) return err(written.error)
  const settled: ResolvedCharter[] = []
  for (const [at, place] of input.places.entries()) {
    const word = written.value[at]
    const charter = word ? declared.find((one) => one.word === word) : undefined
    if (!charter) {
      return err({
        stage: 'places',
        message: word
          ? `${instanceName(place.index)} was written as a ${word}, which is not a kind of place this city has`
          : `nothing was written for ${instanceName(place.index)}, and a door has to be something before anybody can be put behind it`,
      })
    }
    settled.push(charter)
  }
  return ok(settled)
}

/**
 * The sign over every door this pass put up, asked for in one call.
 *
 * It carries the rest of the town with it. A door that opens was told what it
 * is before the work was written; a door that never opens is nothing at all
 * until here, and the answer says what the place is as well as what its sign
 * reads. Asking a model one call per sign would be four calls in five of a
 * build for a door with nothing behind it, so a narrator that hangs signs
 * itself (`namePlaces`) gets the whole street in one call; one that answers a
 * place at a time is asked about the handful that open and nothing else, and
 * the frontage keeps the signs composed here and stays buildings. A blank name
 * keeps the composed sign.
 */
export async function askSigns(narrator: Narrator, asked: readonly Asking[]): Promise<Written<PlaceSign[]>> {
  if (!asked.length) return ok([])
  if (narrator.namePlaces) {
    const written = await narrator.namePlaces(asked.map((one) => one.request))
    return written.ok ? ok(asked.map((one, at) => hung(one, written.value[at]))) : err(written.error)
  }
  const written = await Promise.all(asked.map((one) => (one.opens && settled(one.request) ? narrator.namePlace(one.request) : ok(''))))
  const stopped = written.find((one) => !one.ok)
  if (stopped && !stopped.ok) return err(stopped.error)
  return ok(asked.map((one, at) => hung(one, { name: written[at]?.ok ? (written[at] as { value: string }).value : '' })))
}

/** A building whose kind is already settled, which is every door that opens by the time its sign is asked for. */
const settled = (request: PlaceRequest): request is PlaceRequest & WrittenPlace => request.kind !== undefined && request.charter !== undefined

/** One door's answer, held to what the world document will take: a sign too long for a plot record keeps the composed one. */
function hung(asked: Asking, written: PlaceSign | undefined): PlaceSign {
  const name = written?.name?.trim()
  return {
    name: name && name.length <= SIGN_LENGTH ? name : asked.composed,
    ...(written?.kind ? { kind: written.kind } : {}),
  }
}
