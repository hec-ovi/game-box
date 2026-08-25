import type { Sidecar, SidecarError } from '@gb/sidecar'
import type { Pins } from './pins.ts'
import { bullets, prompt } from './prompts.ts'
import type { Tool } from './tools.ts'

/** One field of an answer that did not hold up, in the words the model gets back. */
export interface Violation {
  readonly path: string
  readonly message: string
}

/** A second opinion on an answer the contract already accepted. Empty means it stands. */
export type Check<T> = (value: T) => readonly Violation[]

/** One authoring call that did not work out, kept so a thin world is explainable. */
export interface ScribeProblem {
  readonly task: string
  readonly error: SidecarError
}

export interface AskerOptions {
  readonly sidecar: Sidecar
  readonly pins: Pins
  readonly attempts: number
  /** Left out for the sidecar's own clock, set only where a call is genuinely longer than the rest. */
  readonly timeoutMs?: number | undefined
  readonly signal?: AbortSignal | undefined
  readonly record: (problem: ScribeProblem) => void
}

/**
 * Makes one tool call and keeps at it: a rejected answer comes back to the model
 * with the exact fields quoted, a call that ran out of time or came back as
 * prose is tried again on the next attempt's seed, and anything else gives up
 * so a dead sidecar costs one answer rather than the whole build. Every request
 * carries the seed for its position and attempt, so a second try is a second
 * draw rather than the same one over.
 */
export class Asker {
  #sidecar: Sidecar
  #pins: Pins
  #attempts: number
  #timeoutMs?: number | undefined
  #signal?: AbortSignal | undefined
  #record: (problem: ScribeProblem) => void

  constructor(options: AskerOptions) {
    this.#sidecar = options.sidecar
    this.#pins = options.pins
    this.#attempts = Math.max(1, options.attempts)
    this.#timeoutMs = options.timeoutMs
    this.#signal = options.signal
    this.#record = options.record
  }

  /** `at` is the call's place in the build (`quest:3`), which is what its seed is derived from. */
  async ask<T>(tool: Tool<T>, user: string, at: string, check?: Check<T>): Promise<T | undefined> {
    let request = user
    for (let attempt = 0; attempt < this.#attempts; attempt++) {
      const answer = await this.#sidecar.ask(tool.contract, {
        system: prompt('system'),
        user: request,
        toolName: tool.name,
        toolDescription: tool.description,
        signal: this.#signal,
        ...this.#pins.for(at, attempt),
        ...(this.#timeoutMs === undefined ? {} : { timeoutMs: this.#timeoutMs }),
      })

      if (!answer.ok) {
        this.#record({ task: tool.name, error: answer.error })
        if (answer.error.code === 'timeout' || answer.error.code === 'no-tool-call') continue
        if (answer.error.code !== 'invalid-arguments') return undefined
        request = this.#again(user, answer.error.violations)
        continue
      }

      const violations = check?.(answer.value) ?? []
      if (violations.length === 0) return answer.value
      this.#record({ task: tool.name, error: { code: 'invalid-arguments', violations: violations.slice() } })
      request = this.#again(user, violations)
    }
    return undefined
  }

  /** Says exactly what was wrong and lets it try again. */
  #again(user: string, violations: readonly Violation[]): string {
    const lines = violations.map((violation) => `${violation.path}: ${violation.message}`)
    return `${user}\n\n${prompt('retry', { violations: bullets(lines, 'nothing named') })}`
  }
}
