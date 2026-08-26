import * as THREE from 'three'
import { GLASS, PIECES, type PieceId } from '../catalog/pieces.ts'
import type { GroundLibrary } from '../ground/library.ts'
import { flavourOf } from '../look/flavour.ts'
import { grimeTexture } from '../look/grime.ts'
import { toneMaterials } from '../look/dress.ts'
import { TONES } from '../look/tones.ts'
import { CityNight } from '../night/night.ts'
import { FAR_GLASS, farWindowMaterial, windowMaterial } from '../night/windows.ts'
import { signAtlas } from '../sign/atlas.ts'
import { signMaterial } from '../sign/material.ts'
import { SIGN } from '../sign/sign.ts'
import { KitUnknownPiece } from './error.ts'

/** The kind of town a kit is dressed for when nobody says: this one is a neon city. */
export const DEFAULT_THEME = 'neon'

/** One material's worth of one piece: the geometry in the piece's own frame. */
export interface KitPart {
  readonly material: string
  readonly geometry: THREE.BufferGeometry
}

/**
 * Every piece the kit gives us, loaded once. Buildings clone geometry out of
 * here and never load anything themselves, so a city of a thousand plots reads
 * the art exactly once.
 *
 * The library also owns the city's night: one set of uniforms and the two glass
 * materials, the room behind a near pane and the flat one behind a far one, so
 * moving the clock is two numbers however much of the city is standing.
 */
export class KitLibrary {
  readonly #parts: ReadonlyMap<string, readonly KitPart[]>
  /** The kit's own materials, kept so the buffers behind them can be freed. */
  readonly #raw: ReadonlyMap<string, THREE.Material>
  readonly #materials: ReadonlyMap<string, THREE.Material>
  readonly #grime: THREE.DataTexture
  /** The tiling ground surfaces, when the pack carries them. Nothing else in the kit is ground. */
  readonly ground: GroundLibrary | undefined
  /** What hour it is, and every uniform that answers to it. */
  readonly night = new CityNight()

  readonly #glass: THREE.Material
  readonly #farGlass: THREE.Material
  readonly #atlas: THREE.DataTexture
  readonly #sign: THREE.Material

  constructor(parts: Map<PieceId, KitPart[]>, materials: Map<string, THREE.Material>, ground?: GroundLibrary, theme = DEFAULT_THEME) {
    this.#parts = parts
    this.#raw = materials
    this.#grime = grimeTexture()
    this.#materials = toneMaterials(materials, TONES[flavourOf(theme)], this.#grime)
    this.ground = ground
    this.#glass = windowMaterial(this.night, materials.get(GLASS))
    this.#farGlass = farWindowMaterial(this.night, materials.get(GLASS))
    this.#atlas = signAtlas()
    this.#sign = signMaterial(this.night, this.#atlas)
  }

  /** Which pieces of the catalog this library is missing. Empty means it can build anything. */
  static missing(parts: ReadonlyMap<string, unknown>): PieceId[] {
    return (Object.keys(PIECES) as PieceId[]).filter((id) => !parts.has(id))
  }

  /** Geometry per material for one piece. A piece the library cannot draw is refused, never drawn as a hole. */
  parts(piece: PieceId): readonly KitPart[] {
    const found = this.#parts.get(piece)
    if (!found?.length) throw new KitUnknownPiece(piece)
    return found
  }

  material(name: string): THREE.Material {
    if (name === GLASS) return this.#glass
    if (name === FAR_GLASS) return this.#farGlass
    if (name === SIGN.material) return this.#sign
    const found = this.#materials.get(name)
    if (found) return found
    throw new Error(`kitbash: no material named ${name}`)
  }

  /** Frees every buffer and material the library holds. */
  dispose(): void {
    for (const parts of this.#parts.values()) for (const part of parts) part.geometry.dispose()
    for (const material of this.#raw.values()) material.dispose()
    for (const material of this.#materials.values()) material.dispose()
    this.#grime.dispose()
    this.#glass.dispose()
    this.#farGlass.dispose()
    this.#sign.dispose()
    this.#atlas.dispose()
    this.ground?.dispose()
  }
}
