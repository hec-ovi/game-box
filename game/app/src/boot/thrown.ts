/**
 * What a thrown failure says for itself. `@gb/scribe` throws when a model call
 * cannot be made good, and the player is owed the sentence it threw rather than
 * a line saying that something went wrong.
 */
export function thrown(cause: unknown): string {
  const said = cause instanceof Error ? cause.message : String(cause)
  return said.trim() || 'it stopped without saying why'
}
