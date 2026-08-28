import type { SchemaViolation } from '@gb/kit'
import type { IntegrityProblem, WorldError } from '@gb/world'
import type { Unwritten, WritingStage } from './narrator.ts'

/**
 * Everything that can come back instead of a city. The set is closed, and it is
 * here rather than beside the generator because both halves of the box answer
 * with it: the plan, which is arithmetic, and the build, which is written.
 */
export type ForgeError =
  | { readonly code: 'invalid-brief'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'unsound-world'; readonly problems: readonly IntegrityProblem[] }
  /** A stage of the writing stopped. `message` is the sentence to show whoever asked for the city. */
  | { readonly code: 'unwritten'; readonly stage: WritingStage; readonly message: string }

/** A stage that stopped, as the error a caller reads: the sentence goes on `message`, where the launcher looks for it. */
export const stopped = (failure: Unwritten): ForgeError => ({ code: 'unwritten', stage: failure.stage, message: failure.message })

/** The world refusing a spec means the brief asked for a city that cannot exist. */
export function violationsOf(error: WorldError): readonly SchemaViolation[] {
  if (error.code === 'invalid-document') return error.violations
  if (error.code === 'inconsistent-world') return error.problems.map((p) => ({ path: p.where, message: p.message }))
  return [{ path: '(root)', message: error.message }]
}
