import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GRID, facadeTile, shopfrontTile } from './windows.ts'
import { FAMILIES, type Family } from './look.ts'
import type { Producer } from './producer.ts'

/**
 * One wall picture per family, drawn from code and handed to the producer the
 * way its skill says to hand one over: through `add-texture`, which names the
 * file, pairs the glow map and records the grid the picture holds. Doing that
 * by hand is what goes wrong.
 *
 * What comes back is a texture pack folder per family. The build copies the
 * right one into each model's home before it builds, so which family a look
 * belongs to is the only thing that decides what its walls wear.
 */
export async function drawTextures(producer: Producer, scratch: string): Promise<Map<Family, string>> {
  const packs = new Map<Family, string>()
  for (const family of FAMILIES) {
    const files = join(scratch, `tile-${family}`)
    await mkdir(files, { recursive: true })
    const home = join(scratch, `textures-${family}`)

    for (const [finish, tile, grid] of [
      ['facade', await facadeTile(family), GRID.facade],
      ['glass-band', await shopfrontTile(family), GRID.shopfront],
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
    packs.set(family, join(home, 'textures'))
  }
  return packs
}
