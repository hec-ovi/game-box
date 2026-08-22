/**
 * Prints what the catalog does to the source art: the size of every model, the
 * evidence for which way it faces, and the box each prop ends up in.
 *
 * Run: node game/furnish/tools/print-catalog.ts
 */
import type { FurnitureProp } from '@gb/world'
import { PIECES, PIECE_IDS, yawOf } from '../src/catalog/pieces.ts'
import { PROP_ART } from '../src/catalog/props.ts'
import { faceStretch, fitScale } from '../src/kit/fit.ts'
import { frontOn, measurePiece, type Measured } from './measure.ts'

const measured = new Map(PIECE_IDS.map((id) => [id, measurePiece(id)] as const))

console.log('pieces (source units)\n')
for (const id of PIECE_IDS) {
  const piece = measured.get(id)!
  const size = sizeOf(piece)
  const read = [frontOn(piece, 'x'), frontOn(piece, 'z')].map((sign, at) => `${sign ?? '?'}${at ? 'z' : 'x'}`)
  console.log(
    `${id.padEnd(26)} ${PIECES[id].pack.padEnd(10)} ${fixed(size)}  ${String(piece.triangles).padStart(5)} tris  ` +
      `front ${PIECES[id].front}  measured ${read.join(' ')}  ${piece.materials.join(',')}`,
  )
}

console.log('\nprops (metres)\n')
for (const [prop, art] of Object.entries(PROP_ART) as [FurnitureProp, (typeof PROP_ART)[FurnitureProp]][]) {
  const source = union(art.parts.map((part) => ({ piece: measured.get(part.piece)!, at: part.at })))
  const turned = turn(source, yawOf(PIECES[art.parts[0]!.piece].front))
  const scale = fitScale(turned, art)
  const built = { x: turned.x * scale.x, y: turned.y * scale.y, z: turned.z * scale.z }
  console.log(
    `${prop.padEnd(16)} ${art.parts.map((part) => part.piece).join(' + ').padEnd(34)} ` +
      `${fixed(built)}  face x${faceStretch(scale).toFixed(2)}  depth x${(scale.z / scale.y).toFixed(2)}  ` +
      `${art.parts.reduce((total, part) => total + measured.get(part.piece)!.triangles, 0)} tris`,
  )
}

interface Size {
  x: number
  y: number
  z: number
}

function sizeOf(piece: Measured): Size {
  return { x: piece.max[0] - piece.min[0], y: piece.max[1] - piece.min[1], z: piece.max[2] - piece.min[2] }
}

function union(parts: readonly { piece: Measured; at: readonly [number, number, number] | undefined }[]): Size {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const { piece, at = [0, 0, 0] } of parts) {
    for (const axis of [0, 1, 2] as const) {
      min[axis] = Math.min(min[axis]!, piece.min[axis] + at[axis])
      max[axis] = Math.max(max[axis]!, piece.max[axis] + at[axis])
    }
  }
  return { x: max[0]! - min[0]!, y: max[1]! - min[1]!, z: max[2]! - min[2]! }
}

/** A quarter turn swaps which way across the piece is. */
function turn(size: Size, yaw: number): Size {
  return Math.abs(Math.sin(yaw)) > 0.5 ? { x: size.z, y: size.y, z: size.x } : size
}

function fixed(size: Size): string {
  return `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`.padEnd(22)
}
