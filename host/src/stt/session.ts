import { err, ok, type Result } from '../result.ts'
import { decodeBase64 } from './base64.ts'
import { invalidChunk, type SttError } from './errors.ts'
import { audioChunkContract, type TranscriptEvent } from './schema.ts'

const DEFAULT_SAMPLE_RATE = 16000

/**
 * One recognition session. Deterministic stand-in engine for now: it reports
 * how much audio it has heard. The seam for a real streaming recognizer
 * (sherpa-onnx Nemotron) is this same push/finish surface.
 */
export class Session {
  #samples = 0
  #sampleRate = DEFAULT_SAMPLE_RATE

  /** Feed one audio chunk envelope. An invalid chunk changes nothing. */
  push(chunk: unknown): Result<TranscriptEvent[], SttError> {
    const parsed = audioChunkContract.parse(chunk)
    if (!parsed.ok) return err(invalidChunk(parsed.error))
    const data = decodeBase64(parsed.value.dataBase64)
    if (!data) return err(invalidChunk('dataBase64: not valid base64'))
    if (data.length % 2 !== 0) return err(invalidChunk('odd byte count for 16-bit PCM'))

    this.#sampleRate = parsed.value.sampleRate
    this.#samples += data.length / 2
    return ok([{ type: 'partial', text: `heard ${this.#heardMs()}ms` }])
  }

  /** End the utterance: exactly one `final` event, then a fresh utterance. */
  finish(): TranscriptEvent[] {
    const event: TranscriptEvent = { type: 'final', text: `heard ${this.#heardMs()}ms total` }
    this.#samples = 0
    return [event]
  }

  #heardMs(): number {
    return Math.floor((this.#samples * 1000) / Math.max(this.#sampleRate, 1))
  }
}

export function newSession(): Session {
  return new Session()
}
