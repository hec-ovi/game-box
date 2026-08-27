import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { BALCONY } from '../src/balcony.ts'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from '../src/entrance.ts'
import { DISPLAY_FINISH } from '../src/screens.ts'
import { BASE, WALL } from '../src/wall.ts'
import { COLOUR_SIZE } from './layers.ts'
import { NEONS } from './look.ts'

/**
 * How every finish in the pack is shaped and how rough it is, as the layer a
 * strip is stacked out of: normal x and y, roughness, in one opaque texel.
 *
 * There is no fourth channel on purpose. The runtime decodes a strip through a
 * 2D canvas, whose backing store is premultiplied, so anything in alpha costs
 * the other three a level on the way back out: measured, an occlusion of 0.4
 * puts 0.45 degrees of noise on a normal whose median tilt is a fifth of a
 * degree. Occlusion off a colour map is also most of the way to double
 * counting, because the hollow it darkens is the dirt the height field was read
 * from in the first place.
 *
 * A wall picture gets a real one, derived from the picture itself by
 * `tools/textures/relief.mjs` and committed beside it as
 * `finishes/<picture>-relief.png`. The derivation is offline and lives outside
 * this box on purpose: three boxes want the same maths and none of them may
 * import another's tools, so the tool writes files and every pack builder
 * stacks them.
 *
 * Everything else is flat, and each of those is a number rather than a picture
 * because there is nothing in its image to read. The two entrances are the
 * clearest case: they are photographs of a lit lobby, so their brightness is
 * where the light is rather than where the metal is, and a roughness read off
 * them comes out with the push bar smoother than the glass. Measured on
 * `door.png`, which is why it ships flat.
 */

/** Roughness of the finishes that carry no picture worth deriving from. */
const FLAT: Record<string, number> = {
  // a shut glazed leaf in a dark metal frame, taken over the whole plate
  [DOOR_FINISH]: 0.3,
  [OPEN_DOOR_FINISH]: 0.3,
  // a screen's own face is drawn by the shader; the plate's edges are its dark paint
  [DISPLAY_FINISH]: 0.45,
  // architectural glazing, the smoothest thing on a building
  glass: 0.08,
  // an acrylic diffuser over a tube, not a mirror
  ...Object.fromEntries(NEONS.map((neon) => [`neon:${neon}`, 0.35])),
  // powder coated steel on a balustrade
  [BALCONY.finish]: 0.5,
}

const FOLDER = resolve(import.meta.dirname, '../finishes')

/** A layer of the relief strip, and the one number a shell reads off it. */
interface ReliefLayer {
  readonly pixels: Buffer
  readonly roughness: number
}

export interface ReliefStrip {
  readonly strip: Buffer
  readonly layers: number
  /** Each layer's mean roughness, in strip order. */
  readonly roughness: readonly number[]
}

/**
 * The strip, stacked in the order the layers are named. It is the same size and
 * the same layer count as the colour strip, so one layer index reads both and
 * a joint in the picture is a joint in the relief.
 */
export async function buildRelief(names: readonly string[]): Promise<ReliefStrip> {
  const layers: ReliefLayer[] = []
  for (const name of names) layers.push(await layerOf(name))

  const stacked = Buffer.concat(layers.map((layer) => layer.pixels))
  return {
    strip: await sharp(stacked, { raw: { width: COLOUR_SIZE, height: COLOUR_SIZE * layers.length, channels: 3 } })
      // lossless, like every other picture in the pack: a palette is shared by
      // the whole strip, and a shared palette would quantise a normal
      .png({ compressionLevel: 9, palette: false })
      .toBuffer(),
    layers: layers.length,
    roughness: layers.map((layer) => layer.roughness),
  }
}

/** The picture a finish is derived from, or nothing where it is a flat number. */
function pictureOf(name: string): string | undefined {
  for (const prefix of [WALL, BASE]) {
    if (name.startsWith(prefix)) return name.slice(prefix.length)
  }
  return undefined
}

async function layerOf(name: string): Promise<ReliefLayer> {
  const picture = pictureOf(name)
  if (picture) return await derived(picture)

  const roughness = FLAT[name]
  if (roughness === undefined) throw new Error(`relief: nothing says how rough "${name}" is`)
  return flat(roughness)
}

/** One committed relief picture, read at the size the strip stores. */
async function derived(picture: string): Promise<ReliefLayer> {
  const file = join(FOLDER, `${picture}-relief.png`)
  const image = sharp(await readFile(file))
  const { width, height } = await image.metadata()
  if (width !== COLOUR_SIZE || height !== COLOUR_SIZE) {
    throw new Error(`relief: ${picture}-relief.png is ${width}x${height}, and a layer is ${COLOUR_SIZE}`)
  }

  const pixels = await image.removeAlpha().raw().toBuffer()
  let sum = 0
  for (let at = 2; at < pixels.length; at += 3) sum += pixels[at]!
  return { pixels, roughness: sum / (pixels.length / 3) / 255 }
}

/** A surface with no shape, at one roughness. */
function flat(roughness: number): ReliefLayer {
  const pixels = Buffer.alloc(COLOUR_SIZE * COLOUR_SIZE * 3)
  const value = Math.round(roughness * 255)
  for (let at = 0; at < pixels.length; at += 3) {
    pixels[at] = 128
    pixels[at + 1] = 128
    pixels[at + 2] = value
  }
  return { pixels, roughness: value / 255 }
}
