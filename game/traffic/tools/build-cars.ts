/**
 * Converts the Quaternius Realistic Car Pack (CC0) into the one file the game
 * loads for traffic. The pack ships OBJ, FBX and Blend, and nothing else here
 * reads those, so three.js parses the OBJ and writes glTF; gltf-transform then
 * does the compressing the rest of the art goes through.
 *
 * Run: node game/traffic/tools/build-cars.ts
 * Reads:  assets/src/quaternius-cars/... (GB_CAR_PACK overrides)
 * Writes: assets/dist/cars.glb           (GB_ASSETS_DIST overrides)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Scene } from 'three'
import { CARS_FILE, CAR_PARTS, partName } from '../src/pack-layout.ts'
import { CAR_MODELS } from '../src/settings.ts'
import { buildCar } from './car-source.ts'
import { writeGlb } from './glb.ts'

const ROOT = resolve(import.meta.dirname, '../../..')
const SOURCE =
  process.env['GB_CAR_PACK'] ??
  join(ROOT, 'assets/src/quaternius-cars/extracted/Realistic Car Pack - Nov 2018/OBJ')
const DIST = process.env['GB_ASSETS_DIST'] ?? join(ROOT, 'assets/dist')
mkdirSync(DIST, { recursive: true })

const output = join(DIST, CARS_FILE)
const working = join(DIST, 'cars.working.glb')

const run = (...args: string[]): void => {
  execFileSync('npx', ['gltf-transform', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
}

// one scene, one node per model, so seven cars are one request
const scene = new Scene()
scene.name = 'Cars'
const built = CAR_MODELS.map((model) => {
  const car = buildCar(model, SOURCE)
  scene.add(car.node)
  return { model, ...car }
})
await writeGlb(scene, working)

// spelled out rather than `optimize`, which joins meshes and flattens the graph;
// this pack is only useful while every car and every wheel is still its own node
run('dedup', working, working)
// OBJ is triangle soup: welding turns 62k loose corners back into shared vertices
run('weld', working, working)
run('prune', working, working)
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
    `${car.model.padEnd(11)} x${car.scale.toFixed(3)}  ${length.toFixed(2)} x ${width.toFixed(2)} x ${height.toFixed(2)} m` +
      `  wheel r ${car.wheelRadius.toFixed(2)} m  wheelbase ${car.wheelBase.toFixed(2)} m`,
  )
}
console.log(`${built.length} cars -> ${output} (${(statSync(output).size / 1e3).toFixed(0)} KB)`)
