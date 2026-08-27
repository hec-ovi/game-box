/**
 * The keys, in a hidden environment-format file the host owns. A value already
 * exported wins over the file, the way `.env` does, so a machine that sets its
 * key in the environment is never overruled by something a screen saved.
 */
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { err, ok, type Result } from '../result.ts'
import { unwritable, type ProvidersError } from './errors.ts'
import type { Environment } from './paths.ts'

/** Owner read and write only: nobody else on the machine gets to see a key. */
const PRIVATE = 0o600

export class SecretStore {
  readonly #path: string
  readonly #env: Environment

  constructor(path: string, env: Environment) {
    this.#path = path
    this.#env = env
  }

  /** The key for a name, from the environment first and the file second. */
  value(name: string): string | undefined {
    const exported = (this.#env[name] ?? '').trim()
    if (exported !== '') return exported
    const stored = this.#read().get(name)
    return stored === undefined || stored === '' ? undefined : stored
  }

  /** An empty value takes the name out of the file; the rest of it is left alone. */
  write(changes: ReadonlyMap<string, string>): Result<void, ProvidersError> {
    if (changes.size === 0) return ok(undefined)
    const lines = this.#read()
    for (const [name, value] of changes) {
      if (value === '') lines.delete(name)
      else lines.set(name, value)
    }
    const text = [...lines].map(([name, value]) => `${name}=${value}`).join('\n')
    return this.#save(text === '' ? '' : `${text}\n`)
  }

  #read(): Map<string, string> {
    const found = new Map<string, string>()
    let text: string
    try {
      text = readFileSync(this.#path, 'utf8')
    } catch {
      return found
    }
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue
      const split = trimmed.indexOf('=')
      if (split <= 0) continue
      found.set(trimmed.slice(0, split).trim(), unquoted(trimmed.slice(split + 1).trim()))
    }
    return found
  }

  /**
   * Written to a neighbour and renamed over the file, so a reader never sees a
   * half-written key. The neighbour is created 0600 and then chmodded to it:
   * the mode a file is created with is masked by the umask, and a key must not
   * be readable by the rest of the machine even for an instant.
   */
  #save(text: string): Result<void, ProvidersError> {
    const temporary = `${this.#path}.writing`
    try {
      mkdirSync(dirname(this.#path), { recursive: true })
      writeFileSync(temporary, text, { encoding: 'utf8', mode: PRIVATE })
      chmodSync(temporary, PRIVATE)
      renameSync(temporary, this.#path)
      return ok(undefined)
    } catch (cause) {
      return err(unwritable(this.#path, String(cause)))
    }
  }
}

function unquoted(value: string): string {
  const quoted = value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value[0] ?? '')
  return quoted ? value.slice(1, -1) : value
}
