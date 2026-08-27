/**
 * The shipped pack, loaded without a renderer: the catalogue off disk and the
 * geometry out of the glb, with one layer of grey standing in for every
 * picture, because nothing headless reads what a wall is painted. `loadPrefab`
 * is the way in from a browser; this is the way in from a tool or a test.
 */
import { CityNight } from '@gb/kitbash'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { Catalogue } from '../src/catalogue.ts'
import { Library } from '../src/library.ts'
import { ROOM_PICTURES } from '../src/rooms.ts'
import { SCREEN_PICTURES } from '../src/screens.ts'

const PACK = new URL('../pack/', import.meta.url)

export async function readPack(night: CityNight = new CityNight()): Promise<Library> {
  const catalogue = await Catalogue.read(new Uint8Array(readFileSync(new URL('buildings.json', PACK))))
  const finishes = catalogue.atlas.finishes
  const atlas = {
    colour: grey(finishes.length),
    emissive: grey(finishes.length),
    rooms: grey(ROOM_PICTURES.length),
    screens: grey(SCREEN_PICTURES.length),
    // the pixels are a stand-in like the rest, but the per-finish roughness is
    // the pack's own, because that is a number rather than a picture
    ...(catalogue.atlas.relief
      ? { relief: grey(finishes.length), roughness: catalogue.atlas.relief.roughness }
      : {}),
    finishes,
  }
  return Library.of({ catalogue, scenes: await scenesOf(new URL('buildings.glb', PACK)), atlas, night })
}

/** A glb off disk, as the scenes `Library.of` reads its models out of. */
export async function scenesOf(file: URL): Promise<THREE.Object3D[]> {
  const bytes = readFileSync(file)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')).scenes
}

function grey(layers: number): THREE.DataArrayTexture {
  return new THREE.DataArrayTexture(new Uint8Array(4 * 4 * layers * 4).fill(128), 4, 4, layers)
}
