import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Forge, type ForgeResult, type Narrator } from '../src/index.ts'

/**
 * The city as the local model actually wrote it, played back.
 *
 * A city's words are a model's, so the tests do not get to make any up. What is
 * committed in `fixtures/recording.json` is every question a build put to the
 * narrator port and the answer the model gave, taken off one real run against
 * the engine. `Recorded` answers from that and from nothing else: a question
 * that is not in the recording throws, so it can never invent a name, a person
 * or a quest, and a change to the architecture that moves a question shows up
 * as a loud miss rather than as a quietly different town.
 *
 * Re-recording needs the engine. The tool that made it is not in the box,
 * because a box may not reach into `@gb/scribe`.
 */

/** One question, keyed by the method and the request, and the answer the model gave. */
interface Call {
  readonly method: string
  readonly key: string
  readonly output: unknown
}

interface Recording {
  readonly brief: Record<string, unknown>
  readonly calls: readonly Call[]
}

const RECORDING = JSON.parse(readFileSync(new URL('./fixtures/recording.json', import.meta.url), 'utf8')) as Recording

/** The question, as the recording keys it. */
const keyOf = (method: string, input: unknown): string =>
  createHash('sha256').update(JSON.stringify([method, input])).digest('hex').slice(0, 32)

/** What the model was asked, and what it answered. Nothing else is on offer. */
class Replay {
  readonly asked: Array<{ method: string; input: unknown }> = []
  readonly #answers = new Map<string, unknown>()

  constructor(calls: readonly Call[]) {
    for (const call of calls) this.#answers.set(call.key, call.output)
  }

  answer<T>(method: string, input: unknown): T {
    const found = this.#answers.get(keyOf(method, input))
    if (found === undefined) {
      throw new Error(`${method} was asked something the model was never asked; the recording is stale, and nothing here may make an answer up`)
    }
    this.asked.push({ method, input })
    return found as T
  }

  /** Every request of one method, in the order they were put. */
  requests<T>(method: string): T[] {
    return this.asked.filter((one) => one.method === method).map((one) => one.input as T)
  }
}

/** A narrator that answers a build out of the recording, and throws at anything it was never asked. */
export class Recorded implements Narrator {
  readonly #replay = new Replay(RECORDING.calls)

  /** Every question this narrator was put, in the order the build put them. */
  get asked(): ReadonlyArray<{ method: string; input: unknown }> {
    return this.#replay.asked
  }

  requests<T>(method: string): T[] {
    return this.#replay.requests<T>(method)
  }

  writePremise = async (input: Parameters<NonNullable<Narrator['writePremise']>>[0]) => this.#replay.answer<ReturnType<NonNullable<Narrator['writePremise']>>>('writePremise', input)
  nameCity = async (input: Parameters<Narrator['nameCity']>[0]) => this.#replay.answer<Awaited<ReturnType<Narrator['nameCity']>>>('nameCity', input)
  namePlace = async (input: Parameters<Narrator['namePlace']>[0]) => this.#replay.answer<Awaited<ReturnType<Narrator['namePlace']>>>('namePlace', input)
  namePlaces = async (requests: Parameters<NonNullable<Narrator['namePlaces']>>[0]) =>
    this.#replay.answer<Awaited<ReturnType<NonNullable<Narrator['namePlaces']>>>>('namePlaces', requests)
  nameDistricts = async (requests: Parameters<NonNullable<Narrator['nameDistricts']>>[0]) =>
    this.#replay.answer<Awaited<ReturnType<NonNullable<Narrator['nameDistricts']>>>>('nameDistricts', requests)
  describeNpc = async (input: Parameters<Narrator['describeNpc']>[0]) => this.#replay.answer<Awaited<ReturnType<Narrator['describeNpc']>>>('describeNpc', input)
  describeItem = async (input: Parameters<Narrator['describeItem']>[0]) => this.#replay.answer<Awaited<ReturnType<Narrator['describeItem']>>>('describeItem', input)
  writeInstances = async (requests: Parameters<NonNullable<Narrator['writeInstances']>>[0]) =>
    this.#replay.answer<Awaited<ReturnType<NonNullable<Narrator['writeInstances']>>>>('writeInstances', requests)
  writeQuests = async (input: Parameters<Narrator['writeQuests']>[0]) => this.#replay.answer<Awaited<ReturnType<Narrator['writeQuests']>>>('writeQuests', input)
}

/** The brief the recording was made against. */
export const RECORDED_BRIEF: Record<string, unknown> = RECORDING.brief

/** The history the model wrote for it, as a plan takes one. */
export const recordedHistory = (): unknown => {
  const written = RECORDING.calls.find((call) => call.method === 'writePremise')?.output as { ok: boolean; value?: unknown } | undefined
  if (!written?.ok) throw new Error('the recording holds no history')
  return written.value
}

/** Builds the recorded city, once, out of the recorded answers. */
export async function recordedCity(narrator: Narrator = new Recorded()): Promise<ForgeResult> {
  const built = await new Forge(narrator).build(RECORDED_BRIEF)
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 800))
  return built.value
}
