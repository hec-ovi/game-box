/** The one thing that can go wrong here: the art handed over is not the kit we build from. */
export class KitIncomplete extends Error {
  readonly code = 'kit-incomplete' as const

  constructor(readonly missing: readonly string[]) {
    super(`kitbash: the kit is missing ${missing.length} piece(s): ${missing.join(', ')}`)
    this.name = 'KitIncomplete'
  }
}
