/** A cell of a piece, from the top left of its box. */
export interface Offset {
  readonly x: number
  readonly y: number
}

/** One of the seven pieces: its rotations, clockwise from how it spawns. */
export interface Tetromino {
  readonly name: string
  readonly turns: readonly (readonly Offset[])[]
}

/** The seven pieces drawn in their boxes, spawn orientation first. */
const DRAWN: readonly { name: string; rows: readonly string[] }[] = [
  { name: 'I', rows: ['....', '####', '....', '....'] },
  { name: 'O', rows: ['##', '##'] },
  { name: 'T', rows: ['.#.', '###', '...'] },
  { name: 'S', rows: ['.##', '##.', '...'] },
  { name: 'Z', rows: ['##.', '.##', '...'] },
  { name: 'J', rows: ['#..', '###', '...'] },
  { name: 'L', rows: ['..#', '###', '...'] },
]

/** Every piece with all four of its turns worked out from the drawing. */
export const TETROMINOES: readonly Tetromino[] = DRAWN.map(({ name, rows }) => {
  const size = rows.length
  let cells = rows.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === '#' ? [{ x, y }] : [])))
  const turns: Offset[][] = []
  for (let turn = 0; turn < 4; turn += 1) {
    turns.push(cells)
    cells = cells.map(({ x, y }) => ({ x: size - 1 - y, y: x }))
  }
  return { name, turns }
})

/**
 * Pieces come out of a bag of all seven, shuffled, so no piece is ever more
 * than twelve draws away and a game does not hang on one shape.
 */
export class Bag {
  #left: Tetromino[] = []

  draw(): Tetromino {
    if (this.#left.length === 0) this.#left = shuffled(TETROMINOES)
    return this.#left.pop()!
  }
}

function shuffled(pieces: readonly Tetromino[]): Tetromino[] {
  const out = [...pieces]
  for (let at = out.length - 1; at > 0; at -= 1) {
    const other = Math.floor(Math.random() * (at + 1))
    ;[out[at], out[other]] = [out[other]!, out[at]!]
  }
  return out
}
