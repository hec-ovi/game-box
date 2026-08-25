import { readFile } from 'node:fs/promises'
import { Catalogue, PACK_MANIFEST, heightOf } from '@gb/prefab'
import type { AssetPackRef, Plot, World } from '@gb/world'

/**
 * What a pass over the plots pinned. `pinned` is the city tied to the pack it
 * was drawn from, `unpinned` is a city that promises nothing, and `refused` is
 * a city that cannot be pinned to this pack and must not be written.
 */
export type Pinning =
  | { state: 'pinned'; pack: AssetPackRef; plots: number }
  | { state: 'unpinned'; why: string }
  | { state: 'refused'; why: string }

/**
 * Writes into a city which building of the committed pack each of the named
 * plots was given, so a reader whose pack has grown draws the city that was
 * built rather than its own idea of it.
 *
 * A pack that cannot be read pins nothing at all: a city with no catalogues is
 * honestly unpinned, while a city naming a catalogue with no plots pinned
 * looks pinned and is not. A city already drawn against another version of
 * this pack is refused: a plot pinned to art the city does not name is a pin
 * that buys nothing, and a second version of one pack is not an extension.
 */
export async function pinDesigns(world: World, plotIds: readonly string[], manifest: URL = PACK_MANIFEST): Promise<Pinning> {
  const catalogue = await read(manifest)
  if (typeof catalogue === 'string') return { state: 'unpinned', why: catalogue }

  const named = world.catalogues().find((ref) => ref.pack === catalogue.pack)
  if (named && !samePack(named, catalogue.identity)) {
    return { state: 'refused', why: `the city was drawn against ${label(named)} and this build has ${label(catalogue.identity)}` }
  }
  if (!named) {
    const recorded = world.recordCatalogues([...world.catalogues(), catalogue.identity])
    if (!recorded.ok) return { state: 'unpinned', why: recorded.error.code }
  }

  let plots = 0
  for (const id of plotIds) {
    const plot = world.plot(id)
    if (!plot) return { state: 'refused', why: `${id}: not a plot of this city` }
    // a shape the pack has no building for keeps falling back to the kit, and
    // the file says nothing about it rather than naming a model it never chose
    const design = catalogue.design(plot, sizeOf(plot, world), suitsOf(plot, world))
    if (!design) continue

    const written = world.recordDesign(plot.id, { pack: catalogue.pack, ...design })
    // the world took this catalogue and the plot is its own, so a refusal here
    // leaves a city part pinned and there is no way to unpin it
    if (!written.ok) return { state: 'refused', why: `${plot.id}: ${written.error.code}` }
    plots++
  }
  return { state: 'pinned', pack: catalogue.identity, plots }
}

/** One pack ref as the report names it. */
export function label(ref: AssetPackRef): string {
  return `${ref.pack} ${ref.version}${ref.sha256 ? ` (${ref.sha256.slice(0, 12)})` : ''}`
}

/** One pack ref names another when pack, version and bytes all agree. */
export function samePack(a: AssetPackRef, b: AssetPackRef): boolean {
  return a.pack === b.pack && a.version === b.version && a.sha256 === b.sha256
}

/** The size `@gb/scene` hands the dressing, so the pin names the model the plot is actually drawn with. */
function sizeOf(plot: Plot, world: World) {
  return {
    width: plot.rect.w * world.cellSize,
    depth: plot.rect.h * world.cellSize,
    height: heightOf(plot.storeys),
  }
}

/** The words the pick matches a look on. A world refuses a plot whose word no charter declares, so there is always one. */
function suitsOf(plot: Plot, world: World) {
  return world.charter(plot.kind)!.suits
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
