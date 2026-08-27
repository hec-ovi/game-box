import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import { CELL, cellRows, gridField, type CellKind } from '@gb/world'
import type { WorldDoc } from '../self-describing.ts'
import type { CellChange } from './schema.ts'

type GridDoc = WorldDoc['grid']

const KIND_OF_CHAR = new Map<string, CellKind>(Object.entries(CELL).map(([kind, char]) => [char, kind as CellKind]))

/**
 * The ground an extension built on. A pack names each cell it changed and
 * what it became; every one of them was `empty` in the base, because that is
 * the only ground a later plot may take and the base's streets and buildings
 * are not the pack's to move.
 *
 * A document carries its grid as rows or as runs and keeps the form it was
 * written in, so the picture is read with `cellRows` and written back with
 * `gridField` against the base: applying a pack never rewrites the base's bytes.
 */
export class GridDelta {
  readonly cells: readonly CellChange[]

  // written out rather than as a constructor parameter property: `gb` runs
  // under node's strip-only TypeScript, which refuses one outright
  constructor(cells: readonly CellChange[]) {
    this.cells = cells
  }

  /** The cells that differ between the base and the extended grid. Anything but empty ground turning into something is a problem. */
  static between(base: GridDoc, extended: GridDoc): Result<GridDelta, SchemaViolation[]> {
    if (base.width !== extended.width || base.height !== extended.height) {
      return err([{ path: 'grid', message: 'the extension is a different size from the base' }])
    }
    const was = cellRows(base)
    const now = cellRows(extended)
    const cells: CellChange[] = []
    const problems: SchemaViolation[] = []
    for (let y = 0; y < base.height; y += 1) {
      for (let x = 0; x < base.width; x += 1) {
        const before = was[y]![x]!
        const after = now[y]![x]!
        if (before === after) continue
        const kind = KIND_OF_CHAR.get(after)
        if (before !== CELL.empty) problems.push({ path: `grid.${y}.${x}`, message: 'the base had built here and the extension changed it' })
        else if (kind === undefined) problems.push({ path: `grid.${y}.${x}`, message: 'not a kind of cell' })
        else cells.push({ x, y, kind })
      }
    }
    return problems.length > 0 ? err(problems) : ok(new GridDelta(cells))
  }

  /** The base grid with every named cell written, in the form the base is written in. A cell outside the grid is a problem at its index. */
  applyTo(base: GridDoc): Result<GridDoc, SchemaViolation[]> {
    const rows = cellRows(base).map((row) => row.split(''))
    const problems: SchemaViolation[] = []
    this.cells.forEach((cell, index) => {
      if (cell.y >= base.height || cell.x >= base.width) problems.push({ path: `world.cells.${index}`, message: 'outside the grid' })
      else rows[cell.y]![cell.x] = CELL[cell.kind]
    })
    return problems.length > 0 ? err(problems) : ok(gridField(rows.map((row) => row.join('')), base))
  }
}
