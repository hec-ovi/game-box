import type { SidecarError } from '@gb/sidecar'
import type { ScribeStage } from './progress.ts'

/**
 * Why a call could not be made good: what the engine said, plus `unusable` for
 * an answer that arrived inside its contract and still could not be used here
 * (a name the city had already spent, a batch that missed a building).
 */
export type ScribeFailureCode = SidecarError['code'] | 'unusable'

/**
 * A stage of the writing that stopped. Nothing is substituted for it: the
 * caller gets this back and the build stops, because a city somebody asked a
 * story of is written by the model or not at all.
 */
export interface ScribeFailure {
  /** Which stage stopped. */
  readonly stage: ScribeStage
  /** The call's place in the build (`premise`, `charter:jail`, `signs:2`, `quest:3`). */
  readonly at: string
  readonly code: ScribeFailureCode
  /** One sentence for whoever is waiting: what could not be written, and why. */
  readonly message: string
}

/** Where the call was made: the engine's address without its scheme, the way a settings screen shows it. */
export function addressOf(base: string): string {
  return base.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

/** What the engine said, in the words somebody waiting for a city reads. */
export function saidBy(where: string, error: SidecarError): string {
  switch (error.code) {
    case 'unreachable':
      return `the model at ${where} did not answer`
    case 'refused':
      return `the model at ${where} refused the call (HTTP ${error.status})`
    case 'busy':
      return `the model at ${where} is busy: worth asking again in ${error.retryAfter}s`
    case 'timeout':
      return `the model at ${where} ran out of time`
    case 'broken':
      return `the model at ${where} broke off mid-answer`
    case 'no-tool-call':
      return `the model at ${where} wrote prose instead of the answer`
    case 'aborted':
      return 'the writing was stopped'
    case 'invalid-arguments':
      return `the model at ${where} wrote an answer off the contract: ${firstOf(error.violations)}`
  }
}

/** The call the engine would not make good, said as one sentence. */
export function failureOf(input: { stage: ScribeStage; at: string; what: string; where: string; error: SidecarError }): ScribeFailure {
  return {
    stage: input.stage,
    at: input.at,
    code: input.error.code,
    message: `${input.what} could not be written: ${saidBy(input.where, input.error)}`,
  }
}

/** An answer that held up against its contract and still could not be used here. */
export function unusable(input: { stage: ScribeStage; at: string; what: string; why: string }): ScribeFailure {
  return { stage: input.stage, at: input.at, code: 'unusable', message: `${input.what} could not be written: ${input.why}` }
}

function firstOf(violations: readonly { path: string; message: string }[]): string {
  const first = violations[0]
  return first ? `${first.path}, ${first.message}` : 'nothing it could name'
}
