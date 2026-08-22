/** The art handed over is not the kit this box furnishes rooms from. */
export class FurnishIncomplete extends Error {
  readonly code = 'furnish-incomplete' as const
  readonly missing: readonly string[]

  constructor(missing: readonly string[]) {
    super(`furnish: the pack is missing ${missing.length} piece(s): ${missing.join(', ')}`)
    this.name = 'FurnishIncomplete'
    this.missing = missing
  }
}
