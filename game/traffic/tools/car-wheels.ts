import { Box3, BufferAttribute, BufferGeometry, Vector3 } from 'three'
import { CAR_PARTS, type CarPart } from '../src/pack-layout.ts'

/**
 * Finds the wheels of a car nobody labelled.
 *
 * A downloaded model names its parts for whoever modelled it, or welds the
 * whole car into one lump, so there is no `FrontLeftWheel` to put on a pivot.
 * What is always true is the shape: a wheel is a round thing standing on the
 * road, near one flank, and it is its own shell rather than part of the body.
 * So the geometry is cut into islands of triangles that share vertices, and the
 * four round ones touching the ground are the wheels. Whatever else sits inside
 * a wheel, the rim, the hub cap, a brake disc, goes with it.
 *
 * It works in the model's own units and measures everything against the car's
 * own size, so it does not care whether a file is in metres or centimetres.
 */

/** A wheel stands on the road: its lowest point is within this much of the car's. */
const GROUND = 0.05
/** A wheel is round: its height and its length agree within this much. */
const ROUNDNESS = 0.3
/** And it is narrower than it is tall. */
const NARROW = 0.8
/** A wheel is this much of the car's height, at least, and at most. */
const SIZE = { least: 0.2, most: 0.75 }
/** And it stands out towards a flank rather than under the middle of the car. */
const OFFSET = 0.15
/** How much wider than a wheel the search for what belongs to it goes. */
const REACH = 1.05

export interface CarWheels {
  /** Everything that is not a wheel. */
  readonly body: BufferGeometry
  /** One geometry per pivot: the front pair each on their own, the rear pair together. */
  readonly wheels: ReadonlyMap<CarPart, BufferGeometry>
  /** What was found, for the build to print. */
  readonly said: string
}

/**
 * Cuts a whole car into a body and three wheel pivots. The geometry must be
 * non-indexed and standing the way it will be driven, nose down +Z.
 */
export function splitWheels(model: string, whole: BufferGeometry): CarWheels {
  const islands = islandsOf(whole)
  const car = new Box3().setFromBufferAttribute(whole.getAttribute('position') as BufferAttribute)
  const size = car.getSize(new Vector3())

  const round = islands.filter((island) => isWheel(island, car, size))
  if (round.length !== 4) {
    throw new Error(
      `${model}: found ${round.length} wheels, not 4. ` +
        `Islands: ${islands
          .slice(0, 12)
          .map((one) => `${one.triangles.length}t ${one.size.toArray().map((v) => v.toFixed(2)).join('x')}`)
          .join(', ')}`,
    )
  }

  const corners = new Map<string, Island[]>()
  for (const wheel of round) {
    const front = wheel.centre.z > car.getCenter(new Vector3()).z
    const left = wheel.centre.x > 0
    const corner = `${front ? 'front' : 'rear'}-${left ? 'left' : 'right'}`
    corners.set(corner, [...(corners.get(corner) ?? []), wheel])
  }
  if ([...corners.values()].some((at) => at.length !== 1) || corners.size !== 4) {
    throw new Error(`${model}: the four wheels are not one to a corner (${[...corners.keys()].join(', ')})`)
  }

  // a rim, a hub cap or a brake disc is its own island sitting inside a wheel
  const taken = new Set(round)
  for (const island of islands) {
    if (taken.has(island)) continue
    const inside = round.find((wheel) => holds(wheel, island))
    if (!inside) continue
    inside.triangles.push(...island.triangles)
    taken.add(island)
  }

  const parts = new Map<CarPart, number[]>([
    [CAR_PARTS.frontLeft, corners.get('front-left')![0]!.triangles],
    [CAR_PARTS.frontRight, corners.get('front-right')![0]!.triangles],
    [CAR_PARTS.rear, [...corners.get('rear-left')![0]!.triangles, ...corners.get('rear-right')![0]!.triangles]],
  ])
  const wheels = new Map<CarPart, BufferGeometry>()
  for (const [part, triangles] of parts) wheels.set(part, subset(whole, triangles))

  const rest = islands.filter((island) => !taken.has(island)).flatMap((island) => island.triangles)
  const one = round[0]!
  return {
    body: subset(whole, rest),
    wheels,
    said:
      `${islands.length} islands, wheels ${round.map((wheel) => wheel.triangles.length).join('/')} triangles` +
      `, ${(one.size.y / size.y).toFixed(2)} of the car's height`,
  }
}

interface Island {
  triangles: number[]
  readonly box: Box3
  readonly size: Vector3
  readonly centre: Vector3
}

/** Triangles that share a vertex are one shell; the file's own parts are ignored. */
function islandsOf(geometry: BufferGeometry): Island[] {
  const position = geometry.getAttribute('position')
  const faces = position.count / 3
  const box = new Box3().setFromBufferAttribute(position as BufferAttribute)
  const grain = Math.max(...box.getSize(new Vector3()).toArray()) * 1e-6

  const parent = new Int32Array(faces).map((_, at) => at)
  const find = (at: number): number => {
    let root = at
    while (parent[root] !== root) root = parent[root]!
    while (parent[at] !== root) {
      const next = parent[at]!
      parent[at] = root
      at = next
    }
    return root
  }
  const merge = (a: number, b: number): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  const owner = new Map<string, number>()
  for (let face = 0; face < faces; face++) {
    for (let k = 0; k < 3; k++) {
      const at = face * 3 + k
      const key = `${Math.round(position.getX(at) / grain)},${Math.round(position.getY(at) / grain)},${Math.round(position.getZ(at) / grain)}`
      const seen = owner.get(key)
      if (seen === undefined) owner.set(key, face)
      else merge(seen, face)
    }
  }

  const groups = new Map<number, number[]>()
  for (let face = 0; face < faces; face++) {
    const root = find(face)
    const group = groups.get(root)
    if (group) group.push(face)
    else groups.set(root, [face])
  }

  const corner = new Vector3()
  return [...groups.values()]
    .map((triangles) => {
      const bounds = new Box3()
      for (const face of triangles) {
        for (let k = 0; k < 3; k++) bounds.expandByPoint(corner.fromBufferAttribute(position, face * 3 + k))
      }
      return { triangles, box: bounds, size: bounds.getSize(new Vector3()), centre: bounds.getCenter(new Vector3()) }
    })
    .sort((a, b) => b.triangles.length - a.triangles.length)
}

function isWheel(island: Island, car: Box3, size: Vector3): boolean {
  const round = Math.abs(island.size.y - island.size.z) < ROUNDNESS * Math.max(island.size.y, island.size.z)
  return (
    island.box.min.y - car.min.y < GROUND * size.y &&
    round &&
    island.size.x < NARROW * island.size.y &&
    island.size.y > SIZE.least * size.y &&
    island.size.y < SIZE.most * size.y &&
    Math.abs(island.centre.x) > OFFSET * size.x
  )
}

/** Whether a wheel's cylinder holds another island whole. */
function holds(wheel: Island, island: Island): boolean {
  const reach = wheel.box.clone()
  reach.expandByVector(wheel.size.clone().multiplyScalar((REACH - 1) / 2))
  return reach.containsBox(island.box)
}

/** The triangles named, as their own geometry, with every attribute they wore. */
function subset(whole: BufferGeometry, faces: readonly number[]): BufferGeometry {
  const out = new BufferGeometry()
  for (const [name, attribute] of Object.entries(whole.attributes)) {
    const source = attribute as BufferAttribute
    const items = source.itemSize
    const array = new (source.array.constructor as new (length: number) => typeof source.array)(faces.length * 3 * items)
    let at = 0
    for (const face of faces) {
      for (let k = 0; k < 3; k++) {
        for (let item = 0; item < items; item++) array[at++] = source.array[(face * 3 + k) * items + item]!
      }
    }
    out.setAttribute(name, new BufferAttribute(array, items, source.normalized))
  }
  return out
}
