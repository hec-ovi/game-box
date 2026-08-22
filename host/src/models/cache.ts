/** The model cache: one directory of files, each identified by its sha256. */
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { err, ok, type Result } from '../result.ts'
import { sha256Of } from './digest.ts'
import { integrity, invalidEntry, missing, unreadable, type ModelsError } from './errors.ts'
import { defaultRoot } from './root.ts'
import { modelEntryContract, type ResolvedModel } from './schema.ts'

export class Cache {
  #root: string

  constructor(root: string) {
    this.#root = root
  }

  /** Cache at `GAME_BOX_MODELS_DIR`, or the platform cache directory. */
  static open(): Cache {
    return new Cache(defaultRoot())
  }

  /** Cache at an explicit directory. */
  static at(root: string): Cache {
    return new Cache(root)
  }

  get root(): string {
    return this.#root
  }

  /** Locate a catalog entry and verify its digest. Nothing comes back unverified. */
  async resolve(entry: unknown): Promise<Result<ResolvedModel, ModelsError>> {
    const parsed = modelEntryContract.parse(entry)
    if (!parsed.ok) return err(invalidEntry(parsed.error))

    const expected = parsed.value.sha256
    const path = join(this.#root, parsed.value.file)
    if (!isFile(path)) return err(missing(path))

    let digest
    try {
      digest = await sha256Of(path)
    } catch (cause) {
      return err(unreadable(cause))
    }
    if (digest.sha256 !== expected) return err(integrity(expected, digest.sha256))

    return ok({ id: parsed.value.id, path, sizeBytes: digest.sizeBytes, sha256: digest.sha256 })
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}
