/**
 * What the inside of a building is made of: two tiling surfaces the pack
 * carries, and what the floor, the walls and the ceiling take from them.
 *
 * @gb/scene builds an interior out of plain planes and boxes whose UVs run 0..1
 * across whatever size the room happens to be, so a material cannot tile off
 * them. These materials ignore the UVs and lay the texture out by where the
 * surface is in the world instead, which is what makes a flagstone half a metre
 * across in a small room and in a large one alike (see `tiling.ts`).
 */
export type SurfacePart = 'floor' | 'wall' | 'ceiling'

export const SURFACE_PARTS: readonly SurfacePart[] = ['floor', 'wall', 'ceiling']

/** The tiling surfaces the pack carries, one node each. */
export type SurfaceTextureId = 'flagstone' | 'plaster'

export interface SurfaceTexture {
  /** The node the pack hangs this surface's material on. */
  readonly node: string
  /** How many metres across one tile of it is. */
  readonly tile: number
}

export const SURFACE_TEXTURES: Record<SurfaceTextureId, SurfaceTexture> = {
  // the kit's stone floor is four slabs to a tile, so two metres lays it in half-metre flags
  flagstone: { node: 'Surface_Flagstone', tile: 2 },
  // plaster has no repeat in it to give the tile away, so it can be laid coarse
  plaster: { node: 'Surface_Plaster', tile: 3 },
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
