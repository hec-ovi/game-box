/**
 * Boot. A city comes from `?bundle=<url>`, or is generated here and now from
 * `?seed=` and `?theme=`, so the game runs with nothing else installed.
 */
import { Bundle, type OpenedBundle } from '@gb/bundle'
import { Forge, OfflineNarrator } from '@gb/forge'
import { Scribe } from '@gb/scribe'
import { Sidecar } from '@gb/sidecar'
import { Game } from './game.ts'
import { loadCars, loadDressing } from './pack.ts'

const mount = document.querySelector<HTMLDivElement>('#game')!
const query = new URLSearchParams(location.search)
const sidecarBase = query.get('sidecar')
const sidecar = new Sidecar(sidecarBase ? { base: sidecarBase } : {})

const bundle = await load()
const [art, cars] = await Promise.all([loadDressing(bundle.world.theme), loadCars()])
const game = await Game.start(mount, bundle, { sidecar, dressing: art.dressing, ...(art.cast ? { cast: art.cast } : {}), ...(art.kit ? { kit: art.kit } : {}), ...(cars ? { cars } : {}) })

if (import.meta.env.DEV) {
  // so the dev console can ask the running game where it thinks it is
  ;(globalThis as Record<string, unknown>).game = game
  ;(globalThis as Record<string, unknown>).world = bundle.world
}

async function load(): Promise<OpenedBundle> {
  const url = query.get('bundle')
  if (url) {
    const opened = await Bundle.open(await (await fetch(url)).json())
    if (opened.ok) return opened.value
    throw new Error(`${url} will not open: ${opened.error.code}`)
  }

  const seed = query.get('seed') ?? 'town'
  const theme = query.get('theme') ?? 'quiet coastal town'
  const narrator = query.has('model') ? new Scribe({ sidecar, seed }) : new OfflineNarrator(seed)

  const built = await new Forge(narrator).build({
    theme,
    seed,
    blocksX: Number(query.get('blocks') ?? 2),
    blocksY: Number(query.get('blocks') ?? 2),
    blockCells: 14,
  })
  if (!built.ok) throw new Error(`cannot build: ${built.error.code}`)

  const packed = await Bundle.pack(built.value.world, built.value.quests, { generator: 'browser' })
  const opened = await Bundle.open(packed)
  if (!opened.ok) throw new Error(`packed city will not open: ${opened.error.code}`)
  return opened.value
}
