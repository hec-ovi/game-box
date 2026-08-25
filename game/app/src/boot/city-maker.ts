import { Bundle, type OpenedBundle } from '@gb/bundle'
import { Forge, OfflineNarrator, type ForgeResult } from '@gb/forge'
import type { Notice } from '@gb/hud'
import type { Catalogue } from '@gb/prefab'
import { Scribe, type ScribeProgress } from '@gb/scribe'
import type { Sidecar } from '@gb/sidecar'
import type { CityBrief } from './brief.ts'
import { pin } from './pinning.ts'

/**
 * A city, the sealed document it came in (which is what Export writes out), and
 * what the player should be told about it once it is on screen.
 */
export interface City {
  readonly bundle: OpenedBundle
  readonly document: unknown
  readonly notes: readonly Notice[]
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

  /**
   * A city written from the brief, sealed and reopened exactly as a file would
   * be. With the model on, `progress` hears every stage of the writing.
   */
  async build(
    brief: CityBrief,
    options: { signal: AbortSignal; step: Progress; catalogue?: Catalogue; progress?: (event: ScribeProgress) => void },
  ): Promise<Made> {
    const scribe = brief.model
      ? new Scribe({
          sidecar: this.#sidecar,
          seed: brief.seed,
          signal: options.signal,
          ...(options.progress ? { progress: options.progress } : {}),
        })
      : undefined

    await options.step(brief.model ? 'Asking the local model to write the city' : 'Laying out the city')
    const built = await new Forge(scribe ?? new OfflineNarrator(brief.seed)).build({
      theme: brief.theme,
      seed: brief.seed,
      blocksX: brief.blocks,
      blocksY: brief.blocks,
      ...(brief.brief ? { brief: brief.brief } : {}),
      ...(brief.asks ? { asks: brief.asks } : {}),
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
    return this.#open(document, [...leftOut(built.value), ...(scribe ? failed(scribe) : [])])
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

  /** A city the library kept: the document as it was shelved. */
  async reopen(document: unknown, signal: AbortSignal): Promise<Made> {
    if (signal.aborted) return { ok: false, message: 'Stopped.' }
    return this.#open(document)
  }

  async #open(document: unknown, notes: Notice[] = []): Promise<Made> {
    const opened = await Bundle.open(document)
    if (!opened.ok) return { ok: false, message: willNotOpen(opened.error) }
    if (opened.value.upgraded) {
      notes.push({
        kind: 'note',
        text: 'This city was written before charters and reads against the presets it was drawn with; export it again to write them in.',
      })
    }
    return { ok: true, value: { bundle: opened.value, document, notes } }
  }
}

/** Every kind of place the history asked for that the city would not take, said with its reason. */
function leftOut(built: ForgeResult): Notice[] {
  return built.dropped.map(({ word, reason }) => ({
    kind: 'note',
    text: `The history asked for a ${word}, which the city would not take: ${reason}`,
  }))
}

/**
 * What the model did not answer, as one line rather than one per call. A call
 * the sidecar gave up waiting on is a busy model, said as the wait it was; the
 * calls that came back wrong or not at all are a fault. Either way the offline
 * writer covered them.
 */
function failed(scribe: Scribe): Notice[] {
  const problems = scribe.problems()
  const busy = problems.filter((problem) => problem.error.code === 'busy').length
  const broken = problems.filter((problem) => problem.error.code !== 'busy')
  const notes: Notice[] = []
  if (busy > 0) notes.push({ kind: 'note', text: `The model was busy for ${busy} of its calls; the offline writer filled them in` })
  if (broken.length > 0) {
    const codes = [...new Set(broken.map((problem) => problem.error.code))].join(', ')
    notes.push({ kind: 'error', text: `The model failed ${broken.length} of its calls (${codes}); the offline writer filled them in` })
  }
  return notes
}

/** Why a file will not open, in words rather than a code. */
function willNotOpen(error: { code: string }): string {
  if (error.code === 'unknown-kind') {
    const words = (error as { words?: string[] }).words ?? []
    return `That city will not open: its places are of a kind it does not describe (${words.join(', ')}).`
  }
  return `That city will not open (${error.code}).`
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
