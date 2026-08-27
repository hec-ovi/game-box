/**
 * Writes the committed pack's two picture strips from a theme pack and records
 * them in the manifest, with no producer run: what a window shows and what a
 * screen carries ride on no vertex and touch no geometry, so a new theme is two
 * images and a version bump rather than two minutes of baking.
 *
 *   node tools/theme-buildings.ts [--theme themes/gb] [--out pack]
 *
 * Everything else in the manifest is kept as read. The mesh, the finishes and
 * the relief are the producer's, and this refuses to touch them: a look added
 * to or taken out of `looks/` still needs `build-buildings.ts`.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { CatalogueSchema, type CatalogueDoc } from '../src/catalogue.ts'
import { ROOM_SIZE } from '../src/rooms.ts'
import { SCREEN_SIZE } from '../src/screens.ts'
import { flag } from './args.ts'
import { serialise, VERSION } from './manifest.ts'
import { buildScreens } from './screens.ts'
import { buildGlazing, ThemePack } from './theme.ts'

const args = process.argv.slice(2)
const out = resolve(import.meta.dirname, '..', flag(args, '--out') ?? 'pack')
const themed = flag(args, '--theme')
const file = join(out, 'buildings.json')

const read = JSON.parse(await readFile(file, 'utf8')) as CatalogueDoc
const theme = await ThemePack.at(themed ? resolve(themed) : undefined)
const glazing = await buildGlazing(theme, ROOM_SIZE)
const screens = await buildScreens(theme)

const manifest: CatalogueDoc = {
  ...read,
  version: VERSION,
  atlas: {
    ...read.atlas,
    rooms: { size: ROOM_SIZE, layers: glazing.layers, sha256: createHash('sha256').update(glazing.strip).digest('hex'), ...theme.plan.strip },
    screens: { size: SCREEN_SIZE, layers: screens.layers, sha256: createHash('sha256').update(screens.strip).digest('hex') },
  },
}

const checked = CatalogueSchema.safeParse(manifest)
if (!checked.success) throw new Error(`the manifest would not be one: ${checked.error.message}`)

await writeFile(join(out, 'buildings-rooms.png'), glazing.strip)
await writeFile(join(out, 'buildings-screens.png'), screens.strip)
await writeFile(file, serialise(checked.data))

const { rooms, panels, faces } = theme.plan.strip
console.log(`theme ${theme.doc.theme} ${theme.doc.version}, version ${VERSION}`)
console.log(
  `  ${glazing.layers} glazing layers, ${(glazing.strip.length / 1024).toFixed(0)} kB: ` +
    `rooms upper ${run(rooms.upper)} street ${run(rooms.street)}, panels upper ${run(panels.upper)} street ${run(panels.street)}, ` +
    `faces ${faces.floor}, ${faces.ceiling}, ${faces.side}, ${faces.sideAlt}`,
)
console.log(`  ${screens.layers} screens, ${(screens.strip.length / 1024).toFixed(0)} kB`)

function run(bank: { first: number; count: number }): string {
  return `${bank.first}..${bank.first + bank.count - 1}`
}
