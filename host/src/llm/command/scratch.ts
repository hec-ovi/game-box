/**
 * A throwaway working directory under the platform's temporary directory, so a
 * command that carries file tools of its own never runs anywhere near the
 * repository. It is removed when the run ends, whatever the run did.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export class Scratch {
  readonly dir: string

  constructor(prefix: string) {
    this.dir = mkdtempSync(join(tmpdir(), prefix))
  }

  /** Writes a file the command is meant to read, and hands back its path. */
  file(name: string, contents: string): string {
    const path = join(this.dir, name)
    writeFileSync(path, contents, 'utf8')
    return path
  }

  close(): void {
    rmSync(this.dir, { recursive: true, force: true })
  }
}
