/**
 * Where cached model files live. `GAME_BOX_MODELS_DIR` wins; otherwise the
 * platform cache directory, under `game-box/models`.
 */
import { join } from 'node:path'

export function defaultRoot(): string {
  const override = envPath('GAME_BOX_MODELS_DIR')
  if (override) return override
  const base = envPath('XDG_CACHE_HOME') ?? envPath('LOCALAPPDATA') ?? withHome() ?? '.'
  return join(base, 'game-box', 'models')
}

function withHome(): string | undefined {
  const home = envPath('HOME')
  return home === undefined ? undefined : join(home, '.cache')
}

function envPath(key: string): string | undefined {
  const value = process.env[key]
  return value ? value : undefined
}
