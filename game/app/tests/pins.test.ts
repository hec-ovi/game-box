// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { Bundle } from '@gb/bundle'
import { Catalogue, PACK_MANIFEST, designFor, heightOf } from '@gb/prefab'
import { Sidecar } from '@gb/sidecar'
import type { AssetPackRef, Plot, World } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULTS } from '../src/boot/brief.ts'
import { CityMaker } from '../src/boot/city-maker.ts'

const QUIET = { signal: new AbortController().signal, step: () => {} }
const BRIEF = { ...DEFAULTS, blocks: 2, seed: 'pack' }

/**
 * The size `@gb/scene` hands the dressing, worked out here rather than taken
 * from the source under test: a pin written against any other size names a
 * model of the wrong shape, and the catalogue would fall back instead.
 */
function sizeOf(plot: Plot, world: World) {
  return { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: heightOf(plot.storeys) }
}

/** The same pack with one more look in it, which is what a pack update is: another building at every shape. */
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
  return Catalogue.parse({ ...manifest, version: '1.6.0', models: [...manifest.models, ...later.values()] })
}

let pack: Catalogue
let city: { world: World; requires: readonly AssetPackRef[]; asBuilt: boolean }

// one city, made the way the panel makes one and opened the way the game opens it
beforeAll(async () => {
  pack = await Catalogue.read(await readFile(PACK_MANIFEST))
  const made = await new CityMaker(new Sidecar()).build(BRIEF, { ...QUIET, catalogue: pack })
  if (!made.ok) throw new Error(made.message)
  const opened = await Bundle.open(JSON.parse(JSON.stringify(made.value.document)), [pack.identity])
  if (!opened.ok) throw new Error(`the city the panel made will not open: ${opened.error.code}`)
  city = { world: opened.value.world, requires: opened.value.requires, asBuilt: opened.value.packs.asBuilt }
}, 60_000)

describe('a city made in the browser', () => {
  it('names the pack it was drawn from and pins the buildings it drew', () => {
    expect(city.requires).toEqual([pack.identity])
    expect(city.asBuilt).toBe(true)

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

    // and the teeth: the same growth re-skins the city for anyone reading it
    // off the catalogue instead of off the file
    const repicked = plots.filter(
      (plot) =>
        later.design(plot, sizeOf(plot, city.world))?.model !== pack.design(plot, sizeOf(plot, city.world))?.model,
    )
    expect(repicked.length).toBeGreaterThan(0)
  }, 30_000)
})

it('pins nothing at all when the art would not load', async () => {
  // half a truth is the worst outcome here: a city naming a catalogue with no
  // plot pinned to it reads as pinned and is not
  const made = await new CityMaker(new Sidecar()).build({ ...BRIEF, blocks: 1 }, QUIET)
  if (!made.ok) throw new Error(made.message)

  const opened = await Bundle.open(JSON.parse(JSON.stringify(made.value.document)))
  if (!opened.ok) throw new Error(opened.error.code)
  expect(opened.value.requires).toEqual([])
  expect(opened.value.world.catalogues()).toEqual([])
  expect(opened.value.world.plots().some((plot) => plot.design)).toBe(false)
}, 60_000)
