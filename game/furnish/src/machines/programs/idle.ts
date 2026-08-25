import { LIT, LIT_TILES } from '../../style/lit.ts'
import { print, type Page, type Program } from './page.ts'

/**
 * A game nobody is playing. The game itself is the app's overlay when a body
 * sits down, so the glass draws the attract screen: a snake lying in its
 * field with its food ahead of it, or a tetris stack with a piece falling on
 * it. Which one is the machine's program.
 */
export const idle: Program = (page) => {
  if (page.program === 'tetris') tetris(page)
  else snake(page)
}

/** A field of cells, its outline, and where a cell's middle is. */
function field(page: Page, columns: number, rows: number) {
  const cell = Math.min((page.width * 0.86) / columns, (page.height * 0.86) / rows)
  const w = cell * columns
  const h = cell * rows
  const y0 = (page.height - h) / 2
  const line = 0.003
  for (const [x, width, low, high] of [
    [0, w + 2 * line, y0 - line, y0],
    [0, w + 2 * line, y0 + h, y0 + h + line],
    [-w / 2 - line / 2, line, y0, y0 + h],
    [w / 2 + line / 2, line, y0, y0 + h],
  ] as const) {
    print(page, { x, y0: low, y1: high, width, look: LIT.faint })
  }
  return {
    cell,
    at: (column: number, row: number, look: (typeof LIT)[keyof typeof LIT]) =>
      print(page, {
        x: -w / 2 + (column + 0.5) * cell,
        y0: y0 + row * cell + cell * 0.1,
        y1: y0 + (row + 1) * cell - cell * 0.1,
        width: cell * 0.8,
        look,
      }),
  }
}

function snake(page: Page): void {
  const columns = 16
  const rows = 10
  const { at } = field(page, columns, rows)
  const rng = page.rng.fork('snake')
  const row = rng.int(2, rows - 2)
  const head = rng.int(6, columns - 3)
  for (let segment = 0; segment < 6; segment++) at(head - segment, row, LIT.green)
  at(head + 2 + rng.int(0, columns - head - 3), row, LIT.red)
}

function tetris(page: Page): void {
  const columns = 10
  const rows = 16
  const { at } = field(page, columns, rows)
  const rng = page.rng.fork('tetris')
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < columns; column++) {
      if (rng.fork(`${column},${row}`).chance(0.7)) at(column, row, LIT_TILES[rng.fork(`c${column},${row}`).int(0, LIT_TILES.length)]!)
    }
  }
  const column = rng.int(1, columns - 2)
  const look = LIT_TILES[rng.int(0, LIT_TILES.length)]!
  for (const [dx, dy] of [
    [-1, 0],
    [0, 0],
    [1, 0],
    [0, 1],
  ] as const) {
    at(column + dx, rows - 3 + dy, look)
  }
}
