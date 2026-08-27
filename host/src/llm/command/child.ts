/**
 * Running a command: spawned directly with an argument array, never through a
 * shell, so nothing inside a prompt can be read as a command. The child leads
 * its own process group, so the helpers it starts end with it rather than
 * outliving the request that asked for them.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { err, ok, type Result } from '../../result.ts'

export interface Plan {
  readonly binary: string
  readonly args: readonly string[]
  /** Written to the child's stdin, which is then closed. */
  readonly stdin: string
  /** Where the child runs. A scratch directory, never the repository. */
  readonly cwd: string
  /** Exactly what the child sees. Nothing is inherited. */
  readonly env: Readonly<Record<string, string>>
  /** How long it may run before its process group is killed. */
  readonly timeoutMs: number
}

/** How a run ended. */
export interface Ended {
  readonly stdout: string
  readonly stderr: string
  /** null when a signal ended it. */
  readonly code: number | null
  /** It ran past its time and was killed. */
  readonly timedOut: boolean
  /** The caller left, so it was killed on purpose. */
  readonly hungUp: boolean
}

/** A run that never started: the binary is missing, or the machine refused to start it. */
export interface ChildError {
  readonly missing: boolean
  readonly message: string
}

/** What a command is allowed to see of this process's environment. */
const PASSED = ['PATH', 'HOME'] as const

/** Enough of stderr to say what went wrong, without pasting a whole log into an error body. */
const SAID_LIMIT = 500

/** What a run that ended badly says for itself: how it ended, and the tail of what it wrote. */
export function exitDetail(binary: string, ended: Ended): string {
  const status = ended.code === null ? 'a signal' : `status ${ended.code}`
  const said = ended.stderr.trim().slice(-SAID_LIMIT)
  return `${binary} exited with ${status}${said === '' ? '' : `: ${said}`}`
}

type Environment = Readonly<Record<string, string | undefined>>

/**
 * Where to find its own binaries and where its own settings live, and nothing
 * else. No credential of this service's ever reaches a command.
 */
export function safeEnvironment(env: Environment): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of PASSED) {
    const value = env[name]
    if (value !== undefined && value !== '') out[name] = value
  }
  return out
}

/** Every child still running, so a process that is shutting down leaves none behind. */
const running = new Set<Child>()
process.on('exit', () => {
  for (const child of running) child.kill()
})

export class Child {
  readonly #plan: Plan
  #process: ChildProcess | undefined

  constructor(plan: Plan) {
    this.#plan = plan
  }

  /** One run, start to finish. `gone` firing kills it, the way an aborted fetch drops a connection. */
  run(gone?: AbortSignal): Promise<Result<Ended, ChildError>> {
    return new Promise((resolve) => {
      const child = spawn(this.#plan.binary, [...this.#plan.args], {
        cwd: this.#plan.cwd,
        env: { ...this.#plan.env },
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      this.#process = child
      running.add(this)

      const out: Buffer[] = []
      const said: Buffer[] = []
      child.stdout?.on('data', (chunk: Buffer) => out.push(chunk))
      child.stderr?.on('data', (chunk: Buffer) => said.push(chunk))
      // a child that dies before it reads takes the pipe with it
      child.stdin?.on('error', () => {})
      child.stdin?.end(this.#plan.stdin)

      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        this.kill()
      }, this.#plan.timeoutMs)
      timer.unref()

      const hangUp = (): void => this.kill()
      gone?.addEventListener('abort', hangUp, { once: true })

      let settled = false
      const finish = (result: Result<Ended, ChildError>): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        gone?.removeEventListener('abort', hangUp)
        running.delete(this)
        this.#process = undefined
        resolve(result)
      }

      child.once('error', (cause: NodeJS.ErrnoException) => finish(err(unstarted(this.#plan.binary, cause))))
      child.once('close', (code) =>
        finish(
          ok({
            stdout: Buffer.concat(out).toString('utf8'),
            stderr: Buffer.concat(said).toString('utf8'),
            code,
            timedOut,
            hungUp: gone?.aborted === true,
          }),
        ),
      )
    })
  }

  /** SIGKILL to the whole group, so a command that started helpers leaves none of them behind. */
  kill(): void {
    const pid = this.#process?.pid
    if (pid === undefined) return
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      // already gone
    }
  }
}

function unstarted(binary: string, cause: NodeJS.ErrnoException): ChildError {
  if (cause.code === 'ENOENT') return { missing: true, message: `${binary} is not installed on this machine` }
  return { missing: false, message: `${binary} could not be started: ${cause.message}` }
}
