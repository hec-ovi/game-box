/**
 * The clocks the transport keeps, pushed out past the box's own.
 *
 * Node's global fetch is undici, and undici runs two clocks of its own: 300 s
 * from the request to the response headers, and 300 s between two pieces of the
 * body. A local model writing a quest runs longer than that, and undici ends
 * such a call as a broken connection, so a slow answer came back as
 * `unreachable` instead of the retryable `timeout` it is.
 *
 * So every call made from Node carries a dispatcher of its own, with both
 * clocks set from the deadline that call runs against. They are twice as long,
 * so the box's own `Deadline` is always the one that fires, whatever the caller
 * sets `askMs` to, and the two numbers cannot meet again.
 *
 * The dispatcher is an instance of the class the running Node already uses,
 * read off its own global dispatcher. One built from a separate copy of undici
 * is rejected by the built-in fetch as soon as the two majors differ, so the
 * runtime's own class is the only one that always fits, and it costs no
 * dependency. The global dispatcher itself is only read: the host application's
 * fetch keeps every setting it had.
 *
 * None of this happens in a browser, where there is no undici and no dispatcher
 * to hand fetch. Nothing in this box imports `undici` or a `node:` module, so a
 * browser build has nothing to pull in.
 */

/** The dispatcher's clocks, as a multiple of the deadline they have to outlast. */
const HEADROOM = 2

/** Undici's own key for the dispatcher its fetch uses when a call names none. */
const GLOBAL_DISPATCHER = Symbol.for('undici.globalDispatcher.1')

interface Clocks {
  readonly headersTimeout: number
  readonly bodyTimeout: number
}

/** Undici's agent, as much of it as this box touches. */
interface UndiciAgent {
  close?: () => Promise<void>
}

type UndiciAgentClass = new (clocks: Clocks) => UndiciAgent

export class FetchDispatcher {
  #agentClass: Promise<UndiciAgentClass | undefined> | undefined
  #agent: UndiciAgent | undefined
  #ms = 0

  /**
   * What to add to a `fetch` for a call that may run for `ms`. One dispatcher
   * serves the client, growing if a later call is given a longer deadline.
   *
   * Empty in a browser, and empty when the host application has put a
   * dispatcher of its own in place: that one is its decision, and a proxy or a
   * mock would lose its calls if this replaced it.
   */
  async forCall(ms: number): Promise<{ dispatcher?: object }> {
    const clock = Math.ceil(ms * HEADROOM)
    if (this.#agent && this.#ms >= clock) return { dispatcher: this.#agent }

    this.#agentClass ??= defaultAgentClass()
    const Agent = await this.#agentClass
    if (!Agent) return {}

    if (!this.#agent || this.#ms < clock) {
      const previous = this.#agent
      this.#agent = new Agent({ headersTimeout: clock, bodyTimeout: clock })
      this.#ms = clock
      // The one it replaces finishes what it is carrying, then lets its sockets go.
      void previous?.close?.().catch(() => {})
    }
    return { dispatcher: this.#agent }
  }
}

/**
 * The agent class the running Node uses for `fetch`, or nothing.
 *
 * Undici only builds its dispatcher on the first call, so one call is made
 * here first: a `data:` URL is answered inside the process and never opens a
 * socket.
 */
async function defaultAgentClass(): Promise<UndiciAgentClass | undefined> {
  if (!onNode()) return undefined
  try {
    await globalThis.fetch('data:,')
  } catch {
    return undefined
  }
  const current = (globalThis as unknown as Record<symbol, { constructor?: unknown } | undefined>)[GLOBAL_DISPATCHER]
  const agentClass = current?.constructor
  // Only undici's plain agent is copied. Anything else was installed by the host
  // application, and a copy of a proxy or a mock would not do what it does.
  if (typeof agentClass !== 'function' || agentClass.name !== 'Agent') return undefined
  return agentClass as UndiciAgentClass
}

function onNode(): boolean {
  const runtime = (globalThis as { process?: { versions?: { node?: string } } }).process
  return typeof runtime?.versions?.node === 'string'
}
