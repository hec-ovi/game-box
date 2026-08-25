import { SCREEN_WORDS } from '../phrase.ts'
import type { ScreenApp } from './app.ts'
import { BODY_ROWS, overlay } from './size.ts'
import { Bag, type Offset, type Tetromino } from './tetromino.ts'
import { Ticker } from './ticker.ts'

/** The well, in cells; each cell is two characters wide on screen. */
const WELL = { cols: 10, rows: BODY_ROWS } as const

/** How long a piece rests on each row. */
const FALL_MS = 500

/** Credited for clearing that many rows at once. */
const LINES = [0, 40, 100, 300, 1200] as const

/** The well as drawn, walls included, and where the side column starts, in characters. */
const WELL_WIDTH = WELL.cols * 2 + 2
const SIDE = WELL_WIDTH + 2

const TETRIS = SCREEN_WORDS.tetris

const GLYPH = { block: '[]', floor: ' .', wall: '|' } as const

type Phase = 'ready' | 'running' | 'over'

interface Falling {
  readonly piece: Tetromino
  readonly turn: number
  readonly x: number
  readonly y: number
}

/**
 * Tetris in a text well: pieces fall on a clock, the arrows move and turn
 * them, Space drops one to the floor, full rows go and score. A piece that
 * cannot spawn ends the game, which is the one moment the score is reported.
 * The best score is what the game was handed and is drawn in the side column.
 */
export class TetrisApp implements ScreenApp {
  #best: number | undefined
  #hooks: { changed(): void; over(score: number): void }
  #ticker = new Ticker(FALL_MS, () => this.#fall())
  #bag = new Bag()
  #phase: Phase = 'ready'
  #well: boolean[][] = []
  #falling!: Falling
  #next!: Tetromino
  #score = 0
  #lines = 0

  constructor(best: number | undefined, hooks: { changed(): void; over(score: number): void }) {
    this.#best = best
    this.#hooks = hooks
    this.#reset()
  }

  /** The playthrough's best for this machine, as pushed. */
  best(best: number | undefined): void {
    this.#best = best
  }

  rows(): readonly string[] {
    const cells = this.#well.map((row) => [...row])
    if (this.#phase === 'running') {
      for (const cell of this.#cells(this.#falling)) cells[cell.y]![cell.x] = true
    }
    let well = cells.map((row) => `${GLYPH.wall}${row.map((full) => (full ? GLYPH.block : GLYPH.floor)).join('')}${GLYPH.wall}`)
    // A message sits in the well, so the side column still reads.
    if (this.#phase === 'ready') well = overlay(well, [TETRIS.title, '', TETRIS.start], WELL_WIDTH)
    if (this.#phase === 'over') well = overlay(well, [TETRIS.over, `Score ${this.#score}`, '', TETRIS.again], WELL_WIDTH)
    const side = this.#side()
    return well.map((row, y) => row.padEnd(SIDE) + (side[y] ?? ''))
  }

  status(): string {
    return TETRIS.keys
  }

  key(key: string): void {
    if (this.#phase === 'over') {
      if (key !== 'Enter') return
      this.#reset()
      this.#hooks.changed()
      return
    }
    if (this.#phase === 'ready') {
      this.#phase = 'running'
      this.#ticker.start()
    }
    const at = this.#falling
    if (key === 'ArrowLeft') this.#move({ ...at, x: at.x - 1 })
    else if (key === 'ArrowRight') this.#move({ ...at, x: at.x + 1 })
    else if (key === 'ArrowUp') this.#turn()
    else if (key === 'ArrowDown') this.#fall()
    else if (key === ' ') this.#drop()
    this.#hooks.changed()
  }

  dispose(): void {
    this.#ticker.stop()
  }

  #reset(): void {
    this.#phase = 'ready'
    this.#score = 0
    this.#lines = 0
    this.#well = Array.from({ length: WELL.rows }, () => Array<boolean>(WELL.cols).fill(false))
    this.#next = this.#bag.draw()
    this.#spawn()
  }

  /** The side column: what comes next, and the numbers. */
  #side(): string[] {
    const preview = Array.from({ length: 4 }, () => Array<string>(4).fill('  '))
    for (const cell of this.#next.turns[0]!) preview[cell.y]![cell.x] = GLYPH.block
    const best = this.#best === undefined ? [] : [`BEST  ${this.#best}`]
    return [TETRIS.next, ...preview.map((row) => row.join('')), '', `SCORE ${this.#score}`, `LINES ${this.#lines}`, ...best]
  }

  #cells(at: Falling): Offset[] {
    return at.piece.turns[at.turn]!.map((cell) => ({ x: at.x + cell.x, y: at.y + cell.y }))
  }

  #fits(at: Falling): boolean {
    return this.#cells(at).every(
      (cell) => cell.x >= 0 && cell.x < WELL.cols && cell.y >= 0 && cell.y < WELL.rows && !this.#well[cell.y]![cell.x],
    )
  }

  #move(to: Falling): boolean {
    if (!this.#fits(to)) return false
    this.#falling = to
    return true
  }

  /** Clockwise, nudged a column either way when the wall is in the way. */
  #turn(): void {
    const at = this.#falling
    const turned = { ...at, turn: (at.turn + 1) % at.piece.turns.length }
    for (const dx of [0, -1, 1]) if (this.#move({ ...turned, x: turned.x + dx })) return
  }

  #fall(): void {
    if (this.#phase !== 'running') return
    const at = this.#falling
    if (this.#move({ ...at, y: at.y + 1 })) {
      this.#hooks.changed()
      return
    }
    this.#lock()
  }

  #drop(): void {
    let at = this.#falling
    while (this.#fits({ ...at, y: at.y + 1 })) at = { ...at, y: at.y + 1 }
    this.#falling = at
    this.#lock()
  }

  #lock(): void {
    for (const cell of this.#cells(this.#falling)) this.#well[cell.y]![cell.x] = true
    const kept = this.#well.filter((row) => !row.every(Boolean))
    const cleared = WELL.rows - kept.length
    while (kept.length < WELL.rows) kept.unshift(Array<boolean>(WELL.cols).fill(false))
    this.#well = kept
    this.#lines += cleared
    this.#score += LINES[cleared] ?? 0
    this.#spawn()
    this.#hooks.changed()
  }

  #spawn(): void {
    const piece = this.#next
    this.#next = this.#bag.draw()
    const box = piece.turns[0]!.reduce((wide, cell) => Math.max(wide, cell.x + 1), 0)
    this.#falling = { piece, turn: 0, x: Math.floor((WELL.cols - box) / 2), y: 0 }
    if (this.#phase === 'running' && !this.#fits(this.#falling)) this.#end()
  }

  #end(): void {
    this.#phase = 'over'
    this.#ticker.stop()
    this.#hooks.over(this.#score)
  }
}
