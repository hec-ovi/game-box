import { execFile } from 'node:child_process'
import { cp, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** The project name every model is built under. One name, so nothing is seeded by which model it is. */
const PROJECT = 'gb'

export class ProducerMissing extends Error {
  readonly code = 'producer-missing'
  readonly at: string

  constructor(at: string) {
    super(`glb-buildings is not at ${at}. Clone it there, or set GLB_BUILDINGS to where it is.`)
    this.name = 'ProducerMissing'
    this.at = at
  }
}

export class ProducerRefused extends Error {
  readonly code = 'producer-refused'
  readonly verb: readonly string[]
  readonly answer: string

  constructor(verb: readonly string[], answer: string) {
    super(`buildings ${verb.join(' ')} refused: ${answer}`)
    this.name = 'ProducerRefused'
    this.verb = verb
    this.answer = answer
  }
}

/**
 * The owner's `glb-buildings` CLI, driven the way its skill says to drive it:
 * one verb at a time, reading the answer, never touching the documents.
 *
 * Every model gets a home of its own, so nothing one build does can reach
 * another and the project is always called the same thing. That is what keeps
 * the geometry a function of the look and the footprint alone.
 */
export class Producer {
  readonly root: string
  readonly #homes: string

  private constructor(root: string, homes: string) {
    this.root = root
    this.#homes = homes
  }

  static at(homes: string): Producer {
    const root = resolve(process.env['GLB_BUILDINGS'] ?? resolve(import.meta.dirname, '../../../../glb-buildings-skill'))
    if (!existsSync(join(root, 'boxes/cli/bin/buildings.ts'))) throw new ProducerMissing(root)
    return new Producer(root, homes)
  }

  /** The producer's commit, so a pack says which version of the tool drew it. */
  async version(): Promise<string> {
    const { stdout } = await run('git', ['-C', this.root, 'rev-parse', '--short', 'HEAD'])
    return `glb-buildings@${stdout.trim()}`
  }

  /**
   * Runs one model's worth of verbs in a home of its own and hands back the
   * file it wrote. The home is swept afterwards: the documents that matter are
   * the looks, which are committed, and a per-model document is derived.
   */
  async build(
    id: string,
    verbs: readonly string[][],
    project = PROJECT,
    textures?: string,
  ): Promise<{ file: string; sweep: () => Promise<void> }> {
    const home = join(this.#homes, id)
    await mkdir(home, { recursive: true })
    // the pictures go in before the project does, so the first build already
    // wears them and nothing has to be rebuilt to pick them up
    if (textures) await cp(textures, join(home, 'textures'), { recursive: true })
    for (const verb of verbs) await this.#verb(home, verb, project)
    return {
      file: join(home, 'projects', project, 'build', 'model.glb'),
      sweep: () => rm(home, { recursive: true, force: true }),
    }
  }

  /** Runs one verb in a home of its own, for the calls that set a home up rather than build in it. */
  async textures(home: string, verb: readonly string[]): Promise<void> {
    await mkdir(home, { recursive: true })
    await this.#verb(home, verb, PROJECT)
  }

  async #verb(home: string, verb: readonly string[], project: string): Promise<void> {
    const line = verb[0] === 'new' ? verb : [verb[0]!, '--project', project, ...verb.slice(1)]
    const { stdout } = await run('node', [join(this.root, 'boxes/cli/bin/buildings.ts'), ...line], {
      cwd: home,
      env: { ...process.env, BUILDINGS_HOME: home },
      maxBuffer: 32 * 1024 * 1024,
    }).catch((cause: { stdout?: string }) => ({ stdout: cause.stdout ?? '' }))

    const answer = JSON.parse(stdout || '{"ok":false,"message":"the CLI said nothing"}') as Answer
    if (!answer.ok) throw new ProducerRefused(line, answer.message ?? JSON.stringify(answer))
  }
}

/** Every verb answers with one JSON object, and `ok` is the only field this reads. */
interface Answer {
  readonly ok: boolean
  readonly message?: string
}
