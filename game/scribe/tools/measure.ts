/**
 * Builds cities through the live sidecar and prints what the model wrote: who
 * got a life and a codex, how many distinct head words and shapes the signs
 * came out in, what a batch of signs costs in tokens, and whether any example
 * from a prompt came back as output.
 *
 * Usage: pnpm --filter @gb/scribe run measure [cities] [blockCells]
 */
import { Forge, premiseLines } from '@gb/forge'
import { Sidecar } from '@gb/sidecar'
import { headOf } from '../src/head.ts'
import { Scribe, type PlaceRequest } from '../src/index.ts'

const THEMES = [
  'rain-soaked port',
  'neon city, the freight lines shut last winter',
  'mining town on the ridge',
  'coastal resort after the season',
  'industrial estate by the canal',
  'alpine research station',
  'agrarian market town',
  'border town on the highway',
  'university district in the rain',
  'shipyard town in decline',
]

/** What a prompt once showed as an example, and every bracketed slot the prompts show now. */
const LEAKS = [
  'copper wheel', 'mystical tavern', 'wonders', 'legendary', 'dunn supply', 'hollis',
  '[first name]', '[family name]', '[trade]', '[place word]', '[number]', '[street]', '[adjective]', '[noun]',
  '[thing]', '[place]', '[person]',
]

interface Usage {
  readonly tool: string
  readonly prompt: number
  readonly completion: number
  readonly ms: number
}

const cities = Number(process.argv[2] ?? 1)
const blockCells = Number(process.argv[3] ?? 16)
const usage: Usage[] = []

/** The engine behind the sidecar, asked to count tokens, because the sidecar's reply carries no usage. */
const engine = process.env['GAME_BOX_LLM_UPSTREAM'] ?? 'http://127.0.0.1:8080'

async function tokens(content: string): Promise<number> {
  const response = await globalThis.fetch(`${engine}/tokenize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  const json = (await response.json()) as { tokens?: unknown[] }
  return json.tokens?.length ?? 0
}

const fetch: typeof globalThis.fetch = async (url, init) => {
  const body = JSON.parse(String(init?.body))
  const tool = body.tools?.[0]?.function?.name ?? '?'
  const started = Date.now()
  const response = await globalThis.fetch(url, init)
  const text = await response.text()
  const ms = Date.now() - started
  try {
    const message = JSON.parse(text).choices?.[0]?.message
    const answer = message?.tool_calls?.[0]?.function?.arguments ?? message?.content ?? ''
    usage.push({
      tool,
      prompt: await tokens(JSON.stringify({ messages: body.messages, tools: body.tools })),
      completion: await tokens(String(answer)),
      ms,
    })
  } catch {
    usage.push({ tool, prompt: 0, completion: 0, ms })
  }
  return new Response(text, { status: response.status, headers: response.headers })
}

function shapeOf(name: string): string {
  if (/^\d/.test(name)) return 'number'
  if (/&|\b(sons|daughters|partners|bros|brothers)\b/i.test(name)) return 'family firm'
  if (/['’]s\b/.test(name)) return 'possessive'
  if (/^the\s/i.test(name)) return 'The X Y'
  return 'plain trade'
}

const leaked: string[] = []
const shapes = new Map<string, number>()
let signs = 0
let heads = 0
let people = 0
let lives = 0
let codices = 0
let staged = 0
let quests = 0
let rejected = 0
const problems = new Map<string, number>()

for (let i = 0; i < cities; i++) {
  const theme = THEMES[i % THEMES.length]!
  const seed = `measure-${i}`
  const scribe = new Scribe({ sidecar: new Sidecar({ fetch }), seed })
  const started = Date.now()
  const built = await new Forge(scribe).build({ theme, seed, blocksX: 1, blocksY: 1, blockCells })
  if (!built.ok) {
    console.log(`${seed}: ${built.error.code}`)
    continue
  }
  const world = built.value.world
  const premise = world.premise()
  const shut = world.plots().filter((plot) => !plot.interiorId)
  const requests: PlaceRequest[] = shut.map((plot, index) => ({
    index: index + world.plots().length,
    kind: plot.kind,
    theme,
    ...(premise ? { premise: premiseLines(premise) } : {}),
  }))
  const named = await scribe.namePlaces(requests)
  const allSigns = [...world.plots().filter((plot) => plot.interiorId).map((plot) => plot.name), ...named]
  signs += allSigns.length
  heads += new Set(allSigns.map(headOf)).size
  for (const sign of allSigns) shapes.set(shapeOf(sign), (shapes.get(shapeOf(sign)) ?? 0) + 1)

  for (const npc of world.npcs()) {
    people++
    const life = npc.life
    if (life && (['history', 'interests', 'manner', 'cares', 'avoids', 'reason', 'errand'] as const).every((key) => life[key])) lives++
    if (npc.background?.length) codices++
    if (npc.background && new Set(npc.background.map((fact) => fact.unlockedBy)).size === 4) staged++
  }
  quests += built.value.quests.length
  rejected += built.value.rejected.length
  for (const problem of scribe.problems()) problems.set(`${problem.task}:${problem.error.code}`, (problems.get(`${problem.task}:${problem.error.code}`) ?? 0) + 1)

  const text = JSON.stringify([world.toJSON(), built.value.quests, named]).toLowerCase()
  for (const leak of LEAKS) if (text.includes(leak)) leaked.push(`${seed}: ${leak}`)

  console.log(
    `${seed} (${theme}): ${world.plots().length} plots, ${shut.length} shut, ${world.npcs().length} people, ` +
      `${built.value.quests.length} quests, ${Math.round((Date.now() - started) / 1000)} s`,
  )
  console.log(`  ${world.name}: ${allSigns.join(' | ')}`)
}

const batches = usage.filter((entry) => entry.tool === 'name_signs')
const mean = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0)
console.log(`\nsigns: ${signs}, distinct heads: ${heads}, shapes: ${[...shapes].map(([shape, n]) => `${shape} ${n}`).join(', ')}`)
console.log(`sign batches: ${batches.length}, tokens per batch: prompt ${mean(batches.map((b) => b.prompt))}, completion ${mean(batches.map((b) => b.completion))}, ${mean(batches.map((b) => b.ms))} ms`)
console.log(`people: ${people}, with a whole life: ${lives}, with a codex: ${codices}, codex using all four stages: ${staged}`)
console.log(`quests: ${quests}, rejected: ${rejected}`)
console.log(`calls: ${usage.length}, problems: ${[...problems].map(([key, n]) => `${key} ${n}`).join(', ') || 'none'}`)
console.log(`leaks: ${leaked.length ? leaked.join('; ') : 'none'}`)
