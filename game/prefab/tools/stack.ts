import { heightOf, type Bucket } from '../src/bucket.ts'
import type { Look } from './look.ts'

/** How the storeys of a building are cut into producer sections, in metres. */
export interface Stack {
  readonly ground: number
  readonly bodyFloors: number
  readonly bodyFloor: number
  readonly crown: number
}

const STOREY = 3.2

/** The board on the parapet storey: how much of that face it takes, and the rows it stands on. */
const BOARD = { share: 0.78, low: 4, high: 28, least: 3 } as const

/** The banner beside the entrance: the column it starts at, how wide at most, the narrowest worth hanging, and the rows it stands on. */
const BANNER = { left: 3, wide: 12, least: 7, low: 2, high: 25 } as const

/**
 * How far an advert keeps from the entrance, in the producer's 10 cm cells: one
 * of the city's 2 m cells, which is the entrance cell's own width. A banner
 * ends that far short of the door, and a board hangs only where the parapet
 * storey starts that far above the door head, which puts it above the sign
 * `@gb/kitbash` writes over the door as well.
 */
export const CLEAR = 20

/**
 * The bands one building stands on, chosen so the stack adds up to the exact
 * height `@gb/scene` puts the plot at and every band is a real storey.
 *
 * A one storey building is a shopfront under a transom band; everything taller
 * is a taller ground floor, some plain storeys and a top storey that carries
 * the parapet. The producer draws one row of its wall picture per floor, so a
 * band that is one storey tall gets one row of windows and the grid lands where
 * the storeys do.
 */
export function stackFor(storeys: number): Stack {
  const height = heightOf(storeys)
  if (storeys === 1) return { ground: 3.2, bodyFloors: 0, bodyFloor: STOREY, crown: 0.8 }
  const ground = 4
  const bodyFloors = storeys - 2
  return { ground, bodyFloors, bodyFloor: STOREY, crown: height - ground - bodyFloors * STOREY }
}

/** Every `buildings` line one model takes, in order, with its own sizes filled in. */
export function verbsFor(look: Look, bucket: Bucket, project: string): string[][] {
  const stack = stackFor(bucket.storeys)
  const face = Math.round(bucket.front * 10)
  const verbs: string[][] = [
    ['new', project, '--style', 'cyber', '--width', metres(bucket.front), '--depth', metres(bucket.depth), '--floors', '3'],
    ['set-band', 'ground', '--tier', 'light', '--height', metres(stack.ground), ...shopfront(look), ...chamfer(look)],
  ]

  if (stack.bodyFloors > 0) {
    verbs.push([
      'set-band',
      'body',
      '--tier',
      'flat',
      '--floors',
      String(stack.bodyFloors),
      '--height',
      metres(stack.bodyFloor),
      '--template',
      look.glass === 'body' ? 'bulk-glass' : 'bulk-flat',
    ])
  } else {
    verbs.push(['remove-band', 'body'])
  }

  verbs.push(['set-band', 'crown', '--tier', 'light', '--height', metres(stack.crown), '--clutter', '0', ...setback(look)])
  verbs.push(['put', 'door', '--row', '1', '--wide', metres(look.door.wide), '--tall', metres(look.door.tall), '--section', 'ground', '--side', 'S'])
  verbs.push(...displays(look, bucket, stack))

  // a band over the shopfront: clear of the door under it, clear of the corners
  // either side, and left off entirely on a ground floor with no room for it
  if (look.fascia) {
    const low = Math.round(look.door.tall * 10) + 3
    const high = Math.round(stack.ground * 10) - 3
    if (high - low >= 4) verbs.push(['put', 'panel', `2,${low}`, `${face - 3},${high}`, '--section', 'ground', '--side', 'S'])
  }

  if (look.glass === 'crown') verbs.push(['set-band', 'crown', '--template', 'bulk-glass'])
  if (look.crown) verbs.push(['crown', 'crown', '--colour', look.crown])
  verbs.push(['build'])
  return verbs
}

/**
 * Where a look's lit screens land, in the producer's own 10 cm cells, and
 * never over or beside the door.
 *
 * A board goes across the parapet storey, wide and high enough to be read from
 * the far pavement, and only where that storey starts `CLEAR` above the door
 * head: on a three storey building and up, which leaves the entrance and the
 * sign over it a whole storey of wall to themselves. A banner stands at the
 * left margin of the street level and ends `CLEAR` short of the door; a front
 * too narrow to hold `BANNER.least` of it that way carries none.
 *
 * A board is measured against the parapet's own face, not the plot's frontage,
 * because a look that steps its top storey back off the street has that much
 * less wall to hang one on.
 */
function displays(look: Look, bucket: Bucket, stack: Stack): string[][] {
  const wants = look.displays ?? []
  const verbs: string[][] = []
  const doorHead = Math.round(look.door.tall * 10)

  if (wants.includes('board') && stack.crown >= BOARD.least && Math.round((stack.ground + stack.bodyFloors * stack.bodyFloor) * 10) >= doorHead + CLEAR) {
    const parapet = Math.round((bucket.front - (look.setback ?? 0) * 2) * 10)
    const wide = Math.round(parapet * BOARD.share)
    const left = Math.round((parapet - wide) / 2)
    verbs.push(panel(left, BOARD.low, left + wide - 1, BOARD.high, 'crown'))
  }
  if (wants.includes('banner') && doorHead + 3 > BANNER.high) {
    const doorLeft = Math.round((bucket.front - look.door.wide) * 5)
    const right = Math.min(BANNER.left + BANNER.wide - 1, doorLeft - CLEAR - 1)
    if (right - BANNER.left + 1 >= BANNER.least) verbs.push(panel(BANNER.left, BANNER.low, right, BANNER.high, 'ground'))
  }
  return verbs
}

function panel(from: number, low: number, to: number, high: number, section: string): string[] {
  return ['put', 'panel', `${from},${low}`, `${to},${high}`, '--section', section, '--side', 'S', '--material', 'screen']
}

/** A lit shop window at street level, which is what a night street is read by. */
function shopfront(look: Look): string[] {
  return look.shopfront ? ['--template', 'bulk-glass'] : []
}

function chamfer(look: Look): string[] {
  return look.chamfer ? ['--chamfer', metres(look.chamfer)] : []
}

function setback(look: Look): string[] {
  return look.setback ? ['--inset', metres(look.setback)] : []
}

/** Two decimals, which is what the producer stores and reads back. */
function metres(value: number): string {
  return value.toFixed(2)
}
