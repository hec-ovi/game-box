/**
 * What the inside of a building is made of: two tiling images the pack carries,
 * how much real wall or floor each one covers, and what the floor, the walls
 * and the ceiling take from them in each of the two interior languages.
 *
 * Density is the whole point of this file. @gb/scene builds an interior out of
 * planes and boxes whose UVs run 0..1 across whatever size the room happens to
 * be, so tiling off those UVs stretches one image over a whole wall and gives a
 * 3 m wall and a 12 m wall different sized stones. The materials ignore the
 * mesh UVs and lay the image out by where the surface is in the world, in
 * metres, per axis (see `tiling.ts`); this table is the only place that says
 * how many metres that is.
 *
 * Both languages read off the same two images. A corpo floor and a home floor
 * differ in tint, gloss and how deep the relief reads, not in what they are
 * made of, so a second language costs no texture memory at all.
 */
import type { FurnishStyle } from '../style/palette.ts'

export type SurfacePart = 'floor' | 'wall' | 'ceiling'

export const SURFACE_PARTS: readonly SurfacePart[] = ['floor', 'wall', 'ceiling']

/** The tiling surfaces the pack carries, one node each. */
export type SurfaceTextureId = 'flagstone' | 'plaster' | 'panel'

export interface SurfaceTexture {
  /** The node the pack hangs this surface's material on. */
  readonly node: string
  /** How many metres of real floor, wall or ceiling one tile of the image covers. */
  readonly metres: number
}

/**
 * The real-world size of one tile of each image. Both numbers are read off the
 * image against what stands next to it in `METRICS`: a 2.1 m door, a 4 m ground
 * floor, 2 m cells.
 */
export const SURFACE_TEXTURES: Record<SurfaceTextureId, SurfaceTexture> = {
  // the image is four slabs by four, and an interior floor slab is 0.5 m across
  flagstone: { node: 'Surface_Flagstone', metres: 2 },
  // concrete has no repeating unit to measure, so the size is its coarsest stain: about
  // 0.6 m of wall, a third of a door, which reads as a mark on a panel rather than cloud
  plaster: { node: 'Surface_Plaster', metres: 2 },
  // ours, generated from tools/textures/prompts/wall-plastic-home.md: moulded
  // plastic, drawn at a metre and a half of panel and cut to wrap
  panel: { node: 'Surface_Panel', metres: 1.5 },
}

export const SURFACE_TEXTURE_IDS = Object.keys(SURFACE_TEXTURES) as SurfaceTextureId[]

export interface SurfaceLook {
  readonly name: string
  readonly map: SurfaceTextureId
  readonly colour: number
  readonly roughness: number
  /** How deep the relief reads. Left out, the normal map is taken at full strength. */
  readonly normalScale?: number
}

export const SURFACE_LOOKS: Record<FurnishStyle, Record<SurfacePart, SurfaceLook>> = {
  // polished concrete that mirrors the strips, graphite structure, a dark lid
  // with the services in it: the corpo reference is nearly all one grey
  corpo: {
    floor: { name: 'surface:corpo:floor', map: 'flagstone', colour: 0x77797c, roughness: 0.3 },
    wall: { name: 'surface:corpo:wall', map: 'plaster', colour: 0x53565a, roughness: 0.7, normalScale: 0.7 },
    ceiling: { name: 'surface:corpo:ceiling', map: 'plaster', colour: 0x24262a, roughness: 0.9, normalScale: 0.5 },
  },
  // a moulded cabin: a dark glossy floor the coves reflect off, moulded plastic
  // panel on the walls, a pale lid so the ceiling coves have something to wash
  home: {
    floor: { name: 'surface:home:floor', map: 'flagstone', colour: 0x2c2529, roughness: 0.16 },
    wall: { name: 'surface:home:wall', map: 'panel', colour: 0x6b6064, roughness: 0.38 },
    ceiling: { name: 'surface:home:ceiling', map: 'panel', colour: 0x968a8d, roughness: 0.5 },
  },
}
