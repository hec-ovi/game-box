import sharp from 'sharp'
import { Field } from './field.mjs'

/**
 * A colour tile as the one thing a derived map is made of: its luminance in
 * linear light. sRGB bytes are a display encoding, and differentiating them
 * would put more slope on a dark surface than a light one for the same real
 * step in the material.
 */
export async function readTile(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.width !== info.height) throw new Error(`relief: ${file} is ${info.width}x${info.height}; a tile has to be square`)

  const luminance = Field.zeros(info.width)
  for (let at = 0, to = 0; at < data.length; at += 3, to++) {
    luminance.data[to] = 0.2126 * linear(data[at]) + 0.7152 * linear(data[at + 1]) + 0.0722 * linear(data[at + 2])
  }
  return { size: info.width, luminance, mean: luminance.mean }
}

/** Writes raw channels out as a PNG at the size they were computed at. */
export function writeImage(bytes, size, channels, file) {
  return sharp(bytes, { raw: { width: size, height: size, channels } }).png({ compressionLevel: 9 }).toFile(file)
}

const linear = (byte) => {
  const value = byte / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}
