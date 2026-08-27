/** What this service knows about agy itself, as opposed to any command. */
import type { Environment } from './paths.ts'

/** Where the binary is, when it is not simply on PATH. */
export const AGY_BINARY_VARIABLE = 'GAME_BOX_AGY_BIN'

/** Found on PATH by name unless the variable above says otherwise. */
export const AGY_BINARY = 'agy'

/** The fast one of the models it lists, and what a new entry starts on. */
export const AGY_MODEL = 'gemini-3.7-flash-low'

/** Long enough for a whole city document, short enough that a hung run ends. */
export const AGY_TIMEOUT_SECONDS = 300

export function agyBinary(env: Environment): string {
  return (env[AGY_BINARY_VARIABLE] ?? '').trim() || AGY_BINARY
}
