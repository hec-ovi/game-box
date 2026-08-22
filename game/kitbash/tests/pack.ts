import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { loadKit, type KitLibrary } from '../src/index.ts'

/** The pack tools/build-kit.ts writes. Override the folder with GB_ASSETS_DIST. */
export const KIT_FILE = join(
  process.env['GB_ASSETS_DIST'] ?? resolve(import.meta.dirname, '../../../assets/dist'),
  'downtown-kit.glb',
)

// three reaches for browser globals while decoding textures; the geometry does not need them
const globals = globalThis as Record<string, unknown>
globals.self ??= globalThis
globals.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

/** The shipped kit, loaded the way game/app loads it: meshopt-compressed glb, quantized attributes and all. */
export async function loadPackedKit(): Promise<KitLibrary> {
  const bytes = readFileSync(KIT_FILE)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')
  return loadKit(gltf.scenes)
}
