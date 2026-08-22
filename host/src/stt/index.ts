/** Speech recognition: audio chunk envelopes in, partial and final transcripts out. */
export { Session, newSession } from './session.ts'
export type { SttError } from './errors.ts'
export {
  AudioChunkSchema,
  AudioEnvelopeSchema,
  TranscriptEventSchema,
  audioChunkContract,
  transcriptEventContract,
  type AudioChunk,
  type TranscriptEvent,
} from './schema.ts'
