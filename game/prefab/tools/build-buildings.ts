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
import { flag } from './args.ts'
import type { CatalogueDoc } from '../src/catalogue.ts'
import { buildAtlas, swatchVerbs } from './atlas.ts'
import { balconyPieces } from './balconies.ts'
import { intake, type Baked } from './intake.ts'
import { ROOM_SIZE } from '../src/rooms.ts'
import { SCREEN_SIZE } from '../src/screens.ts'
import { COLOUR_SIZE, EMISSIVE_SIZE, Layers } from './layers.ts'
import { loadLooks, type Look } from './look.ts'
import { modelOf, PACK, serialise, VERSION } from './manifest.ts'
import { Producer } from './producer.ts'
import { buildRelief } from './relief.ts'
import { buildRooms } from './rooms.ts'
import { buildScreens } from './screens.ts'
import { drawTextures } from './textures.ts'
import { verbsFor } from './stack.ts'
import { verifyPack } from './verify.ts'
import { writePack } from './write.ts'

const args = process.argv.slice(2)
const jobs = Math.max(1, Number(flag(args, '--jobs') ?? 8))
const out = resolve(import.meta.dirname, '..', flag(args, '--out') ?? 'pack')
const looksFolder = resolve(import.meta.dirname, '../looks')

const homes = join(tmpdir(), `gb-prefab-${process.pid}`)
await mkdir(homes, { recursive: true })

try {
  const looks = loadLooks(looksFolder)
  const layers = Layers.of(looks)
  const producer = Producer.at(homes)
  const buckets = everyBucket()
  console.log(`${looks.length} looks x ${buckets.length} shapes = ${looks.length * buckets.length} models, ${jobs} at a time`)

  const textures = await drawTextures(producer, homes, looks)
  const swatches = new Map<string, string>()
  for (const look of looks) {
    const built = await producer.build(`swatch-${look.id}`, swatchVerbs('gb'), 'gb', textures.get(look.id))
    swatches.set(look.id, built.file)
  }
  const atlas = await buildAtlas(looks, swatches, layers)
  const relief = await buildRelief(layers.names)
  const rooms = await buildRooms()
  const screens = await buildScreens()
  console.log(
    `atlas: ${atlas.layers} layers, ${(atlas.colour.length / 1024) | 0} kB colour, ${(atlas.emissive.length / 1024) | 0} kB glow, ` +
      `${rooms.layers} rooms, ${(rooms.strip.length / 1024) | 0} kB, ${screens.layers} screens, ${(screens.strip.length / 1024) | 0} kB`,
  )

  const started = Date.now()
  const jobsList = looks.flatMap((look) => buckets.map((bucket) => ({ look, bucket })))
  const baked = await pool(jobsList, jobs, async ({ look, bucket }) => bake(producer, look, bucket, textures.get(look.id)!, layers))
  const seconds = (Date.now() - started) / 1000

  const models = baked.map(({ look, bucket, model }) => modelOf(look, bucket, model.id, model.triangles))

  const mesh = await writePack(baked.map((one) => one.model))
  await verifyPack(mesh, new Map(baked.map(({ bucket, model }) => [model.id, bucket])), layers.names)
  const manifest: CatalogueDoc = {
    pack: PACK,
    version: VERSION,
    sha256: createHash('sha256').update(mesh).digest('hex'),
    producer: await producer.version(),
    atlas: {
      colour: { size: COLOUR_SIZE, layers: layers.count, sha256: createHash('sha256').update(atlas.colour).digest('hex') },
      emissive: { size: EMISSIVE_SIZE, layers: layers.count, sha256: createHash('sha256').update(atlas.emissive).digest('hex') },
      rooms: { size: ROOM_SIZE, layers: rooms.layers, sha256: createHash('sha256').update(rooms.strip).digest('hex') },
      screens: { size: SCREEN_SIZE, layers: screens.layers, sha256: createHash('sha256').update(screens.strip).digest('hex') },
      relief: {
        size: COLOUR_SIZE,
        layers: relief.layers,
        sha256: createHash('sha256').update(relief.strip).digest('hex'),
        roughness: relief.roughness.map((value) => Number(value.toFixed(4))),
      },
      finishes: [...layers.names],
    },
    models,
  }

  await mkdir(out, { recursive: true })
  await writeFile(join(out, 'buildings.glb'), mesh)
  await writeFile(join(out, 'buildings-colour.png'), atlas.colour)
  await writeFile(join(out, 'buildings-emissive.png'), atlas.emissive)
  await writeFile(join(out, 'buildings-rooms.png'), rooms.strip)
  await writeFile(join(out, 'buildings-screens.png'), screens.strip)
  await writeFile(join(out, 'buildings-relief.png'), relief.strip)
  await writeFile(join(out, 'buildings.json'), serialise(manifest))

  const triangles = models.reduce((sum, model) => sum + model.triangles, 0)
  const trimmed = baked.reduce((sum, one) => sum + one.model.trimmed, 0)
  console.log(
    [
      `${models.length} models, ${triangles} triangles (${Math.round(triangles / models.length)} each), ${trimmed} parts trimmed above the plot`,
      `mesh ${(mesh.length / 1024).toFixed(0)} kB, colour ${(atlas.colour.length / 1024).toFixed(0)} kB, glow ${(atlas.emissive.length / 1024).toFixed(0)} kB, ` +
        `rooms ${(rooms.strip.length / 1024).toFixed(0)} kB, screens ${(screens.strip.length / 1024).toFixed(0)} kB, relief ${(relief.strip.length / 1024).toFixed(0)} kB`,
      `built in ${seconds.toFixed(0)}s`,
      `sha256 ${manifest.sha256}`,
    ].join('\n'),
  )
} finally {
  await rm(homes, { recursive: true, force: true })
}

async function bake(producer: Producer, look: Look, bucket: Bucket, textures: string, layers: Layers): Promise<{ look: Look; bucket: Bucket; model: Baked }> {
  const id = `${look.id}-${bucket.front}x${bucket.depth}x${bucket.storeys}`
  const built = await producer.build(id, verbsFor(look, bucket, 'gb'), 'gb', textures)
  try {
    return { look, bucket, model: await intake(built.file, id, bucket, look, layers, balconyPieces(look, bucket, layers)) }
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

