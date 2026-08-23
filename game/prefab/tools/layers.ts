import { DOOR_FINISH, OPEN_DOOR_FINISH } from '../src/entrance.ts'
import { WALL } from '../src/interior.ts'
import { DISPLAY_FINISH } from '../src/screens.ts'
import { FAMILIES, NEONS, type Look } from './look.ts'

/**
 * Pixels a side, per layer. A wall picture holds four bays by two floors, which
 * is 12 by 6.4 m, so this is about 21 pixels a metre: enough that a window mark
 * is half a dozen pixels across at the distance anybody sees it from.
 */
export const COLOUR_SIZE = 256
export const EMISSIVE_SIZE = 256

/** What the pack stores 1.0 of glow as, so a tube and a lit window share one 8-bit map. */
export const GLOW_BAKE = 2

/** The layer a committed wall picture lands on. `windowsOn` reads the prefix. */
export function wallFinish(picture: string): string {
  return WALL + picture
}

export class UnknownFinish extends Error {
  readonly code = 'unknown-finish'
  readonly material: string

  constructor(material: string) {
    super(`nothing in the catalogue wears "${material}"; author around it or give it a layer`)
    this.name = 'UnknownFinish'
    this.material = material
  }
}

/**
 * One layer of the pack's array texture per finish. An array rather than an
 * atlas because the producer's wall pictures tile across a wall, and only a
 * layer of its own lets the sampler wrap one without bleeding into the picture
 * next door.
 *
 * The wall above the street is a layer per committed picture, and a look names
 * the one it wears, so a bar and a corporate slab on the same street are not
 * the same surface and two looks that want one picture pay for it once.
 * Everything else is shared: the doors, the glazing and the screen housing
 * because a door is a door, the base because it is the plain heavy wall a
 * composed band stands on, and the tubes because they are the four colours
 * `docs/LOOK.md` settles on.
 *
 * The lit entrance is last, and nothing is ever baked onto it: no look asks for
 * it and `forMaterial` cannot reach it. The runtime moves a plot's door onto it
 * when the world says that plot has an interior. Last, because a layer index
 * rides on the vertices of every model in the pack, so a finish added anywhere
 * else renumbers the whole mesh and needs a rebuild with it.
 */
export class Layers {
  readonly names: readonly string[]
  readonly #index: ReadonlyMap<string, number>

  private constructor(names: readonly string[]) {
    this.names = names
    this.#index = new Map(names.map((name, index) => [name, index]))
  }

  static of(looks: readonly Look[]): Layers {
    return new Layers([
      ...[...new Set(looks.map((look) => look.facade))].map(wallFinish),
      ...FAMILIES.map((family) => `${family}:base`),
      DOOR_FINISH,
      DISPLAY_FINISH,
      'glass',
      ...NEONS.map((neon) => `neon:${neon}`),
      OPEN_DOOR_FINISH,
    ])
  }

  get count(): number {
    return this.names.length
  }

  /** Where a finish sits in the strip. Throws rather than answering for one the pack has not got. */
  at(finish: string): number {
    const index = this.#index.get(finish)
    if (index === undefined) throw new UnknownFinish(finish)
    return index
  }

  /**
   * Which layer a producer material lands on, for a model built from this look.
   * The set is closed on purpose: a look that reaches for a balcony, a pipe or a
   * mast fails the build here rather than costing the city a second material.
   */
  forMaterial(material: string, look: Look): number {
    const index = this.#index.get(finishOf(material, look))
    if (index === undefined) throw new UnknownFinish(material)
    return index
  }
}

function finishOf(material: string, look: Look): string {
  if (material === 'facade') return wallFinish(look.facade)
  // a band somebody has composed on wears the producer's plain wall rather than
  // the bay-and-floor picture, because a window drawn in the middle of a bay is
  // exactly where a composed element goes. The pack's base finish is that same
  // plain heavy wall at the same tile, so the two are one layer
  if (material === 'base' || material === 'concrete' || material === 'roof' || material === 'wall') return `${look.family}:base`
  if (material === 'door') return DOOR_FINISH
  if (material === 'screen') return DISPLAY_FINISH
  if (material === 'glass-band') return 'glass'
  return material
}
