/** What the registry holds before anybody saves anything. */
import { AGY_MODEL, AGY_TIMEOUT_SECONDS } from './agy.ts'
import { OPENROUTER_BASE, OPENROUTER_MODEL } from './openrouter.ts'
import type { Configuration } from './schema.ts'

export const OPENROUTER_SECRET = 'OPENROUTER_API_KEY'

/**
 * One of each family, so the settings screen has something to fill in rather
 * than something to invent. A second external is another entry here or another
 * row saved from the screen; it needs no code.
 */
export function defaultConfiguration(): Configuration {
  return {
    providers: [
      {
        id: 'openrouter',
        kind: 'external',
        label: 'OpenRouter',
        base: OPENROUTER_BASE,
        model: OPENROUTER_MODEL,
        secretName: OPENROUTER_SECRET,
      },
      { id: 'local', kind: 'local', label: 'Local server', host: '127.0.0.1', port: 8080, model: 'default' },
      { id: 'agy', kind: 'agent', label: 'agy', model: AGY_MODEL, timeoutSeconds: AGY_TIMEOUT_SECONDS },
    ],
    routes: {},
  }
}
