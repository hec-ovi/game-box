import type { AiHealth, AiProvider } from '@gb/hud'

/**
 * What the launcher's settings screen calls things. It is the tab in game word
 * for word, because they are one screen in two places: a player who set a
 * provider up at the front door must recognise it in the settings tab, and the
 * other way round.
 */
export const AI = {
  screens: 'Your televisions',
  screensField: 'Video on the screens',
  screensAbout: 'What every set in town plays, by address. Kept on this machine and never written into a city.',
  providers: 'Providers',
  jobs: 'Which AI does what',
  model: 'Model',
  url: 'Base URL',
  host: 'Host and port',
  key: 'Key',
  typeKey: 'Paste a key',
  store: 'Store key',
  stored: 'A key is stored for this one.',
  noKey: 'No key stored for this one yet.',
  check: 'Check',
  test: 'Test',
  pickModel: 'Pick a model',
  pickProvider: 'Pick a provider',
  unassigned: 'Nothing assigned yet, so the game answers this one its own way.',
  noneReady: 'No provider is ready yet. Set one up under Providers.',
  noProviders: 'The game has offered no provider yet.',
  noJobs: 'The game has offered no job yet.',
} as const

/** How a provider answered the last time it was asked, in a word. */
export const AI_HEALTH: Record<AiHealth, string> = {
  unknown: 'Not checked',
  checking: 'Checking',
  ok: 'Answering',
  failed: 'No answer',
}

/** The colour that word is said in. */
export const AI_TONE: Record<AiHealth, string> = {
  unknown: 'quiet',
  checking: 'accent',
  ok: 'good',
  failed: 'bad',
}

/**
 * What a provider is still waiting on beyond a key, in one plain line. A key
 * of its own is said on the key field, and one that is ready waits on nothing.
 */
export function aiMissing(provider: AiProvider): string | null {
  if (provider.configured || provider.needsKey) return null
  return provider.family === 'local'
    ? 'Point this at a running server before it can answer.'
    : 'Set the model and the address before this one can answer.'
}

/** "Answered in 240 ms", over what came back. */
export function answeredIn(ms: number): string {
  return `Answered in ${ms} ms`
}
