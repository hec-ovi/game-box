/**
 * What a pack costs at each city size: how much of the file is the grid, how
 * many cells the growth changed, and how long cutting and applying take.
 * `pnpm run measure [blocks] [blockCells]`, repeated per size.
 */
import { Forge, OfflineNarrator } from '@gb/forge'
import { cellRows } from '@gb/world'
import { Bundle, Pack } from '../src/index.ts'

const ART = [{ pack: 'kenney-city', version: '1.0.0' }]
const sizes = (process.argv[2] ?? '3,20,116').split(',').map(Number)
const cells = (process.argv[3] ?? '14,,6').split(',').map((one) => (one ? Number(one) : undefined))

const kb = (value: unknown) => (JSON.stringify(value).length / 1024).toFixed(1)
const row = (parts: string[]) => parts.map((part, i) => (i ? part.padStart(12) : part.padEnd(14))).join('')
console.log(row(['blocks', 'grid', 'world KB', 'picture KB', 'runs KB', 'pack cells', 'pack KB', 'cut ms', 'apply ms']))

for (const [at, blocks] of sizes.entries()) {
  const seed = `pack-${blocks}`
  const forge = new Forge(new OfflineNarrator(seed))
  const built = await forge.build({ theme: 'harbour town', seed, blocksX: blocks, blocksY: blocks, blockCells: cells[at], density: 0.5 })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 300))

  const sealed = await Bundle.open(await Bundle.pack(built.value.world, built.value.quests, { requires: ART }), ART)
  if (!sealed.ok) throw new Error(JSON.stringify(sealed.error).slice(0, 300))
  const doc = built.value.world.toJSON()
  const picture = cellRows(doc.grid)

  const growth = await forge.extend(built.value.world, 30)
  if (!growth.ok) throw new Error(JSON.stringify(growth.error).slice(0, 300))

  const cutting = performance.now()
  const pack = await Pack.cut(sealed.value, { world: built.value.world, quests: built.value.quests })
  const cutMs = performance.now() - cutting
  if (!pack.ok) throw new Error(JSON.stringify(pack.error).slice(0, 300))

  const applying = performance.now()
  const applied = await Pack.apply(sealed.value, JSON.parse(JSON.stringify(pack.value)), ART)
  const applyMs = performance.now() - applying
  if (!applied.ok) throw new Error(JSON.stringify(applied.error).slice(0, 300))

  console.log(
    row([
      `${blocks}x${blocks}${cells[at] ? ` of ${cells[at]}` : ''}`,
      `${doc.grid.width}x${doc.grid.height}`,
      kb(doc),
      kb(picture),
      kb(doc.grid),
      String(pack.value.world.cells.length),
      kb(pack.value),
      cutMs.toFixed(0),
      applyMs.toFixed(0),
    ]),
  )
}
