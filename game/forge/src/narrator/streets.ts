import { Rng } from '@gb/kit'
import type { Facing, World } from '@gb/world'
import { covers, type Cell, type StreetLine } from '../layout/bands.ts'
import { streetLines, type StreetLines } from '../layout/lines.ts'
import { flavourOf } from '../theme/flavour.ts'
import { wordsFor, type Words } from '../theme/words.ts'

/** What an ordinary street's name ends in. An avenue is called one. */
const TAILS: readonly string[] = ['Street', 'Row', 'Lane']

interface Named {
  readonly line: StreetLine
  readonly name: string
}

/**
 * The name of every street in a town, one per band, dealt once off the seed.
 *
 * The columns west to east and then the rows north to south each take the
 * next word of the theme's own (a noun, an adjective, a family name), so no
 * two streets share a name and a numbered address says where it is. A town
 * with more streets than words numbers the rest. The same world deals the
 * same names, so a building added later stands on the street it always did.
 */
export class StreetNames {
  readonly #columns: readonly Named[]
  readonly #rows: readonly Named[]

  constructor(lines: StreetLines, words: Words, rng: Rng) {
    const pool = rng.shuffle(unique([...words.nouns, ...words.adjectives, ...words.last]))
    const named = [...lines.columns, ...lines.rows].map((line, at) => ({ line, name: nameOf(line, at, pool, rng) }))
    this.#columns = named.slice(0, lines.columns.length)
    this.#rows = named.slice(lines.columns.length)
  }

  /** The streets of a standing town, read off its road graph and named off its own seed and theme. */
  static of(world: World): StreetNames {
    return new StreetNames(streetLines(world), wordsFor(flavourOf(world.theme)), new Rng(`streets/${world.seed}`))
  }

  /** Every street, in the order they were named. */
  get all(): readonly string[] {
    return [...this.#columns, ...this.#rows].map((one) => one.name)
  }

  /** The street a door is on: the band its doorstep stands in, across the wall it faces. Nothing when the doorstep is on no band. */
  at(doorstep: Cell, facing: Facing): string | undefined {
    const onRow = facing === 'north' || facing === 'south'
    const bands = onRow ? this.#rows : this.#columns
    return bands.find(({ line }) => covers(line, onRow ? doorstep.y : doorstep.x))?.name
  }
}

/** The next word off the pool, or a number once the words run out, with the tail its class takes. */
function nameOf(line: StreetLine, at: number, pool: readonly string[], rng: Rng): string {
  const word = pool[at] ?? ordinal(at - pool.length + 1)
  return `${word} ${line.kind === 'avenue' ? 'Avenue' : rng.pick(TAILS)}`
}

/** 1st, 2nd, 3rd, 4th, 11th, 21st. */
function ordinal(n: number): string {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix}`
}

/** Each word once, whichever list said it first. */
function unique(words: readonly string[]): string[] {
  const seen = new Set<string>()
  return words.filter((word) => {
    const key = word.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
