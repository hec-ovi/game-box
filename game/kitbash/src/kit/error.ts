/** The art handed over is not the kit we build from. */
export class KitIncomplete extends Error {
  readonly code = 'kit-incomplete' as const

  constructor(readonly missing: readonly string[]) {
    super(`kitbash: the kit is missing ${missing.length} piece(s): ${missing.join(', ')}`)
    this.name = 'KitIncomplete'
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

  constructor(readonly material: string, readonly pieces: readonly string[]) {
    super(`kitbash: the pieces on ${material} do not share one set of vertex attributes: ${pieces.join(', ')}`)
    this.name = 'KitUnmergeable'
  }
}
