import type { Rng } from '@gb/kit'
import type { ResolvedCharter, Word } from '@gb/world'
import { drawOf } from '../interior/draw.ts'
import type { PremiseBuild } from '../premise/check.ts'
import type { Flavour } from './flavour.ts'
import { tiltOf } from './traits.ts'

export type KindWeights = ReadonlyArray<readonly [Word, number]>

/** How far one kind swings either side of what the theme asks for. */
const SWING: readonly number[] = [0.6, 0.8, 1, 1, 1, 1.25, 1.5]

/**
 * What the town's own history is worth on top of the kind of town it is. It
 * sits under the theme's own tilt on purpose: a collapsed trade should be
 * legible in the sheds and the empty offices, and a town should still be mostly
 * where people live rather than mostly whatever its story is about.
 */
const STORIED = 1.8

/** And the same push the other way, for the kinds the story leaves less use for. */
const SPARED = 0.5

/** How many places a town is known for on top of its keystone. */
const FEWEST_STAPLES = 1
const MOST_STAPLES = 3

/**
 * What a town of this flavour is made of, jittered by the seed: each charter's
 * own share, the theme's tilt through its traits, the town's history pushing it
 * further, and the seed moving every kind around inside that, up to dropping
 * two kinds the town turns out not to have at all.
 *
 * Every draw is forked on the word, so declaring one more kind of place moves
 * nothing another kind already rolled. Nothing the history asks for is ever the
 * kind the dice drop, and somewhere to live is never dropped, never swung below
 * what the theme asks and never pushed down by the history: whatever happened
 * here, people still live here.
 */
export function kindWeights(flavour: Flavour, rng: Rng, charters: readonly ResolvedCharter[], build?: PremiseBuild): KindWeights {
  const kept = new Set<Word>([...(build?.moreOf ?? []), ...(build?.mustHave ?? [])])
  const missing = dropped(charters.filter((charter) => !charter.residential && !kept.has(charter.word)), rng)
  return charters
    .map((charter) => {
      const swing = rng.fork(`mix/${charter.word}`).pick(SWING)
      const wanted = charter.share * tiltOf(flavour, charter) * storied(build, charter) * (charter.residential ? Math.max(1, swing) : swing)
      return [charter.word, missing.has(charter.word) ? 0 : Math.max(1, Math.round(wanted))] as const
    })
    .filter(([, weight]) => weight > 0)
}

/** Up to two kinds the town turns out not to have: each keyed off its own word, the lowest keys dropped. */
function dropped(candidates: readonly ResolvedCharter[], rng: Rng): Set<Word> {
  const count = rng.fork('drop').int(0, 3)
  const keyed = candidates
    .map((charter) => [charter.word, rng.fork(`drop/${charter.word}`).float()] as const)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
  return new Set(keyed.slice(0, count).map(([word]) => word))
}

/** How much the town's own history moves one kind, on top of what the theme asks. */
function storied(build: PremiseBuild | undefined, charter: ResolvedCharter): number {
  if (!build) return 1
  if (build.mustHave.includes(charter.word) || build.moreOf.includes(charter.word)) return STORIED
  if (build.fewerOf.includes(charter.word) && !charter.residential) return SPARED
  return 1
}

/**
 * The one place every town has, whatever the theme: somewhere everybody passes
 * through, which is also where the main line starts. A staffed place with
 * somewhere to sit, one that pours before one that does not, the lowest word
 * of those. Every town has a bar until its history declares something ahead of it.
 */
export function keystoneOf(charters: readonly ResolvedCharter[]): ResolvedCharter | undefined {
  const seated = charters.filter((charter) => charter.service !== 'none' && drawOf(charter).seats > 0)
  const pours = seated.filter((charter) => charter.holding.includes('drink'))
  return (pours.length ? pours : seated.length ? seated : charters).at(0)
}

/** The kinds a town can be known for: a counter, or a place the street notices. */
export function stapleSet(charters: readonly ResolvedCharter[]): readonly ResolvedCharter[] {
  return charters.filter((charter) => charter.service !== 'none' || charter.prominence !== 'background')
}

/**
 * The places this town is known for, whatever the mix rolls: its keystone,
 * whatever the town's history demands it holds, and one to three more out of
 * the kinds a town can be known for. They go on seeded sites, so two towns are
 * not the same two places on the same two corners.
 *
 * This is where "a surgery, because of the flood" stops being a sentence: a
 * demanded kind is put on a site before the rest of the town is rolled, so it
 * is there however the dice fall. Each candidate is keyed off its own word and
 * the theme's lean on it, and the lowest keys are taken, so one more kind of
 * place moves no other kind's chance.
 */
export function stapleKinds(flavour: Flavour, rng: Rng, charters: readonly ResolvedCharter[], demanded: readonly Word[] = []): readonly Word[] {
  const keystone = keystoneOf(charters)?.word
  const count = rng.fork('staples').int(FEWEST_STAPLES, MOST_STAPLES + 1)
  const rest = stapleSet(charters)
    .filter((charter) => charter.word !== keystone)
    .map((charter) => [charter.word, rng.fork(`staple/${charter.word}`).float() / tiltOf(flavour, charter)] as const)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([word]) => word)
  return [...new Set([...(keystone ? [keystone] : []), ...demanded, ...rest])]
}
