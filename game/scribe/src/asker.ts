import { err, ok, type Result } from '@gb/kit'
import type { Sidecar, SidecarError } from '@gb/sidecar'
import { failureOf, unusable, type ScribeFailure } from './failure.ts'
import type { Pins } from './pins.ts'
import type { ScribeStage } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import type { Tool } from './tools.ts'

/** One field of an answer that did not hold up, in the words the model gets back. */
export interface Violation {
  readonly path: string
  readonly message: string
}

/** A second opinion on an answer the contract already accepted. Empty means it stands. */
export type Check<T> = (value: T) => readonly Violation[]

/** One authoring call: its place in the build, and what it is writing in the words a player reads. */
export interface Call {
  /** `premise`, `charter:jail`, `signs:2`, `quest:3`: what the call's seed is drawn from. */
  readonly at: string
  /** `the history`, `the sign over a bar`: the subject of the sentence a failure comes back as. */
  readonly what: string
}

/** One authoring call that did not work out, kept so a thin world is explainable. */
export interface ScribeProblem {
  readonly task: string
  /** The call's place in the build (`charter:jail`, `quest:3`): which answer the town went without. */
  readonly at: string
  readonly error: SidecarError
}

/** What is worth a second draw: the engine ran out of time, died mid-reply, or wrote prose. Measured: a charter call broke off at 327 s beside four that took 39 s. */
const RETRIED: ReadonlySet<SidecarError['code']> = new Set(['timeout', 'broken', 'no-tool-call'])

export interface AskerOptions {
  readonly sidecar: Sidecar
  readonly pins: Pins
  /** Which stage of the writing the calls made through this asker belong to. Every one of them carries it. */
  readonly stage: ScribeStage
  /** The engine's address, for the sentence a failure comes back as. */
  readonly where: string
  readonly attempts: number
  /** Left out for the sidecar's own clock, set only where a call is genuinely longer than the rest. */
  readonly timeoutMs?: number | undefined
  readonly signal?: AbortSignal | undefined
  readonly record: (problem: ScribeProblem) => void
}

/**
 * Makes one tool call and keeps at it: a rejected answer comes back to the model
 * with the exact fields quoted, and a call that ran out of time, broke off
 * mid-reply or came back as prose is tried again on the next attempt's seed. A
 * call the model will not make good comes back as a `ScribeFailure` saying which
 * stage stopped and what the engine said. Every request carries the seed for its
 * position and attempt, so a second try is a second draw rather than the same one
 * over, and the stage it belongs to, so the service can send it to the model that
 * work is assigned to.
 */
export class Asker {
  #sidecar: Sidecar
  #pins: Pins
  #stage: ScribeStage
  #where: string
  #attempts: number
  #timeoutMs?: number | undefined
  #signal?: AbortSignal | undefined
  #record: (problem: ScribeProblem) => void

  constructor(options: AskerOptions) {
    this.#sidecar = options.sidecar
    this.#pins = options.pins
    this.#stage = options.stage
    this.#where = options.where
    this.#attempts = Math.max(1, options.attempts)
    this.#timeoutMs = options.timeoutMs
    this.#signal = options.signal
    this.#record = options.record
  }

  async ask<T>(tool: Tool<T>, user: string, call: Call, check?: Check<T>): Promise<Result<T, ScribeFailure>> {
    let request = user
    for (let attempt = 0; ; attempt++) {
      const spent = attempt >= this.#attempts - 1
      const answer = await this.#sidecar.ask(tool.contract, {
        system: prompt('system'),
        user: request,
        toolName: tool.name,
        toolDescription: tool.description,
        job: this.#stage,
        signal: this.#signal,
        ...this.#pins.for(call.at, attempt),
        ...(this.#timeoutMs === undefined ? {} : { timeoutMs: this.#timeoutMs }),
      })

      if (!answer.ok) {
        this.#record({ task: tool.name, at: call.at, error: answer.error })
        const worthAnother = RETRIED.has(answer.error.code) || answer.error.code === 'invalid-arguments'
        if (spent || !worthAnother) return err(this.#failed(call, answer.error))
        if (answer.error.code === 'invalid-arguments') request = this.#again(user, answer.error.violations)
        continue
      }

      const violations = check?.(answer.value) ?? []
      if (violations.length === 0) return ok(answer.value)
      const error: SidecarError = { code: 'invalid-arguments', violations: violations.slice() }
      this.#record({ task: tool.name, at: call.at, error })
      if (spent) return err(this.#failed(call, error))
      request = this.#again(user, violations)
    }
  }

  /** What the engine said, as the sentence the launcher shows. */
  #failed(call: Call, error: SidecarError): ScribeFailure {
    return failureOf({ stage: this.#stage, at: call.at, what: call.what, where: this.#where, error })
  }

  /** An answer that held up against its contract and still could not be used here. */
  unusable(call: Call, why: string): ScribeFailure {
    return unusable({ stage: this.#stage, at: call.at, what: call.what, why })
  }

  /** Says exactly what was wrong and lets it try again. */
  #again(user: string, violations: readonly Violation[]): string {
    const lines = violations.map((violation) => `${violation.path}: ${violation.message}`)
    return `${user}\n\n${prompt('retry', { violations: bullets(lines, 'nothing named') })}`
  }
}
