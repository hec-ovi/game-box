/**
 * What a pack costs at each city size: how much of the file is the grid, how
 * many cells the growth changed, and how long cutting and applying take.
 * `pnpm run measure [blocks] [blockCells]`, repeated per size.
 *
 * The towns are laid out and grown by the same harness the tests use
 * (`tests/town.ts`), so the numbers are of a real document and no model is in
 * the room. Every row grows by the same twenty opened buildings, so what moves
 * between rows is the grid.
 */
import { cellRows, World } from '@gb/world'
import { Bundle, Pack } from '../src/index.ts'
import { errand, grow, laidOut } from '../tests/town.ts'

const ART = [{ pack: 'kenney-city', version: '1.0.0' }]
const GROWTH = { buildings: 20, has: { anchors: 3, people: 2, things: 3 } }
const sizes = (process.argv[2] ?? '3,20,116').split(',').map(Number)
const cells = (process.argv[3] ?? '14,,6').split(',').map((one) => (one ? Number(one) : undefined))

const kb = (value: unknown) => (JSON.stringify(value).length / 1024).toFixed(1)
const row = (parts: string[]) => parts.map((part, i) => (i ? part.padStart(12) : part.padEnd(14))).join('')
console.log(row(['blocks', 'grid', 'world KB', 'picture KB', 'runs KB', 'pack cells', 'pack KB', 'cut ms', 'apply ms']))

for (const [at, blocks] of sizes.entries()) {
  const world = laidOut(`pack-${blocks}`, { blocks, ...(cells[at] === undefined ? {} : { blockCells: cells[at] }) })
  const [place] = grow(world, 1, GROWTH.has)
  const quests = [errand('quest_0001', 'The thing on the shelf', place!)]

  const sealed = await Bundle.open(await Bundle.pack(world, quests, { requires: ART }), ART)
  if (!sealed.ok) throw new Error(JSON.stringify(sealed.error).slice(0, 300))
  const doc = sealed.value.world.toJSON()
  const picture = cellRows(doc.grid)

  // the growth is written onto the base's own document, the way a caller grows
  // a city they opened rather than the one they still had in hand
  const loaded = World.load(doc)
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error).slice(0, 300))
  const added = grow(loaded.value, GROWTH.buildings, GROWTH.has)
  const extended = { world: loaded.value, quests: [...quests, errand('quest_0002', 'The thing in the new place', added[0]!)] }

  const cutting = performance.now()
  const pack = await Pack.cut(sealed.value, extended)
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
