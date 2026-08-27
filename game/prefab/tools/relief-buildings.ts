/**
 * Writes the committed pack's relief strip and records it in the manifest, with
 * no producer run: how a wall is shaped and how rough it is rides on no vertex
 * and touches no geometry, so it is one image and a version bump rather than
 * two minutes of baking.
 *
 *   node tools/relief-buildings.ts [--out pack]
 *
 * The strip has to line up with the colour strip layer for layer, so this
 * refuses a pack whose finishes are not the ones the looks name today. A look
 * added to or taken out of `looks/` needs `build-buildings.ts` first.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { CatalogueSchema, type CatalogueDoc } from '../src/catalogue.ts'
import { flag } from './args.ts'
import { COLOUR_SIZE, Layers } from './layers.ts'
import { loadLooks } from './look.ts'
import { serialise, VERSION } from './manifest.ts'
import { buildRelief } from './relief.ts'

const out = resolve(import.meta.dirname, '..', flag(process.argv.slice(2), '--out') ?? 'pack')
const file = join(out, 'buildings.json')

const read = JSON.parse(await readFile(file, 'utf8')) as CatalogueDoc
const named = Layers.of(loadLooks(resolve(import.meta.dirname, '../looks'))).names
const baked = read.atlas.finishes
if (named.length !== baked.length || named.some((name, at) => name !== baked[at])) {
  throw new Error(`the pack has to be rebuilt: its finishes are ${JSON.stringify(baked)}, the looks name ${JSON.stringify(named)}`)
}

const relief = await buildRelief(baked)
const manifest: CatalogueDoc = {
  ...read,
  version: VERSION,
  atlas: {
    ...read.atlas,
    relief: {
      size: COLOUR_SIZE,
      layers: relief.layers,
      sha256: createHash('sha256').update(relief.strip).digest('hex'),
      roughness: relief.roughness.map((value) => Number(value.toFixed(4))),
    },
  },
}

const checked = CatalogueSchema.safeParse(manifest)
if (!checked.success) throw new Error(`the manifest would not be one: ${checked.error.message}`)

await writeFile(join(out, 'buildings-relief.png'), relief.strip)
await writeFile(file, serialise(checked.data))

const roughest = relief.roughness.map((value, at) => `${baked[at]} ${value.toFixed(2)}`).join(', ')
console.log(`${relief.layers} relief layers, ${(relief.strip.length / 1024).toFixed(0)} kB, version ${VERSION}`)
console.log(`roughness: ${roughest}`)
