import * as THREE from 'three'
import { PIECES, type PieceId } from '../catalog/pieces.ts'

/** One material's worth of one piece: the geometry in the piece's own frame. */
export interface KitPart {
  readonly material: string
  readonly geometry: THREE.BufferGeometry
}

/**
 * Every piece the kit gives us, loaded once. Buildings clone geometry out of
 * here and never load anything themselves, so a city of a thousand plots reads
 * the art exactly once.
 */
export class KitLibrary {
  readonly #parts: ReadonlyMap<PieceId, readonly KitPart[]>
  readonly #materials: ReadonlyMap<string, THREE.Material>

  constructor(parts: Map<PieceId, KitPart[]>, materials: Map<string, THREE.Material>) {
    this.#parts = parts
    this.#materials = materials
  }

  /** Which pieces of the catalog this library is missing. Empty means it can build anything. */
  static missing(parts: ReadonlyMap<PieceId, unknown>): PieceId[] {
    return (Object.keys(PIECES) as PieceId[]).filter((id) => !parts.has(id))
  }

  parts(piece: PieceId): readonly KitPart[] {
    return this.#parts.get(piece) ?? []
  }

  material(name: string): THREE.Material {
    const found = this.#materials.get(name)
    if (found) return found
    throw new Error(`kitbash: no material named ${name}`)
  }

  /** Frees every buffer and material the library holds. */
  dispose(): void {
    for (const parts of this.#parts.values()) for (const part of parts) part.geometry.dispose()
    for (const material of this.#materials.values()) material.dispose()
  }
}
