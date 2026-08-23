import { choiceOf, type Choice } from './choice.ts'
import type { Progress } from './progress.ts'
import { countOf, isOptional, type Step } from './schema.ts'
import { targetOf, type ObjectiveTarget } from './target.ts'

/**
 * One step as the interface reads it: the line to show, where it points and how
 * far along it is. The objectives panel and the journal both draw from this, so
 * the same step reads the same way wherever it appears.
 */
export interface StepLine extends ObjectiveTarget {
  readonly stepId: string
  readonly text: string
  /** Short label for the world marker, when the objective line is too long for it. */
  readonly markerLabel?: string
  /** A nudge to show if the player stalls. */
  readonly hint?: string
  /** Side work: the quest finishes without it. Absent means it is required. */
  readonly optional?: boolean
  /** How far along a step that wants several things is, for a "3/5" in the interface. */
  readonly count?: { readonly done: number; readonly needed: number }
  /** The decision to put in front of the player, on a `choice` step and nowhere else. */
  readonly choice?: Choice
}

export function stepLine(step: Step, progress: Progress): StepLine {
  return {
    stepId: step.id,
    text: step.objective,
    ...(isOptional(step) ? { optional: true } : {}),
    ...(step.markerLabel ? { markerLabel: step.markerLabel } : {}),
    ...(step.hint ? { hint: step.hint } : {}),
    ...targetOf(step),
    ...choiceOf(step),
    ...countSoFar(step, progress),
  }
}

/** The "3/5", and only where the step wants more than one thing. */
function countSoFar(step: Step, progress: Progress): { count?: { done: number; needed: number } } {
  const needed = countOf(step)
  if (needed <= 1) return {}
  return { count: { done: progress.credited.get(step.id)?.size ?? 0, needed } }
}
