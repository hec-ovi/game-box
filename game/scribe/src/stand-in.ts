import type { Written } from '@gb/forge'

/**
 * What a stand-in wrote, or nothing.
 *
 * A stand-in is a `Narrator` like any other, so its answers can stop too.
 * Nothing means the caller keeps the model's own failure, which is the reason
 * worth showing: the stand-in is only ever there in a test or a harness.
 */
export function answered<T>(written: Written<T> | undefined): T | undefined {
  return written?.ok ? written.value : undefined
}
