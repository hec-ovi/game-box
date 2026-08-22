import { z } from 'zod'
import { contract } from '../contract.ts'

/**
 * Audio only crosses a boundary as this envelope, never as bare bytes. The
 * shape is unlabelled so the api layer can embed it in its own event schema;
 * `AudioChunkSchema` is the same shape published under its own id.
 */
export const AudioEnvelopeSchema = z.strictObject({
  mediaType: z.literal('audio/pcm;bits=16'),
  sampleRate: z.int().min(8000).max(48000),
  channels: z.literal(1).optional(),
  dataBase64: z.string().min(4).meta({ contentEncoding: 'base64' }),
})

export const AudioChunkSchema = AudioEnvelopeSchema.meta({
  $id: 'game-box.dev/stt/audio-chunk',
  title: 'audio chunk envelope (mono 16-bit PCM, base64)',
})

export const TranscriptEventSchema = z
  .strictObject({
    type: z.enum(['partial', 'final']),
    text: z.string(),
  })
  .meta({ $id: 'game-box.dev/stt/transcript-event', title: 'stt transcript event' })

export const audioChunkContract = contract('audio-chunk', AudioChunkSchema)
export const transcriptEventContract = contract('transcript-event', TranscriptEventSchema)

export type AudioChunk = z.infer<typeof AudioChunkSchema>
export type TranscriptEvent = z.infer<typeof TranscriptEventSchema>
