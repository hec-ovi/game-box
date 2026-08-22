import type { AudioFrame } from './schema.ts'

/** 12.5 Hz, the frame rate the Mimi codec streams at. */
export const FRAME_MS = 80

/** Turns owed speech time into base64 PCM frame envelopes. */
export class FrameEncoder {
  #sampleRate: number
  #owed = 0
  #spoken = 0

  constructor(sampleRate: number) {
    this.#sampleRate = sampleRate
  }

  frameSamples(): number {
    return Math.floor((this.#sampleRate * FRAME_MS) / 1000)
  }

  samplesForMs(ms: number): number {
    return Math.round((ms * this.#sampleRate) / 1000)
  }

  /** Speech time that has been decided but not yet handed out as frames. */
  owe(samples: number): void {
    this.#owed += samples
  }

  /** Whole frames that are ready right now. */
  drain(): AudioFrame[] {
    const frame = this.frameSamples()
    const out: AudioFrame[] = []
    while (this.#owed >= frame) {
      this.#owed -= frame
      out.push(this.#emit(frame))
    }
    return out
  }

  /** Everything left, including a short trailing frame. */
  flush(): AudioFrame[] {
    const out = this.drain()
    if (this.#owed > 0) {
      const rest = this.#owed
      this.#owed = 0
      out.push(this.#emit(rest))
    }
    return out
  }

  spokenMs(): number {
    return Math.floor((this.#spoken * 1000) / Math.max(this.#sampleRate, 1))
  }

  reset(): void {
    this.#owed = 0
    this.#spoken = 0
  }

  #emit(samples: number): AudioFrame {
    this.#spoken += samples
    return {
      type: 'frame',
      mediaType: 'audio/pcm;bits=16',
      sampleRate: this.#sampleRate,
      channels: 1,
      dataBase64: Buffer.alloc(samples * 2).toString('base64'),
    }
  }
}
