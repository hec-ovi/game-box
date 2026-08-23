import { readFile } from 'node:fs/promises'
import { Catalogue, PACK_MANIFEST, heightOf } from '@gb/prefab'
import type { AssetPackRef, Plot, World } from '@gb/world'

/**
 * What a build pinned. `pinned` is the city tied to the pack it was drawn
 * from, `unpinned` is a city that promises nothing, and `half` is a world that
 * took a catalogue and then refused a design, which cannot be undone.
 */
export type Pinning =
  | { state: 'pinned'; pack: AssetPackRef; plots: number }
  | { state: 'unpinned'; why: string }
  | { state: 'half'; why: string }

/**
 * Writes into a generated city which building of the committed pack every plot
 * was given, so a reader whose pack has grown draws the city that was built
 * rather than its own idea of it.
 *
 * A pack that cannot be read pins nothing at all: a city with no catalogues is
 * honestly unpinned, while a city naming a catalogue with no plots pinned
 * looks pinned and is not.
 */
export async function pinDesigns(world: World, manifest: URL = PACK_MANIFEST): Promise<Pinning> {
  const catalogue = await read(manifest)
  if (typeof catalogue === 'string') return { state: 'unpinned', why: catalogue }

  const recorded = world.recordCatalogues([catalogue.identity])
  if (!recorded.ok) return { state: 'unpinned', why: recorded.error.code }

  let plots = 0
  for (const plot of world.plots()) {
    // a shape the pack has no building for keeps falling back to the kit, and
    // the file says nothing about it rather than naming a model it never chose
    const design = catalogue.design(plot, sizeOf(plot, world))
    if (!design) continue

    const written = world.recordDesign(plot.id, { pack: catalogue.pack, ...design })
    // the world took this catalogue a moment ago and the plot is its own, so a
    // refusal here leaves a city part pinned and there is no way to unpin it
    if (!written.ok) return { state: 'half', why: `${plot.id}: ${written.error.code}` }
    plots++
  }
  return { state: 'pinned', pack: catalogue.identity, plots }
}

/** The size `@gb/scene` hands the dressing, so the pin names the model the plot is actually drawn with. */
function sizeOf(plot: Plot, world: World) {
  return {
    width: plot.rect.w * world.cellSize,
    depth: plot.rect.h * world.cellSize,
    height: heightOf(plot.storeys),
  }
}

/** The catalogue, or one line saying why the city goes out unpinned. */
async function read(manifest: URL): Promise<Catalogue | string> {
  try {
    return await Catalogue.read(await readFile(manifest))
  } catch (cause) {
    const code = (cause as { code?: string }).code
    return code ?? (cause as Error).message
  }
}
