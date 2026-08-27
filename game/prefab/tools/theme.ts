import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { readTheme, planStrip, type Folder, type StripPlan, type ThemeDoc } from '../src/theme.ts'
import { drawPanel } from './panels.ts'
import { PNG } from './paint.ts'

/**
 * A theme pack on disk: the manifest, the layout it plans, and the pixels
 * behind every image it declares.
 *
 * The pack that ships is a theme like any other, in `themes/gb/`, so there is
 * one way to author a set of pictures and no second mechanism underneath it.
 * A pack of your own goes in `assets/themes/<name>/` (or anywhere, and named on
 * the command line), and anything it does not carry falls back to the shipped
 * pack's image of the same name; anything neither carries is drawn from
 * arithmetic in `tools/panels.ts` and `tools/screens.ts`, so a half finished
 * pack still builds a whole city.
 */

/** The pack that ships. Every other pack falls back to it. */
export const SHIPPED = resolve(import.meta.dirname, '../themes/gb')

/** Which folder of a pack an image sits in. */
export type Store = Folder | 'ads'

export class ThemePack {
  readonly doc: ThemeDoc
  readonly plan: StripPlan
  readonly #folders: readonly string[]

  private constructor(doc: ThemeDoc, folders: readonly string[]) {
    this.doc = doc
    this.plan = planStrip(doc)
    this.#folders = folders
  }

  /**
   * Reads a pack. `theme.json` is validated before anything else is touched, so
   * a malformed one is refused whole rather than half applied.
   */
  static async at(folder = SHIPPED): Promise<ThemePack> {
    const doc = readTheme(JSON.parse(await readFile(join(folder, 'theme.json'), 'utf8')))
    return new ThemePack(doc, folder === SHIPPED ? [folder] : [folder, SHIPPED])
  }

  /** The image behind a declared name, or nothing when no pack on the chain carries it. */
  async image(store: Store, file: string): Promise<Buffer | undefined> {
    for (const folder of this.#folders) {
      try {
        return await readFile(join(folder, store, file))
      } catch {
        continue
      }
    }
    return undefined
  }

  /** Raw RGBA pixels for one layer of the glazing strip: the pack's image if it has one, the drawing if not. */
  async pixels(store: Folder, file: string, size: number): Promise<Buffer> {
    const image = await this.image(store, file)
    if (!image) return drawPanel(stemOf(file), size)
    return await sharp(image).resize(size, size, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer()
  }
}

/** What the strip carries: the pictures, stacked in the order the runtime reads them by. */
export interface Strip {
  readonly strip: Buffer
  readonly layers: number
}

/**
 * The glazing strip: back walls, then flat panels, then the four shared faces.
 *
 * A strip's rows already sit in the order an array texture wants them, so the
 * runtime decodes one image and hands the bytes straight to the GPU with no
 * copying in between.
 */
export async function buildGlazing(pack: ThemePack, size: number): Promise<Strip> {
  const tiles: Buffer[] = []
  for (const layer of pack.plan.layers) tiles.push(await pack.pixels(layer.folder, layer.file, size))
  return { strip: await stacked(tiles, size), layers: tiles.length }
}

/** Several square pictures, one above the other, as one lossless PNG. */
export async function stacked(tiles: readonly Buffer[], size: number): Promise<Buffer> {
  return await sharp(Buffer.concat(tiles), { raw: { width: size, height: size * tiles.length, channels: 4 } }).png(PNG).toBuffer()
}

/** A declared name without its extension, which is what a drawing is keyed by. */
export function stemOf(file: string): string {
  return file.replace(/\.png$/, '')
}
