import type { Material } from '@gltf-transform/core'
import type { EmissiveStrength } from '@gltf-transform/extensions'
import sharp from 'sharp'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from '../src/entrance.ts'
import { DISPLAY_FINISH } from '../src/screens.ts'
import { io } from './intake.ts'
import { COLOUR_SIZE, EMISSIVE_SIZE, GLOW_BAKE, LAYERS } from './layers.ts'
import { FAMILIES, NEONS, type Family } from './look.ts'
import { decode, encode, PNG, type Tile } from './paint.ts'
import { housingTile } from './screens.ts'
import { doorTile } from './walls.ts'

/** One finish's two layers, as the raw pixels a strip is stacked out of. */
interface Layer {
  readonly colour: Buffer
  readonly emissive: Buffer
}

export interface Atlas {
  readonly colour: Buffer
  readonly emissive: Buffer
  readonly layers: number
}

/**
 * The verbs that build one family's swatch: every finish the pack takes off the
 * producer, on one model. The entrance and the screen housing are not among
 * them; both are drawn in this repo and laid straight into the strip.
 */
export function swatchVerbs(project: string): string[][] {
  return [
    ['new', project, '--style', 'cyber', '--width', '12.00', '--depth', '12.00', '--floors', '4'],
    ['set-band', 'ground', '--tier', 'light', '--height', '4.00'],
    ['set-band', 'body', '--tier', 'flat', '--floors', '1', '--height', '3.20'],
    ['add-band', 'glow', '--kind', 'custom', '--tier', 'flat', '--template', 'bulk-glass', '--floors', '1', '--height', '3.20', '--after', 'body'],
    ['set-band', 'crown', '--tier', 'light', '--height', '3.20', '--clutter', '0'],
    ['put', 'panel', '2,26', '117,33', '--section', 'ground', '--side', 'S'],
    ['line', 'ground', '--side', 'S', '--count', '3', '--spacing', '3.00', '--colours', 'teal,magenta,amber', '--thickness', '0.08'],
    ['crown', 'crown', '--colour', 'cyan'],
    ['build'],
  ]
}

/**
 * Stacks the pack's layers into two strips, one picture tall each.
 *
 * A strip's rows already sit in the order an array texture wants them, so the
 * runtime decodes one image and hands the bytes straight to the GPU with no
 * copying in between. Colour and glow are folded in here, in linear light, so
 * the shader is a plain texture fetch and the pack carries exactly what it
 * draws.
 *
 * Most finishes come off a swatch the producer built. Three are drawn in this
 * repo instead: the two entrances, which are the surfaces a player stands
 * closest to, and the housing a screen sits in, which is a dark field the
 * shader lays the picture and the lamp grid over.
 */
export async function buildAtlas(swatches: ReadonlyMap<Family, string>): Promise<Atlas> {
  const finishes = new Map<string, Layer>()
  for (const family of FAMILIES) {
    const materials = await materialsOf(swatches.get(family)!)
    finishes.set(`${family}:facade`, await tileOf(materials.get('facade')))
    finishes.set(`${family}:base`, await tileOf(materials.get('base')))
    if (family === FAMILIES[0]) {
      finishes.set('glass', await tileOf(materials.get('glass-band')))
      for (const neon of NEONS) finishes.set(`neon:${neon}`, await tileOf(materials.get(`neon:${neon}`)))
    }
  }
  // the ones the producer has no picture worth taking: the two entrances, drawn
  // here because a door is the surface a player stands closest to, and the
  // housing a screen sits in, which is a dark field with a picture laid over it
  finishes.set(DOOR_FINISH, await drawn(await doorTile('plain')))
  finishes.set(OPEN_DOOR_FINISH, await drawn(await doorTile('open')))
  finishes.set(DISPLAY_FINISH, await drawn(await housingTile(COLOUR_SIZE)))

  const missing = LAYERS.filter((name) => !finishes.has(name))
  if (missing.length) throw new Error(`the swatches carry no ${missing.join(', ')}`)

  return {
    colour: await strip(LAYERS.map((name) => finishes.get(name)!.colour), COLOUR_SIZE),
    emissive: await strip(LAYERS.map((name) => finishes.get(name)!.emissive), EMISSIVE_SIZE),
    layers: LAYERS.length,
  }
}

async function materialsOf(file: string): Promise<Map<string, Material>> {
  const doc = await io.read(file)
  return new Map(doc.getRoot().listMaterials().map((material) => [material.getName(), material]))
}

/** A picture drawn in this repo, taken to the two sizes the pack stores. */
async function drawn(tile: Tile): Promise<Layer> {
  return { colour: await raw(tile.colour, COLOUR_SIZE), emissive: await raw(tile.emissive, EMISSIVE_SIZE) }
}

/** Any image, decoded at the size a layer is stored at. */
async function raw(image: Uint8Array, size: number): Promise<Buffer> {
  return await sharp(Buffer.from(image)).resize(size, size, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer()
}

/** One finish, taken to the two sizes the pack stores and folded into linear light. */
async function tileOf(material: Material | undefined): Promise<Layer> {
  if (!material) throw new Error('a swatch is missing a finish the pack needs')
  const strength = material.getExtension<EmissiveStrength>('KHR_materials_emissive_strength')?.getEmissiveStrength() ?? 1
  const base = material.getBaseColorFactor()
  const glow = material.getEmissiveFactor()

  return {
    colour: await paint(material.getBaseColorTexture()?.getImage(), COLOUR_SIZE, [base[0]!, base[1]!, base[2]!]),
    emissive: await paint(material.getEmissiveTexture()?.getImage(), EMISSIVE_SIZE, [
      (glow[0]! * strength) / GLOW_BAKE,
      (glow[1]! * strength) / GLOW_BAKE,
      (glow[2]! * strength) / GLOW_BAKE,
    ]),
  }
}

/**
 * A picture at the pack's size with its factor already in it, or a flat one
 * when the finish is its own colour and carries no picture. The multiply is in
 * linear light, which is where glTF says a factor and a picture meet.
 */
async function paint(image: Uint8Array | null | undefined, size: number, factor: [number, number, number]): Promise<Buffer> {
  const pixels = image ? await raw(image, size) : Buffer.alloc(size * size * 4, 255)

  for (let at = 0; at < pixels.length; at += 4) {
    for (let channel = 0; channel < 3; channel++) {
      pixels[at + channel] = encode(decode(pixels[at + channel]!) * factor[channel]!)
    }
    pixels[at + 3] = 255
  }
  return pixels
}

/** Every layer stacked top to bottom, which is the order an array texture reads them in. */
async function strip(tiles: readonly Buffer[], size: number): Promise<Buffer> {
  const stacked = Buffer.concat(tiles as Buffer[])
  return await sharp(stacked, { raw: { width: size, height: size * tiles.length, channels: 4 } })
    .png(PNG)
    .toBuffer()
}

