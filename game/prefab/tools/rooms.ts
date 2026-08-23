import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { ROOM_PICTURES, ROOM_SIZE } from '../src/rooms.ts'
import { PNG } from './paint.ts'

/**
 * The room pictures, stacked into the strip the pack ships.
 *
 * A strip's rows already sit in the order an array texture wants them, so the
 * runtime decodes one image and hands the bytes straight to the GPU. The
 * pictures in `rooms/` are committed art: this reads them, it never draws them.
 */
export async function buildRooms(folder = resolve(import.meta.dirname, '../rooms')): Promise<{ strip: Buffer; layers: number }> {
  const tiles: Buffer[] = []
  for (const name of ROOM_PICTURES) {
    const picture = await readFile(join(folder, `${name}.png`))
    const raw = await sharp(picture).resize(ROOM_SIZE, ROOM_SIZE, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
    tiles.push(raw)
  }

  const strip = await sharp(Buffer.concat(tiles), { raw: { width: ROOM_SIZE, height: ROOM_SIZE * tiles.length, channels: 4 } })
    .png(PNG)
    .toBuffer()
  return { strip, layers: tiles.length }
}
