/** What the cast refuses to start with. Everything after loading is forgiving. */
export type CastErrorCode =
  /** A file in the pack could not be read as a GLB. */
  | 'unreadable-asset'
  /** `wardrobe.json` is not the shape the build writes. */
  | 'bad-wardrobe'
  /** The wardrobe names a character whose file was not handed to `Cast.load`. */
  | 'missing-character'

export class CastError extends Error {
  readonly code: CastErrorCode
  /** The file or entry at fault. */
  readonly what: string

  constructor(code: CastErrorCode, what: string, detail: string) {
    super(`${what}: ${detail}`)
    this.name = 'CastError'
    this.code = code
    this.what = what
  }
}
