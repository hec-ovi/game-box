/**
 * The two files the configuration lives in. Both sit beside this service's
 * folder, which is the repository root when it sits in one, and both are
 * pointed somewhere else with an environment variable.
 */
import { join } from 'node:path'

export type Environment = Readonly<Record<string, string | undefined>>

const beside = join(import.meta.dirname, '..', '..', '..')

/** Everything that is not a secret: which providers exist and where jobs go. */
export function configPath(env: Environment): string {
  return (env.GAME_BOX_CONFIG_FILE ?? '').trim() || join(beside, '.game-box.json')
}

/** The keys, in environment format, written 0600 and never read back out over HTTP. */
export function secretsPath(env: Environment): string {
  return (env.GAME_BOX_SECRETS_FILE ?? '').trim() || join(beside, '.env.local')
}
