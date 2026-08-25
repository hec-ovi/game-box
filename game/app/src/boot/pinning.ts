import { heightOf, type Catalogue } from '@gb/prefab'
import type { AssetPackRef, Plot, World } from '@gb/world'

/**
 * Writes into a city which building of the committed pack every plot was given,
 * and names the pack, so a reader whose pack has grown draws the city that was
 * built rather than its own idea of it.
 *
 * A pack that would not load pins nothing at all, and that is the honest
 * answer: a city with no catalogues promises nothing, while one naming a
 * catalogue with no plots pinned to it looks pinned and is not. A world that
 * took the catalogue and then refused a design is that second city and there is
 * no way to undo it, so it comes back as a sentence rather than a file.
 *
 * `only` is for a city being grown: the buildings that went up are pinned and
 * everything already standing is left byte for byte as the base wrote it, which
 * is what lets the growth be cut into a pack.
 */
export function pin(
  world: World,
  catalogue: Catalogue,
  only?: ReadonlySet<string>,
): { ok: true; requires: AssetPackRef[] } | { ok: false; message: string } {
  const named = world.recordCatalogues([catalogue.identity]).ok

  for (const plot of world.plots()) {
    if (only && !only.has(plot.id)) continue
    // a shape the pack has no building for keeps falling back to the kit, and
    // the file says nothing about it rather than naming a model it never chose
    const design = catalogue.design(plot, sizeOf(plot, world), world.charter(plot.kind)!.suits)
    if (!design) continue

    const written = world.recordDesign(plot.id, { pack: catalogue.pack, ...design })
    if (!written.ok) return { ok: false, message: `That city cannot be pinned to its art (${plot.id}: ${written.error.code}).` }
  }
  return { ok: true, requires: named ? [catalogue.identity] : [] }
}

/** The size `@gb/scene` hands the dressing, so the pin names the model the plot is actually drawn with. */
function sizeOf(plot: Plot, world: World) {
  return { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: heightOf(plot.storeys) }
}
