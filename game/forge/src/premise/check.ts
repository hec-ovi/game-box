import { charterContract, premiseContract, type Charter, type Premise, type Word } from '@gb/world'
import type { Dropped } from '../charters/resolve.ts'

/**
 * The city's history is `@gb/world`'s shape, because it is a fact about the
 * city and a file somebody is sent carries it. This box writes one and builds
 * against it; what it is lives there.
 */

/** One side of the town's argument: who they are and what they want out of it. */
export type PremiseSide = Premise['sides'][number]

/** What the history says the town holds, in the words of its charters. */
export type PremiseBuild = Premise['build']

type Loose = Record<string, unknown>

const record = (value: unknown): Loose => (typeof value === 'object' && value !== null ? (value as Loose) : {})

const line = (value: unknown): string | undefined => (typeof value === 'string' && value.trim().length ? value : undefined)

const lines = (value: unknown): string[] => (Array.isArray(value) ? value.map(line).filter((one): one is string => one !== undefined) : [])

/**
 * The charters a written history declares, each checked on its own against
 * `@gb/world`'s `CharterSchema`. One that fails is dropped with the fields that
 * failed it, and the rest stand: one bad axis costs one kind of place, never the
 * history.
 */
export function chartersOf(written: unknown): { charters: Charter[]; dropped: Dropped[] } {
  const charters: Charter[] = []
  const dropped: Dropped[] = []
  const raw = record(written).charters
  for (const [at, one] of (Array.isArray(raw) ? raw : []).entries()) {
    const parsed = charterContract.parse(one)
    if (parsed.ok) charters.push(parsed.value)
    else dropped.push({ word: line(record(one).word) ?? `#${at}`, reason: parsed.error.map((violation) => `${violation.path}: ${violation.message}`).join('; ') })
  }
  return { charters, dropped }
}

/**
 * A premise as written by a narrator, checked against the contract the world
 * document will hold it to, with its `build` held to the kinds of place the
 * city declares. Nothing a narrator writes is trusted, and nothing good in it
 * is thrown away for one bad word: a history that fails the contract is
 * salvaged field by field (a kind no charter declares is dropped from `build`,
 * a side without both its parts is dropped, a line that is not a line is
 * dropped) and checked again. One that still does not hold up is dropped whole
 * and the town is built without one, the same way an unusable quest is dropped
 * rather than shipped. Checking it here is what keeps a long one out of
 * `World.found`, where it would take the whole city down instead.
 */
export function premiseOf(written: unknown, declared: readonly Word[]): Premise | undefined {
  if (written === undefined) return undefined
  const salvaged = premiseContract.parse(salvage(written, declared))
  return salvaged.ok ? salvaged.value : undefined
}

/** What can be kept of a history: every field that holds up on its own. */
function salvage(written: unknown, declared: readonly Word[]): Loose {
  const loose = record(written)
  const build = record(loose.build)
  const kinds = (value: unknown): Word[] => lines(value).filter((word) => declared.includes(word))
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
