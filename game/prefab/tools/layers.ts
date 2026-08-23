import { FAMILIES, NEONS, type Family, type Neon } from './look.ts'

/**
 * One layer of the pack's array texture per finish. An array rather than an
 * atlas because the producer's wall pictures tile across a wall, and only a
 * layer of its own lets the sampler wrap one without bleeding into the picture
 * next door.
 *
 * The door and the glazing are shared across the four families, because a door
 * is a door; the wall and the base are what makes one family look unlike
 * another, and the tubes are the four colours `docs/LOOK.md` settles on.
 */
export const LAYERS: readonly string[] = [
  ...FAMILIES.flatMap((family) => [`${family}:facade`, `${family}:base`]),
  'door',
  'glass',
  ...NEONS.map((neon) => `neon:${neon}`),
]

export const LAYER_OF: ReadonlyMap<string, number> = new Map(LAYERS.map((name, index) => [name, index]))

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
 * Which layer a producer material lands on. The set is closed on purpose: a
 * look that reaches for a balcony, a screen, a pipe or a mast fails the build
 * here rather than costing the city a second material.
 */
export function layerFor(material: string, family: Family): number {
  const name = finish(material, family)
  const index = LAYER_OF.get(name)
  if (index === undefined) throw new UnknownFinish(material)
  return index
}

function finish(material: string, family: Family): string {
  if (material === 'facade') return `${family}:facade`
  if (material === 'base' || material === 'concrete' || material === 'roof') return `${family}:base`
  if (material === 'door') return 'door'
  if (material === 'glass-band') return 'glass'
  if (material.startsWith('neon:')) {
    const colour = material.slice('neon:'.length) as Neon
    return NEONS.includes(colour) ? material : material + '?'
  }
  return material
}
