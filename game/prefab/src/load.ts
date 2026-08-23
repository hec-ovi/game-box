import type { CityNight } from '@gb/kitbash'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { Catalogue } from './catalogue.ts'
import { Library } from './library.ts'
import type { PrefabAtlas } from './material.ts'

export class PackChanged extends Error {
  readonly code = 'pack-changed'
  constructor(
    readonly file: string,
    readonly expected: string,
    readonly found: string,
  ) {
    super(`the prefab ${file} is not the one its manifest describes (expected ${expected.slice(0, 12)}, found ${found.slice(0, 12)})`)
    this.name = 'PackChanged'
  }
}

/**
 * The pack's four files, as URLs the bundler can see. They are written out one
 * by one rather than built from a name, because a bundler only follows a
 * literal.
 */
const PACK = {
  manifest: new URL('../pack/buildings.json', import.meta.url),
  mesh: new URL('../pack/buildings.glb', import.meta.url),
  colour: new URL('../pack/buildings-colour.png', import.meta.url),
  emissive: new URL('../pack/buildings-emissive.png', import.meta.url),
} as const

/**
 * The shipped catalogue, loaded and checked against its own manifest.
 *
 * The mesh is committed bytes and the manifest names their hash, so a pack that
 * has been edited under the game refuses to load rather than quietly drawing a
 * different city than the one the seed says.
 */
export async function loadPrefab(night: CityNight): Promise<Library> {
  const [manifest, mesh, colour, emissive] = await Promise.all([
    fetch(PACK.manifest).then((response) => response.json()),
    bytes(PACK.mesh),
    bytes(PACK.colour),
    bytes(PACK.emissive),
  ])

  const catalogue = Catalogue.parse(manifest)
  await check('mesh', mesh, catalogue.sha256)
  await check('colour atlas', colour, catalogue.atlas.colour.sha256)
  await check('glow atlas', emissive, catalogue.atlas.emissive.sha256)

  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(mesh, '')
  const atlas: PrefabAtlas = {
    colour: await arrayTexture(colour, catalogue.atlas.colour.size, catalogue.atlas.colour.layers, THREE.SRGBColorSpace),
    emissive: await arrayTexture(emissive, catalogue.atlas.emissive.size, catalogue.atlas.emissive.layers, THREE.SRGBColorSpace),
  }
  return Library.of({ catalogue, scenes: gltf.scenes, atlas, night })
}

async function bytes(url: URL): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url.pathname}: HTTP ${response.status}`)
  return response.arrayBuffer()
}

async function check(file: string, data: ArrayBuffer, expected: string): Promise<void> {
  const found = await sha256(data)
  if (found !== expected) throw new PackChanged(file, expected, found)
}

async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * One finish per layer, out of a strip of them stacked top to bottom. A strip
 * is one image to decode and its rows already sit in the order an array texture
 * wants them, so this is a decode and a read with no copying in between.
 */
async function arrayTexture(png: ArrayBuffer, size: number, layers: number, colorSpace: THREE.ColorSpace): Promise<THREE.DataArrayTexture> {
  const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }))
  const canvas = new OffscreenCanvas(size, size * layers)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('no 2d context to read the prefab atlas with')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const pixels = context.getImageData(0, 0, size, size * layers).data
  const texture = new THREE.DataArrayTexture(new Uint8Array(pixels.buffer), size, size, layers)
  texture.colorSpace = colorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
