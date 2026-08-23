import { Rng } from '@gb/kit'
import type { ItemArchetype } from '@gb/world'
import type { Look } from '../build/look.ts'
import { MATTER } from './matter.ts'
import { ITEM_SPECS } from './specs.ts'
import type { EdgeKind } from '../style/variant.ts'

/**
 * One archetype drawn one way.
 *
 * A quest hands you a cheap ledger from one shop and a stained one from
 * another, and they have to look like two different ledgers without being two
 * different models. So each archetype is built in a fixed handful of casts: the
 * body is a different matter in each, and a stream forked per archetype and per
 * cast decides the moulding, the proportions and whether the one bright detail
 * on it is lit.
 *
 * Fixed handful is the whole point. Vary per item and a town of a thousand
 * items is a thousand buffers; vary per cast and it is `ITEM_CASTS` per
 * archetype whatever the size of the city, which is what lets every item in a
 * room share one material and one batch.
 */
export const ITEM_CASTS = 3

export interface ItemCast {
  readonly archetype: ItemArchetype
  /** Which cast this is, 0 up. */
  readonly index: number
  /** The body of the thing. */
  readonly body: Look
  /** Its fittings: a spine, a cap, a frame, a latch. */
  readonly trim: Look
  /** Its one bright detail: a stamp, a label, a band, a seal. */
  readonly mark: Look
  readonly edge: EdgeKind
  /** Metres of radius on a rounded plan corner. */
  readonly radius: number
  readonly rounding: 'square' | 'front' | 'all'
  /** A proportion knob, 0 slim to 1 chunky. */
  readonly heft: number
  /** Whether the detail that can emit does. */
  readonly lit: boolean
}

const EDGES: readonly [EdgeKind, number][] = [
  ['chamfer', 4],
  ['round', 4],
  ['sharp', 2],
]

/** One archetype in one cast. Same seed, same thing, always. */
export function itemCast(seed: string, archetype: ItemArchetype, index: number): ItemCast {
  const spec = ITEM_SPECS[archetype]
  const rng = new Rng(seed).fork('items').fork(archetype).fork(String(index))
  return {
    archetype,
    index,
    body: MATTER[spec.body[index % spec.body.length]!],
    trim: MATTER[spec.trim],
    mark: MATTER[spec.mark],
    edge: rng.weighted(EDGES as [EdgeKind, number][]),
    radius: rng.range(0.002, 0.008),
    rounding: rng.chance(0.5) ? 'all' : 'front',
    heft: rng.float(),
    lit: rng.chance(0.6),
  }
}

/**
 * Which cast one item is drawn in. Its id, so the ledger you were sent for
 * looks the same on the second visit and unlike the one in the next shop.
 */
export function castIndex(seed: string, itemId: string): number {
  return new Rng(seed).fork('item').fork(itemId).int(0, ITEM_CASTS)
}
