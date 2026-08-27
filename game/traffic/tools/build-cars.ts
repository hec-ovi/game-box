/**
 * Builds the one file the game loads for traffic, out of two kinds of source:
 * the Quaternius Realistic Car Pack (CC0), which ships OBJ, FBX and Blend, and
 * single models the owner downloaded, fitted to a street car's budget by
 * `tools/fit-model.mjs` and staged under assets/src. three.js parses both and
 * writes glTF; gltf-transform then does the compressing the rest of the art
 * goes through.
 *
 * Run: node game/traffic/tools/build-cars.ts
 * Reads:  assets/src/quaternius-cars/...  (GB_CAR_PACK overrides)
 *         assets/src/<slug>/<model>.glb   (GB_ASSETS_SRC overrides the folder)
 * Writes: assets/dist/cars.glb            (GB_ASSETS_DIST overrides)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Scene } from 'three'
import { CARS_FILE, CAR_PARTS, partName } from '../src/pack-layout.ts'
import { CAR_MODELS } from '../src/settings.ts'
import { buildCar } from './car-source.ts'
import { buildStagedCar } from './car-glb.ts'
import { SOURCE_OF, stagedFile } from './car-sources.ts'
import { writeGlb } from './glb.ts'

const ROOT = resolve(import.meta.dirname, '../../..')
const STAGING = process.env['GB_ASSETS_SRC'] ?? join(ROOT, 'assets/src')
const QUATERNIUS =
  process.env['GB_CAR_PACK'] ?? join(STAGING, 'quaternius-cars/extracted/Realistic Car Pack - Nov 2018/OBJ')
const DIST = process.env['GB_ASSETS_DIST'] ?? join(ROOT, 'assets/dist')
mkdirSync(DIST, { recursive: true })

const output = join(DIST, CARS_FILE)
const working = join(DIST, 'cars.working.glb')

const run = (...args: string[]): void => {
  execFileSync('npx', ['gltf-transform', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
}

// one scene, one node per model, so the whole pack is one request
const scene = new Scene()
scene.name = 'Cars'
const built = []
for (const model of CAR_MODELS) {
  const source = SOURCE_OF[model]
  if (source.kind === 'obj') {
    built.push({ model, ...buildCar(model, QUATERNIUS) })
    continue
  }
  const file = stagedFile(source, STAGING)
  if (!existsSync(file)) {
    throw new Error(`build-cars: ${model} is staged at ${file}, which is not there. See assets/registry/sources.json.`)
  }
  built.push({ model, ...(await buildStagedCar(model, source, file)) })
}
for (const car of built) scene.add(car.node)
await writeGlb(scene, working)

// spelled out rather than `optimize`, which joins meshes and flattens the graph;
// this pack is only useful while every car and every wheel is still its own node
run('dedup', working, working)
// welding turns loose corners back into shared vertices, and now that the
// normals are real it only welds where the surface really is continuous, so the
// creases survive
run('weld', working, working)
// the colour attribute carries the surface as well as the colour, and nothing
// in the material says so, so prune must be told to leave the vertices alone
run('prune', working, working, '--keep-attributes', 'true')
run('meshopt', working, output, '--level', 'high')
rmSync(working)

// a car or a wheel the game cannot find by name is a car it cannot draw
const packed = nodeNames(output)
const wanted = CAR_MODELS.flatMap((model) => [model, ...Object.values(CAR_PARTS).map((part) => partName(model, part))])
const missing = wanted.filter((name) => !packed.has(name))
if (missing.length) throw new Error(`build-cars: the pack has no node for ${missing.join(', ')}`)

/** Every node name in a .glb, read out of its JSON chunk. */
function nodeNames(file: string): Set<string> {
  const glb = readFileSync(file)
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string }[] }
  return new Set(json.nodes.map((node) => node.name).filter((name) => name !== undefined))
}

for (const car of built) {
  const { length, width, height } = car.size
  console.log(
    `${car.model.padEnd(12)} x${car.scale.toFixed(3)}  ${length.toFixed(2)} x ${width.toFixed(2)} x ${height.toFixed(2)} m` +
      `  ${String(car.triangles).padStart(6)} tris  wheel r ${car.wheelRadius.toFixed(2)} m` +
      `  wheelbase ${car.wheelBase.toFixed(2)} m`,
  )
  for (const note of car.notes) console.log(`${' '.repeat(13)}${note}`)
}
const triangles = built.reduce((sum, car) => sum + car.triangles, 0)
console.log(
  `${built.length} cars -> ${output} (${(statSync(output).size / 1e3).toFixed(0)} KB), ` +
    `${Math.round(triangles / built.length)} triangles a car on average`,
)
