/**
 * Records one real build against the engine, for `@gb/forge`'s written-city tests.
 *
 * A city's words are a model's, so the tests may not make any up. This runs a
 * whole `Forge.build` through `@gb/scribe`, keeps every question the narrator
 * port was put and the answer the model gave, and writes them where
 * `game/forge/tests/recorded.ts` replays them from. It lives here rather than in
 * a box because it reaches into both `@gb/forge` and `@gb/scribe`.
 *
 *   node --experimental-strip-types tools/record-city.ts [seed] [blocks]
 */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { Forge, type Narrator } from '../game/forge/src/index.ts'
import { Scribe } from '../game/scribe/src/index.ts'

const seed = process.argv[2] ?? 'recorded'
const blocks = Number(process.argv[3] ?? 3)
const brief = { theme: 'quiet coastal town', seed, blocksX: blocks, blocksY: blocks }

const keyOf = (method: string, input: unknown): string =>
  createHash('sha256').update(JSON.stringify([method, input])).digest('hex').slice(0, 32)

const calls: Array<{ method: string; key: string; output: unknown }> = []

/** Every member the scribe has, forwarded and written down. Nothing is added that it does not have. */
function watching(inner: Narrator): Narrator {
  const seen = (method: string) => async (input: unknown) => {
    const started = Date.now()
    const output = await (inner as unknown as Record<string, (one: unknown) => Promise<unknown>>)[method]!(input)
    calls.push({ method, key: keyOf(method, input), output })
    console.log(`[${method}] ${Date.now() - started} ms  ok=${(output as { ok?: boolean }).ok}`)
    return output
  }
  const watched: Record<string, unknown> = {}
  for (const method of ['writePremise', 'nameCity', 'namePlace', 'namePlaces', 'nameDistricts', 'describeNpc', 'describeItem', 'writePlaces', 'writeInstances', 'writeQuests']) {
    if (typeof (inner as unknown as Record<string, unknown>)[method] === 'function') watched[method] = seen(method)
  }
  return watched as unknown as Narrator
}

const scribe = new Scribe({ seed })
const built = await new Forge(watching(scribe)).build(brief)
if (!built.ok) {
  console.error('the build stopped:', JSON.stringify(built.error))
  process.exit(1)
}

const out = new URL('../game/forge/tests/fixtures/recording.json', import.meta.url)
writeFileSync(out, `${JSON.stringify({ brief, calls }, null, 1)}\n`)
const world = built.value.world
console.log(`recorded ${calls.length} calls: ${world.plots().length} plots, ${world.interiors().length} open, ${world.npcs().length} people, ${built.value.quests.length} quests`)
