import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GRID, facadePicture, streetPicture } from './finishes.ts'
import type { Look } from './look.ts'
import type { Producer } from './producer.ts'

/**
 * One wall picture per look, read out of `finishes/` and handed to the producer
 * the way its skill says to hand one over: through `add-texture`, which names
 * the file, pairs the glow map and records the grid the picture holds. Doing
 * that by hand is what goes wrong.
 *
 * What comes back is a texture pack folder per look. The build copies the right
 * one into each model's home before it builds, so the look is the only thing
 * that decides what its walls wear.
 */
export async function drawTextures(producer: Producer, scratch: string, looks: readonly Look[]): Promise<Map<string, string>> {
  const packs = new Map<string, string>()
  for (const look of looks) {
    const files = join(scratch, `tile-${look.id}`)
    await mkdir(files, { recursive: true })
    const home = join(scratch, `textures-${look.id}`)

    for (const [finish, tile, grid] of [
      ['facade', await facadePicture(look), GRID.facade],
      ['glass-band', await streetPicture(), GRID.shopfront],
    ] as const) {
      await writeFile(join(files, `${finish}.png`), tile.colour)
      await writeFile(join(files, `${finish}-lit.png`), tile.emissive)
      await producer.textures(home, [
        'add-texture',
        finish,
        join(files, `${finish}.png`),
        '--emissive',
        join(files, `${finish}-lit.png`),
        '--across',
        String(grid.across),
        '--down',
        String(grid.down),
        '--style',
        'cyber',
      ])
    }
    packs.set(look.id, join(home, 'textures'))
  }
  return packs
}
