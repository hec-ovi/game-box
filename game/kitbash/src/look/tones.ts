import { FAKE_INTERIOR, GLASS } from '../catalog/pieces.ts'
import type { Flavour } from './flavour.ts'

/**
 * What the buildings are made of, per kind of town.
 *
 * The kit is authored bright: red brick and pale concrete, which is a quiet
 * seaside town. A neon city is the opposite of that. Its architecture is nearly
 * silhouette and the only colour on the street comes from what is lit, so the
 * tints here take the walls down to near black and keep just enough distance
 * between brick, trim and concrete that a facade still reads as having parts.
 *
 * Nothing here is a texture. The tint multiplies the kit's own maps, so the
 * brick keeps its bond and the concrete keeps its pitting; only the value and
 * the hue move.
 */
export interface Tone {
  /** The albedo each kit material is taken to. */
  readonly tint: Readonly<Record<string, number>>
  /** Anything the tint does not name. */
  readonly rest: number
  /** How far the grime takes a surface down, 0 clean to 1 filthy. */
  readonly grime: number
  /** How much shine is left on: 0 keeps the kit's own roughness, 1 polishes it. */
  readonly sheen: number
}

/** Materials that are somebody else's: the window shader and the plane behind the glass. */
export const UNTONED: readonly string[] = [GLASS, FAKE_INTERIOR]

const tone = (brick: number, pale: number, trim: number, dark: number, green: number, concrete: number, inside: number, asphalt: number, grime: number, sheen: number): Tone => ({
  tint: {
    MI_RedBrick: brick,
    MI_RedBrick_Pale: pale,
    MI_Trim: trim,
    MI_Trim_Dark: dark,
    MI_Trim_Green: green,
    MI_Trim_MetalConcrete: concrete,
    MI_InteriorWall: inside,
    MI_Asphalt: asphalt,
  },
  rest: trim,
  grime,
  sheen,
})

export const TONES: Record<Flavour, Tone> = {
  //         brick     pale      trim      dark      green     concrete  inside    asphalt   grime sheen
  neon: tone(0x342527, 0x3d3239, 0x33363e, 0x1c1e23, 0x233a35, 0x3d414c, 0x22242a, 0x202226, 0.9, 0.5),
  industrial: tone(0x392b26, 0x413733, 0x3c3d3e, 0x232324, 0x2c3a31, 0x45464a, 0x2a2926, 0x232325, 1, 0.25),
  frontier: tone(0x7a5340, 0x8f7461, 0x8e8071, 0x4a443c, 0x53614c, 0x928b7e, 0x6a6155, 0x3a3936, 0.6, 0.15),
  coastal: tone(0x6d4e46, 0x8a7267, 0x9a978d, 0x4b4d4e, 0x4f6a58, 0x9d9d98, 0x6e6a63, 0x3b3b3d, 0.5, 0.3),
  alpine: tone(0x5a4642, 0x76686a, 0x8d9298, 0x3f4348, 0x415a4d, 0x91979d, 0x64656a, 0x35363a, 0.35, 0.35),
  agrarian: tone(0x7d5440, 0x967b64, 0x9b937f, 0x4d473c, 0x556047, 0x968f80, 0x6d6455, 0x3a3935, 0.35, 0.1),
  plain: tone(0x6b4a3f, 0x836b60, 0x86837b, 0x44454a, 0x445a4a, 0x8a8a87, 0x5f5b55, 0x38383b, 0.5, 0.25),
}
