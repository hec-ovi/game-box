/**
 * How the grid is written in the document, and read back.
 *
 * A city block is a run of the same kind of cell, so a town of a million cells
 * is a few hundred thousand runs: `rows` is one char a cell, the form every
 * file written before this carries, and `runs` is the same picture with each
 * run written `<count><char>`, the count left out for a run of one. A city
 * keeps the form its file was written in, so a file already shared saves back
 * to the bytes it was sealed with.
 */
import type { WorldDoc } from './schema.ts'

/** The grid as the document carries it, in either form. */
export type GridField = WorldDoc['grid']

/** The picture, one char a cell, whichever form the field is in. */
export function cellRows(field: GridField): string[] {
  if (field.rows) return [...field.rows]
  return (field.runs ?? []).map((run) => rowOf(run, field.width))
}

/**
 * The picture as a field to write: in the form of the field it came from, so a
 * file is left as it was written, and as runs when it came from none.
 */
export function gridField(rows: readonly string[], like?: GridField): GridField {
  const size = { width: rows[0]?.length ?? 0, height: rows.length }
  return like?.rows ? { ...size, rows: [...rows] } : { ...size, runs: rows.map(runOf) }
}

/** One row as runs. Maximal runs, no count on a run of one: the same row gives the same string. */
function runOf(row: string): string {
  let run = ''
  for (let x = 0; x < row.length; ) {
    let length = 1
    while (row[x + length] === row[x]) length++
    run += length === 1 ? row[x] : `${length}${row[x]}`
    x += length
  }
  return run
}

/**
 * One row back from its runs. It stops a cell past the width the document
 * claims, so a count no grid could hold is a row `check()` reports too long
 * rather than a string nothing can allocate.
 */
function rowOf(run: string, width: number): string {
  let row = ''
  let count = 0
  for (const char of run) {
    if (char >= '0' && char <= '9') {
      count = count * 10 + Number(char)
      continue
    }
    row += char.repeat(Math.min(count || 1, width + 1 - row.length))
    count = 0
    if (row.length > width) break
  }
  return row
}
