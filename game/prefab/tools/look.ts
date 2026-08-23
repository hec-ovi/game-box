import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BUILDING_KINDS, type BuildingKind } from '@gb/world'

/** The four texture families the pack draws from: one project name each, one seed each. */
export const FAMILIES = ['a', 'b', 'c', 'd'] as const
export type Family = (typeof FAMILIES)[number]

/** The four tube colours the whole catalogue is lit with. `docs/LOOK.md`'s palette. */
export const NEONS = ['cyan', 'teal', 'magenta', 'amber'] as const
export type Neon = (typeof NEONS)[number]

/**
 * One authored look: how a building of this kind is dressed, said without any
 * reference to how big it is. The builder replays it at every footprint the
 * city actually cuts, which is what makes twelve pages of authoring into a
 * catalogue of hundreds.
 */
export interface Look {
  readonly id: string
  readonly family: Family
  readonly note: string
  /** Trades this look suits. The catalogue filters by it before it picks. */
  readonly kinds: readonly BuildingKind[]
  readonly door: { readonly wide: number; readonly tall: number }
  /** A band over the shopfront. */
  readonly fascia?: boolean
  /** Street level is lit glazing rather than a plain wall: a shop, a lobby, a bar. */
  readonly shopfront?: boolean
  /** Which section above the street is lit glazing instead of a wall. */
  readonly glass?: 'body' | 'crown'
  readonly lines?: {
    readonly section: 'ground' | 'body' | 'crown'
    readonly count: number
    readonly spread: 'third' | 'quarter'
    readonly colour: Neon
    readonly thickness: number
  }
  /** A tube round the top edge. */
  readonly crown?: Neon
  /** Metres the top section steps in from the street. */
  readonly setback?: number
  /** Metres of bevel on the ground floor's top and bottom edges. */
  readonly chamfer?: number
}

export function loadLooks(folder: string): Look[] {
  const looks = readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => check(JSON.parse(readFileSync(join(folder, name), 'utf8')) as Look, name))
  if (looks.length === 0) throw new Error(`no looks in ${folder}`)
  return looks
}

/** A look that would build something the intake gates refuse is caught here instead. */
function check(look: Look, file: string): Look {
  const fail = (why: string): never => {
    throw new Error(`${file}: ${why}`)
  }
  if (!FAMILIES.includes(look.family)) fail(`family must be one of ${FAMILIES.join(', ')}`)
  if (look.kinds.length === 0) fail('a look has to say which trades it suits')
  for (const kind of look.kinds) if (!BUILDING_KINDS.includes(kind)) fail(`${kind} is not a building kind`)
  if (look.crown && !NEONS.includes(look.crown)) fail(`${look.crown} is not one of ${NEONS.join(', ')}`)
  if (look.lines && !NEONS.includes(look.lines.colour)) fail(`${look.lines.colour} is not one of ${NEONS.join(', ')}`)
  if (look.door.tall > 3) fail('a door taller than 3 m does not fit the shortest ground floor')
  return look
}
