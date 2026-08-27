/**
 * What a city of each size costs: how long it takes to build, how big its file
 * is, and how much there is to do in it. `pnpm run measure [seed] [sizes]`.
 */
import { Forge, OfflineNarrator } from '../src/index.ts'

const seed = process.argv[2] ?? 'measure'
const sizes = (process.argv[3] ?? '2,5,10,20').split(',').map(Number)
const theme = process.argv[4] ?? 'dusty western mining town'
/** Cells per block, when you want a size the default block will not fit inside the grid. */
const blockCells = process.argv[5] ? Number(process.argv[5]) : undefined

const row = (cells: string[]) => cells.map((cell, i) => (i ? cell.padStart(10) : cell.padEnd(8))).join('')
console.log(row(['blocks', 'grid', 'metres', 'walk min', 'avenues', 'buildings', 'open', 'people', 'things', 'quests', 'stations', 'build s', 'file MB']))

/** How many avenue bands the town was laid with, read off the graph the way another box reads it. */
function avenuesIn(roads: { nodes: { id: string; cell: { x: number; y: number } }[]; segments: { from: string; to: string; kind: string }[] }): number {
  const cellOf = (id: string) => roads.nodes.find((node) => node.id === id)!.cell
  const lines = new Set<string>()
  for (const segment of roads.segments) {
    if (segment.kind !== 'avenue') continue
    const from = cellOf(segment.from)
    const to = cellOf(segment.to)
    lines.add(from.y === to.y ? `row ${from.y}` : `column ${from.x}`)
  }
  return lines.size
}

for (const blocks of sizes) {
  const started = performance.now()
  const built = await new Forge(new OfflineNarrator(seed)).build({ theme, seed, blocksX: blocks, blocksY: blocks, ...(blockCells ? { blockCells } : {}) })
  if (!built.ok) {
    const why =
      built.error.code === 'invalid-brief'
        ? built.error.violations.map((one) => one.message).join('; ')
        : built.error.code === 'unsound-world'
          ? built.error.problems.map((one) => one.message).join('; ')
          : built.error.message
    console.log(`${`${blocks}x${blocks}`.padEnd(8)}refused: ${why}`)
    continue
  }
  const { world, quests } = built.value
  const across = world.grid.width * world.cellSize
  console.log(
    row([
      `${blocks}x${blocks}`,
      `${world.grid.width}x${world.grid.height}`,
      String(Math.round(across)),
      (across / 1.4 / 60).toFixed(1),
      String(avenuesIn(world.toJSON().roads)),
      String(world.plots().length),
      String(world.interiors().length),
      String(world.npcs().length),
      String(world.items().length),
      String(quests.length),
      String(world.stations().length),
      ((performance.now() - started) / 1000).toFixed(2),
      (JSON.stringify(world.toJSON()).length / 1e6).toFixed(3),
    ]),
  )
}
