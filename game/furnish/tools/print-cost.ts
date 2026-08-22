/**
 * Prints what a furnished room costs against the greybox it replaces: draws,
 * triangles and materials, from the shipped pack and a generated town. The
 * numbers in CONTRACT.md come from here.
 *
 * Run: node game/furnish/tools/print-cost.ts
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Forge, OfflineNarrator } from '@gb/forge'
import { buildInterior, Greybox, type Dressing } from '@gb/scene'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { FurnishDressing, loadFurnish } from '../src/index.ts'

const KIT_FILE = join(
  process.env['GB_ASSETS_DIST'] ?? resolve(import.meta.dirname, '../../../assets/dist'),
  'interior-kit.glb',
)

// three reaches for browser globals while decoding textures; nothing here draws
const globals = globalThis as Record<string, unknown>
globals.self ??= globalThis
globals.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

const bytes = readFileSync(KIT_FILE)
const gltf = await new GLTFLoader()
  .setMeshoptDecoder(MeshoptDecoder)
  .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')
const dressing = new FurnishDressing(loadFurnish(gltf.scenes))
const greybox = new Greybox()

const built = await new Forge(new OfflineNarrator('furnish')).build({
  theme: 'old harbour town',
  seed: 'furnish',
  blocksX: 1,
  blocksY: 1,
  blockCells: 14,
})
if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
const world = built.value.world

console.log(`pack ${(bytes.byteLength / 1e3).toFixed(0)} KB\n`)
console.log(`${'room'.padEnd(12)}${'pieces'.padStart(6)}   ${'furnished'.padEnd(30)}greybox`)
for (const interior of [...world.interiors()].sort((a, b) => b.furniture.length - a.furniture.length)) {
  const kind = world.plot(interior.plotId)?.kind ?? '?'
  console.log(
    `${kind.padEnd(12)}${String(interior.furniture.length).padStart(4)}   ` +
      `${cost(interior.id, dressing).padEnd(30)}${cost(interior.id, greybox)}`,
  )
}

function cost(id: string, dressing: Dressing): string {
  const interior = world.interior(id)!
  const room = buildInterior(world, interior, dressing)
  const meshes: THREE.Mesh[] = []
  room.root.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })
  const triangles = meshes.reduce((total, mesh) => total + (mesh.geometry.getIndex()?.count ?? 0) / 3, 0)
  const materials = new Set(meshes.map((mesh) => mesh.material)).size
  return `${meshes.length} draws, ${triangles} tris, ${materials} mats`
}
