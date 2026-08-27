import type { CellKind, Grid, Rect } from '@gb/world'

/**
 * The grid, as few rectangles as cover it.
 *
 * A twenty block city is about three hundred thousand cells, and a quad per
 * cell is a quarter of a million quads for ground nobody looks closely at. The
 * cells of one kind tile into long runs (an avenue is one strip a hundred cells
 * long), so they are merged: each run along a row is grown down as far as the
 * rows under it match, and what comes out is a few hundred rectangles for the
 * whole roadway.
 */
export function patchesOf(grid: Grid, kind: CellKind): Rect[] {
  const { width, height } = grid
  const taken = new Uint8Array(width * height)
  const patches: Rect[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (taken[y * width + x] || grid.at(x, y) !== kind) continue
      let right = x
      while (right + 1 < width && !taken[y * width + right + 1] && grid.at(right + 1, y) === kind) right++
      let bottom = y
      while (bottom + 1 < height && rowMatches(grid, taken, x, right, bottom + 1, kind)) bottom++
      for (let row = y; row <= bottom; row++) taken.fill(1, row * width + x, row * width + right + 1)
      patches.push({ x, y, w: right - x + 1, h: bottom - y + 1 })
    }
  }
  return patches
}

/** Whether the whole stretch of that row is the same kind and still free. */
function rowMatches(grid: Grid, taken: Uint8Array, from: number, to: number, y: number, kind: CellKind): boolean {
  for (let x = from; x <= to; x++) {
    if (taken[y * grid.width + x] || grid.at(x, y) !== kind) return false
  }
  return true
}
