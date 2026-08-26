/**
 * What the skyline of a city actually is: how many plots are raised past the
 * band the building catalogue is drawn for, how tall they get, and where they
 * stand. The numbers in CONTRACT.md come from here.
 *
 *   node game/forge/tools/skyline.ts [--blocks 20] [--density 0.8] [--storeys 24] [--seeds metro,harbour,kite]
 */
import { PLOT_BAND, plotShape, type World } from '@gb/world'
import { Forge, OfflineNarrator } from '../src/index.ts'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}
const blocks = Number(flag('--blocks') ?? 20)
const density = flag('--density')
const maxStoreys = flag('--storeys')
const seeds = (flag('--seeds') ?? 'metro,harbour,kite').split(',')

for (const seed of seeds) {
  const built = await new Forge(new OfflineNarrator(seed)).build({
    theme: 'a neon port city',
    seed,
    blocksX: blocks,
    blocksY: blocks,
    ...(density ? { density: Number(density) } : {}),
    ...(maxStoreys ? { maxStoreys: Number(maxStoreys) } : {}),
  })
  if (!built.ok) throw new Error(`the forge refused ${seed}: ${JSON.stringify(built.error).slice(0, 300)}`)
  report(seed, built.value.world)
}

function report(seed: string, world: World): void {
  const plots = world.plots()
  const towers = plots.filter((plot) => plot.storeys > PLOT_BAND.storeys.max)
  const counts = new Map<number, number>()
  for (const plot of plots) counts.set(plot.storeys, (counts.get(plot.storeys) ?? 0) + 1)
  const middle = { x: world.grid.width / 2, y: world.grid.height / 2 }
  const out = (list: typeof plots) => list.reduce((sum, one) => sum + Math.hypot(one.entrance.cell.x - middle.x, one.entrance.cell.y - middle.y), 0) / (list.length || 1)
  const widest = Math.max(...plots.map((plot) => plotShape(plot).frontage))

  console.log(
    `${seed}: ${plots.length} plots, ${towers.length} raised (${((towers.length / plots.length) * 100).toFixed(1)}%), tallest ${Math.max(...plots.map((plot) => plot.storeys))} storeys, ` +
      `${out(towers).toFixed(0)} cells from the middle against ${out(plots).toFixed(0)}, widest frontage ${widest}`,
  )
  console.log(`  ${[...counts.entries()].sort((a, b) => a[0] - b[0]).map(([storeys, n]) => `${storeys}:${n}`).join(' ')}`)
}
