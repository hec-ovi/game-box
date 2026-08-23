import type { AssetPackRef } from './schema.ts'
import { compareVersions } from './version.ts'

/** How the art the reader has stands against the art the file was built from. */
export type PackState = 'same' | 'newer' | 'older' | 'altered' | 'missing'

export interface PackVerdict {
  readonly pack: string
  /** The version the city was built against. */
  readonly wanted: string
  /** The version the reader has, absent when they have none. */
  readonly found?: string
  readonly state: PackState
}

export interface PackReport {
  readonly verdicts: readonly PackVerdict[]
  /** True only when the file names its art and the reader has every piece of it. */
  readonly asBuilt: boolean
}

/**
 * Judge what the reader has against what the file names. Nothing here refuses
 * anything: a city always opens, and the report is how a caller tells the
 * player that what they are looking at is not what its maker saw.
 */
export function comparePacks(requires: readonly AssetPackRef[], have: readonly AssetPackRef[]): PackReport {
  const installed = new Map(have.map((pack) => [pack.pack, pack]))
  const verdicts = requires.map((wanted) => verdict(wanted, installed.get(wanted.pack)))
  return { verdicts, asBuilt: verdicts.length > 0 && verdicts.every((one) => one.state === 'same') }
}

function verdict(wanted: AssetPackRef, found: AssetPackRef | undefined): PackVerdict {
  if (!found) return { pack: wanted.pack, wanted: wanted.version, state: 'missing' }
  const order = compareVersions(found.version, wanted.version)
  const state: PackState = order > 0 ? 'newer' : order < 0 ? 'older' : altered(wanted, found) ? 'altered' : 'same'
  return { pack: wanted.pack, wanted: wanted.version, found: found.version, state }
}

/** Same name, same version, different bytes: somebody's copy of the art is not the art. */
function altered(wanted: AssetPackRef, found: AssetPackRef): boolean {
  return Boolean(wanted.sha256 && found.sha256 && wanted.sha256 !== found.sha256)
}
