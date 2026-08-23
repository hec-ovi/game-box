import { Forge, OfflineNarrator } from '@gb/forge'
import { Greybox } from '@gb/scene'
import { BUILDING_KINDS, type Plot, type World } from '@gb/world'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Catalogue, type CatalogueDoc } from '../src/catalogue.ts'
import { PrefabDressing } from '../src/dressing.ts'
import { designFor } from '../src/pin.ts'
import { catalogueOf, libraryOf, plotOf } from './support.ts'

const manifest = JSON.parse(readFileSync(new URL('../pack/buildings.json', import.meta.url), 'utf8')) as CatalogueDoc
const shipped = Catalogue.parse(manifest)

/** The metres a plot's footprint covers, which is what `@gb/scene` hands the dressing. */
function sizeOf(world: World, plot: Plot): { width: number; depth: number } {
  return { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize }
}

/**
 * The shipped catalogue with one more look in it, at every shape it holds. That
 * is what a content pack does to the art: the same pack name, a version on, and
 * a new candidate in every bucket. It claims every trade, which is the widest a
 * look can reach and so the most the pin has to absorb.
 */
function grownByOneLook(): Catalogue {
  const shapes = new Map(manifest.models.map((model) => [`${model.front}x${model.depth}x${model.storeys}`, model]))
  return Catalogue.parse({
    ...manifest,
    version: '1.4.0',
    models: [
      ...manifest.models,
      ...[...shapes.values()].map((shape) => ({
        id: `club-e-${shape.front}x${shape.depth}x${shape.storeys}`,
        look: 'club-e',
        front: shape.front,
        depth: shape.depth,
        storeys: shape.storeys,
        kinds: [...BUILDING_KINDS],
        triangles: 220,
        door: { along: 0 },
      })),
    ],
  })
}

/** A whole city, dressed and written down, the way a packing site does it. */
async function pinnedCity(): Promise<World> {
  const built = await new Forge(new OfflineNarrator('metro')).build({
    theme: 'a neon port city',
    seed: 'metro',
    blocksX: 4,
    blocksY: 4,
    density: 0.7,
    maxStoreys: 4,
  })
  expect(built.ok).toBe(true)
  if (!built.ok) throw new Error('the city did not build')

  const world = built.value.world
  expect(world.recordCatalogues([shipped.identity]).ok).toBe(true)
  for (const plot of world.plots()) {
    const design = shipped.design(plot, sizeOf(world, plot))
    if (design) expect(world.recordDesign(plot.id, { pack: shipped.pack, ...design }).ok).toBe(true)
  }
  return world
}

describe('a city pinned to the catalogue it was dressed against', () => {
  it('draws the same buildings after the catalogue grows, when picking again would not', async () => {
    const world = await pinnedCity()
    const grown = grownByOneLook()

    let repicked = 0
    let pinned = 0
    for (const plot of world.plots()) {
      const size = sizeOf(world, plot)
      const before = JSON.stringify(shipped.design(plot, size))
      if (JSON.stringify(grown.design(plot, size)) !== before) repicked++
      if (JSON.stringify(designFor(grown, plot, size)) !== before) pinned++
    }

    // the experiment has to be able to fail: a catalogue with one more look in
    // it does answer differently, which is exactly what re-skinned a finished
    // city and what the pin is for
    expect({ plots: world.plots().length, repicked: repicked > 0, pinned }).toEqual({ plots: world.plots().length, repicked: true, pinned: 0 })
  })

  it('falls back rather than picking again when a pin cannot be honoured', () => {
    const catalogue = catalogueOf()
    const size = { width: 8, depth: 12 }
    const design = { pack: 'test', model: 'home-8x12x2', mirror: true, rooms: 5 }

    expect(designFor(catalogue, plotOf({ design }), size)).toEqual({ model: 'home-8x12x2', mirror: true, rooms: 5 })
    // somebody else's catalogue: its model ids mean nothing here
    expect(designFor(catalogue, plotOf({ design: { ...design, pack: 'other-pack' } }), size)).toBeUndefined()
    // a model this copy of the pack no longer holds
    expect(designFor(catalogue, plotOf({ design: { ...design, model: 'gone-8x12x2' } }), size)).toBeUndefined()
    // and a plot with nothing written down is still picked for
    expect(designFor(catalogue, plotOf(), size)?.model).toMatch(/8x12x2$/)
  })

  it('draws the building the world file names, not the one it would have picked', () => {
    const catalogue = catalogueOf()
    const dressing = new PrefabDressing(libraryOf(catalogue), new Greybox())
    const size = { width: 8, depth: 12, height: 7.2 }
    const picked = catalogue.design(plotOf(), size)!
    const other = catalogue.models.find((model) => model.id !== picked.model)!

    const building = dressing.building(plotOf({ design: { pack: 'test', model: other.id, mirror: false, rooms: 0 } }), size)
    expect(building.children[0]?.name).toBe(`plot_0001:${other.id}`)

    // a pin this pack cannot honour is a kit building, which reads as one on the
    // street; picking a different model would look like the city the file names
    const foreign = dressing.building(plotOf({ design: { pack: 'other-pack', model: other.id, mirror: false, rooms: 0 } }), size)
    expect(foreign.children.some((child) => child.name.endsWith(':shell'))).toBe(true)
  })
})
