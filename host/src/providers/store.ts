/** The provider list and the routing, in a hidden JSON file the host owns. */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { violationText } from '../contract.ts'
import { err, ok, type Result } from '../result.ts'
import { defaultConfiguration } from './defaults.ts'
import { unreadable, unwritable, type ProvidersError } from './errors.ts'
import { configurationContract, type Configuration } from './schema.ts'

export class ConfigStore {
  readonly #path: string

  constructor(path: string) {
    this.#path = path
  }

  /** The stored configuration, or the defaults when nobody has saved one. */
  read(): Result<Configuration, ProvidersError> {
    let text: string
    try {
      text = readFileSync(this.#path, 'utf8')
    } catch {
      return ok(defaultConfiguration())
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return err(unreadable(this.#path, 'it is not valid JSON'))
    }
    const checked = configurationContract.parse(parsed)
    return checked.ok ? ok(checked.value) : err(unreadable(this.#path, violationText(checked.error)))
  }

  write(configuration: Configuration): Result<void, ProvidersError> {
    const temporary = `${this.#path}.writing`
    try {
      mkdirSync(dirname(this.#path), { recursive: true })
      writeFileSync(temporary, `${JSON.stringify(configuration, null, 2)}\n`, 'utf8')
      renameSync(temporary, this.#path)
      return ok(undefined)
    } catch (cause) {
      return err(unwritable(this.#path, String(cause)))
    }
  }
}
