import { ArgumentSchema } from './argument-schema.ts'
import { objectIn } from './json-text.ts'
import type { DoneEvent, TokenEvent, Tool, ToolCallEvent } from './schema.ts'

/** How the engine was asked for the call: as a tool choice, or as JSON content fitting the tool's parameters. */
export type Asked = 'call' | 'json'

type Token = Extract<TokenEvent, { type: 'token' }>

/**
 * A reply that was supposed to be one call. Its text is held back until the
 * reply ends, because it may be the call written as JSON: asked for JSON,
 * that is the answer by design; asked for a call, it is a salvage and the
 * event says so. Text that is not the call, or that arrives beside a real
 * call, comes through as it was.
 */
export class ForcedReply {
  readonly #tool: Tool
  readonly #asked: Asked
  #held: Token[] = []
  #called = false

  constructor(tool: Tool, asked: Asked) {
    this.#tool = tool
    this.#asked = asked
  }

  async *through(events: AsyncIterable<TokenEvent>): AsyncGenerator<TokenEvent> {
    for await (const event of events) {
      switch (event.type) {
        case 'token':
          this.#held.push(event)
          break
        case 'tool-call':
          this.#called = true
          yield* this.#release()
          yield event
          break
        case 'done':
          yield* this.#end(event)
          break
      }
    }
  }

  *#end(done: DoneEvent): Generator<TokenEvent> {
    const rebuilt = this.#called || done.finishReason !== 'stop' ? undefined : this.#rebuild()
    if (rebuilt === undefined) yield* this.#release()
    else {
      this.#held = []
      yield rebuilt
    }
    yield done
  }

  *#release(): Generator<TokenEvent> {
    const held = this.#held
    this.#held = []
    yield* held
  }

  #rebuild(): ToolCallEvent | undefined {
    const value = objectIn(this.#held.map((token) => token.text).join(''))
    if (value === undefined || !new ArgumentSchema(this.#tool).accepts(value)) return undefined
    const event: ToolCallEvent = { type: 'tool-call', name: this.#tool.function.name, arguments: value }
    return this.#asked === 'call' ? { ...event, salvaged: true } : event
  }
}
