import { ok, type Result } from '@gb/kit'
import type { ConverseEvent, Sidecar, SidecarError } from '@gb/sidecar'
import type { Turn } from './events.ts'
import { Redactor } from './redact.ts'

/**
 * The voice track: what the NPC says, streamed, and nothing else. It is offered
 * no tools, so the model has no id in front of it and no decision to weigh up;
 * it answers the way a person answers, and the first words arrive at once.
 */
export class Voice {
  #sidecar: Sidecar

  constructor(sidecar: Sidecar) {
    this.#sidecar = sidecar
  }

  async speak(input: {
    system: string
    history: readonly Turn[]
    signal?: AbortSignal | undefined
  }): Promise<Result<AsyncIterable<string>, SidecarError>> {
    const stream = await this.#sidecar.converse({ system: input.system, messages: input.history, signal: input.signal })
    if (!stream.ok) return stream
    return ok(spoken(stream.value))
  }
}

/** Text pieces with anything machine-shaped taken out before they are heard. */
async function* spoken(events: AsyncIterable<ConverseEvent>): AsyncGenerator<string> {
  const redactor = new Redactor()
  for await (const event of events) {
    if (event.kind !== 'text') continue
    const piece = redactor.push(event.text)
    if (piece) yield piece
  }
  const last = redactor.flush()
  if (last) yield last
}
