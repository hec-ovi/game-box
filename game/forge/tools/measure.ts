/**
 * What a city of each size costs: how long it takes to build, how big its file
 * is, and how much there is to do in it. `pnpm run measure [seed] [sizes]`.
 */
import { Forge, OfflineNarrator } from '../src/index.ts'

const seed = process.argv[2] ?? 'measure'
const sizes = (process.argv[3] ?? '2,5,10,20').split(',').map(Number)
const theme = process.argv[4] ?? 'dusty western mining town'

const row = (cells: string[]) => cells.map((cell, i) => (i ? cell.padStart(11) : cell.padEnd(8))).join('')
console.log(row(['blocks', 'grid', 'metres', 'walk min', 'buildings', 'open', 'people', 'quests', 'build s', 'file MB']))

for (const blocks of sizes) {
  const started = performance.now()
  const built = await new Forge(new OfflineNarrator(seed)).build({ theme, seed, blocksX: blocks, blocksY: blocks })
  if (!built.ok) {
    const why = built.error.code === 'invalid-brief' ? built.error.violations : built.error.problems
    console.log(`${`${blocks}x${blocks}`.padEnd(8)}refused: ${why.map((one) => one.message).join('; ')}`)
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
      String(world.plots().length),
      String(world.interiors().length),
      String(world.npcs().length),
      String(quests.length),
      ((performance.now() - started) / 1000).toFixed(2),
      (JSON.stringify(world.toJSON()).length / 1e6).toFixed(2),
    ]),
  )
}
