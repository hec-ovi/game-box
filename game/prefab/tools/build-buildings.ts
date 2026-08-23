/**
 * Builds the committed building pack: every authored look, replayed at every
 * footprint the city cuts, through the owner's `glb-buildings` CLI.
 *
 *   node tools/build-buildings.ts [--jobs 8] [--out pack]
 *
 * Nothing in the game runs this. It is the offline half of the design: a model
 * writes the looks by hand, once, and this turns them into the bytes that ship.
 * The producer lives outside this repo; point `GLB_BUILDINGS` at it or keep it
 * beside the checkout.
 */
import { createHash } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { everyBucket, type Bucket } from '../src/bucket.ts'
import type { CatalogueDoc, ModelSpec } from '../src/catalogue.ts'
import { buildAtlas, swatchVerbs } from './atlas.ts'
import { intake, type Baked } from './intake.ts'
import { COLOUR_SIZE, EMISSIVE_SIZE, LAYERS } from './layers.ts'
import { FAMILIES, loadLooks, type Family, type Look } from './look.ts'
import { Producer } from './producer.ts'
import { drawTextures } from './textures.ts'
import { verbsFor } from './stack.ts'
import { verifyPack } from './verify.ts'
import { writePack } from './write.ts'

const PACK = 'gb-buildings'
const VERSION = '1.0.0'

const args = process.argv.slice(2)
const jobs = Math.max(1, Number(flag('--jobs') ?? 8))
const out = resolve(import.meta.dirname, '..', flag('--out') ?? 'pack')
const looksFolder = resolve(import.meta.dirname, '../looks')

const homes = join(tmpdir(), `gb-prefab-${process.pid}`)
await mkdir(homes, { recursive: true })

try {
  const looks = loadLooks(looksFolder)
  const producer = Producer.at(homes)
  const buckets = everyBucket()
  console.log(`${looks.length} looks x ${buckets.length} shapes = ${looks.length * buckets.length} models, ${jobs} at a time`)

  const textures = await drawTextures(producer, homes)
  const swatches = new Map<Family, string>()
  for (const family of FAMILIES) {
    const built = await producer.build(`swatch-${family}`, swatchVerbs(`gb-family-${family}`), `gb-family-${family}`, textures.get(family))
    swatches.set(family, built.file)
  }
  const atlas = await buildAtlas(swatches)
  console.log(`atlas: ${atlas.layers} layers, ${(atlas.colour.length / 1024) | 0} kB colour, ${(atlas.emissive.length / 1024) | 0} kB glow`)

  const started = Date.now()
  const jobsList = looks.flatMap((look) => buckets.map((bucket) => ({ look, bucket })))
  const baked = await pool(jobsList, jobs, async ({ look, bucket }) => bake(producer, look, bucket, textures.get(look.family)!))
  const seconds = (Date.now() - started) / 1000

  const models: ModelSpec[] = baked.map(({ look, bucket, model }) => ({
    id: model.id,
    look: look.id,
    front: bucket.front,
    depth: bucket.depth,
    storeys: bucket.storeys,
    kinds: [...look.kinds],
    triangles: model.triangles,
    door: { along: 0 },
  }))

  const mesh = await writePack(baked.map((one) => one.model))
  await verifyPack(mesh, new Map(baked.map(({ bucket, model }) => [model.id, bucket])))
  const manifest: CatalogueDoc = {
    pack: PACK,
    version: VERSION,
    sha256: createHash('sha256').update(mesh).digest('hex'),
    producer: await producer.version(),
    atlas: {
      colour: { size: COLOUR_SIZE, layers: LAYERS.length, sha256: createHash('sha256').update(atlas.colour).digest('hex') },
      emissive: { size: EMISSIVE_SIZE, layers: LAYERS.length, sha256: createHash('sha256').update(atlas.emissive).digest('hex') },
    },
    models,
  }

  await mkdir(out, { recursive: true })
  await writeFile(join(out, 'buildings.glb'), mesh)
  await writeFile(join(out, 'buildings-colour.png'), atlas.colour)
  await writeFile(join(out, 'buildings-emissive.png'), atlas.emissive)
  await writeFile(join(out, 'buildings.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  const triangles = models.reduce((sum, model) => sum + model.triangles, 0)
  const trimmed = baked.reduce((sum, one) => sum + one.model.trimmed, 0)
  console.log(
    [
      `${models.length} models, ${triangles} triangles (${Math.round(triangles / models.length)} each), ${trimmed} parts trimmed above the plot`,
      `mesh ${(mesh.length / 1024).toFixed(0)} kB, colour ${(atlas.colour.length / 1024).toFixed(0)} kB, glow ${(atlas.emissive.length / 1024).toFixed(0)} kB`,
      `built in ${seconds.toFixed(0)}s`,
      `sha256 ${manifest.sha256}`,
    ].join('\n'),
  )
} finally {
  await rm(homes, { recursive: true, force: true })
}

async function bake(producer: Producer, look: Look, bucket: Bucket, textures: string): Promise<{ look: Look; bucket: Bucket; model: Baked }> {
  const id = `${look.id}-${bucket.front}x${bucket.depth}x${bucket.storeys}`
  const built = await producer.build(id, verbsFor(look, bucket, 'gb'), 'gb', textures)
  try {
    return { look, bucket, model: await intake(built.file, id, bucket, look.family) }
  } finally {
    await built.sweep()
  }
}

/** A fixed number of builds in flight. The producer is a subprocess, so this is what fills the box. */
async function pool<In, Out>(items: readonly In[], width: number, work: (item: In) => Promise<Out>): Promise<Out[]> {
  const out = new Array<Out>(items.length)
  let next = 0
  let done = 0
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      for (let at = next++; at < items.length; at = next++) {
        out[at] = await work(items[at]!)
        if (++done % 50 === 0) process.stdout.write(`  ${done}/${items.length}\r`)
      }
    }),
  )
  return out
}

function flag(name: string): string | undefined {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}
