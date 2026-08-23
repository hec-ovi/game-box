import { Rng } from '@gb/kit'
import sharp from 'sharp'

/**
 * The picture a wall wears: a near black panel with a few hundred tiny lit
 * windows in it.
 *
 * The reference is the repo owner's own night city: at any distance a tower is
 * a black silhouette drawn by dots and dashes, mostly dark, a handful bright,
 * warm and cool mixed, and the lights come in runs rather than scattered
 * evenly, because a lit floor and a lit corner are what a building at night
 * actually looks like. It is an image on a flat face, which is what makes a
 * whole storey cost eight triangles.
 *
 * Drawn from code rather than generated as an image: a window grid is a few
 * lines of arithmetic, it tiles by construction so there is no seam to hide,
 * and it comes out the same on every machine, which the pack's byte-for-byte
 * promise needs. `@gb/kitbash` draws its sign letters the same way and for the
 * same reasons.
 */

/** Pixels a side. A picture covers a few bays by a floor or two, so this sets how fine the marks are. */
const SIZE = 256
/** Bays across and floors down each picture holds. The producer lays it out on these. */
export const GRID = { facade: { across: 4, down: 2 }, shopfront: { across: 2, down: 1 } } as const

/** What one picture is made of: how finely it is divided and how much of it is alight. */
interface Weave {
  readonly grid: { readonly across: number; readonly down: number }
  /** Slots a bay of one floor is divided into. */
  readonly slots: { readonly across: number; readonly down: number }
  /** How much of a slot the mark fills, as a share of it. */
  readonly mark: { readonly wide: readonly [number, number]; readonly tall: readonly [number, number] }
  /** The share of panes alight, and how many neighbours one drags on with it. */
  readonly lit: { readonly share: number; readonly longest: number }
  /** How often a slot holds nothing at all, which is what stops a grid reading as graph paper. */
  readonly blank: number
  readonly lights: ReadonlyArray<readonly [Rgb, number]>
}

/** Near black composite panel, and the mullion between two bays. */
const WALL: Rgb = [12, 12, 14]
const PANEL: Rgb = [17, 17, 20]
const MULLION: Rgb = [8, 8, 10]
/** A window with nobody in: glass over a dark room, a shade lighter than the wall. */
const DARK: Rgb = [26, 28, 33]

type Rgb = readonly [number, number, number]

/** What burns behind an office window. Cool offices, warm rooms, and the odd sign colour. */
const ROOMS: ReadonlyArray<readonly [Rgb, number]> = [
  [[255, 246, 214], 5],
  [[255, 214, 150], 4],
  [[196, 240, 255], 4],
  [[150, 255, 236], 3],
  [[255, 176, 120], 2],
  [[255, 140, 170], 1],
  [[120, 200, 255], 1],
]

/**
 * What burns in a shop window: warmer than an office and most of them on, but
 * held well under a neon tube. A shopfront is a wide pane a player stands a
 * metre from, so at a tube's brightness it is a white hole in the frame.
 */
const SHOPS: ReadonlyArray<readonly [Rgb, number]> = [
  [[142, 129, 104], 5],
  [[142, 110, 71], 4],
  [[98, 137, 142], 3],
  [[142, 85, 109], 2],
  [[94, 142, 119], 2],
  [[142, 68, 62], 1],
]

/** A wall above the street: hundreds of small panes, a handful of them alight. */
const FACADE: Weave = {
  grid: GRID.facade,
  slots: { across: 5, down: 5 },
  mark: { wide: [0.55, 0.95], tall: [0.15, 0.34] },
  lit: { share: 0.16, longest: 4 },
  blank: 0.12,
  lights: ROOMS,
}

/** Street level: a few big panes, most of them alight, because this is what a street is read by. */
const SHOPFRONT: Weave = {
  grid: GRID.shopfront,
  slots: { across: 3, down: 2 },
  mark: { wide: [0.72, 0.92], tall: [0.5, 0.78] },
  lit: { share: 0.62, longest: 2 },
  blank: 0.06,
  lights: SHOPS,
}

export interface Tile {
  readonly colour: Buffer
  readonly emissive: Buffer
}

/** One family's wall above the street, and the map of what glows in it. */
export async function facadeTile(seed: string): Promise<Tile> {
  return await weave(FACADE, `facade/${seed}`)
}

/** One family's street level: the lit shop window a player walks past. */
export async function shopfrontTile(seed: string): Promise<Tile> {
  return await weave(SHOPFRONT, `shopfront/${seed}`)
}

async function weave(spec: Weave, seed: string): Promise<Tile> {
  const rng = new Rng(seed)
  const colour = fill(WALL)
  const emissive = fill([0, 0, 0])

  panels(colour, spec, rng)
  for (let bay = 0; bay < spec.grid.across; bay++) {
    for (let floor = 0; floor < spec.grid.down; floor++) {
      windows(colour, emissive, spec, bay, floor, rng)
    }
  }

  return { colour: await png(colour), emissive: await png(emissive) }
}

/** Faint panel joints so a dark wall is not a flat field, and a mullion on every bay line. */
function panels(pixels: Uint8ClampedArray, spec: Weave, rng: Rng): void {
  const bayWidth = SIZE / spec.grid.across
  const floorHeight = SIZE / spec.grid.down

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const grain = rng.float() < 0.12 ? PANEL : WALL
      set(pixels, x, y, grain)
    }
  }
  for (let bay = 0; bay < spec.grid.across; bay++) {
    const x = Math.round(bay * bayWidth)
    for (let y = 0; y < SIZE; y++) set(pixels, x, y, MULLION)
  }
  for (let floor = 0; floor < spec.grid.down; floor++) {
    const y = Math.round(floor * floorHeight)
    for (let x = 0; x < SIZE; x++) set(pixels, x, y, MULLION)
  }
}

/** One bay of one floor: a grid of slots, each empty, dark or lit. */
function windows(colour: Uint8ClampedArray, emissive: Uint8ClampedArray, spec: Weave, bay: number, floor: number, rng: Rng): void {
  const bayWidth = SIZE / spec.grid.across
  const floorHeight = SIZE / spec.grid.down
  const slotWidth = bayWidth / spec.slots.across
  const slotHeight = floorHeight / spec.slots.down

  for (let row = 0; row < spec.slots.down; row++) {
    let burning = 0
    let lamp: Rgb = spec.lights[0]![0]
    for (let column = 0; column < spec.slots.across; column++) {
      // a slot with nothing in it is what stops the grid reading as graph paper
      if (rng.chance(spec.blank)) {
        burning = 0
        continue
      }

      if (burning > 0) burning--
      else if (rng.chance(spec.lit.share)) {
        burning = rng.int(1, spec.lit.longest + 1)
        lamp = rng.weighted(spec.lights)
      }

      const left = bay * bayWidth + column * slotWidth
      const top = floor * floorHeight + row * slotHeight
      const wide = slotWidth * rng.range(spec.mark.wide[0], spec.mark.wide[1])
      const tall = slotHeight * rng.range(spec.mark.tall[0], spec.mark.tall[1])
      const x = left + (slotWidth - wide) / 2 + rng.range(-0.5, 0.5)
      const y = top + (slotHeight - tall) / 2 + rng.range(-0.5, 0.5)

      if (burning > 0) {
        // a lit pane is the light itself, so it is drawn into both maps: bright
        // in colour so it reads by day, and the whole of it into the glow
        rect(colour, x, y, wide, tall, dim(lamp, 0.75))
        rect(emissive, x, y, wide, tall, lamp)
      } else {
        rect(colour, x, y, wide, tall, DARK)
      }
    }
  }
}

function fill(rgb: Rgb): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let i = 0; i < SIZE * SIZE; i++) {
    pixels[i * 4] = rgb[0]
    pixels[i * 4 + 1] = rgb[1]
    pixels[i * 4 + 2] = rgb[2]
    pixels[i * 4 + 3] = 255
  }
  return pixels
}

function set(pixels: Uint8ClampedArray, x: number, y: number, rgb: Rgb): void {
  const at = ((((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)) * 4
  pixels[at] = rgb[0]
  pixels[at + 1] = rgb[1]
  pixels[at + 2] = rgb[2]
  pixels[at + 3] = 255
}

/** A mark, wrapped at the edges, so the picture tiles with nothing cut in half. */
function rect(pixels: Uint8ClampedArray, x: number, y: number, wide: number, tall: number, rgb: Rgb): void {
  for (let dy = 0; dy < Math.max(1, Math.round(tall)); dy++) {
    for (let dx = 0; dx < Math.max(1, Math.round(wide)); dx++) {
      set(pixels, Math.round(x) + dx, Math.round(y) + dy, rgb)
    }
  }
}

function dim(rgb: Rgb, by: number): Rgb {
  return [Math.round(rgb[0] * by), Math.round(rgb[1] * by), Math.round(rgb[2] * by)]
}

async function png(pixels: Uint8ClampedArray): Promise<Buffer> {
  return await sharp(Buffer.from(pixels.buffer), { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer()
}
