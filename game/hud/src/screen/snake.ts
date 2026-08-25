import { SCREEN_WORDS } from '../phrase.ts'
import type { ScreenApp } from './app.ts'
import { BODY_ROWS, SCREEN, overlay } from './size.ts'
import { Ticker } from './ticker.ts'

/** The field inside the border, in cells of one character. */
const FIELD = { cols: SCREEN.cols - 2, rows: BODY_ROWS - 2 } as const

/** One step of the snake, in milliseconds. */
const STEP_MS = 120

/** Credited per thing eaten. */
const BITE = 10

const SNAKE = SCREEN_WORDS.snake

const GLYPH = { head: '@', body: 'o', food: '*', floor: ' ' } as const

interface Cell {
  readonly x: number
  readonly y: number
}

const HEADINGS: Record<string, Cell> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

type Phase = 'ready' | 'running' | 'over'

/**
 * Snake on a text field: the arrows steer, the first one sets it going,
 * eating grows it and scores, and a wall or its own tail ends the game,
 * which is the one moment the score is reported. The best score is what the
 * game was handed and is drawn beside the live one.
 */
export class SnakeApp implements ScreenApp {
  #best: number | undefined
  #hooks: { changed(): void; over(score: number): void }
  #ticker = new Ticker(STEP_MS, () => this.#step())
  #phase: Phase = 'ready'
  #body: Cell[] = []
  #heading: Cell = HEADINGS.ArrowRight!
  #next: Cell = this.#heading
  #food: Cell = { x: 0, y: 0 }
  #score = 0

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
    const field = Array.from({ length: FIELD.rows }, () => Array<string>(FIELD.cols).fill(GLYPH.floor))
    field[this.#food.y]![this.#food.x] = GLYPH.food
    this.#body.forEach((cell, at) => {
      field[cell.y]![cell.x] = at === 0 ? GLYPH.head : GLYPH.body
    })
    const edge = `+${'-'.repeat(FIELD.cols)}+`
    const lines = [edge, ...field.map((row) => `|${row.join('')}|`), edge]
    if (this.#phase === 'ready') return overlay(lines, [SNAKE.title, '', SNAKE.start])
    if (this.#phase === 'over') return overlay(lines, [SNAKE.over, `Score ${this.#score}`, '', SNAKE.again])
    return lines
  }

  status(): string {
    const best = this.#best === undefined ? '' : `   Best ${this.#best}`
    return `Score ${this.#score}${best}   ${SNAKE.keys}`
  }

  key(key: string): void {
    if (this.#phase === 'over') {
      if (key !== 'Enter') return
      this.#reset()
      this.#hooks.changed()
      return
    }
    const heading = HEADINGS[key]
    if (!heading) return
    // Turning straight back into itself is the one turn that cannot be meant.
    if (this.#body.length > 1 && heading.x === -this.#heading.x && heading.y === -this.#heading.y) return
    this.#next = heading
    if (this.#phase === 'ready') {
      this.#phase = 'running'
      this.#ticker.start()
      this.#hooks.changed()
    }
  }

  dispose(): void {
    this.#ticker.stop()
  }

  #reset(): void {
    this.#phase = 'ready'
    this.#score = 0
    const y = Math.floor(FIELD.rows / 2)
    const x = Math.floor(FIELD.cols / 2)
    this.#body = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }]
    this.#heading = HEADINGS.ArrowRight!
    this.#next = this.#heading
    this.#place()
  }

  #step(): void {
    this.#heading = this.#next
    const head = this.#body[0]!
    const to = { x: head.x + this.#heading.x, y: head.y + this.#heading.y }
    const wall = to.x < 0 || to.y < 0 || to.x >= FIELD.cols || to.y >= FIELD.rows
    const ate = to.x === this.#food.x && to.y === this.#food.y
    // The tail moves on unless the snake grows, so the cell it leaves is free.
    const rest = ate ? this.#body : this.#body.slice(0, -1)
    if (wall || rest.some((cell) => cell.x === to.x && cell.y === to.y)) {
      this.#end()
      return
    }
    this.#body = [to, ...rest]
    if (ate) {
      this.#score += BITE
      this.#place()
    }
    this.#hooks.changed()
  }

  #end(): void {
    this.#phase = 'over'
    this.#ticker.stop()
    this.#hooks.changed()
    this.#hooks.over(this.#score)
  }

  /** Food lands on a free cell. */
  #place(): void {
    const free: Cell[] = []
    for (let y = 0; y < FIELD.rows; y += 1) {
      for (let x = 0; x < FIELD.cols; x += 1) {
        if (!this.#body.some((cell) => cell.x === x && cell.y === y)) free.push({ x, y })
      }
    }
    this.#food = free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 }
  }
}
