/**
 * The city as a matrix of cells. One char per cell keeps it compact in the
 * world file and readable when you print it, and makes "is this space free"
 * and "put a building here" cheap.
 */

/**
 * Every kind of cell the grid holds. Closed: whoever routes, drives or draws
 * the city reads what a kind means off this list and CONTRACT.md, never off a
 * list of its own.
 */
export const CELL_KINDS = [
  /** Unbuilt ground inside the town, at road level: walked across, never driven, where a later plot goes. */
  'empty',
  /** The roadway, kerb to kerb, at road level: the only ground a car drives, crossed by a walker. */
  'street',
  /** The pavement, a kerb above the roadway: where people walk. */
  'sidewalk',
  /** A plot's footprint: nothing crosses it, the way in is the plot's entrance door. */
  'building',
  /** Open ground at pavement height: walked, never driven, never built on. */
  'park',
  /** The valley wall: nothing crosses it, and the ground rises from the pavement top away from the town. */
  'mountain',
  /** Standing water at road level: nothing crosses it. */
  'water',
] as const

export type CellKind = (typeof CELL_KINDS)[number]

/** The char each kind is written as in the file. */
export const CELL = {
  empty: '.',
  street: 'S',
  sidewalk: 'W',
  building: 'B',
  park: 'P',
  mountain: 'M',
  water: '~',
} as const satisfies Record<CellKind, string>

export type CellChar = (typeof CELL)[CellKind]

const KIND_BY_CHAR = new Map<string, CellKind>(
  (Object.entries(CELL) as Array<[CellKind, CellChar]>).map(([kind, char]) => [char, kind]),
)

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export class Grid {
  readonly width: number
  readonly height: number
  #rows: string[]

  constructor(width: number, height: number, rows?: readonly string[]) {
    this.width = width
    this.height = height
    this.#rows = rows ? [...rows] : Array.from({ length: height }, () => CELL.empty.repeat(width))
  }

  static fromRows(rows: readonly string[]): Grid {
    return new Grid(rows[0]?.length ?? 0, rows.length, rows)
  }

  rows(): readonly string[] {
    return this.#rows
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  at(x: number, y: number): CellKind | undefined {
    if (!this.inside(x, y)) return undefined
    return KIND_BY_CHAR.get(this.#rows[y]![x]!)
  }

  set(x: number, y: number, kind: CellKind): void {
    if (!this.inside(x, y)) return
    const row = this.#rows[y]!
    this.#rows[y] = row.slice(0, x) + CELL[kind] + row.slice(x + 1)
  }

  fill(rect: Rect, kind: CellKind): void {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) this.set(x, y, kind)
    }
  }

  /** True when every cell of the rect is inside the grid and of one of `kinds`. */
  isAll(rect: Rect, kinds: readonly CellKind[]): boolean {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const kind = this.at(x, y)
        if (kind === undefined || !kinds.includes(kind)) return false
      }
    }
    return true
  }

  count(kind: CellKind): number {
    let total = 0
    for (const row of this.#rows) {
      for (const char of row) if (char === CELL[kind]) total++
    }
    return total
  }

  /**
   * Every free rectangle of exactly this size that touches a sidewalk, which is
   * how "add three more houses later" finds somewhere to put them.
   */
  freeRects(w: number, h: number, options: { touching?: CellKind } = {}): Rect[] {
    const found: Rect[] = []
    for (let y = 0; y + h <= this.height; y++) {
      for (let x = 0; x + w <= this.width; x++) {
        const rect = { x, y, w, h }
        if (!this.isAll(rect, ['empty'])) continue
        if (options.touching && !this.borders(rect, options.touching)) continue
        found.push(rect)
      }
    }
    return found
  }

  /** True when any cell orthogonally adjacent to the rect is of `kind`. */
  borders(rect: Rect, kind: CellKind): boolean {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (this.at(x, rect.y - 1) === kind) return true
      if (this.at(x, rect.y + rect.h) === kind) return true
    }
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      if (this.at(rect.x - 1, y) === kind) return true
      if (this.at(rect.x + rect.w, y) === kind) return true
    }
    return false
  }

  clone(): Grid {
    return new Grid(this.width, this.height, this.#rows)
  }
}
