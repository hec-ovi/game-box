/**
 * Voices the engine can speak. The stand-in ships a fixed list; a real engine
 * (Kyutai Pocket TTS) reports the voices of the loaded checkpoint here.
 */
const VOICES = ['default', 'narrator', 'villager', 'guard'] as const

export function all(): readonly string[] {
  return VOICES
}

export function isKnown(voice: string): boolean {
  return (VOICES as readonly string[]).includes(voice)
}
