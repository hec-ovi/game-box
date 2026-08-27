import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { placedAt } from '../assemble.ts'
import { GLASS, MODULE, RELIEF, type PieceId } from '../catalog/pieces.ts'
import type { PlotCharter } from '../charter.ts'
import type { Fixture } from '../fixture/fixture.ts'
import type { KitLibrary, KitPart } from '../kit/library.ts'
import { bakeRoom } from '../night/room.ts'
import { FAR_GLASS } from '../night/windows.ts'
import type { Band } from './bands.ts'
import type { Face } from './faces.ts'
import type { Placement, WallPlan } from './plan.ts'

/**
 * A tall building's shell above its shopfront: the kit's own plain course
 * stretched across each wall, with the same windows on it, flat.
 *
 * A shell is drawn from `DETAIL_RADIUS` out to the far side of town, so what it
 * owes is the silhouette, the wall that silhouette is made of, and the lit
 * windows that make a skyline read at night. A stack of kit pieces is none of
 * those: above the shopfront a building is one course repeated, and repeating
 * it module by module and storey by storey cost 36 ms and 40,000 triangles in a
 * frame that builds one building.
 */
export const MASSING = {
  /**
   * Storeys at or under which a shell is every one of its kit pieces. Over it,
   * the shopfront is still built out of them and everything above is stretched,
   * because everything above is the same course over and over.
   */
  storeys: 4,
  /**
   * How far a flat pane stands off the wall it is drawn on. A stretched course
   * has no opening cut in it, so a window goes on the face of it rather than
   * behind it, on the same centimetre of air `@gb/scene` lifts road paint and a
   * sign lifts its letters by.
   */
  layer: 0.01,
} as const

/** What a tall plot's shell is made of: the kit pieces it keeps, and the stretched course over them. */
export interface Massed {
  /** The shopfront and the roof deck, still kit pieces. */
  readonly placements: readonly Placement[]
  /** Everything over the shopfront: one run of wall a face a storey, and one quad a window. */
  readonly parts: readonly Fixture[]
}

/**
 * Cuts a wall plan into the part a shell still builds out of the kit and the
 * part it stretches. A plan at or under `MASSING.storeys` is handed back whole.
 *
 * The plan is laid out in full first, so which modules glaze and which room
 * each of them looks into come off the same draws as the whole building: the
 * same windows light up in the same order however the plot is drawn.
 */
export function massing(plan: WallPlan, charter: PlotCharter, library: KitLibrary): Massed {
  const { faces, bands } = plan.walls
  if (bands.length <= MASSING.storeys) return { placements: plan.placements, parts: [] }

  const { upper, crown } = charter.built
  const plain = courseOf(library, upper.plain)
  const top = crown ? courseOf(library, crown) : plain
  const placements: Placement[] = []
  const walls = new Map<string, THREE.BufferGeometry[]>()
  const panes: THREE.BufferGeometry[] = []
  const openings = new Map<PieceId, Rect>()

  for (const placement of plan.placements) {
    if (placement.storey === undefined || placement.storey === 0) placements.push(placement)
    else if (placement.room) panes.push(pane(placement, opening(openings, library, placement.piece)))
  }
  for (const face of faces) {
    for (let storey = 1; storey < bands.length; storey++) {
      for (const course of storey === bands.length - 1 ? top : plain) {
        push(walls, course.material, wall(face, bands[storey]!, course))
      }
    }
  }
  return { placements, parts: [...welded('massing:wall', walls), ...welded('massing:pane', new Map([[FAR_GLASS, panes]]))] }
}

/**
 * One storey of one wall: the module's outer face carried across the whole of
 * it, and up it to the height of the storey.
 *
 * Every vertex takes the UV its own row would have had that far along, so the
 * kit's texture repeats every module the way it does on a wall of modules
 * rather than being stretched over the lot. At one module wide this is the
 * kit's own face, unchanged.
 */
function wall(face: Face, band: Band, course: Course): THREE.BufferGeometry {
  const vertices = course.vertices.length
  const position = new Float32Array(vertices * 3)
  const normal = new Float32Array(vertices * 3)
  const uv = new Float32Array(vertices * 2)
  const [rx, rz] = face.right
  const [ox, oz] = [-rz, rx]
  const [cx, cz] = face.origin
  // one module's own x, carried out to the width of the wall
  const stretch = (face.modules * face.moduleWidth) / MODULE.width

  course.vertices.forEach((vertex, at) => {
    const along = vertex.x * stretch
    position[at * 3] = cx + rx * along
    position[at * 3 + 1] = band.base + vertex.up * band.height
    position[at * 3 + 2] = cz + rz * along
    normal[at * 3] = rx * vertex.normal[0] + ox * vertex.normal[2]
    normal[at * 3 + 1] = vertex.normal[1]
    normal[at * 3 + 2] = rz * vertex.normal[0] + oz * vertex.normal[2]
    uv[at * 2] = vertex.at + vertex.slope * vertex.x * face.modules
    uv[at * 2 + 1] = vertex.v
  })
  return buffered(position, normal, uv, course.index)
}

/** One window on it: the opening the kit's own piece glazes, drawn flat on the face of the wall. */
function pane(placement: Placement, rect: Rect): THREE.BufferGeometry {
  const out = MASSING.layer
  const corners = [rect.x0, rect.y0, out, rect.x1, rect.y0, out, rect.x1, rect.y1, out, rect.x0, rect.y1, out]
  const geometry = buffered(
    Float32Array.from(corners),
    Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    new Float32Array(8),
    [0, 1, 2, 0, 2, 3],
  ).applyMatrix4(placedAt(placement))
  bakeRoom(geometry, placement.room!)
  return geometry
}

/** One buffer in the shape every kit part is in: float position, normal and UV, indexed. */
function buffered(position: Float32Array, normal: Float32Array, uv: Float32Array, index: readonly number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(index), 1))
  return geometry
}

function push(into: Map<string, THREE.BufferGeometry[]>, material: string, geometry: THREE.BufferGeometry): void {
  const found = into.get(material)
  if (found) found.push(geometry)
  else into.set(material, [geometry])
}

/** Each material's share of the stretched wall, as one buffer. Nothing to draw is no part. */
function welded(piece: string, geometries: ReadonlyMap<string, readonly THREE.BufferGeometry[]>): Fixture[] {
  const parts: Fixture[] = []
  for (const [material, quads] of geometries) {
    if (quads.length === 0) continue
    const merged = mergeGeometries([...quads])
    if (!merged) throw new Error(`kitbash: the ${piece} quads on ${material} do not share one set of vertex attributes`)
    for (const geometry of quads) geometry.dispose()
    parts.push({ piece, material, geometry: merged })
  }
  return parts
}

/** A rectangle in a piece's own frame, in metres. */
interface Rect {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** One vertex of a module's outer face, in the terms a wall of any width is laid out from. */
interface Vertex {
  /** Metres from the middle of the module, across it. */
  readonly x: number
  /** Where it sits up the module: 0 at the storey's floor, 1 at its ceiling. */
  readonly up: number
  /** In the module's own frame, +Z out of the wall. */
  readonly normal: readonly [number, number, number]
  /** Its row's own map along the wall, `u = at + slope * x`, so widening the wall tiles the texture instead of stretching it. */
  readonly at: number
  readonly slope: number
  readonly v: number
}

/** The outer face of one kit module on one material, ready to carry across a wall of any width. */
interface Course {
  readonly material: string
  readonly vertices: readonly Vertex[]
  readonly index: readonly number[]
}

/** The opening a glazed piece cuts, measured off the piece's own pane and remembered per piece. */
function opening(known: Map<PieceId, Rect>, library: KitLibrary, piece: PieceId): Rect {
  const found = known.get(piece)
  if (found) return found

  const rect = boundsOf(library.parts(piece).filter((part) => part.material === GLASS))
  known.set(piece, rect)
  return rect
}

/**
 * The outer face of a plain module, read off the kit rather than tabled. A wall
 * piece is authored with that face on z = 0 and its body behind it, so the
 * triangles standing on the front and looking out of it are the course, and
 * everything behind them is wall nobody can see from across the town.
 */
function courseOf(library: KitLibrary, piece: PieceId): Course[] {
  const parts = library.parts(piece)
  const front = Math.max(...parts.map((part) => boundsOf([part]).z1))
  return parts.map((part) => faceOf(part, front)).filter((course) => course.index.length > 0)
}

/** How square to the front a triangle has to stand to be part of the face rather than a return into the wall. */
const FACING = 0.7

function faceOf(part: KitPart, front: number): Course {
  const position = part.geometry.getAttribute('position')
  const normal = part.geometry.getAttribute('normal')
  const uv = part.geometry.getAttribute('uv')
  const index = part.geometry.getIndex()!
  const vertices: Vertex[] = []
  const kept: number[] = []
  // a vertex two rows share is two vertices here, because each row runs its own way along the wall
  const seen = new Map<string, number>()
  const onFace = (vertex: number): boolean => position.getZ(vertex) >= front - RELIEF && normal.getZ(vertex) >= FACING

  for (let triangle = 0; triangle < index.count; triangle += 3) {
    const corners = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)]
    if (!corners.every(onFace)) continue

    const slope = slopeOf(corners, position, uv)
    for (const corner of corners) {
      const key = `${corner}:${slope}`
      let at = seen.get(key)
      if (at === undefined) {
        at = vertices.length
        seen.set(key, at)
        vertices.push({
          x: position.getX(corner),
          up: position.getY(corner) / MODULE.height,
          normal: [normal.getX(corner), normal.getY(corner), normal.getZ(corner)],
          at: uv.getX(corner) - slope * position.getX(corner),
          slope,
          v: uv.getY(corner),
        })
      }
      kept.push(at)
    }
  }
  return { material: part.material, vertices, index: kept }
}

/**
 * How fast the texture runs along one triangle of the face. A wall's rows are
 * mapped left to right, some of them mirrored, so the rate is read off the
 * triangle itself rather than assumed for the piece.
 */
function slopeOf(corners: readonly number[], position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): number {
  let widest = { span: 0, slope: 0 }
  for (const [from, to] of [[0, 1], [1, 2], [2, 0]] as const) {
    const span = position.getX(corners[to]!) - position.getX(corners[from]!)
    if (Math.abs(span) <= Math.abs(widest.span)) continue
    widest = { span, slope: (uv.getX(corners[to]!) - uv.getX(corners[from]!)) / span }
  }
  return widest.slope
}

function boundsOf(parts: readonly KitPart[]): Rect & { z1: number } {
  const box = new THREE.Box3()
  for (const part of parts) {
    part.geometry.computeBoundingBox()
    box.union(part.geometry.boundingBox!)
  }
  return { x0: box.min.x, y0: box.min.y, x1: box.max.x, y1: box.max.y, z1: box.max.z }
}
