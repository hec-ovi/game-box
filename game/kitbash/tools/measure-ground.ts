/**
 * Prints the mean linear albedo of the pack's ground surfaces, tinted the way
 * `GROUND_LOOKS` tints them. It is where the numbers in `PAVEMENT_TONES` come
 * from: a tone is aimed at an albedo, and an albedo has to be measured off the
 * shipped pack rather than guessed off a hex.
 *
 * Run: node game/kitbash/tools/measure-ground.ts [pack.glb]
 * Reads: assets/dist/downtown-kit.glb (GB_ASSETS_DIST overrides)
 */
import { join, resolve } from 'node:path'
import { Color } from 'three'
import { NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization, KHRTextureTransform } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import { GROUND_LOOKS, GROUND_TEXTURES, PAVEMENT_TONES, type GroundTextureId } from '../src/ground/surfaces.ts'
import { flavourOf } from '../src/look/flavour.ts'

const DIST = process.env['GB_ASSETS_DIST'] ?? join(resolve(import.meta.dirname, '../../..'), 'assets/dist')

/** Rec. 709, the weights three's own tone mapping reads luminance with. */
const LUMA = [0.2126, 0.7152, 0.0722] as const

const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization, KHRTextureTransform])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const document = await io.read(process.argv[2] ?? join(DIST, 'downtown-kit.glb'))
const textures = new Map(document.getRoot().listTextures().map((texture) => [texture.getName(), texture]))

/** The mean of a map, in linear light: what the surface is worth before any tint. */
async function meanOf(name: string): Promise<readonly [number, number, number]> {
  const image = textures.get(name)?.getImage()
  if (!image) throw new Error(`measure-ground: the pack has no texture named ${name}`)
  const { data, info } = await sharp(Buffer.from(image)).raw().toBuffer({ resolveWithObject: true })
  const pixels = info.width * info.height
  const total = [0, 0, 0]
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) total[c]! += srgbToLinear(data[i * info.channels + c]! / 255)
  }
  return [total[0]! / pixels, total[1]! / pixels, total[2]! / pixels]
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: readonly [number, number, number]): number {
  return rgb[0] * LUMA[0] + rgb[1] * LUMA[1] + rgb[2] * LUMA[2]
}

// which map the pack hangs on each surface node, read off the pack itself
const maps = new Map<GroundTextureId, string>()
for (const [id, surface] of Object.entries(GROUND_TEXTURES)) {
  const node = document.getRoot().listNodes().find((candidate) => candidate.getName() === surface.node)
  const map = node?.getMesh()?.listPrimitives()[0]?.getMaterial()?.getBaseColorTexture()?.getName()
  if (!map) throw new Error(`measure-ground: the pack has no ground surface named ${surface.node}`)
  maps.set(id as GroundTextureId, map)
}

console.log('the pack\'s own maps, mean linear albedo')
for (const [id, map] of maps) console.log(`  ${id.padEnd(8)} ${map.padEnd(30)} ${luminance(await meanOf(map)).toFixed(4)}`)

console.log('\nwhat a cell kind lands at, tinted, per kind of town')
const kinds = Object.entries(GROUND_LOOKS).filter(([, look]) => look.map)
const towns = Object.keys(PAVEMENT_TONES) as (keyof typeof PAVEMENT_TONES)[]
console.log(`  ${'kind'.padEnd(10)}${towns.map((town) => town.slice(0, 6).padStart(8)).join('')}`)
for (const [kind, look] of kinds) {
  const mean = await meanOf(maps.get(look.map!)!)
  const tint = new Color(look.colour)
  const row = towns.map((town) => {
    const tone = look.toned ? PAVEMENT_TONES[town] : 1
    return luminance([mean[0] * tint.r * tone, mean[1] * tint.g * tone, mean[2] * tint.b * tone]).toFixed(3).padStart(8)
  })
  console.log(`  ${kind.padEnd(10)}${row.join('')}`)
}

console.log(`\nthe theme "cyberpunk downtown" is a ${flavourOf('cyberpunk downtown')} town`)
