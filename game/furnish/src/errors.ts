/**
 * The two ways a call here can fail, both a name this box has no shape for.
 *
 * Everything else is generated, so nothing can arrive missing: a pack with no
 * interior surfaces gives none and `surface` falls through to the dressing
 * behind, which is a fall-through and not an error.
 */
export type FurnishErrorCode = 'unknown-prop' | 'unknown-item'

export class FurnishError extends Error {
  readonly code: FurnishErrorCode

  constructor(code: FurnishErrorCode, what: string) {
    super(`furnish: ${code}: ${what}`)
    this.name = 'FurnishError'
    this.code = code
  }
}
