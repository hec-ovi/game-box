import { Bundle, type OpenedBundle } from '@gb/bundle'
import { Forge, OfflineNarrator } from '@gb/forge'
import { heightOf, type Catalogue } from '@gb/prefab'
import { Scribe } from '@gb/scribe'
import type { Sidecar } from '@gb/sidecar'
import type { AssetPackRef, Plot, World } from '@gb/world'
import type { CityBrief } from './brief.ts'

/** A city and the sealed document it came in, which is what Export writes out. */
export interface City {
  readonly bundle: OpenedBundle
  readonly document: unknown
}

export type Made = { ok: true; value: City } | { ok: false; message: string }

/**
 * What the panel says while it waits. It may return a promise, and the maker
 * waits on it, so a step can hold long enough for the browser to draw the line
 * before the next stretch of work blocks it.
 */
export type Progress = (step: string) => void | Promise<void>

/**
 * Makes a city: writes one from a brief, or opens one somebody exported. Every
 * failure comes back as a sentence the player can read, because there is
 * nowhere for a thrown error to go on the way in.
 */
export class CityMaker {
  #sidecar: Sidecar

  constructor(sidecar: Sidecar) {
    this.#sidecar = sidecar
  }

  /** A city written from the brief, sealed and reopened exactly as a file would be. */
  async build(brief: CityBrief, options: { signal: AbortSignal; step: Progress; catalogue?: Catalogue }): Promise<Made> {
    const narrator = brief.model
      ? new Scribe({ sidecar: this.#sidecar, seed: brief.seed, signal: options.signal })
      : new OfflineNarrator(brief.seed)

    await options.step(brief.model ? 'Asking the local model to write the city' : 'Laying out the city')
    const built = await new Forge(narrator).build({
      theme: brief.theme,
      seed: brief.seed,
      blocksX: brief.blocks,
      blocksY: brief.blocks,
    })
    if (options.signal.aborted) return { ok: false, message: 'Stopped.' }
    if (!built.ok) return { ok: false, message: refused(built.error) }

    await options.step('Sealing the city')
    // pinned before it is sealed, because the hash covers the pins: a file that
    // does not say which building of the pack each plot was designed against is
    // re-skinned by the next reader whose pack has grown
    const pinned = options.catalogue ? pin(built.value.world, options.catalogue) : { ok: true as const, requires: [] }
    if (!pinned.ok) return { ok: false, message: pinned.message }
    const document = await Bundle.pack(built.value.world, built.value.quests, {
      generator: 'browser',
      requires: pinned.requires,
    })
    return this.#open(document)
  }

  /**
   * A city out of a file the player picked off their own machine. It is the
   * file Export wrote, opened with nothing done to it in between, so a world
   * somebody sent is played by choosing it rather than by editing an address.
   */
  async read(file: Blob, signal: AbortSignal): Promise<Made> {
    try {
      const text = await file.text()
      if (signal.aborted) return { ok: false, message: 'Stopped.' }
      return await this.#open(JSON.parse(text))
    } catch (cause) {
      if (signal.aborted) return { ok: false, message: 'Stopped.' }
      return { ok: false, message: `That file could not be read (${String(cause)}).` }
    }
  }

  /** A city out of a file: the same door a downloaded one comes through. */
  async fetch(url: string, signal: AbortSignal): Promise<Made> {
    try {
      const response = await window.fetch(url, { signal })
      if (!response.ok) return { ok: false, message: `${url} could not be read (HTTP ${response.status}).` }
      return await this.#open(await response.json())
    } catch (cause) {
      if (signal.aborted) return { ok: false, message: 'Stopped.' }
      return { ok: false, message: `${url} could not be read (${String(cause)}).` }
    }
  }

  async #open(document: unknown): Promise<Made> {
    const opened = await Bundle.open(document)
    if (!opened.ok) return { ok: false, message: `That city will not open (${opened.error.code}).` }
    return { ok: true, value: { bundle: opened.value, document } }
  }
}

/**
 * Writes into a generated city which building of the committed pack every plot
 * was given, and names the pack, so a reader whose pack has grown draws the
 * city that was built rather than its own idea of it.
 *
 * A pack that would not load pins nothing at all, and that is the honest
 * answer: a city with no catalogues promises nothing, while one naming a
 * catalogue with no plots pinned to it looks pinned and is not. A world that
 * took the catalogue and then refused a design is that second city and there is
 * no way to undo it, so it comes back as a sentence rather than a file.
 */
function pin(world: World, catalogue: Catalogue): { ok: true; requires: AssetPackRef[] } | { ok: false; message: string } {
  if (!world.recordCatalogues([catalogue.identity]).ok) return { ok: true, requires: [] }

  for (const plot of world.plots()) {
    // a shape the pack has no building for keeps falling back to the kit, and
    // the file says nothing about it rather than naming a model it never chose
    const design = catalogue.design(plot, sizeOf(plot, world))
    if (!design) continue

    const written = world.recordDesign(plot.id, { pack: catalogue.pack, ...design })
    if (!written.ok) return { ok: false, message: `That city cannot be pinned to its art (${plot.id}: ${written.error.code}).` }
  }
  return { ok: true, requires: [catalogue.identity] }
}

/** The size `@gb/scene` hands the dressing, so the pin names the model the plot is actually drawn with. */
function sizeOf(plot: Plot, world: World) {
  return { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: heightOf(plot.storeys) }
}

/** Why the generator would not build it, in words rather than a code. */
function refused(error: { code: string }): string {
  const detail = problems(error)
  if (error.code === 'invalid-brief') return `That is not a city the generator will build${detail}.`
  if (error.code === 'unsound-world') return `The generator built a city that does not hold together${detail}.`
  return `The city could not be built (${error.code})${detail}.`
}

function problems(error: unknown): string {
  const found = (error as { problems?: unknown; paths?: unknown })
  const list = Array.isArray(found.problems) ? found.problems : Array.isArray(found.paths) ? found.paths : []
  if (list.length === 0) return ''
  return `: ${list.slice(0, 3).map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(', ')}`
}
