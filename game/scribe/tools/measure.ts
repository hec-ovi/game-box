/**
 * Builds cities through the live sidecar and prints what the model wrote: the
 * kinds of place each history invented and whether the city has them, the locks
 * and screens the city placed and the quests written through them, how many
 * distinct head words and shapes the signs came out in, who got a life and a
 * codex, what each kind of call costs in tokens and seconds, and whether any
 * slot a prompt shows came back as output.
 *
 * Every brief asks for a kind of place the presets lack, so every city measures
 * the charter path.
 *
 * Usage: pnpm --filter @gb/scribe run measure [cities] [blocks] [blockCells] [firstTown]
 */
import { Forge, summarise } from '@gb/forge'
import type { QuestDoc } from '@gb/quest'
import { Sidecar } from '@gb/sidecar'
import { SHIPPED_CHARTERS } from '@gb/world'
import { headOf } from '../src/head.ts'
import { Scribe } from '../src/index.ts'
import { CityLocks } from '../src/locks.ts'
import { PROMPTS } from '../src/prompts.generated.ts'
import { reachProblems } from '../src/reach.ts'

/** A shipped quest is a compiled flow, so its steps are what a complaint points at. */
const NO_BEATS: ReadonlyMap<string, string> = new Map()

const TOWNS = [
  {
    theme: 'border town on the highway',
    brief: 'A border crossing where the customs house and the jail are where everything happens. Half the town is waiting on somebody inside one of them.',
  },
  {
    theme: 'rain-soaked port',
    brief: 'A port with a lighthouse nobody has kept lit since the wreck, and a fish market that opens before dawn.',
  },
  {
    theme: 'neon city, the freight lines shut last winter',
    brief: 'The pawnshops took over when the freight stopped, and the night court never closes.',
  },
  {
    theme: 'mining town on the ridge',
    brief: 'The assay office decides what the ore is worth and the bathhouse is where the shift ends.',
  },
  {
    theme: 'coastal resort after the season',
    brief: 'A casino that stays open for the staff, and a pier with an arcade at the end of it.',
  },
  {
    theme: 'industrial estate by the canal',
    brief: 'A foundry that still runs one furnace, and a union hall that argues about it.',
  },
  {
    theme: 'alpine research station',
    brief: 'A laboratory the whole town works for, and a cable car station at the top of the street.',
  },
  {
    theme: 'agrarian market town',
    brief: 'A grain exchange that sets the price, and a veterinary surgery that never sleeps.',
  },
  {
    theme: 'university district in the rain',
    brief: 'A library open all night, and a print shop that runs the pamphlets everybody argues over.',
  },
  {
    theme: 'shipyard town in decline',
    brief: 'A dry dock with one hull in it, and a pawnbroker holding half the town\'s tools.',
  },
  {
    theme: 'neon port after the docks shut',
    brief: 'A disco where the whole town ends up after dark, with a cellar nobody but the doorman gets into, and a shipping office with a locked back room where a terminal still holds the manifests.',
  },
]

/** Every bracketed slot the prompts show, read off the prompts themselves: the one thing a prompt can hand back as an answer. */
const LEAKS = [...new Set(Object.values(PROMPTS).flatMap((text) => text.match(/\[[a-z][a-z ]*\]/g) ?? []))]

interface Usage {
  readonly tool: string
  readonly prompt: number
  readonly completion: number
  readonly ms: number
}

const cities = Number(process.argv[2] ?? 1)
const blocks = Number(process.argv[3] ?? 1)
const blockCells = Number(process.argv[4] ?? 16)
const firstTown = Number(process.argv[5] ?? 0)
const usage: Usage[] = []
/** The start of every reply that came back as prose rather than the call. */
const prose: string[] = []
const presets = new Set(SHIPPED_CHARTERS.map((charter) => charter.word))

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
    if (!message?.tool_calls?.length) prose.push(`${tool}: ${String(answer).replace(/\s+/g, ' ').slice(0, 160)}`)
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
let invented = 0
let raised = 0
let throughLocks = 0
let walkable = 0
const problems = new Map<string, number>()

for (let i = 0; i < cities; i++) {
  const town = TOWNS[(firstTown + i) % TOWNS.length]!
  const seed = `measure-${i}`
  const scribe = new Scribe({ sidecar: new Sidecar({ fetch }), seed })
  const started = Date.now()
  const built = await new Forge(scribe).build({ theme: town.theme, seed, blocksX: blocks, blocksY: blocks, blockCells, brief: town.brief })
  if (!built.ok) {
    console.log(`${seed}: ${'message' in built.error ? built.error.message : built.error.code}`)
    continue
  }
  const world = built.value.world
  const plots = world.plots()
  const open = plots.filter((plot) => plot.interiorId)
  const allSigns = plots.map((plot) => plot.name)
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
  for (const problem of scribe.problems()) {
    const key = `${problem.task}:${problem.error.code}`
    problems.set(key, (problems.get(key) ?? 0) + 1)
    const why = 'violations' in problem.error ? problem.error.violations.map((violation) => `${violation.path}: ${violation.message}`).join(' | ') : ''
    console.log(`  ${problem.at}: ${problem.error.code}${why ? ` (${why})` : ''}`)
  }

  const summary = summarise(world, world.premise())
  const locks = summary.places.flatMap((place) => place.locks ?? [])
  const screens = summary.places.flatMap((place) => place.machines ?? [])
  const shipped = built.value.quests as readonly QuestDoc[]
  const walk = new CityLocks(summary.places)
  const used = shipped.filter((quest) => quest.steps.some((step) => ['unlock', 'hack', 'beat-game', 'buy'].includes(step.kind)))
  const walked = shipped.filter((quest) => reachProblems(quest, walk, NO_BEATS).length === 0)
  throughLocks += used.length
  walkable += walked.length

  const text = JSON.stringify([world.toJSON(), built.value.quests]).toLowerCase()
  for (const leak of LEAKS) {
    const at = text.indexOf(leak)
    if (at >= 0) leaked.push(`${seed}: ${leak} in "${text.slice(Math.max(0, at - 40), at + leak.length + 40)}"`)
  }

  console.log(
    `${seed} (${town.theme}): ${plots.length} plots, ${open.length} open, ${world.npcs().length} people, ` +
      `${built.value.quests.length} quests, ${Math.round((Date.now() - started) / 1000)} s`,
  )
  const premise = world.premise()
  if (premise) console.log(`  build: more of ${premise.build.moreOf.join(', ') || 'nothing'}; fewer of ${premise.build.fewerOf.join(', ') || 'nothing'}; must have ${premise.build.mustHave.join(', ') || 'nothing'}`)
  for (const charter of world.charters().filter((charter) => !presets.has(charter.word))) {
    invented++
    const of = plots.filter((plot) => plot.kind === charter.word)
    const opened = of.filter((plot) => plot.interiorId)
    if (of.length) raised++
    const rooms = [charter.rooms.hall, charter.rooms.main, ...charter.rooms.services].flatMap((room) => (room ? [`${room.name} (${room.use})`] : []))
    console.log(
      `  charter ${charter.word}: "${charter.label}", blade ${charter.blade}, ${charter.street.frontage} front, ${charter.access}, ` +
        `${charter.service} at the front, work ${charter.work.join('+') || 'none'}, keeps ${charter.holding.join('+') || 'nothing'}, ` +
        `share ${charter.share}, ${charter.prominence}; rooms ${rooms.join(', ')}; signs ${charter.names.join(' | ')}`,
    )
    console.log(`    in the city: ${of.length} plots, ${opened.length} open${of.length ? `: ${of.map((plot) => plot.name).join(' | ')}` : ''}`)
  }
  for (const dropped of built.value.dropped) console.log(`  dropped ${dropped.word}: ${dropped.reason}`)
  console.log(
    `  locks: ${locks.length} (${locks.filter((lock) => lock.street).length} street doors, ${locks.filter((lock) => lock.keyItemId).length} with a key, ${locks.filter((lock) => lock.password).length} with a code); ` +
      `screens: ${screens.length} (${screens.filter((screen) => screen.locked).length} locked; ${[...new Set(screens.map((screen) => screen.program))].map((program) => `${program} ${screens.filter((screen) => screen.program === program).length}`).join(', ')}); ` +
      `for sale: ${summary.places.filter((place) => place.forSale !== undefined).map((place) => `${place.name} at ${place.forSale}`).join(', ') || 'nothing'}`,
  )
  for (const place of summary.places.filter((place) => place.locks?.length || place.machines?.length)) {
    const doors = (place.locks ?? []).map((lock) => `${lock.doorId} ${lock.street ? 'street door' : lock.room} by ${[lock.keyItemId && `key ${lock.keyItemId} (${lock.keeperNpcId})`, lock.password && `code ${lock.password}`].filter(Boolean).join(' or ')}`)
    const machines = (place.machines ?? []).map((machine) => `${machine.machineId} ${machine.program}${machine.locked ? ` (${machine.password})` : ''}`)
    console.log(`    ${place.name}, a ${place.kind}: ${[...doors, ...machines].join('; ')}`)
  }
  for (const quest of shipped) {
    const kinds = quest.steps.map((step) => step.kind).join(' > ')
    const extras = [quest.reward.access?.length && `access ${quest.reward.access.map((access) => Object.values(access)[0]).join(',')}`, quest.reward.car && `car ${quest.reward.car}`, quest.reward.deed && `deed ${quest.reward.deed}`].filter(Boolean).join(', ')
    const problems = reachProblems(quest, walk, NO_BEATS)
    console.log(`  ${quest.id} ${quest.kind} ${quest.difficulty} "${quest.title}": ${kinds}${extras ? `; ${extras}` : ''}${problems.length ? `; SHUT: ${problems.map((problem) => `${problem.path} ${problem.message}`).join(' | ')}` : ''}`)
  }
  console.log(`  ${world.name}: ${allSigns.join(' | ')}`)
}

const mean = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0)
console.log(`\nkinds invented: ${invented}, with a plot in the city: ${raised}`)
console.log(`signs: ${signs}, distinct heads: ${heads}, shapes: ${[...shapes].map(([shape, n]) => `${shape} ${n}`).join(', ')}`)
console.log(`people: ${people}, with a whole life: ${lives}, with a codex: ${codices}, codex using all four stages: ${staged}`)
console.log(`quests: ${quests}, rejected: ${rejected}, through a lock, a screen or a counter: ${throughLocks}, passing the lock walk: ${walkable}`)
console.log('calls by tool: count, prompt tokens, completion tokens, seconds (means)')
for (const tool of new Set(usage.map((entry) => entry.tool))) {
  const calls = usage.filter((entry) => entry.tool === tool)
  console.log(`  ${tool}: ${calls.length}, ${mean(calls.map((c) => c.prompt))}, ${mean(calls.map((c) => c.completion))}, ${(mean(calls.map((c) => c.ms)) / 1000).toFixed(1)}`)
}
console.log(`calls: ${usage.length}, problems: ${[...problems].map(([key, n]) => `${key} ${n}`).join(', ') || 'none'}`)
for (const reply of prose) console.log(`  prose ${reply}`)
console.log(`leaks: ${leaked.length ? leaked.join('; ') : 'none'}`)
