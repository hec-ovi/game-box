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
