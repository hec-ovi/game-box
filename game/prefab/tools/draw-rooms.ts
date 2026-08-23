/**
 * Turns the raw generations into the room pictures the pack ships.
 *
 *   node tools/draw-rooms.ts <folder of raw images>
 *
 * Nothing in the game runs this, and nothing in the build does either: the
 * pictures in `rooms/` are committed art and the build only stacks them. This
 * is here so they can be redrawn from the prompts beside them.
 *
 * One thing has to happen on the way in. Asked for a room seen through a
 * window, the model often paints the wall round the window as well, so the room
 * sits in a dark border. The border would double up with the frame the shader
 * already draws, so it is cut off here: an edge is trimmed while its row or
 * column is both dark and flat, which is what a blank border is and what a room
 * never is.
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { ROOM_PICTURES, ROOM_SIZE } from '../src/rooms.ts'
import { PNG } from './paint.ts'

/** A row or column this dark and this flat is border, not room. */
const BORDER = { bright: 0.16, spread: 0.055, most: 0.3 }

const from = resolve(process.argv[2] ?? '.')
const to = resolve(import.meta.dirname, '../rooms')

// whatever is in the folder, not all of them: a new room arrives on its own and
// the eleven already committed are not redrawn to take it
const waiting = ROOM_PICTURES.filter((name) => existsSync(join(from, `${name}.jpg`)))
if (waiting.length === 0) throw new Error(`no room pictures in ${from}; expected one of ${ROOM_PICTURES.join(', ')} as .jpg`)

for (const name of waiting) {
  const raw = await readFile(join(from, `${name}.jpg`))
  const { data, info } = await sharp(raw).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const box = roomIn(data, info.width, info.height)
  await sharp(raw)
    .extract(box)
    .resize(ROOM_SIZE, ROOM_SIZE, { fit: 'fill', kernel: 'lanczos3' })
    .png(PNG)
    .toFile(join(to, `${name}.png`))
  console.log(`${name}: ${info.width}x${info.height} -> ${box.width}x${box.height} at ${box.left},${box.top}`)
}

/** The part of the picture that is actually the room, with any painted border cut off. */
function roomIn(pixels: Buffer, width: number, height: number): { left: number; top: number; width: number; height: number } {
  const rows = lines(pixels, width, height, true)
  const columns = lines(pixels, width, height, false)
  const top = trim(rows, Math.floor(height * BORDER.most))
  const bottom = height - 1 - trim([...rows].reverse(), Math.floor(height * BORDER.most))
  const left = trim(columns, Math.floor(width * BORDER.most))
  const right = width - 1 - trim([...columns].reverse(), Math.floor(width * BORDER.most))
  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

/** Mean and spread of every row, or of every column. */
function lines(pixels: Buffer, width: number, height: number, byRow: boolean): Array<{ mean: number; spread: number }> {
  const count = byRow ? height : width
  const across = byRow ? width : height
  const out: Array<{ mean: number; spread: number }> = []
  for (let line = 0; line < count; line++) {
    let sum = 0
    let squares = 0
    for (let step = 0; step < across; step++) {
      const at = ((byRow ? line * width + step : step * width + line) * 3)
      const value = (pixels[at]! * 0.299 + pixels[at + 1]! * 0.587 + pixels[at + 2]! * 0.114) / 255
      sum += value
      squares += value * value
    }
    const mean = sum / across
    out.push({ mean, spread: Math.sqrt(Math.max(0, squares / across - mean * mean)) })
  }
  return out
}

/** How many lines in from an edge are border. Never more than a third of the picture. */
function trim(lines: ReadonlyArray<{ mean: number; spread: number }>, most: number): number {
  let at = 0
  while (at < most && lines[at]!.mean < BORDER.bright && lines[at]!.spread < BORDER.spread) at++
  return at
}
