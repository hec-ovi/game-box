import { Bundle, Pack } from '@gb/bundle'
import type { Catalogue } from '@gb/prefab'
import type { ScribeProblem, ScribeProgress } from '@gb/scribe'
import { Sidecar } from '@gb/sidecar'
import type { CityBrief } from '../../src/boot/brief.ts'
import { CityMaker, failed, type City, type Made, type Progress } from '../../src/boot/city-maker.ts'
import { pin } from '../../src/boot/pinning.ts'
import { openDoors, putUpBuilding } from './insides.ts'

/** The four stages a writing reports, in the order a build runs them. */
const STAGES: readonly ScribeProgress['stage'][] = ['history', 'city', 'places', 'quests']

/**
 * A city with no model in the room.
 *
 * Every word of a city is a model's and there is no stand-in for one, so a
 * test that needs a city to play, shelve, export or open gets the half of a
 * city that is arithmetic: `@gb/forge` lays the streets, the parts of town and
 * every building out under its own placeholders, `insides.ts` puts rooms and
 * people behind the first few doors as data, and everything after that is the
 * real maker's, down to the pins, the seal and the way the document is opened.
 *
 * Nothing here is written: the town has no name, no signs, no histories and no
 * work, so a test about any of those has no city to run on.
 */
export class FixtureMaker extends CityMaker {
  /** Called once the city is sealed, with the build not yet handed back. */
  watch: () => void = () => {}

  /** What a writing could not answer, for the notes a finished city carries. */
  problems: readonly ScribeProblem[] = []

  override async build(
    brief: CityBrief,
    options: { signal: AbortSignal; step: Progress; catalogue?: Catalogue; progress?: (event: ScribeProgress) => void },
  ): Promise<Made> {
    const laid = this.plan(brief)
    if (!laid.ok) return { ok: false, message: laid.message }
    if (options.signal.aborted) return { ok: false, message: 'Stopped.' }
    openDoors(laid.value)

    await options.step('Sealing the city')
    const pinned = options.catalogue ? pin(laid.value, options.catalogue) : { ok: true as const, requires: [] }
    if (!pinned.ok) return { ok: false, message: pinned.message }
    const document = await Bundle.pack(laid.value, [], { generator: 'browser', requires: pinned.requires })
    for (const stage of STAGES) options.progress?.({ stage, done: 1, total: 1, what: laid.value.name })

    this.watch()
    const made = await this.reopen(document, options.signal)
    if (!made.ok) return made
    return { ok: true, value: { ...made.value, notes: [...made.value.notes, ...failed(this.problems)] } }
  }
}

/**
 * A pack for a city, cut the way growing one cuts it: the base opened twice,
 * one copy built onto, and the difference cut. What a real growth puts up is
 * written by the model, so what goes up here is a building put up as data.
 */
export async function fixturePack(city: City): Promise<unknown> {
  const base = await Bundle.open(city.document)
  const growing = await Bundle.open(structuredClone(city.document))
  if (!base.ok || !growing.ok) throw new Error('the fixture city will not open again')
  putUpBuilding(growing.value.world)
  const cut = await Pack.cut(base.value, { world: growing.value.world, quests: growing.value.quests }, { generator: 'browser' })
  if (!cut.ok) throw new Error(`no pack cut: ${JSON.stringify(cut.error).slice(0, 200)}`)
  return cut.value
}

/** A maker for a test, over a sidecar nothing answers on, because nothing calls it. */
export function fixtureMaker(): FixtureMaker {
  return new FixtureMaker(deaf())
}

function deaf(): Sidecar {
  return new Sidecar({ fetch: () => Promise.reject(new Error('a test has no model')) })
}
