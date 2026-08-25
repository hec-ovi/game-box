/**
 * What a forged town costs on the shipped pack, measured headless in Node:
 * the batches `@gb/scene` draws the buildings in (one draw each) and the
 * triangles a prefab building carries on each of its materials.
 *
 *   node tools/measure-city.ts [--seed metro] [--blocks 4]
 */
import { Forge, OfflineNarrator } from '@gb/forge'
import { CityNight } from '@gb/kitbash'
import { Greybox, buildCity, storeyHeight } from '@gb/scene'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { Catalogue } from '../src/catalogue.ts'
import { PrefabDressing } from '../src/dressing.ts'
import { Library } from '../src/library.ts'
import { designFor } from '../src/pin.ts'
import { ROOM_PICTURES } from '../src/rooms.ts'
import { SCREEN_PICTURES } from '../src/screens.ts'
import { flag } from './args.ts'

const args = process.argv.slice(2)
const seed = flag(args, '--seed') ?? 'metro'
const blocks = Number(flag(args, '--blocks') ?? 4)

const pack = new URL('../pack/', import.meta.url)
const catalogue = await Catalogue.read(new Uint8Array(readFileSync(new URL('buildings.json', pack))))
const mesh = readFileSync(new URL('buildings.glb', pack))
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(mesh.buffer.slice(mesh.byteOffset, mesh.byteOffset + mesh.byteLength), '')

// the strips are not read here: a layer of grey stands in for each, since only the geometry is measured
const layers = (count: number) => new THREE.DataArrayTexture(new Uint8Array(4 * 4 * count * 4).fill(128), 4, 4, count)
const finishes = catalogue.atlas.finishes
const atlas = { colour: layers(finishes.length), emissive: layers(finishes.length), rooms: layers(ROOM_PICTURES.length), screens: layers(SCREEN_PICTURES.length), finishes }
const library = Library.of({ catalogue, scenes: gltf.scenes, atlas, night: new CityNight() })
const dressing = new PrefabDressing(library, new Greybox())

const built = await new Forge(new OfflineNarrator(seed)).build({ theme: 'a neon port city', seed, blocksX: blocks, blocksY: blocks, density: 1, maxStoreys: 4 })
if (!built.ok) throw new Error(`the forge refused: ${JSON.stringify(built.error)}`)
const world = built.value.world
const city = buildCity(world, dressing)

const triangles = new Map<string, number>()
let plots = 0
let prefab = 0
for (const plot of world.plots()) {
  plots++
  const charter = world.charter(plot.kind)!
  const size = { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: storeyHeight(plot.storeys) }
  if (!designFor(catalogue, plot, size, charter.suits)) continue
  prefab++
  dressing.building(plot, size, charter).traverse((child) => {
    const one = child as THREE.Mesh
    if (!one.isMesh) return
    const material = (one.material as THREE.Material).name
    triangles.set(material, (triangles.get(material) ?? 0) + (one.geometry.getIndex()?.count ?? one.geometry.getAttribute('position').count) / 3)
  })
}

console.log(`pack ${catalogue.version}, ${blocks} by ${blocks} blocks, ${plots} plots, ${prefab} on the pack`)
console.log(`batches: ${city.root.children.filter((child) => (child as THREE.BatchedMesh).isBatchedMesh).map((child) => child.name).join(', ')}`)
for (const [material, count] of triangles) console.log(`${material}: ${(count / prefab).toFixed(1)} triangles a building`)
console.log(`pack average: ${(catalogue.models.reduce((sum, model) => sum + model.triangles, 0) / catalogue.models.length).toFixed(1)} triangles a model`)
