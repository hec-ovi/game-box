import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { FACADE, SHOPFRONT } from '../src/windows.ts'
import { PNG, png, type Tile } from './paint.ts'
import type { Look } from './look.ts'

/**
 * The wall pictures, read off disk and handed to the producer.
 *
 * They are committed art in `finishes/`, ours, from our own prompts, so they
 * travel inside a world file. A look names the one it wears, so which wall a
 * building has is authored beside everything else about it. Each one tiles: a
 * wall runs several pictures across and any seam would repeat all the way up
 * the building, so the generation was asked for a tile and the pack test
 * measures that it is one.
 *
 * The windows are not in them. A mullion is three centimetres across and a wall
 * picture is about twenty pixels to the metre, so a drawn one would be under a
 * texel; the runtime cuts the opening and the bars out of the bay
 * arithmetically and draws the room behind them. What a picture carries is the
 * surface around that, which is the part a photograph is better at than
 * arithmetic: panel courses, casting marks, staining, wear.
 *
 * Nothing on a wall glows, so every glow map here is black and the neon keeps
 * its own layers.
 */

/** Bays across and floors down each picture holds. What the producer is told, and what the shader reads. */
export const GRID = { facade: FACADE.grid, shopfront: SHOPFRONT.grid } as const

const FOLDER = resolve(import.meta.dirname, '../finishes')

/** One look's wall: what four bays by two floors are made of, above the street and on the base under it. */
export async function facadePicture(look: Look): Promise<Tile> {
  return await committed(`${look.facade}.png`)
}

/**
 * The street level, and it is one surround for the whole catalogue. A pavement
 * level surround is a heavy dark frame whichever building it belongs to, and it
 * is seen from a metre away where a tint per look reads as a mistake rather
 * than as variety.
 */
export async function streetPicture(): Promise<Tile> {
  return await committed('street-surround.png')
}

async function committed(file: string): Promise<Tile> {
  const image = sharp(await readFile(join(FOLDER, file)))
  const { width, height } = await image.metadata()
  const dark = Buffer.alloc(width * height * 4)
  for (let at = 3; at < dark.length; at += 4) dark[at] = 255
  return { colour: await image.ensureAlpha().png(PNG).toBuffer(), emissive: await png(dark, width, height) }
}
