/**
 * What the ground of the city is made of: three tiling surfaces the pack
 * carries, and the look each kind of cell takes from them.
 *
 * @gb/scene lays ground UVs out in metres, so a texture that should repeat
 * every `tile` metres asks for `repeat = 1 / tile`, whatever the cell size is.
 */
import type { CellKind } from '@gb/world'

/** The tiling surfaces the pack carries, one node each. */
export type GroundTextureId = 'asphalt' | 'paving' | 'earth'

export interface GroundTexture {
  /** The node the pack hangs this surface's material on. */
  readonly node: string
  /** How many metres across one tile of it is. */
  readonly tile: number
  /** Whether the pack carries a normal map for it as well as a colour map. */
  readonly relief: boolean
}

export const GROUND_TEXTURES: Record<GroundTextureId, GroundTexture> = {
  asphalt: { node: 'Ground_Asphalt', tile: 4, relief: true },
  // four slabs across a tile, so the pavement is laid in half-metre flags
  paving: { node: 'Ground_Paving', tile: 2, relief: true },
  earth: { node: 'Ground_Earth', tile: 4, relief: false },
}

export const GROUND_TEXTURE_IDS = Object.keys(GROUND_TEXTURES) as GroundTextureId[]

/** One surface of the city floor: which maps it takes, and how it is tinted and lit. */
export interface GroundLook {
  /** What the material is called, so a mesh in the scene says what it is standing on. */
  readonly name: string
  /** The tiling colour map, when the surface has one. */
  readonly map?: GroundTextureId
  /** The tiling normal map, when it has one. */
  readonly normal?: GroundTextureId
  /** Multiplied over the colour map: the kit's textures are shared, the tint is what separates them. */
  readonly colour: number
  readonly roughness: number
  /** How deep the relief reads. Left out, the normal map is taken at full strength. */
  readonly normalScale?: number
}

// the pavement and the strip a building stands on are the same slabs. The
// tint is what turns the kit's warm marble into concrete grey.
const PAVEMENT: GroundLook = { name: 'ground:paving', map: 'paving', normal: 'paving', colour: 0xb4cef9, roughness: 0.85 }

export const GROUND_LOOKS: Record<CellKind, GroundLook> = {
  street: { name: 'ground:asphalt', map: 'asphalt', normal: 'asphalt', colour: 0xffffff, roughness: 0.95 },
  sidewalk: PAVEMENT,
  building: PAVEMENT,
  // bare earth greened down, so a park is planted ground rather than a flat green field
  park: { name: 'ground:grass', map: 'earth', colour: 0xa9ff96, roughness: 1 },
  empty: { name: 'ground:earth', map: 'earth', colour: 0xffffff, roughness: 1 },
  // no colour map: water is its own colour, and the road's relief breaks the light up into ripples
  water: { name: 'ground:water', normal: 'asphalt', colour: 0x2f5a72, roughness: 0.2, normalScale: 0.35 },
  // the mountain ring is blocks, not ground: its faces are UV'd 0..1, not in metres, so nothing tiles on them
  mountain: { name: 'ground:rock', colour: 0x5f5a52, roughness: 1 },
}
