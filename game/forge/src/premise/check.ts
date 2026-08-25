import { BUILDING_KINDS, premiseContract, type BuildingKind, type Premise } from '@gb/world'

/**
 * The city's history is `@gb/world`'s shape, because it is a fact about the
 * city and a file somebody is sent carries it. This box writes one and builds
 * against it; what it is lives there.
 */

/** One side of the town's argument: who they are and what they want out of it. */
export type PremiseSide = Premise['sides'][number]

/** What the history says the town holds, in `@gb/world`'s own building kinds. */
export type PremiseBuild = Premise['build']

/**
 * A premise as written by a narrator, checked against the contract the world
 * document will hold it to. Nothing a narrator writes is trusted, and nothing
 * good in it is thrown away for one bad word: a history that fails the
 * contract is salvaged field by field (a building kind the game has not got is
 * dropped from `build`, a side without both its parts is dropped, a line that
 * is not a line is dropped) and checked again. One that still does not hold up
 * is dropped whole and the town is built without one, the same way an unusable
 * quest is dropped rather than shipped. Checking it here is what keeps a long
 * one out of `World.found`, where it would take the whole city down instead.
 */
export function premiseOf(written: unknown): Premise | undefined {
  if (written === undefined) return undefined
  const parsed = premiseContract.parse(written)
  if (parsed.ok) return parsed.value
  const salvaged = premiseContract.parse(salvage(written))
  return salvaged.ok ? salvaged.value : undefined
}

type Loose = Record<string, unknown>

const record = (value: unknown): Loose => (typeof value === 'object' && value !== null ? (value as Loose) : {})

const line = (value: unknown): string | undefined => (typeof value === 'string' && value.trim().length ? value : undefined)

const lines = (value: unknown): string[] => (Array.isArray(value) ? value.map(line).filter((one): one is string => one !== undefined) : [])

const kinds = (value: unknown): BuildingKind[] => lines(value).filter((kind): kind is BuildingKind => (BUILDING_KINDS as readonly string[]).includes(kind))

/** What can be kept of a history that failed the contract: every field that holds up on its own. */
function salvage(written: unknown): Loose {
  const loose = record(written)
  const build = record(loose.build)
  const sides = Array.isArray(loose.sides)
    ? loose.sides.map(record).flatMap((side) => {
        const name = line(side.name)
        const wants = line(side.wants)
        return name && wants ? [{ name, wants }] : []
      })
    : []
  return {
    ...(line(loose.livesOn) ? { livesOn: loose.livesOn } : {}),
    ...(line(loose.happened) ? { happened: loose.happened } : {}),
    ...(line(loose.stake) ? { stake: loose.stake } : {}),
    sides,
    common: lines(loose.common),
    build: { moreOf: kinds(build.moreOf), fewerOf: kinds(build.fewerOf), mustHave: kinds(build.mustHave) },
  }
}
