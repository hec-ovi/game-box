/**
 * Measures the average brightness of each grain image, in linear light.
 *
 * The interior materials divide by this number so the image reads as grain
 * around one rather than as a multiplier. Without it a look that asks for a mid
 * grey wall gets a fifth of one, because the Downtown concrete averages 0.20.
 * The numbers in `SURFACE_TEXTURES` come from here.
 *
 * Run: node game/furnish/tools/print-grain.ts
 */
import sharp from 'sharp'
import { SURFACE_TEXTURES, SURFACE_TEXTURE_IDS } from '../src/surfaces/surfaces.ts'
import { SOURCE_IMAGES } from './pack.ts'

for (const id of SURFACE_TEXTURE_IDS) {
  const mean = await averageOf(SOURCE_IMAGES[id])
  const held = SURFACE_TEXTURES[id].grain
  const drift = Math.abs(mean - held) > 0.005 ? `  <- SURFACE_TEXTURES says ${held}` : ''
  console.log(`${id.padEnd(10)} mean linear ${mean.toFixed(3)}${drift}`)
}

async function averageOf(file: string): Promise<number> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let total = 0
  for (let at = 0; at < data.length; at += info.channels) {
    for (let channel = 0; channel < 3; channel++) total += linear(data[at + channel]! / 255) / 3
  }
  return total / (data.length / info.channels)
}

/** sRGB to linear, the transfer function the renderer undoes when it samples. */
function linear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
}
