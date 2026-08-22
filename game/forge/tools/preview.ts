/** Prints a generated town to the terminal: the grid, its places and its first quest. */
import { Forge, OfflineNarrator } from '../src/index.ts'

const forge = new Forge(new OfflineNarrator('preview'))
const built = await forge.build({ theme: 'dusty western mining town', seed: 'preview', blocksX: 2, blocksY: 2, blockCells: 14 })
if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 500))
const { world, quests, rejected } = built.value

console.log(`${world.name} (${world.theme})  ${world.grid.width}x${world.grid.height} cells @ ${world.cellSize}m`)
for (const row of world.grid.rows()) console.log(row)
console.log(`\nplots ${world.plots().length}  npcs ${world.npcs().length}  items ${world.items().length}  quests ${quests.length} (rejected ${rejected.length})`)
console.log('\nplaces:')
for (const p of world.plots().slice(0, 10)) {
  const people = world.npcsIn(p.id).map((n) => `${n.name} (${n.role})`).join(', ')
  console.log(`  ${p.kind.padEnd(10)} ${p.name.padEnd(24)} ${p.storeys}st  ${p.rect.w * 2}x${p.rect.h * 2}m  ${people}`)
}
console.log('\nquest:', quests[0]?.title)
for (const s of quests[0]?.steps ?? []) console.log(`   ${s.kind.padEnd(9)} ${s.objective}`)
