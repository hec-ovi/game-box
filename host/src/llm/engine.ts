/** Where generation goes: a server over HTTP, or a command on this machine. */
import type { Upstream } from './upstream.ts'

/**
 * A command-line agent installed on this machine, run once per request. It
 * takes a JSON Schema and holds its own answer to it, which is what every
 * generated thing in this game needs, so it is asked for a forced call that
 * way and never through a tool choice.
 */
export interface CommandEngine {
  readonly transport: 'command'
  /** The binary, by name on PATH or as a path to it. */
  readonly binary: string
  /** The model asked for when the caller names none. */
  readonly model: string
  /** How long one run may take before its process group is killed. */
  readonly timeoutMs: number
}

export type Engine = Upstream | CommandEngine
