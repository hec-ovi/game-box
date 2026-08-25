import { Bundle, Pack, type OpenedBundle } from '@gb/bundle'
import { Forge, OfflineNarrator } from '@gb/forge'
import type { Notice } from '@gb/hud'
import type { Catalogue } from '@gb/prefab'
import { Scribe, type ScribeProgress } from '@gb/scribe'
import type { Sidecar } from '@gb/sidecar'
import type { City, Progress } from './city-maker.ts'
import { pin } from './pinning.ts'

/** How many buildings a growth puts up: the number `gb extend` uses when it is not told. */
const GROWTH = 10

/** What a pack added to the city it went onto. */
export interface Added {
  readonly buildings: number
  readonly interiors: number
  readonly people: number
  readonly things: number
  readonly quests: number
}

/** A pack that went on: the city it gives, and what it put in it. */
export type Applied = { ok: true; value: City; added: Added } | { ok: false; message: string }

/** A city grown here, and the pack the growth travels in. */
export type Grown = { ok: true; value: City; pack: unknown; added: Added } | { ok: false; message: string }

/**
 * Adding to a city that is already finished, the way `gb extend`, `gb pack` and
 * `gb apply` do it.
 *
 * A pack is what somebody built onto one city later. It names the city it was
 * cut from by world id and content hash, so it applies to that one city and
 * refuses every other, and applying it gives the same city on every machine.
 * Growing is the other half: the base is opened twice, one copy is grown and
 * pinned to the art the growth was designed against, and the pack cut from the
 * two is applied straight back before anybody is handed it, so a pack that
 * would not apply is never written.
 */
export class Packs {
  #sidecar: Sidecar

  constructor(sidecar: Sidecar) {
    this.#sidecar = sidecar
  }

  /**
   * Somebody's pack onto this city. The base is opened again from its own
   * sealed document, never from the world the game has been playing, because a
   * playthrough writes into that one.
   */
  async apply(city: City, file: Blob, options: { signal: AbortSignal; step: Progress }): Promise<Applied> {
    let document: unknown
    try {
      document = JSON.parse(await file.text())
    } catch (cause) {
      return { ok: false, message: `That pack could not be read (${String(cause)}).` }
    }
    if (options.signal.aborted) return { ok: false, message: 'Stopped.' }

    const base = await Bundle.open(city.document)
    if (!base.ok) return { ok: false, message: `That city will not open again (${base.error.code}).` }

    await options.step('Applying the pack')
    const applied = await Pack.apply(base.value, document)
    if (!applied.ok) return { ok: false, message: refused(applied.error) }

    const added = between(base.value, applied.value)
    const sealed = await seal(applied.value, generatorOf(document))
    const opened = await Bundle.open(sealed)
    if (!opened.ok) return { ok: false, message: `The city the pack gives will not open (${opened.error.code}).` }
    // the same base and the same pack must not name two cities: the pack's own
    // hash is what the file is sealed under, and a hash that came out different
    // means the city on screen would not be the city anybody else opens
    if (opened.value.contentHash !== applied.value.contentHash) {
      return { ok: false, message: 'That pack applies to a different city than the one it names.' }
    }
    return { ok: true, added, value: { bundle: opened.value, document: sealed, notes: [grew(added)] } }
  }

  /**
   * Grow this city and cut the pack for what went up. The city that comes back
   * is the grown one, so the player is walking round what they just added, and
   * the pack beside it is the file that puts the same buildings on somebody
   * else's copy.
   */
  async grow(
    city: City,
    options: { signal: AbortSignal; step: Progress; model?: boolean; catalogue?: Catalogue; progress?: (event: ScribeProgress) => void },
  ): Promise<Grown> {
    const base = await Bundle.open(city.document)
    const growing = await Bundle.open(structuredClone(city.document))
    if (!base.ok || !growing.ok) return { ok: false, message: 'That city will not open again to be grown.' }

    const seed = growing.value.world.seed
    const scribe = options.model
      ? new Scribe({ sidecar: this.#sidecar, seed, signal: options.signal, ...(options.progress ? { progress: options.progress } : {}) })
      : undefined

    await options.step('Building onto the city')
    const grown = await new Forge(scribe ?? new OfflineNarrator(seed)).extend(growing.value.world, GROWTH)
    if (options.signal.aborted) return { ok: false, message: 'Stopped.' }
    if (!grown.ok) return { ok: false, message: `The city would not grow (${grown.error.code}).` }
    if (grown.value.length === 0) return { ok: false, message: 'That city has no land left to build on.' }

    // only what went up is pinned: every record the base wrote has to come back
    // byte for byte or there is no growth to cut
    if (options.catalogue) {
      const pinned = pin(growing.value.world, options.catalogue, new Set(grown.value))
      if (!pinned.ok) return { ok: false, message: pinned.message }
    }

    await options.step('Cutting the pack')
    const cut = await Pack.cut(base.value, { world: growing.value.world, quests: growing.value.quests }, { generator: 'browser' })
    if (!cut.ok) return { ok: false, message: refused(cut.error) }

    // applied straight back, so a pack that would not apply is never handed over
    const applied = await this.apply(city, blobOf(cut.value), { signal: options.signal, step: options.step })
    if (!applied.ok) return applied
    return { ok: true, value: applied.value, pack: cut.value, added: applied.added }
  }
}

/** What one city has that another has not. */
function between(base: OpenedBundle, grown: OpenedBundle): Added {
  return {
    buildings: grown.world.plots().length - base.world.plots().length,
    interiors: grown.world.interiors().length - base.world.interiors().length,
    people: grown.world.npcs().length - base.world.npcs().length,
    things: grown.world.items().length - base.world.items().length,
    quests: grown.quests.length - base.quests.length,
  }
}

/** What the pack added, in words, for the player to read once they are standing in it. */
function grew(added: Added): Notice {
  const parts = [
    [added.buildings, 'building'],
    [added.interiors, 'of them you can walk into'],
    [added.people, 'person'],
    [added.things, 'thing'],
    [added.quests, 'job'],
  ] as const
  const said = parts
    .filter(([count]) => count > 0)
    .map(([count, word]) => (word.startsWith('of them') ? `${count} ${word}` : `${count} ${word}${count === 1 ? '' : 's'}`))
  return { kind: 'note', text: said.length > 0 ? `The pack added ${said.join(', ')}` : 'The pack added nothing this city did not have' }
}

/** The sealed city an applied pack gives, under the generator the pack names. */
async function seal(applied: OpenedBundle, generator: string): Promise<unknown> {
  return Bundle.pack(applied.world, applied.quests, { generator, requires: [...applied.requires] })
}

/** Which generator a pack says wrote it, so the city it gives is sealed the same way anywhere. */
function generatorOf(document: unknown): string {
  const named = (document as { createdWith?: { generator?: unknown } }).createdWith?.generator
  return typeof named === 'string' ? named : 'browser'
}

/** A pack document as a file, so the apply that proves it reads it the way the player's own would. */
function blobOf(pack: unknown): Blob {
  return new Blob([JSON.stringify(pack)], { type: 'application/json' })
}

/** Why a pack would not go on, in words rather than a code. */
function refused(error: { code: string } & Record<string, unknown>): string {
  if (error.code === 'pack-mismatch') return 'That pack was cut from another city, or from another version of this one.'
  if (error.code === 'content-changed') return 'That pack has been edited since it was written, so nothing was applied.'
  if (error.code === 'not-an-extension') return 'The growth changed something the city already had, so there is no pack to cut from it.'
  const paths = Array.isArray(error.paths) ? error.paths.slice(0, 3).join(', ') : ''
  return `That pack will not apply (${error.code}${paths ? `: ${paths}` : ''}).`
}
