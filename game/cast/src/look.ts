import { hash01 } from './hash.ts'
import type { WardrobeEntry } from './wardrobe.ts'

/**
 * What the tint multiplies the hair texture by, and how common each colour is
 * on the street.
 *
 * The pack draws hair, beards and eyebrows as one greyscale strand map meant
 * to be coloured by the material, so the material's own colour is what makes
 * hair hair: left at white it comes out the grey of the map, on the head and
 * on the brows alike. These read brighter than the hair they make, because a
 * mid-grey map halves them.
 *
 * The weights set what a street looks like. This city dyes its hair: the
 * grown colours still carry half of it so a crowd is not a parade, and the
 * other half is out of a bottle, cyan and magenta most of all.
 */
const GROWN: ReadonlyArray<readonly [string, number]> = [
  ['#2f2a26', 10], // black
  ['#4a382a', 9], // dark brown
  ['#6b4d33', 8], // brown
  ['#8a6743', 6], // mid brown
  ['#c2a06a', 5], // dark blonde
  ['#e0c98f', 4], // blonde
  ['#eed9a6', 3], // platinum
  ['#9c5a30', 3], // auburn
  ['#b4552a', 3], // ginger
  ['#8e8377', 3], // going grey
  ['#b8b2a8', 3], // grey
]

/** Out of a bottle. The city dyes its hair, and cyan and magenta most of all. */
const DYED: ReadonlyArray<readonly [string, number]> = [
  ['#f2efe9', 4], // bleached white
  ['#2e6fd8', 9], // electric blue
  ['#17b6c8', 8], // cyan
  ['#0f8f7a', 5], // teal
  ['#c02f86', 8], // magenta
  ['#8a3fd0', 5], // violet
  ['#c8365a', 4], // red
  ['#5fbb2a', 3], // acid green
  ['#e07a1c', 3], // orange
]

const COLOURS: ReadonlyArray<readonly [string, number]> = [...GROWN, ...DYED]

/** How often somebody has no hair at all. */
const BALD = 0.09

/** How often somebody with a beard available grows one. */
const BEARDED = 0.35

/** One person's hair: the style, the brows, whether they have a beard, and what each is coloured. */
export interface Look {
  /** The hairstyle node to show, or undefined for a bald head. */
  readonly style: string | undefined
  /** The eyebrow node to show. */
  readonly brows: string | undefined
  readonly beard: boolean
  /** The hair and the beard, which may be out of a bottle. */
  readonly colour: string
  /**
   * The brows, which never are.
   *
   * The pack draws a pair of brows as one sheet holding a brow row and a lash
   * row, so whatever colours the brows colours the lashes with them. Dyed to
   * match the hair, somebody with acid green hair got acid green eyelashes,
   * which is the one thing on a face nobody dyes. So the brows take a grown
   * colour near the hair's own darkness and the bottle stays on the head.
   */
  readonly browColour: string
}

/**
 * Which hair an NPC wears. Bald is one of the choices rather than the only
 * one, and it is a rare one, so a street has a mix without being a barracks.
 * The colour is drawn separately from the cut, so the same cut turns up in
 * every colour. The same id always gets the same hair, in this session and in
 * anyone else's.
 */
export function chooseLook(entry: WardrobeEntry, npcId: string): Look {
  const bald = !entry.styles.length || hash01(`${npcId}/bald`) < BALD
  const colour = weighted(COLOURS, hash01(`${npcId}/hair-colour`))
  return {
    style: bald ? undefined : pick(entry.styles, npcId, 'hair'),
    brows: pick(entry.brows, npcId, 'brows'),
    beard: Boolean(entry.beard) && hash01(`${npcId}/beard`) < BEARDED,
    colour,
    browColour: grownLike(colour, npcId),
  }
}

/**
 * A grown colour for the brows. Somebody whose hair grew that colour keeps it;
 * somebody who dyed theirs gets the grown colour nearest what they started
 * from, drawn off their own id so it is the same face every time.
 */
function grownLike(colour: string, npcId: string): string {
  if (GROWN.some(([grown]) => grown === colour)) return colour
  return weighted(GROWN, hash01(`${npcId}/brow-colour`))
}

function pick<T>(options: readonly T[], npcId: string, what: string): T | undefined {
  if (!options.length) return undefined
  return options[Math.floor(hash01(`${npcId}/${what}`) * options.length)]
}

/** Draws from a weighted list: `at` is a number in [0,1). */
function weighted<T>(options: ReadonlyArray<readonly [T, number]>, at: number): T {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0)
  let left = at * total
  for (const [value, weight] of options) {
    left -= weight
    if (left < 0) return value
  }
  return options.at(-1)![0]
}
