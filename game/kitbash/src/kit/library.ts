import * as THREE from 'three'
import type { FurnitureId } from '../catalog/furniture.ts'
import { GLASS, PIECES, type PieceId } from '../catalog/pieces.ts'
import type { GroundLibrary } from '../ground/library.ts'
import { CityNight } from '../night/night.ts'
import { windowMaterial } from '../night/windows.ts'

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
 * The library also owns the city's night: one set of uniforms, one glass
 * material, so moving the clock is two numbers however much of the city is
 * standing.
 */
export class KitLibrary {
  readonly #parts: ReadonlyMap<string, readonly KitPart[]>
  readonly #materials: ReadonlyMap<string, THREE.Material>
  /** The tiling ground surfaces, when the pack carries them. Nothing else in the kit is ground. */
  readonly ground: GroundLibrary | undefined
  /** What hour it is, and every uniform that answers to it. */
  readonly night = new CityNight()

  readonly #glass: THREE.Material

  constructor(parts: Map<PieceId | FurnitureId, KitPart[]>, materials: Map<string, THREE.Material>, ground?: GroundLibrary) {
    this.#parts = parts
    this.#materials = materials
    this.ground = ground
    this.#glass = windowMaterial(this.night, materials.get(GLASS))
  }

  /** Which pieces of the catalog this library is missing. Empty means it can build anything. */
  static missing(parts: ReadonlyMap<string, unknown>): PieceId[] {
    return (Object.keys(PIECES) as PieceId[]).filter((id) => !parts.has(id))
  }

  parts(piece: PieceId | FurnitureId): readonly KitPart[] {
    return this.#parts.get(piece) ?? []
  }

  /** Whether the pack carries a piece of street furniture. Without it, none of them is drawn. */
  has(piece: FurnitureId): boolean {
    return (this.#parts.get(piece)?.length ?? 0) > 0
  }

  material(name: string): THREE.Material {
    if (name === GLASS) return this.#glass
    const found = this.#materials.get(name)
    if (found) return found
    throw new Error(`kitbash: no material named ${name}`)
  }

  /** Frees every buffer and material the library holds. */
  dispose(): void {
    for (const parts of this.#parts.values()) for (const part of parts) part.geometry.dispose()
    for (const material of this.#materials.values()) material.dispose()
    this.#glass.dispose()
    this.ground?.dispose()
  }
}
