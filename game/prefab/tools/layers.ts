import { BALCONY } from '../src/balcony.ts'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from '../src/entrance.ts'
import { DISPLAY_FINISH } from '../src/screens.ts'
import { baseFinish, wallFinish } from '../src/wall.ts'
import { NEONS, type Look } from './look.ts'

/**
 * Pixels a side, per layer. A wall picture holds four bays by two floors, which
 * is 12 by 6.4 m, so this is about 21 pixels a metre: enough that a window mark
 * is half a dozen pixels across at the distance anybody sees it from.
 */
export const COLOUR_SIZE = 256
export const EMISSIVE_SIZE = 256

/** What the pack stores 1.0 of glow as, so a tube and a lit window share one 8-bit map. */
export const GLOW_BAKE = 2

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
 * A look names the picture it wears, and the picture lands twice: as the wall
 * above the street, which the shader cuts windows into, and as the base, the
 * same picture on the walls a band is composed on, with no windows in it. Two
 * looks naming one picture pay for the pair once. Everything else is shared:
 * the doors, the glazing and the screen plate because a door is a door, and
 * the tubes because they are the four colours `docs/LOOK.md` settles on.
 *
 * Nothing is ever baked onto the lit entrance: no look asks for it and
 * `forMaterial` cannot reach it. The runtime moves a plot's door onto it when
 * the world says that plot has an interior. The balustrade is the layer the
 * balconies this repo generates wear, and no producer material lands on it.
 *
 * A new finish goes at the end, because a layer index rides on the vertices of
 * every model in the pack, so a finish added anywhere else renumbers the whole
 * mesh and needs a rebuild with it.
 */
export class Layers {
  readonly names: readonly string[]
  readonly #index: ReadonlyMap<string, number>

  private constructor(names: readonly string[]) {
    this.names = names
    this.#index = new Map(names.map((name, index) => [name, index]))
  }

  static of(looks: readonly Look[]): Layers {
    const pictures = [...new Set(looks.map((look) => look.facade))]
    return new Layers([
      ...pictures.map(wallFinish),
      ...pictures.map(baseFinish),
      DOOR_FINISH,
      DISPLAY_FINISH,
      'glass',
      ...NEONS.map((neon) => `neon:${neon}`),
      OPEN_DOOR_FINISH,
      BALCONY.finish,
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
   * The set is closed on purpose: a look that reaches for a pipe, a mast or a
   * composed window fails the build here rather than costing the city a
   * material it has no layer for.
   */
  forMaterial(material: string, look: Look): number {
    const index = this.#index.get(finishOf(material, look))
    if (index === undefined) throw new UnknownFinish(material)
    return index
  }
}

function finishOf(material: string, look: Look): string {
  if (material === 'facade') return wallFinish(look.facade)
  // a band somebody has composed on wears the plain wall rather than the
  // bay-and-floor picture, because a window drawn in the middle of a bay is
  // exactly where a composed element goes. The base is that same picture with
  // no windows cut into it
  if (material === 'base' || material === 'concrete' || material === 'roof' || material === 'wall') return baseFinish(look.facade)
  if (material === 'door') return DOOR_FINISH
  if (material === 'screen') return DISPLAY_FINISH
  if (material === 'glass-band') return 'glass'
  return material
}
