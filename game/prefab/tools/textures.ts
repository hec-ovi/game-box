import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BASE_TILE } from '../src/wall.ts'
import { GRID, facadePicture, streetPicture } from './finishes.ts'
import type { Look } from './look.ts'
import type { Producer } from './producer.ts'

/**
 * One wall picture per look, read out of `finishes/` and handed to the producer
 * the way its skill says to hand one over: through `add-texture`, which names
 * the file, pairs the glow map and records what the picture holds. Doing that
 * by hand is what goes wrong.
 *
 * The picture goes in three times. As the facade it holds the bay grid the
 * shader reads. As the wall and the base it is the same picture on the bands a
 * door or a board is composed on, which the producer tiles square by the metre
 * from `BASE_TILE`. What size the picture ends up at on the built wall is the
 * shader's, off the surface's own metres, so what this fixes is the uv the bay
 * grid and the room are read in.
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
    const facade = await facadePicture(look)
    const metres = ['--metres', BASE_TILE.toFixed(2)]

    for (const [finish, tile, holds] of [
      ['facade', facade, ['--across', String(GRID.facade.across), '--down', String(GRID.facade.down)]],
      ['glass-band', await streetPicture(), ['--across', String(GRID.shopfront.across), '--down', String(GRID.shopfront.down)]],
      ['wall', facade, metres],
      ['base', facade, metres],
    ] as const) {
      await writeFile(join(files, `${finish}.png`), tile.colour)
      await writeFile(join(files, `${finish}-lit.png`), tile.emissive)
      await producer.textures(home, ['add-texture', finish, join(files, `${finish}.png`), '--emissive', join(files, `${finish}-lit.png`), ...holds, '--style', 'cyber'])
    }
    packs.set(look.id, join(home, 'textures'))
  }
  return packs
}
