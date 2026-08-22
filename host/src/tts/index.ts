/** Speech synthesis: text tokens in, PCM frames out, speaking mid-sentence. */
import { err, ok, type Result } from '../result.ts'
import { invalidRequest, unknownVoice, type TtsError } from './errors.ts'
import { speakRequestContract } from './schema.ts'
import { Session } from './session.ts'
import { all, isKnown } from './voice.ts'

/** Mimi codec native rate, what the streaming engine produces. */
const DEFAULT_SAMPLE_RATE = 24000

/** Open a speaking session. */
export function newSession(request: unknown): Result<Session, TtsError> {
  const parsed = speakRequestContract.parse(request)
  if (!parsed.ok) return err(invalidRequest(parsed.error))
  if (!isKnown(parsed.value.voice)) return err(unknownVoice(parsed.value.voice))
  return ok(new Session(parsed.value.sampleRate ?? DEFAULT_SAMPLE_RATE, parsed.value.speed ?? 1))
}

/** Voices `newSession` accepts. */
export function voices(): readonly string[] {
  return all()
}

export { Session } from './session.ts'
export type { TtsError } from './errors.ts'
export {
  SpeakRequestSchema,
  AudioEventSchema,
  speakRequestContract,
  audioEventContract,
  type SpeakRequest,
  type AudioEvent,
} from './schema.ts'
