import { Bundle, type OpenedBundle } from '@gb/bundle'
import { Forge, OfflineNarrator } from '@gb/forge'
import { Scribe } from '@gb/scribe'
import type { Sidecar } from '@gb/sidecar'
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
  async build(brief: CityBrief, options: { signal: AbortSignal; step: Progress }): Promise<Made> {
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
    const document = await Bundle.pack(built.value.world, built.value.quests, { generator: 'browser' })
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
