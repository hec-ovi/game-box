import { Rng } from '@gb/kit'
import type { LampSpot } from '../layout.ts'
import { GROUP } from './design.ts'

/** One lamp: where it stands, and what kind of lamp it turned out to be. */
export interface Lamp extends LampSpot {
  /** The fittings on it, as a bitmask over `GROUP`. */
  readonly kit: number
  /** 0 cool white, 1 with cyan in it. */
  readonly tint: number
  /** How much bigger or smaller than the drawing this one was built. */
  readonly scale: number
  /** Whether its light is a head over the road rather than a line up the column. */
  readonly overhead: boolean
}

/** How many lamps carry each thing, 0 to 1. */
const SHARE = { overhead: 0.72, camera: 0.28, box: 0.4 } as const

/** How far a lamp is allowed off the drawn height, either way. */
const SPREAD = 0.06

/**
 * What every lamp in the city is. Which of them lean a head out over the road
 * and which are just a lit line on a post, which carry a camera or a service
 * box, how cool the light is and how tall the post.
 *
 * One stream per axis, forked off the city's own seed, so retuning how many
 * lamps carry a camera cannot move the ones that lean over the road, and adding
 * an axis later cannot move any of them. Where the lamps stand is read off the
 * grid and draws no numbers at all.
 */
export function lampsFor(spots: readonly LampSpot[], seed: string): Lamp[] {
  const rng = new Rng(seed).fork('streetlights')
  const form = rng.fork('form')
  const camera = rng.fork('camera')
  const box = rng.fork('box')
  const tint = rng.fork('tint')
  const scale = rng.fork('scale')

  return spots.map((spot) => {
    const overhead = form.chance(SHARE.overhead)
    const kit = bit(overhead ? GROUP.head : GROUP.strip) +
      (camera.chance(SHARE.camera) ? bit(GROUP.camera) : 0) +
      (box.chance(SHARE.box) ? bit(GROUP.box) : 0)
    return { ...spot, kit, tint: tint.float(), scale: 1 + scale.range(-SPREAD, SPREAD), overhead }
  })
}

/** The bit a fitting answers to. Group 0 is on every lamp and has none. */
function bit(group: number): number {
  return 2 ** (group - 1)
}
