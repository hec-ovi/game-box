import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BUILDING_KINDS, type BuildingKind } from '@gb/world'

/** The four tube colours the whole catalogue is lit with. `docs/LOOK.md`'s palette. */
export const NEONS = ['cyan', 'teal', 'magenta', 'amber'] as const
export type Neon = (typeof NEONS)[number]

/**
 * The two lit screens a look can carry. A `board` is the wide one across the
 * top storey, read from across the street; a `banner` is the tall one beside
 * the entrance, read from the pavement. Both are panels on the producer's own
 * cell grid, so they claim their cells and nothing can land on top of them.
 */
export const DISPLAYS = ['board', 'banner'] as const
export type Display = (typeof DISPLAYS)[number]

/**
 * One authored look: how a building of this kind is dressed, said without any
 * reference to how big it is. The builder replays it at every footprint the
 * city actually cuts, which is what makes twelve pages of authoring into a
 * catalogue of hundreds.
 */
export interface Look {
  readonly id: string
  readonly note: string
  /**
   * The wall picture: a file in `finishes/`, without the extension. It is the
   * wall above the street and the base under it, so a bar, a warehouse and a
   * corporate slab are not the same wall, and it is authored here rather than
   * picked at runtime because `design.model` already names the look and a
   * runtime choice would be a second thing a world file does not record.
   */
  readonly facade: string
  /** Trades this look suits. The catalogue filters by it before it picks. */
  readonly kinds: readonly BuildingKind[]
  readonly door: { readonly wide: number; readonly tall: number }
  /** A band over the shopfront. */
  readonly fascia?: boolean
  /** Street level is lit glazing rather than a plain wall: a shop, a lobby, a bar. */
  readonly shopfront?: boolean
  /** Which section above the street is lit glazing instead of a wall. */
  readonly glass?: 'body' | 'crown'
  /** Lit screens on the front: a board across the parapet storey, a banner beside the door. */
  readonly displays?: readonly Display[]
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
  if (!look.facade) fail('a look has to name the wall picture it wears, from finishes/')
  if (look.kinds.length === 0) fail('a look has to say which trades it suits')
  for (const kind of look.kinds) if (!BUILDING_KINDS.includes(kind)) fail(`${kind} is not a building kind`)
  if (look.crown && !NEONS.includes(look.crown)) fail(`${look.crown} is not one of ${NEONS.join(', ')}`)
  for (const display of look.displays ?? []) if (!DISPLAYS.includes(display)) fail(`${display} is not one of ${DISPLAYS.join(', ')}`)
  if (look.door.tall > 3) fail('a door taller than 3 m does not fit the shortest ground floor')
  return look
}
