/**
 * What the inside of a building is made of: two tiling images the pack carries,
 * how much real wall or floor each one covers, and what the floor, the walls
 * and the ceiling take from them.
 *
 * Density is the whole point of this file. @gb/scene builds an interior out of
 * planes and boxes whose UVs run 0..1 across whatever size the room happens to
 * be, so tiling off those UVs stretches one image over a whole wall and gives a
 * 3 m wall and a 12 m wall different sized stones. The materials ignore the
 * mesh UVs and lay the image out by where the surface is in the world, in
 * metres, per axis (see `tiling.ts`); this table is the only place that says
 * how many metres that is.
 */
export type SurfacePart = 'floor' | 'wall' | 'ceiling'

export const SURFACE_PARTS: readonly SurfacePart[] = ['floor', 'wall', 'ceiling']

/** The tiling surfaces the pack carries, one node each. */
export type SurfaceTextureId = 'flagstone' | 'plaster'

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
  // the image is four stone slabs by four, and an interior floor slab is 0.5 m across
  flagstone: { node: 'Surface_Flagstone', metres: 2 },
  // plaster has no repeating unit to measure, so the size is its coarsest stain: about
  // 0.6 m of wall, a third of a door, which reads as a mark on plaster rather than cloud
  plaster: { node: 'Surface_Plaster', metres: 2 },
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

export const SURFACE_LOOKS: Record<SurfacePart, SurfaceLook> = {
  // the kit's warm stone, browned down: a worn floor rather than a lobby
  floor: { name: 'surface:floor', map: 'flagstone', colour: 0xa08a6c, roughness: 0.9 },
  wall: { name: 'surface:wall', map: 'plaster', colour: 0xe8d7bd, roughness: 0.95, normalScale: 0.6 },
  // the ceiling is the same plaster in shadow, so a room has a lid rather than a lightbox
  ceiling: { name: 'surface:ceiling', map: 'plaster', colour: 0x9a9186, roughness: 1, normalScale: 0.4 },
}
