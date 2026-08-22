import { FrameEncoder } from './frame.ts'
import type { AudioEvent } from './schema.ts'

/** Stand-in speaking rate. A real engine derives frame count from the model. */
const MS_PER_CHAR = 60

/** Unicode White_Space: where one spoken word ends and the next begins. */
const WHITESPACE = /[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/

/** One speaking session: text tokens in, audio frames out, word by word. */
export class Session {
  #encoder: FrameEncoder
  #speed: number
  #wordChars = 0

  constructor(sampleRate: number, speed: number) {
    this.#encoder = new FrameEncoder(sampleRate)
    this.#speed = speed
  }

  /**
   * Feed a text token (an LLM token, a word, a whole line: any slice). Returns
   * the frames that are ready, which is why speech starts long before the
   * sentence is complete.
   */
  pushText(text: string): AudioEvent[] {
    for (const ch of text) {
      if (WHITESPACE.test(ch)) this.#closeWord(1)
      else this.#wordChars += 1
    }
    return this.#encoder.drain()
  }

  /**
   * End the utterance: flushes the trailing audio, emits exactly one `end`
   * event, and resets the session for the next line.
   */
  finish(): AudioEvent[] {
    this.#closeWord(0)
    const out: AudioEvent[] = this.#encoder.flush()
    out.push({ type: 'end', durationMs: this.#encoder.spokenMs() })
    this.#encoder.reset()
    return out
  }

  #closeWord(gapChars: number): void {
    if (this.#wordChars === 0) return
    const chars = this.#wordChars + gapChars
    this.#encoder.owe(this.#encoder.samplesForMs((chars * MS_PER_CHAR) / this.#speed))
    this.#wordChars = 0
  }
}
