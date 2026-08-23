/**
 * What the inside of a building is made of.
 *
 * Two things, chosen separately: a **pattern**, which is the rhythm a surface
 * is laid in (rectangular tiles, hexagons, triangles, a chequerboard, planks),
 * and a **finish**, which is the colour, the gloss and how hard the joints and
 * the tile-to-tile variation read. A hexagonal floor can be polished or matte
 * and a plank floor can be near-black and glossy, so two short lists multiply
 * out into far more rooms than one long list of finished floors would.
 *
 * The pattern is arithmetic (`pattern.ts`), never an image, because a
 * structured texture jogs where it is cut to tile. The two images the pack
 * carries are stochastic only: concrete grain and moulded plastic grain. How
 * big they are laid is in metres (`tiling.ts`), so a 3 m wall and a 12 m wall
 * show the same grain.
 *
 * No interior surface is metal: a dark colour at a low roughness catches the
 * room's own light, where a mirror indoors would come out a hole in the floor.
 * What it catches is `probe.ts`, one small picture per language painted from
 * that language's surfaces and the colour its strips emit, because
 * `scene.environment` after dark is the night sky and the strips in a room are
 * emissive geometry nothing else has ever seen.
 *
 * Each part is a short pool rather than one entry, and an interior draws one
 * from its own seed, so no two rooms in a town are the same room. The pools are
 * fixed length, so a town of five hundred buildings still costs the same
 * handful of materials.
 */
import type { FurnishStyle } from '../style/palette.ts'
import type { Pattern } from './pattern.ts'

export type SurfacePart = 'floor' | 'wall' | 'ceiling'

export const SURFACE_PARTS: readonly SurfacePart[] = ['floor', 'wall', 'ceiling']

/** The tiling images the pack carries, one node each. Both are stochastic grain. */
export type SurfaceTextureId = 'plaster' | 'panel'

export interface SurfaceTexture {
  /** The node the pack hangs this surface's material on. */
  readonly node: string
  /** How many metres of real floor, wall or ceiling one tile of the image covers. */
  readonly metres: number
  /**
   * The image's own average brightness, in linear light. The material divides
   * by it, so the image is grain around one rather than a multiplier: a look
   * that asks for a mid grey wall gets a mid grey wall, not a fifth of one.
   * `node game/furnish/tools/print-grain.ts` measures it off the source.
   */
  readonly grain: number
}

/**
 * The real-world size of one tile of each image, read off the image against
 * what stands next to it in `METRICS`: a 2.1 m door, a 4 m ground floor.
 */
export const SURFACE_TEXTURES: Record<SurfaceTextureId, SurfaceTexture> = {
  // concrete has no repeating unit to measure, so the size is its coarsest
  // stain: about 0.6 m of wall, a third of a door
  plaster: { node: 'Surface_Plaster', metres: 2, grain: 0.204 },
  // ours, generated from tools/textures/prompts/wall-plastic-home.md: moulded
  // plastic, drawn at a metre and a half of panel and cut to wrap
  panel: { node: 'Surface_Panel', metres: 1.5, grain: 0.345 },
}

export const SURFACE_TEXTURE_IDS = Object.keys(SURFACE_TEXTURES) as SurfaceTextureId[]

export interface SurfaceLook {
  readonly name: string
  readonly map: SurfaceTextureId
  readonly pattern: Pattern
  readonly colour: number
  readonly roughness: number
  /** How deep the grain reads. Left out, the normal map is taken at full strength. */
  readonly normalScale?: number
  /** How much darker and rougher a joint is than the tile. Zero for a printed pattern. */
  readonly joint: number
  /** How much one tile's colour differs from the next. */
  readonly variation: number
  /** How much one tile's gloss differs from the next: the printed pattern on a wall. */
  readonly sheen?: number
}

/**
 * The pool each part draws from, per language. An interior picks one entry per
 * part from its own seed; index 0 is what a room with no seed behind it gets.
 */
export const SURFACE_LOOKS: Record<FurnishStyle, Record<SurfacePart, readonly SurfaceLook[]>> = {
  // corpo: an open floor of polished concrete, graphite structure, a dark lid
  // with the services in it
  corpo: {
    floor: [
      {
        name: 'surface:corpo:floor:slab',
        map: 'plaster',
        pattern: { kind: 'tile', unit: 0.6 },
        colour: 0x6e7175,
        roughness: 0.3,
        joint: 0.55,
        variation: 0.05,
      },
      {
        name: 'surface:corpo:floor:hex',
        map: 'plaster',
        pattern: { kind: 'hex', unit: 0.34 },
        colour: 0x3a3d42,
        roughness: 0.42,
        joint: 0.6,
        variation: 0.12,
      },
      {
        name: 'surface:corpo:floor:deck',
        map: 'panel',
        pattern: { kind: 'plank', unit: 0.22, length: 1.8 },
        colour: 0x54585d,
        roughness: 0.55,
        joint: 0.5,
        variation: 0.09,
      },
      {
        name: 'surface:corpo:floor:black',
        map: 'plaster',
        pattern: { kind: 'chequer', unit: 0.5 },
        colour: 0x15171b,
        roughness: 0.22,
        joint: 0.35,
        variation: 0.45,
      },
    ],
    wall: [
      {
        name: 'surface:corpo:wall:plain',
        map: 'plaster',
        pattern: { kind: 'plain', unit: 1 },
        colour: 0x53565a,
        roughness: 0.7,
        normalScale: 0.7,
        joint: 0,
        variation: 0,
      },
      {
        name: 'surface:corpo:wall:printed',
        map: 'plaster',
        pattern: { kind: 'hex', unit: 0.5 },
        colour: 0x4a5257,
        roughness: 0.62,
        normalScale: 0.6,
        joint: 0,
        variation: 0.05,
        sheen: 0.22,
      },
      {
        name: 'surface:corpo:wall:etched',
        map: 'plaster',
        pattern: { kind: 'triangle', unit: 0.7 },
        colour: 0x4e5155,
        roughness: 0.66,
        normalScale: 0.6,
        joint: 0.18,
        variation: 0.04,
        sheen: 0.14,
      },
    ],
    ceiling: [
      {
        name: 'surface:corpo:ceiling',
        map: 'plaster',
        pattern: { kind: 'tile', unit: 1.2 },
        colour: 0x24262a,
        roughness: 0.9,
        normalScale: 0.5,
        joint: 0.4,
        variation: 0.03,
      },
    ],
  },
  // home: a moulded cabin, warmer and glossier, the coves reflecting off the floor
  home: {
    floor: [
      {
        name: 'surface:home:floor:hex',
        map: 'panel',
        pattern: { kind: 'hex', unit: 0.3 },
        colour: 0x2f272b,
        roughness: 0.28,
        joint: 0.5,
        variation: 0.07,
      },
      {
        name: 'surface:home:floor:tile',
        map: 'panel',
        pattern: { kind: 'tile', unit: 0.45 },
        colour: 0x7d7278,
        roughness: 0.26,
        joint: 0.45,
        variation: 0.05,
      },
      {
        name: 'surface:home:floor:tri',
        map: 'plaster',
        pattern: { kind: 'triangle', unit: 0.5 },
        colour: 0x4a4348,
        roughness: 0.4,
        joint: 0.5,
        variation: 0.1,
      },
      {
        name: 'surface:home:floor:deck',
        map: 'panel',
        pattern: { kind: 'plank', unit: 0.18, length: 1.6 },
        colour: 0x6b5f5c,
        roughness: 0.5,
        joint: 0.45,
        variation: 0.09,
      },
    ],
    wall: [
      {
        name: 'surface:home:wall:plain',
        map: 'panel',
        pattern: { kind: 'plain', unit: 1 },
        colour: 0x6b6064,
        roughness: 0.38,
        joint: 0,
        variation: 0,
      },
      {
        name: 'surface:home:wall:printed',
        map: 'panel',
        pattern: { kind: 'hex', unit: 0.45 },
        colour: 0x6f6368,
        roughness: 0.34,
        joint: 0,
        variation: 0.05,
        sheen: 0.26,
      },
      {
        name: 'surface:home:wall:etched',
        map: 'panel',
        pattern: { kind: 'triangle', unit: 0.6 },
        colour: 0x655a60,
        roughness: 0.36,
        joint: 0.16,
        variation: 0.05,
        sheen: 0.16,
      },
    ],
    ceiling: [
      {
        name: 'surface:home:ceiling',
        map: 'panel',
        pattern: { kind: 'plain', unit: 1 },
        colour: 0x968a8d,
        roughness: 0.5,
        joint: 0,
        variation: 0,
      },
    ],
  },
}

/** One entry of a pool, wrapped so any index lands somewhere. */
export function lookOf(style: FurnishStyle, part: SurfacePart, choice = 0): SurfaceLook {
  const pool = SURFACE_LOOKS[style][part]
  return pool[((choice % pool.length) + pool.length) % pool.length]!
}
