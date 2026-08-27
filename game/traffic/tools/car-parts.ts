import { Box3, BufferAttribute, Group, Mesh, Matrix4, Vector3, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CAR_FOOTPRINT, CAR_PARTS, partName, type CarPart } from '../src/pack-layout.ts'
import type { CarModel } from '../src/settings.ts'
import { crease, packMaterial } from './car-shading.ts'
import { underbody } from './car-underbody.ts'

/**
 * The last step every car goes through, whatever it was modelled in: sized to
 * the footprint the simulation reserves, sitting on the road at y = 0, centred
 * on its own middle, shaded, closed underneath, and hung on the node the game
 * drives with each wheel on a pivot at its axle.
 *
 * Both sources end here, so a Quaternius car and a downloaded one come out of
 * the pack the same shape and the loader knows one way to read them.
 */

/** A car cut into the pieces the pack hangs: colour and surface already on the vertices. */
export interface CarPieces {
  readonly body: BufferGeometry
  /** The front wheels each on their own, both rear wheels together on one axle. */
  readonly wheels: ReadonlyMap<CarPart, BufferGeometry>
}

export interface CarBuild {
  readonly node: Group
  /** What the source model was multiplied by to reach this size. */
  readonly scale: number
  readonly size: { readonly length: number; readonly width: number; readonly height: number }
  readonly wheelRadius: number
  readonly wheelBase: number
  readonly triangles: number
  /** What the conversion had to work out for itself, for the build to print. */
  readonly notes: readonly string[]
}

export function assemble(model: CarModel, pieces: CarPieces, notes: readonly string[] = []): CarBuild {
  const all = [pieces.body, ...pieces.wheels.values()]
  for (const part of [CAR_PARTS.frontLeft, CAR_PARTS.frontRight, CAR_PARTS.rear]) {
    if (!pieces.wheels.has(part)) throw new Error(`${model}: no ${part}`)
  }

  const whole = new Box3()
  for (const geometry of all) whole.union(bounds(geometry))
  const size = whole.getSize(new Vector3())
  // one factor for both axes, so the car keeps its own proportions and still
  // fits the 4.5 m by 1.8 m slot the simulation keeps clear around it
  const scale = Math.min(CAR_FOOTPRINT.length / size.z, CAR_FOOTPRINT.width / size.x)
  const centre = whole.getCenter(new Vector3())
  const place = new Matrix4()
    .makeTranslation(-centre.x * scale, -whole.min.y * scale, -centre.z * scale)
    .multiply(new Matrix4().makeScale(scale, scale, scale))

  // scale before shading: the creaser buckets vertices at a centimetre, so a
  // model in its own units is one bucket and every normal comes out the same
  const shaped = new Map<BufferGeometry, BufferGeometry>()
  for (const geometry of all) {
    geometry.applyMatrix4(place)
    shaped.set(geometry, crease(geometry))
  }

  const wheels = new Map<CarPart, BufferGeometry>()
  for (const [part, geometry] of pieces.wheels) wheels.set(part, shaped.get(geometry)!)
  let body = shaped.get(pieces.body)!

  const front = bounds(wheels.get(CAR_PARTS.frontLeft)!)
  const rear = bounds(wheels.get(CAR_PARTS.rear)!)
  const wheelRadius = front.getSize(new Vector3()).y / 2
  const frontZ = front.getCenter(new Vector3()).z
  const rearZ = rear.getCenter(new Vector3()).z
  // the shell's own floor pan stops a hand's width up and its arches are open,
  // so the box under it is what reaches the road and casts the shadow
  const fit = { halfWidth: front.min.x + 0.03, frontZ, rearZ, wheelRadius }
  body = mergeGeometries([body, underbody(fit)])!

  const material = packMaterial()
  const node = new Group()
  node.name = model
  const shell = new Mesh(body, material)
  shell.name = partName(model, CAR_PARTS.body)
  node.add(shell)
  for (const [part, geometry] of wheels) node.add(pivot(model, part, geometry, material))

  return {
    node,
    scale,
    size: { length: size.z * scale, width: size.x * scale, height: size.y * scale },
    wheelRadius,
    wheelBase: frontZ - rearZ,
    triangles: [body, ...wheels.values()].reduce((sum, one) => sum + one.getAttribute('position').count / 3, 0),
    notes,
  }
}

/** A wheel's mesh on a pivot at its axle, so it can be spun and steered. */
function pivot(model: CarModel, part: CarPart, geometry: BufferGeometry, material: Mesh['material']): Group {
  const axle = bounds(geometry).getCenter(new Vector3())
  geometry.translate(-axle.x, -axle.y, -axle.z)
  const hub = new Group()
  hub.name = partName(model, part)
  hub.position.copy(axle)
  hub.add(new Mesh(geometry, material))
  return hub
}

function bounds(geometry: BufferGeometry): Box3 {
  return new Box3().setFromBufferAttribute(geometry.getAttribute('position') as BufferAttribute)
}
