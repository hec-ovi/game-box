/**
 * Rewrites what every model in the committed pack suits, from the looks, with
 * no producer run: a look's tags are manifest metadata and touch none of the
 * five binaries, so changing which charters a look claims is this and a
 * version bump rather than two minutes of baking.
 *
 *   node tools/retag-buildings.ts [--out pack]
 *
 * Everything else in the manifest is kept as read, models in the order the
 * build wrote them. A look added to or taken out of `looks/` needs
 * `build-buildings.ts`, and this refuses to paper over either.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { CatalogueSchema, type ModelSpec } from '../src/catalogue.ts'
import { flag } from './args.ts'
import { loadLooks } from './look.ts'
import { modelOf, serialise, VERSION } from './manifest.ts'

const file = join(resolve(import.meta.dirname, '..', flag(process.argv.slice(2), '--out') ?? 'pack'), 'buildings.json')

const looks = new Map(loadLooks(resolve(import.meta.dirname, '../looks')).map((look) => [look.id, look]))
const read = JSON.parse(await readFile(file, 'utf8')) as { models: Array<Omit<ModelSpec, 'tags'>> }

const baked = new Set(read.models.map((model) => model.look))
const unbaked = [...looks.keys()].filter((id) => !baked.has(id))
const gone = [...baked].filter((id) => !looks.has(id))
if (unbaked.length || gone.length) {
  throw new Error(`the pack has to be rebuilt: looks with no models ${JSON.stringify(unbaked)}, models with no look ${JSON.stringify(gone)}`)
}

const models = read.models.map((model) => modelOf(looks.get(model.look)!, model, model.id, model.triangles))
const checked = CatalogueSchema.safeParse({ ...read, version: VERSION, models })
if (!checked.success) throw new Error(`the manifest would not be one: ${checked.error.message}`)
await writeFile(file, serialise(checked.data))
console.log(`${models.length} models retagged from ${looks.size} looks, version ${VERSION}, written to ${file}`)
