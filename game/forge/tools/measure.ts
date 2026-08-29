/**
 * What a brief costs, size by size. It plans the cities rather than building
 * them, which is the same architecture and needs no engine: the buildings, the
 * streets, the time and the file are all the plan's. Where the trains board is
 * not: a station is a kind of place, so what a size of town shows here is how
 * many entrances it asks the writing for.
 *
 *   node game/forge/tools/measure.ts [seed] [blocks,blocks,...] [theme] [blockCells]
 */
import { Forge } from '../src/index.ts'
import { townNeeds } from '../src/interior/needs.ts'
import { streetLines } from '../src/layout/lines.ts'

const [seed = 'measure', sizes = '2,10,20,32,50', theme = 'a rain-soaked port city', blockCells] = process.argv.slice(2)

console.log('| blocks | grid | metres | avenues | buildings | boarding wanted | plan | world file |')
console.log('|---|---|---|---|---|---|---|---|')

for (const blocks of sizes.split(',').map(Number)) {
  const started = performance.now()
  const laid = Forge.plan({ theme, seed, blocksX: blocks, blocksY: blocks, ...(blockCells ? { blockCells: Number(blockCells) } : {}) })
  const took = performance.now() - started
  if (!laid.ok) {
    console.log(`| ${blocks}x${blocks} | refused: ${JSON.stringify(laid.error).slice(0, 80)} |`)
    continue
  }
  const world = laid.value
  const lines = streetLines(world)
  const avenues = [...lines.columns, ...lines.rows].filter((line) => line.kind === 'avenue').length
  const file = JSON.stringify(world.toJSON()).length
  const boards =
    townNeeds({ places: 3, span: Math.max(world.grid.width, world.grid.height) * world.cellSize, charters: world.charters() }).find((need) =>
      need.wants.includes('trains'),
    )?.count ?? 0
  console.log(
    `| ${blocks}x${blocks} | ${world.grid.width}x${world.grid.height} | ${Math.round(world.grid.width * world.cellSize).toLocaleString('en-GB')} | ${avenues} | ` +
      `${world.plots().length.toLocaleString('en-GB')} | ${boards} | ${(took / 1000).toFixed(2)} s | ${(file / 1e6).toFixed(2)} MB |`,
  )
}
