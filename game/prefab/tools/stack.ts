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

/** The banner beside the entrance: the column it starts at, how wide, and the rows it stands on. */
const BANNER = { left: 3, wide: 12, low: 2, high: 25 } as const

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

  if (look.lines && (look.lines.section !== 'body' || stack.bodyFloors > 0)) {
    const spread = bucket.front / (look.lines.spread === 'third' ? 3 : 4)
    verbs.push([
      'line',
      look.lines.section,
      '--side',
      'S',
      '--count',
      String(look.lines.count),
      '--spacing',
      metres(spread),
      '--colour',
      look.lines.colour,
      '--thickness',
      metres(look.lines.thickness),
    ])
  }

  if (look.glass === 'crown') verbs.push(['set-band', 'crown', '--template', 'bulk-glass'])
  if (look.crown) verbs.push(['crown', 'crown', '--colour', look.crown])
  verbs.push(['build'])
  return verbs
}

/**
 * Where a look's lit screens land, in the producer's own 10 cm cells.
 *
 * A board goes across the parapet storey, wide and high enough to be read from
 * the far pavement, which is what every reference puts over a street. A banner
 * stands beside the entrance at the left margin, clear of the door in the
 * middle of the face, clear of the fascia band above it and clear of the neon
 * runs, which sit in the middle third.
 *
 * Both are left off where the band they belong on has no room: a one storey
 * building has a 0.8 m parapet, and a board squeezed into that is a stripe.
 *
 * A board is measured against the parapet's own face, not the plot's frontage,
 * because a look that steps its top storey back off the street has that much
 * less wall to hang one on.
 */
function displays(look: Look, bucket: Bucket, stack: Stack): string[][] {
  const wants = look.displays ?? []
  const verbs: string[][] = []

  if (wants.includes('board') && stack.crown >= BOARD.least) {
    const parapet = Math.round((bucket.front - (look.setback ?? 0) * 2) * 10)
    const wide = Math.round(parapet * BOARD.share)
    const left = Math.round((parapet - wide) / 2)
    verbs.push(panel(left, BOARD.low, left + wide - 1, BOARD.high, 'crown'))
  }
  if (wants.includes('banner') && Math.round(stack.ground * 10) - 3 > BANNER.high && Math.round(look.door.tall * 10) + 3 > BANNER.high) {
    verbs.push(panel(BANNER.left, BANNER.low, BANNER.left + BANNER.wide - 1, BANNER.high, 'ground'))
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
