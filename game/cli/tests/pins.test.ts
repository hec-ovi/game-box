import { mkdtempSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Bundle } from '@gb/bundle'
import { Forge, OfflineNarrator } from '@gb/forge'
import { Catalogue, PACK_MANIFEST, designFor, heightOf } from '@gb/prefab'
import type { Plot, World } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { run } from '../src/index.ts'
import { pinDesigns } from '../src/pins.ts'

const dir = mkdtempSync(join(tmpdir(), 'gb-pins-'))

function silent() {
  return { out: () => {}, err: () => {} }
}

/**
 * The size `@gb/scene` hands the dressing, worked out here rather than taken
 * from the source under test: a pin written against any other size names a
 * model of the wrong shape, and the catalogue would fall back instead.
 */
function sizeOf(plot: Plot, world: World) {
  return { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: heightOf(plot.storeys) }
}

/** The same pack with one more look in it, which is what a pack update is: a ninth building at every shape. */
async function grown(): Promise<Catalogue> {
  const manifest = JSON.parse(await readFile(PACK_MANIFEST, 'utf8')) as {
    models: Array<{ id: string; look: string; kinds: string[] }>
  }
  const later = new Map<string, { id: string; look: string; kinds: string[] }>()
  for (const model of manifest.models) {
    const shape = model.id.slice(model.look.length + 1)
    const at = later.get(shape) ?? { ...model, id: `later-a-${shape}`, look: 'later-a', kinds: [] }
    at.kinds = [...new Set([...at.kinds, ...model.kinds])]
    later.set(shape, at)
  }
  return Catalogue.parse({ ...manifest, version: '1.5.0', models: [...manifest.models, ...later.values()] })
}

let pack: Catalogue
let city: { world: World; file: string }

beforeAll(async () => {
  pack = await Catalogue.read(await readFile(PACK_MANIFEST))
  const file = join(dir, 'pinned.json')
  expect(await run(['build', '--seed', 'pack', '--blocks', '2x2', '--out', file], silent())).toBe(0)
  const opened = await Bundle.open(JSON.parse(readFileSync(file, 'utf8')), [pack.identity])
  if (!opened.ok) throw new Error(`the built city will not open: ${opened.error.code}`)
  city = { world: opened.value.world, file }
})

describe('a city gb built', () => {
  it('names the pack it was drawn from and pins the buildings it drew', async () => {
    const opened = await Bundle.open(JSON.parse(readFileSync(city.file, 'utf8')), [pack.identity])
    if (!opened.ok) throw new Error(opened.error.code)

    expect(opened.value.requires).toEqual([pack.identity])
    expect(opened.value.packs.asBuilt).toBe(true)

    const pinned = city.world.plots().filter((plot) => plot.design)
    expect(pinned.length).toBeGreaterThan(0)
    expect(city.world.catalogues()).toEqual([pack.identity])
    expect(pinned.every((plot) => plot.design?.pack === pack.pack)).toBe(true)
  })

  it('draws the same buildings after the pack has grown', async () => {
    // the whole point of a pack: add to a city later and every building that
    // was already there stays the building it was
    const later = await grown()
    const plots = city.world.plots()

    const moved = plots.filter(
      (plot) =>
        designFor(later, plot, sizeOf(plot, city.world))?.model !==
        designFor(pack, plot, sizeOf(plot, city.world))?.model,
    )
    expect(moved.map((plot) => plot.id)).toEqual([])

    // and the teeth: the same growth moves buildings for anyone reading the
    // city off the catalogue instead of off the file
    const repicked = plots.filter(
      (plot) =>
        later.design(plot, sizeOf(plot, city.world))?.model !== pack.design(plot, sizeOf(plot, city.world))?.model,
    )
    expect(repicked.length).toBeGreaterThan(0)
  })
})

it('pins nothing at all when the pack cannot be read', async () => {
  // half a truth is the worst outcome here: a city naming a catalogue with no
  // plot pinned to it reads as pinned and is not
  const built = await new Forge(new OfflineNarrator('pack')).build({
    theme: 'quiet coastal town',
    seed: 'pack',
    blocksX: 1,
    blocksY: 1,
    density: 0.8,
    maxStoreys: 3,
    exits: 1,
  })
  if (!built.ok) throw new Error(built.error.code)
  const world = built.value.world

  const pins = await pinDesigns(world, new URL('file:///no/such/pack/buildings.json'))

  expect(pins.state).toBe('unpinned')
  expect(world.catalogues()).toEqual([])
  expect(world.plots().some((plot) => plot.design)).toBe(false)
})
