import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Bundle } from '@gb/bundle'
import { Catalogue, PACK_MANIFEST, designFor, heightOf } from '@gb/prefab'
import type { AssetPackRef, Plot, World } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { pinDesigns } from '../src/pins.ts'
import { city, laidOut } from './city.ts'

const dir = mkdtempSync(join(tmpdir(), 'gb-pins-'))

/**
 * The size `@gb/scene` hands the dressing, worked out here rather than taken
 * from the source under test: a pin written against any other size names a
 * model of the wrong shape, and the catalogue would fall back instead.
 */
function sizeOf(plot: Plot, world: World) {
  return { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: heightOf(plot.storeys) }
}

/** The words the pick matches a look on: the plot's charter's. */
function suitsOf(plot: Plot, world: World) {
  return world.charter(plot.kind)!.suits
}

/** The same pack with one more look in it, which is what a pack update is: a ninth building at every shape, suiting everything the shape suits. */
async function grown(): Promise<Catalogue> {
  const manifest = JSON.parse(await readFile(PACK_MANIFEST, 'utf8')) as {
    models: Array<{ id: string; look: string; tags: string[] }>
  }
  const later = new Map<string, { id: string; look: string; tags: string[] }>()
  for (const model of manifest.models) {
    const shape = model.id.slice(model.look.length + 1)
    const at = later.get(shape) ?? { ...model, id: `later-a-${shape}`, look: 'later-a', tags: [] }
    at.tags = [...new Set([...at.tags, ...model.tags])]
    later.set(shape, at)
  }
  return Catalogue.parse({ ...manifest, version: '1.8.0', models: [...manifest.models, ...later.values()] })
}

let pack: Catalogue
let town: { world: World; requires: readonly AssetPackRef[]; asBuilt: boolean }

// one city, pinned and sealed the way a build seals one, then opened the way
// the game opens it
beforeAll(async () => {
  pack = await Catalogue.read(await readFile(PACK_MANIFEST))
  const file = join(dir, 'pinned.json')
  await city(file, { seed: 'pack', blocksX: 2, blocksY: 2 })
  const opened = await Bundle.open(JSON.parse(readFileSync(file, 'utf8')), [pack.identity])
  if (!opened.ok) throw new Error(`the sealed city will not open: ${opened.error.code}`)
  town = { world: opened.value.world, requires: opened.value.requires, asBuilt: opened.value.packs.asBuilt }
})

describe('a pinned city', () => {
  it('names the pack it was drawn from and pins the buildings it drew', () => {
    expect(town.requires).toEqual([pack.identity])
    expect(town.asBuilt).toBe(true)

    const pinned = town.world.plots().filter((plot) => plot.design)
    expect(pinned.length).toBeGreaterThan(0)
    expect(town.world.catalogues()).toEqual([pack.identity])
    expect(pinned.every((plot) => plot.design?.pack === pack.pack)).toBe(true)
  })

  it('pins each plot to the model its charter would be drawn with', () => {
    // the pin is the pick made against the plot's own charter: any other
    // suits, or any other size, names a building the plot is not drawn with
    const world = town.world
    for (const plot of world.plots().filter((plot) => plot.design)) {
      expect(plot.design?.model).toBe(pack.design(plot, sizeOf(plot, world), suitsOf(plot, world))?.model)
    }
  })

  it('draws the same buildings after the pack has grown', async () => {
    // the whole point of a pack: add to a city later and every building that
    // was already there stays the building it was
    const later = await grown()
    const world = town.world
    const plots = world.plots()

    const moved = plots.filter(
      (plot) =>
        designFor(later, plot, sizeOf(plot, world), suitsOf(plot, world))?.model !==
        designFor(pack, plot, sizeOf(plot, world), suitsOf(plot, world))?.model,
    )
    expect(moved.map((plot) => plot.id)).toEqual([])

    // and the teeth: the same growth moves buildings for anyone reading the
    // city off the catalogue instead of off the file
    const repicked = plots.filter(
      (plot) =>
        later.design(plot, sizeOf(plot, world), suitsOf(plot, world))?.model !==
        pack.design(plot, sizeOf(plot, world), suitsOf(plot, world))?.model,
    )
    expect(repicked.length).toBeGreaterThan(0)
  })
})

it('pins nothing at all when the pack cannot be read', async () => {
  // half a truth is the worst outcome here: a city naming a catalogue with no
  // plot pinned to it reads as pinned and is not
  const world = laidOut({ seed: 'pack', blocksX: 1, blocksY: 1 })

  const pins = await pinDesigns(
    world,
    world.plots().map((plot) => plot.id),
    new URL('file:///no/such/pack/buildings.json'),
  )

  expect(pins.state).toBe('unpinned')
  expect(world.catalogues()).toEqual([])
  expect(world.plots().some((plot) => plot.design)).toBe(false)
})

it('refuses a city drawn against another version of the pack', async () => {
  // a pin to art the city does not name buys nothing, and a second version of
  // one pack is not an extension, so the city is left alone and the refusal
  // names both packs
  const world = laidOut({ seed: 'older', blocksX: 1, blocksY: 1 })
  const manifest = JSON.parse(readFileSync(PACK_MANIFEST, 'utf8')) as { version: string }
  const older = join(dir, 'older-pack.json')
  writeFileSync(older, JSON.stringify({ ...manifest, version: '0.9.0' }))
  const ids = world.plots().map((plot) => plot.id)

  expect((await pinDesigns(world, ids, pathToFileURL(older))).state).toBe('pinned')
  const again = await pinDesigns(world, ids)

  expect(again.state).toBe('refused')
  expect(again.state === 'refused' && again.why).toContain('drawn against gb-buildings 0.9.0')
  expect(again.state === 'refused' && again.why).toContain('this build has gb-buildings')
})
