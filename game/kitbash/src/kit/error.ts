/** The art handed over is not the kit we build from. */
export class KitIncomplete extends Error {
  readonly code = 'kit-incomplete' as const
  /** The catalog pieces the scene had no node, or nothing drawable, for. */
  readonly missing: readonly string[]

  constructor(missing: readonly string[]) {
    super(`kitbash: the kit is missing ${missing.length} piece(s): ${missing.join(', ')}`)
    this.name = 'KitIncomplete'
    this.missing = missing
  }
}

/**
 * Pieces sharing a material would not weld into one mesh, because their
 * geometry does not agree attribute for attribute. `loadKit` and
 * `placeholderKit` bring every part to one shape, so this can only come from a
 * `KitLibrary` assembled by hand out of foreign geometry.
 */
export class KitUnmergeable extends Error {
  readonly code = 'kit-unmergeable' as const
  readonly material: string
  readonly pieces: readonly string[]

  constructor(material: string, pieces: readonly string[]) {
    super(`kitbash: the pieces on ${material} do not share one set of vertex attributes: ${pieces.join(', ')}`)
    this.name = 'KitUnmergeable'
    this.material = material
    this.pieces = pieces
  }
}
