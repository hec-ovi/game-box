import { newSession, type Session } from '../stt/index.ts'
import { errorBody } from './errors.ts'
import type { RealtimeServerEvent } from './schema.ts'

/**
 * One `/v1/realtime` session. Every client frame answers with zero or more
 * server events; an error event never closes the socket and never changes what
 * the recognizer has heard.
 */
export class RealtimeSession {
  #recognizer: Session = newSession()

  handle(frame: string): RealtimeServerEvent[] {
    let event: unknown
    try {
      event = JSON.parse(frame)
    } catch {
      return [refuse('message is not valid JSON')]
    }

    const message = event as { type?: unknown; audio?: unknown }
    const type = event !== null && typeof event === 'object' && !Array.isArray(event) ? message.type : undefined

    if (type === 'input_audio_buffer.append') {
      const heard = this.#recognizer.push(message.audio)
      if (!heard.ok) return [refuse(heard.error.message)]
      return heard.value.map((e) => ({ type: 'transcription.partial', text: e.text }))
    }
    if (type === 'input_audio_buffer.commit') {
      return this.#recognizer.finish().map((e) => ({ type: 'transcription.completed', text: e.text }))
    }
    return [refuse('unknown event type')]
  }
}

function refuse(message: string): RealtimeServerEvent {
  return { type: 'error', ...errorBody(message, 'invalid_request_error') }
}
