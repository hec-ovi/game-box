/**
 * The pattern a surface is laid in: rectangular tiles, hexagons, triangles, a
 * chequerboard, or long planks.
 *
 * A pattern is arithmetic on where a point is in the room, in metres, so it
 * costs no image and no memory and it cannot jog at a seam the way a structured
 * texture does when it is cut to tile. The images this box carries are left to
 * do what they are good at: grime, wear and grain, all stochastic.
 *
 * Two numbers come out of it and the finish decides what to do with them: how
 * far the point is from the nearest joint, and a number that is the same
 * everywhere inside one tile and different in the next.
 */
import { float, hash, normalWorldGeometry, positionWorld, vec2 } from 'three/tsl'
import type { Node } from 'three/webgpu'

export type PatternKind = 'plain' | 'tile' | 'chequer' | 'hex' | 'triangle' | 'plank'

export interface Pattern {
  readonly kind: PatternKind
  /** Metres across one tile, one hexagon, one triangle, or the width of one plank. */
  readonly unit: number
  /** Metres along one plank. Nothing else reads it. */
  readonly length?: number
}

export interface PatternNodes {
  /** Metres from the nearest joint. */
  readonly edge: Node<'float'>
  /** The same everywhere inside one tile, 0 to 1. */
  readonly cell: Node<'float'>
}

const ROOT3 = Math.sqrt(3)

/**
 * Where a point on a surface is, in metres, in the plane of the surface: a
 * floor or a ceiling takes x and z, a wall takes height and whichever
 * horizontal axis it runs along. The same choice `MetreTiling` makes, so a
 * pattern and the image under it agree about which way is which.
 */
export function planeMetres(): Node<'vec2'> {
  const face = normalWorldGeometry.abs()
  const flat = face.y.greaterThan(face.x.max(face.z))
  const alongX = face.x.greaterThan(face.z)
  return flat.select(
    positionWorld.xz,
    alongX.select(vec2(positionWorld.z, positionWorld.y), vec2(positionWorld.x, positionWorld.y)),
  )
}

/** How the pattern reads at a point on the surface. */
export function patternNodes(pattern: Pattern, point: Node<'vec2'>): PatternNodes {
  switch (pattern.kind) {
    case 'plain':
      return { edge: float(1), cell: float(0.5) }
    case 'tile':
      return grid(pattern.unit, point, false)
    case 'chequer':
      return grid(pattern.unit, point, true)
    case 'hex':
      return hexagons(pattern.unit, point)
    case 'triangle':
      return triangles(pattern.unit, point)
    case 'plank':
      return planks(pattern.unit, pattern.length ?? 8 * pattern.unit, point)
  }
}

/** Distance to the nearest line of a family, in units of its spacing: 0 on a line, 0.5 midway. */
function toLine(t: Node<'float'>): Node<'float'> {
  return float(0.5).sub(t.fract().sub(0.5).abs())
}

function cellOf(one: Node<'float'>, two: Node<'float'>): Node<'float'> {
  return hash(one.mul(37.31).add(two.mul(101.17)))
}

function grid(unit: number, point: Node<'vec2'>, chequer: boolean): PatternNodes {
  const t = point.div(unit)
  const edge = toLine(t.x).min(toLine(t.y)).mul(unit)
  const across = t.x.floor()
  const down = t.y.floor()
  return { edge, cell: chequer ? across.add(down).mod(2) : cellOf(across, down) }
}

/**
 * A hexagonal grid. Every point belongs to whichever of the two staggered
 * lattices its own cell centre is nearer, which is the cheapest way to walk a
 * hex grid on a GPU.
 */
function hexagons(unit: number, point: Node<'vec2'>): PatternNodes {
  const size = vec2(1, ROOT3)
  const half = size.mul(0.5)
  const q = point.div(unit)
  const one = q.mod(size).sub(half)
  const two = q.sub(half).mod(size).sub(half)
  const local = one.dot(one).lessThan(two.dot(two)).select(one, two)

  const out = local.abs()
  const reach = out.dot(vec2(0.5, ROOT3 / 2)).max(out.x)
  const id = q.sub(local)
  return { edge: float(0.5).sub(reach).mul(unit), cell: cellOf(id.x.floor(), id.y.floor()) }
}

/** Three families of parallel lines, sixty degrees apart. */
function triangles(unit: number, point: Node<'vec2'>): PatternNodes {
  const q = point.div(unit)
  const one = q.dot(vec2(1, 0))
  const two = q.dot(vec2(0.5, ROOT3 / 2))
  const three = q.dot(vec2(-0.5, ROOT3 / 2))
  const edge = toLine(one).min(toLine(two)).min(toLine(three)).mul(unit)
  return { edge, cell: cellOf(one.floor().add(three.floor()), two.floor()) }
}

/** Rows of boards, each row's butt joints shifted along so nothing lines up. */
function planks(width: number, length: number, point: Node<'vec2'>): PatternNodes {
  const row = point.y.div(width)
  const index = row.floor()
  const along = point.x.div(length).add(index.mul(0.37))
  const edge = toLine(row).mul(width).min(toLine(along).mul(length))
  return { edge, cell: cellOf(index, along.floor()) }
}
