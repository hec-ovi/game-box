import { OfflineNarrator, type Narrator } from '@gb/forge'
import type { Catalogue } from '@gb/prefab'
import type { ScribeProblem, ScribeProgress } from '@gb/scribe'
import { Sidecar } from '@gb/sidecar'
import type { CityBrief } from '../../src/boot/brief.ts'
import { CityMaker, type Made, type Progress, type Writer } from '../../src/boot/city-maker.ts'
import { Packs } from '../../src/boot/packs.ts'

/** The four stages a writing reports, in the order a build runs them. */
const STAGES: readonly ScribeProgress['stage'][] = ['history', 'city', 'places', 'quests']

/**
 * A city with no model in the room. The game writes one with the model and
 * nothing else, so a test that needs a city to play, shelve, export or grow
 * swaps out the one thing a test cannot have: `@gb/forge`'s own narrator writes
 * the words, and every other step is the real maker's, down to the pins, the
 * seal and the way the document is opened.
 */
export class FixtureMaker extends CityMaker {
  /** Called once the town has a name, with the build not yet handed back. */
  watch: () => void = () => {}

  /** What the writing could not answer, for the notes a finished city carries. */
  problems: readonly ScribeProblem[] = []

  override async build(
    brief: CityBrief,
    options: { signal: AbortSignal; step: Progress; catalogue?: Catalogue; progress?: (event: ScribeProgress) => void },
  ): Promise<Made> {
    const made = await super.build(brief, options)
    if (!made.ok) return made
    const town = made.value.bundle.world.name
    for (const stage of STAGES) options.progress?.({ stage, done: 1, total: 1, what: stage === 'history' ? brief.theme : town })
    this.watch()
    return made
  }

  protected override writer(brief: CityBrief): Writer {
    return { narrator: new OfflineNarrator(brief.seed), problems: () => this.problems }
  }
}

/** The same for a growth: `@gb/forge` writes what goes up, and the pack is cut for real. */
export class FixturePacks extends Packs {
  protected override narrator(seed: string): Narrator {
    return new OfflineNarrator(seed)
  }
}

/** A maker for a test, over a sidecar nothing answers on, because nothing calls it. */
export function fixtureMaker(): FixtureMaker {
  return new FixtureMaker(deaf())
}

/** A grower for a test, the same way. */
export function fixturePacks(): FixturePacks {
  return new FixturePacks(deaf())
}

function deaf(): Sidecar {
  return new Sidecar({ fetch: () => Promise.reject(new Error('a test has no model')) })
}
