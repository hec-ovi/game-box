import { expect as unwrap, type Result } from '@gb/kit'
import type { ScribeFailure } from '../src/index.ts'

/** What the scribe wrote, or a thrown test failure saying which stage stopped and why. */
export async function wrote<T>(answer: Promise<Result<T, ScribeFailure>>): Promise<T> {
  const written = await answer
  return unwrap(written, written.ok ? '' : written.error.message)
}

/** Why the scribe stopped. Throws when it did not, because that is the test failing. */
export async function stopped<T>(answer: Promise<Result<T, ScribeFailure>>): Promise<ScribeFailure> {
  const written = await answer
  if (written.ok) throw new Error(`expected the stage to stop, and it wrote ${JSON.stringify(written.value).slice(0, 200)}`)
  return written.error
}
