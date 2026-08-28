/**
 * What the skyline of a city actually is: how tall its buildings stand, how
 * many of them clear the band the catalogue is drawn for, and how the heights
 * fall from the middle of town out to the edge. The numbers in CONTRACT.md come
 * from here. It plans the cities rather than building them, which is the same
 * architecture and needs no narrator.
 *
 *   node game/forge/tools/skyline.ts [--blocks 20] [--density 0.8] [--storeys 24] [--seeds metro,harbour,kite]
 */
import { PLOT_BAND, plotShape, type World } from '@gb/world'
import { Forge } from '../src/index.ts'
import { nearnessIn } from '../src/layout/plots.ts'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}
const blocks = Number(flag('--blocks') ?? 20)
const density = flag('--density')
const maxStoreys = flag('--storeys')
const seeds = (flag('--seeds') ?? 'metro,harbour,kite').split(',')

/** The three rings the height field is built out of, by how near the middle of town a plot stands. */
const RINGS = [
  { name: 'core   ', from: 0.72 },
  { name: 'ring   ', from: 0.3 },
  { name: 'edge   ', from: 0 },
] as const

function report(seed: string, world: World): void {
  const plots = world.plots().map((plot) => ({ storeys: plot.storeys, near: nearnessIn(world.grid, plot.entrance.cell) }))
  const towers = plots.filter((plot) => plot.storeys > PLOT_BAND.storeys.max)
  const widest = Math.max(...world.plots().map((plot) => plotShape(plot).frontage))
  const extra = towers.reduce((sum, one) => sum + one.storeys - PLOT_BAND.storeys.max, 0)

  console.log(
    `${seed}: ${plots.length} plots, ${towers.length} raised (${((towers.length / plots.length) * 100).toFixed(1)}%), tallest ${Math.max(...plots.map((one) => one.storeys))} storeys, ` +
      `${extra.toLocaleString('en-GB')} storeys over the band, widest frontage ${widest}`,
  )
  console.log(`  all    ${histogram(plots)}`)
  for (const [at, ring] of RINGS.entries()) {
    const to = RINGS[at - 1]?.from ?? Infinity
    const held = plots.filter((plot) => plot.near >= ring.from && plot.near < to)
    if (held.length) console.log(`  ${ring.name}${histogram(held)}`)
  }
}

/** How many buildings of each height, with the median and the mean the owner counts in. */
function histogram(plots: readonly { storeys: number }[]): string {
  const counts = new Map<number, number>()
  for (const plot of plots) counts.set(plot.storeys, (counts.get(plot.storeys) ?? 0) + 1)
  const sorted = plots.map((plot) => plot.storeys).sort((a, b) => a - b)
  const mean = sorted.reduce((sum, one) => sum + one, 0) / sorted.length
  const median = sorted[Math.floor(sorted.length / 2)]
  return (
    `${sorted.length} plots, mean ${mean.toFixed(1)}, median ${median}: ` +
    [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([storeys, n]) => `${storeys}:${n}`)
      .join(' ')
  )
}

for (const seed of seeds) {
  const planned = Forge.plan({
    theme: 'a neon port city',
    seed,
    blocksX: blocks,
    blocksY: blocks,
    ...(density ? { density: Number(density) } : {}),
    ...(maxStoreys ? { maxStoreys: Number(maxStoreys) } : {}),
  })
  if (!planned.ok) throw new Error(`the forge refused ${seed}: ${JSON.stringify(planned.error).slice(0, 300)}`)
  report(seed, planned.value)
}
