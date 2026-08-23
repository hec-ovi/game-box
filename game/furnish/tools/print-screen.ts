/**
 * What a screen is playing, off the CPU twin of the picture, so it can be
 * looked at and measured without a GPU.
 *
 * Prints the average a screen emits over a whole schedule (the number the
 * room's probe is calibrated from) and how bright each station runs minute by
 * minute. Given a path, it also writes a contact sheet: one row per station,
 * one frame every few seconds across a whole cycle.
 *
 *   node game/furnish/tools/print-screen.ts
 *   node game/furnish/tools/print-screen.ts ~/Pictures/Screenshots/screens.png
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { CYCLE, STATIONS, pictureAt, screenAverage } from '../src/index.ts'

const TABLE = Array.from({ length: 256 }, (_, at) => {
  let value = at
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

const WIDE = 160
const TALL = 90
const FRAMES = 8

const average = screenAverage()
console.log(`average over the glass and a whole schedule: ${average.map((n) => n.toFixed(4)).join(', ')}`)

for (let station = 1; station <= STATIONS; station++) {
  const row: string[] = []
  // three seconds in, so the reading is the spot rather than the static at the cut
  for (let frame = 0; frame < 12; frame++) row.push(brightness(station, (frame * CYCLE) / 12 + 3).toFixed(3))
  console.log(`station ${station}: ${row.join('  ')}`)
}

const out = process.argv[2]
if (out) {
  writeFileSync(out, png(sheet()))
  console.log(`contact sheet: ${out}`)
}

/** How bright a whole screen is at one second, in luminance. */
function brightness(station: number, seconds: number): number {
  let sum = 0
  for (let down = 0; down < 8; down++) {
    for (let along = 0; along < 12; along++) {
      const rgb = pictureAt((along + 0.5) / 12, (down + 0.5) / 8, station, 0, seconds)
      sum += 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
    }
  }
  return sum / 96
}

/** One row per station, one frame every `CYCLE / FRAMES` seconds. */
function sheet(): { width: number; height: number; pixels: Uint8Array } {
  const width = WIDE * FRAMES
  const height = TALL * STATIONS
  const pixels = new Uint8Array(width * height * 3)
  for (let station = 1; station <= STATIONS; station++) {
    for (let frame = 0; frame < FRAMES; frame++) {
      const seconds = (frame * CYCLE) / FRAMES + 3
      for (let down = 0; down < TALL; down++) {
        for (let along = 0; along < WIDE; along++) {
          const rgb = pictureAt((along + 0.5) / WIDE, 1 - (down + 0.5) / TALL, station, 0, seconds)
          const at = (((station - 1) * TALL + down) * width + frame * WIDE + along) * 3
          for (let channel = 0; channel < 3; channel++) pixels[at + channel] = byte(rgb[channel]!)
        }
      }
    }
  }
  return { width, height, pixels }
}

/** Linear light to an 8 bit sRGB byte, with the same curve the renderer writes. */
function byte(value: number): number {
  const clamped = Math.max(0, Math.min(1, value))
  const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
  return Math.round(encoded * 255)
}

/** A minimal PNG: one deflated block of filtered scanlines. */
function png(image: { width: number; height: number; pixels: Uint8Array }): Buffer {
  const raw = Buffer.alloc(image.height * (1 + image.width * 3))
  for (let row = 0; row < image.height; row++) {
    const from = row * image.width * 3
    raw[row * (1 + image.width * 3)] = 0
    Buffer.from(image.pixels.subarray(from, from + image.width * 3)).copy(raw, row * (1 + image.width * 3) + 1)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(image.width, 0)
  header.writeUInt32BE(image.height, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(kind: string, body: Buffer): Buffer {
  const out = Buffer.alloc(body.length + 12)
  out.writeUInt32BE(body.length, 0)
  out.write(kind, 4, 'ascii')
  body.copy(out, 8)
  out.writeUInt32BE(crc(out.subarray(4, 8 + body.length)) >>> 0, 8 + body.length)
  return out
}

function crc(bytes: Buffer): number {
  let value = 0xffffffff
  for (const at of bytes) value = TABLE[(value ^ at) & 0xff]! ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
