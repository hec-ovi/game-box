/**
 * How agy is run and read.
 *
 * It runs one turn per call. The turn goes in on stdin as one NDJSON line and
 * the answer comes back on stdout as NDJSON ending in a `result` event. The
 * prompt is on stdin rather than on the command line because Linux refuses a
 * single argument over 128 KiB (measured on 2026-08-27: 127 KiB spawns, 128
 * KiB is E2BIG) and a prompt here runs to tens of kilobytes; a 41 KB prompt
 * over stdin came back in 6.0 s wall clock. The schema goes to a file in the
 * scratch directory for the same reason.
 *
 * A forced call is asked for with `--json-schema`, which agy holds its answer
 * to. The enforced answer is `result.structured_output`, not `result.response`:
 * the text carries two extra fields (`toolAction`, `toolSummary`) that agy adds
 * to the tool it enforces the schema through, and a schema written
 * `additionalProperties: false` refuses them.
 */
import { err, ok, type Result } from '../../result.ts'
import { grammarSchema } from '../grammar-schema.ts'
import type { GenerateRequest, Tool } from '../schema.ts'
import { Child, exitDetail, safeEnvironment, type ChildError, type Ended } from './child.ts'
import type { CommandEngine } from '../engine.ts'
import { promptOf } from './prompt.ts'
import { Scratch } from './scratch.ts'

/** Why a run produced nothing: `silent` (it never answered) or `refused` (it answered, badly). */
export interface CommandFailure {
  readonly kind: 'silent' | 'refused'
  readonly message: string
}

const SCRATCH_PREFIX = 'game-box-agy-'
const SCHEMA_FILE = 'schema.json'

/** Its own timeout ends the turn first; the kill is the backstop behind it. */
const GRACE_MS = 2_000

/** What it writes when its own print timeout fired, measured on 2026-08-27. */
const TIMED_OUT = /^timeout\b/i

interface AgyResult {
  readonly status?: unknown
  readonly response?: unknown
  readonly error?: unknown
  readonly structured_output?: unknown
}

export class Agy {
  readonly #engine: CommandEngine

  constructor(engine: CommandEngine) {
    this.#engine = engine
  }

  /** One run: the text of the answer, or why there is none. */
  async answer(request: GenerateRequest, tool: Tool | undefined, gone?: AbortSignal): Promise<Result<string, CommandFailure>> {
    const scratch = new Scratch(SCRATCH_PREFIX)
    try {
      const schema =
        tool === undefined ? undefined : scratch.file(SCHEMA_FILE, `${JSON.stringify(grammarSchema(tool.function.parameters))}\n`)
      const ended = await new Child({
        binary: this.#engine.binary,
        args: this.#args(request.model ?? this.#engine.model, schema),
        stdin: `${JSON.stringify(turn(promptOf(request.messages)))}\n`,
        cwd: scratch.dir,
        env: safeEnvironment(process.env),
        timeoutMs: this.#engine.timeoutMs + GRACE_MS,
      }).run(gone)
      return this.#read(ended, tool !== undefined)
    } finally {
      scratch.close()
    }
  }

  /**
   * No output-length cap, here as anywhere. The tools it carries are kept away
   * from anything of ours: it runs sandboxed, with slash commands off, in a
   * scratch directory. Its own print timeout matches ours so a run left behind
   * by a dying process still ends itself.
   */
  #args(model: string, schemaPath: string | undefined): string[] {
    return [
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--model',
      model,
      '--print-timeout',
      `${Math.ceil(this.#engine.timeoutMs / 1000)}s`,
      '--sandbox',
      '--disable-slash-commands',
      ...(schemaPath === undefined ? [] : ['--json-schema', schemaPath]),
      // print mode with the turns on stdin: the flag still wants a value
      '--print',
      '',
    ]
  }

  #read(ended: Result<Ended, ChildError>, forced: boolean): Result<string, CommandFailure> {
    if (!ended.ok) return err({ kind: 'silent', message: ended.error.message })
    const run = ended.value
    if (run.hungUp) return err({ kind: 'silent', message: `${this.#engine.binary} was stopped: the caller left` })
    if (run.timedOut) return err({ kind: 'silent', message: this.#tookTooLong() })
    if (run.code !== 0) return err({ kind: 'refused', message: exitDetail(this.#engine.binary, run) })

    const result = answerIn(run.stdout)
    if (result === undefined) return err({ kind: 'refused', message: `${this.#engine.binary} answered with something that is not its result JSON` })
    if (result.status !== 'SUCCESS') {
      const said = typeof result.error === 'string' && result.error !== '' ? result.error : 'it gave no reason'
      if (TIMED_OUT.test(said)) return err({ kind: 'silent', message: this.#tookTooLong() })
      return err({ kind: 'refused', message: `${this.#engine.binary} could not answer: ${said}` })
    }

    const structured = forced ? result.structured_output : undefined
    if (structured !== undefined && structured !== null) return ok(JSON.stringify(structured))
    return ok(typeof result.response === 'string' ? result.response : '')
  }

  #tookTooLong(): string {
    return `${this.#engine.binary} did not answer within ${Math.ceil(this.#engine.timeoutMs / 1000)} s`
  }
}

/** The one NDJSON line a print-mode run reads as its turn. */
function turn(content: string): unknown {
  return { event: 'user', message: { role: 'user', content } }
}

/** The last `result` event on stdout, which is where the whole answer is. */
function answerIn(stdout: string): AgyResult | undefined {
  for (const line of stdout.split('\n').reverse()) {
    if (line.trim() === '') continue
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }
    const event = parsed as { event?: unknown; result?: unknown }
    if (event.event === 'result' && event.result !== null && typeof event.result === 'object') return event.result as AgyResult
  }
  return undefined
}
