/** Reading a save body: what changes, what is kept, and what it cannot mean. */
import type { SchemaViolation } from '../contract.ts'
import { JOBS, type Provider, type Routes, type SaveProvider } from './schema.ts'

/** The provider as it is stored: the key it arrived with belongs in the other file. */
export function withoutSecret(provider: SaveProvider): Provider {
  if (provider.kind !== 'external') return provider
  const { secret, ...rest } = provider
  return rest
}

/**
 * Only externals carry a key, and only a body that mentioned one changes it, so
 * saving a provider list without keys leaves every stored key exactly as it was.
 */
export function secretChanges(providers: readonly SaveProvider[]): Map<string, string> {
  const changes = new Map<string, string>()
  for (const provider of providers) {
    if (provider.kind === 'external' && provider.secret !== undefined) changes.set(provider.secretName, provider.secret)
  }
  return changes
}

/** What a save cannot mean, whatever each field says on its own. */
export function quarrels(providers: readonly Provider[], routes: Routes): SchemaViolation[] {
  const found: SchemaViolation[] = []
  const seen = new Set<string>()
  for (const provider of providers) {
    if (seen.has(provider.id)) found.push({ path: 'providers', message: `two providers share the id ${provider.id}` })
    seen.add(provider.id)
  }
  for (const job of JOBS) {
    const id = routes[job]
    if (id !== undefined && !seen.has(id)) found.push({ path: `routes.${job}`, message: `no provider with the id ${id}` })
  }
  return found
}
