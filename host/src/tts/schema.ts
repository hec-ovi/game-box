import { z } from 'zod'
import { contract } from '../contract.ts'

export const SpeakRequestSchema = z
  .strictObject({
    voice: z.string().min(1),
    sampleRate: z.int().min(8000).max(48000).optional(),
    speed: z.number().min(0.5).max(2.0).optional(),
  })
  .meta({ $id: 'game-box.dev/tts/speak-request', title: 'tts speak request (session parameters)' })

export const AudioEventSchema = z
  .union([
    z.strictObject({
      type: z.literal('frame'),
      mediaType: z.literal('audio/pcm;bits=16'),
      sampleRate: z.int().min(8000).max(48000),
      channels: z.literal(1),
      dataBase64: z.string().min(4).meta({ contentEncoding: 'base64' }),
    }),
    z.strictObject({ type: z.literal('end'), durationMs: z.int().min(0) }),
  ])
  .meta({ $id: 'game-box.dev/tts/audio-event', title: 'tts audio event' })

export const speakRequestContract = contract('speak-request', SpeakRequestSchema)
export const audioEventContract = contract('audio-event', AudioEventSchema)

export type SpeakRequest = z.infer<typeof SpeakRequestSchema>
export type AudioEvent = z.infer<typeof AudioEventSchema>
export type AudioFrame = Extract<AudioEvent, { type: 'frame' }>
