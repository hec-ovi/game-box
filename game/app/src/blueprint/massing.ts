import * as THREE from 'three'
import { byZone, type Line, type Massing, type Patch, type Plan, type Zone } from './plan.ts'
import type { Palette, Tone } from './palette.ts'

/** Every custom property the city is drawn with. Nothing here picks a colour; they all come off the surface it stands on. */
export const CITY_TONES = [
  '--gb-well',
  '--gb-lift',
  '--gb-edge',
  '--gb-edge-lit',
  '--gb-accent',
  '--gb-accent-lit',
  '--gb-accent-dim',
  '--gb-accent-glow',
  '--gb-ink',
] as const

export type CityTone = (typeof CITY_TONES)[number]
export type CityPalette = Palette<CityTone>

/** How far off the ground each layer is drawn, in metres, so nothing fights for the same plane. */
const LAYER = { roadway: 0.02, water: 0.03, pavement: 0.06, open: 0.1, pad: 0.16, border: 0.2, frame: 0.24 }

/** How much of a part of town is left showing while another one is being read. */
const STEPPED_BACK = 0.22

/** What one part of town is painted with, so it can be lit on its own. */
interface Parts {
  walls: THREE.MeshBasicMaterial
  roofs: THREE.LineBasicMaterial
  fill?: THREE.MeshBasicMaterial
  border?: THREE.LineBasicMaterial
}

/**
 * The city as objects: the streets, the buildings at their real heights and the
 * named parts of town as the shapes they are, drawn on the panel's own grid
 * paper. No lights, no sky, no weather and nothing lying in the street, because
 * none of that is architecture and a plan has none of it in the first place.
 *
 * Buildings are one batch of boxes per part of town, shaded by which way each
 * face points from three tones of the panel's palette, so a skyline reads
 * without a single light in the scene and one part of it can be read on its own.
 */
export class City {
  readonly root = new THREE.Group()
  #palette: CityPalette
  #parts = new Map<string, Parts>()
  #spent: Array<{ dispose(): void }> = []

  constructor(plan: Plan, palette: CityPalette) {
    this.#palette = palette
    this.root.name = 'blueprint'
    this.root.add(
      this.#flat(plan.roadway, LAYER.roadway, '--gb-well'),
      this.#flat(plan.water, LAYER.water, '--gb-accent-dim'),
      this.#flat(plan.pavement, LAYER.pavement, '--gb-lift'),
      this.#flat(plan.open, LAYER.open, '--gb-edge'),
      this.#lines(edgesOf(plan.ground), LAYER.frame, '--gb-edge'),
    )
    const standing = byZone(plan.buildings)
    for (const zone of plan.zones) this.root.add(this.#zone(zone, standing.get(zone.id) ?? []))
    // a building the city never cut into a part of town still stands here
    const loose = standing.get('')
    if (loose) this.root.add(this.#standing('', loose))
    if (plan.stations.length > 0) this.root.add(this.#stations(plan))
  }

  /** One part of town read on its own: it holds its colour and the rest step back, the way the map does it. */
  light(zoneId: string | undefined): void {
    const glow = this.#palette['--gb-accent-glow']
    for (const [id, parts] of this.#parts) {
      const lit = zoneId === undefined || id === zoneId
      if (parts.fill) parts.fill.opacity = glow.alpha * (lit ? 1 : STEPPED_BACK)
      if (parts.border) {
        parts.border.color.setHex(this.#palette[id === zoneId ? '--gb-accent-lit' : '--gb-accent'].colour)
        parts.border.opacity = lit ? 1 : STEPPED_BACK
      }
      for (const material of [parts.walls, parts.roofs]) {
        material.transparent = !lit
        material.depthWrite = lit
        material.opacity = lit ? 1 : STEPPED_BACK
      }
    }
  }

  dispose(): void {
    for (const spent of this.#spent) spent.dispose()
    this.#spent = []
    this.#parts.clear()
    this.root.clear()
  }

  /** A part of town: its blocks filled, the line round them, its buildings, and a stem holding its name over the roofs. */
  #zone(zone: Zone, standing: readonly Massing[]): THREE.Object3D {
    const group = new THREE.Group()
    group.name = `zone:${zone.id}`

    const glow = this.#palette['--gb-accent-glow']
    const pads = quads(zone.pads, LAYER.pad)
    const fill = new THREE.MeshBasicMaterial({ color: glow.colour, transparent: true, opacity: glow.alpha, depthWrite: false })
    const filled = new THREE.Mesh(pads, fill)
    filled.renderOrder = 1

    const outline = strokes(zone.border, LAYER.border)
    const border = new THREE.LineBasicMaterial({ color: this.#palette['--gb-accent'].colour, transparent: true })
    const bordered = new THREE.LineSegments(outline, border)
    bordered.renderOrder = 2

    const stem = buffer(new Float32Array([zone.heart.x, 0, zone.heart.z, zone.heart.x, zone.top, zone.heart.z]))
    const stemmed = new THREE.LineSegments(stem, this.#line('--gb-accent-dim'))

    this.#spent.push(fill, border)
    group.add(this.#kept(filled, pads), this.#kept(bordered, outline), this.#kept(stemmed, stem), this.#standing(zone.id, standing))
    Object.assign(this.#parts.get(zone.id)!, { fill, border })
    return group
  }

  /** The buildings of one part of town: the boxes, and the line round every roof that turns them into a drawing. */
  #standing(zoneId: string, buildings: readonly Massing[]): THREE.Object3D {
    const walls = new THREE.MeshBasicMaterial({ vertexColors: true })
    const roofs = new THREE.LineBasicMaterial({ color: this.#palette['--gb-accent-dim'].colour })
    this.#spent.push(walls, roofs)
    this.#parts.set(zoneId, { walls, roofs })

    const group = new THREE.Group()
    group.add(this.#boxes(buildings, walls), this.#roofs(buildings, roofs))
    return group
  }

  /** Every building as one instance of one box, shaded by which way its faces point. */
  #boxes(buildings: readonly Massing[], material: THREE.Material): THREE.Object3D {
    const box = new THREE.BoxGeometry(1, 1, 1)
    box.translate(0, 0.5, 0)
    box.setAttribute('color', new THREE.BufferAttribute(faceShades(this.#palette), 3))
    const mesh = new THREE.InstancedMesh(box, material, Math.max(buildings.length, 1))
    mesh.count = buildings.length
    const put = new THREE.Matrix4()
    for (const [index, building] of buildings.entries()) {
      put.compose(
        new THREE.Vector3(building.x + building.w / 2, 0, building.z + building.d / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(building.w, building.height, building.d),
      )
      mesh.setMatrixAt(index, put)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    return this.#kept(mesh, box)
  }

  #roofs(buildings: readonly Massing[], material: THREE.Material): THREE.Object3D {
    const points = new Float32Array(buildings.length * 8 * 3)
    let at = 0
    for (const building of buildings) {
      for (const line of edgesOf(building)) {
        points.set([line.x1, building.height, line.z1, line.x2, building.height, line.z2], at)
        at += 6
      }
    }
    const geometry = buffer(points)
    const mesh = new THREE.LineSegments(geometry, material)
    mesh.frustumCulled = false
    return this.#kept(mesh, geometry)
  }

  /** Where fast travel boards: a square on the ground with a mark standing over it. */
  #stations(plan: Plan): THREE.Object3D {
    const lines: Line[] = []
    const stems = new Float32Array(plan.stations.length * 6)
    for (const [index, station] of plan.stations.entries()) {
      lines.push(...edgesOf(station))
      const middle = { x: station.x + station.w / 2, z: station.z + station.d / 2 }
      stems.set([middle.x, 0, middle.z, middle.x, station.top, middle.z], index * 6)
    }
    const stem = buffer(stems)
    const group = new THREE.Group()
    group.name = 'stations'
    group.add(this.#lines(lines, LAYER.frame, '--gb-ink'), this.#kept(new THREE.LineSegments(stem, this.#line('--gb-ink')), stem))
    return group
  }

  #flat(patches: readonly Patch[], y: number, token: CityTone): THREE.Object3D {
    const geometry = quads(patches, y)
    return this.#kept(new THREE.Mesh(geometry, this.#basic(token)), geometry)
  }

  #lines(lines: readonly Line[], y: number, token: CityTone): THREE.Object3D {
    const geometry = strokes(lines, y)
    return this.#kept(new THREE.LineSegments(geometry, this.#line(token)), geometry)
  }

  #basic(token: CityTone): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ color: this.#palette[token].colour })
    this.#spent.push(material)
    return material
  }

  #line(token: CityTone): THREE.LineBasicMaterial {
    const material = new THREE.LineBasicMaterial({ color: this.#palette[token].colour })
    this.#spent.push(material)
    return material
  }

  #kept<T extends THREE.Object3D>(object: T, geometry: THREE.BufferGeometry): T {
    this.#spent.push(geometry)
    return object
  }
}

/** Flat rectangles on the ground as one buffer: two triangles apiece, facing up. */
function quads(patches: readonly Patch[], y: number): THREE.BufferGeometry {
  const points = new Float32Array(patches.length * 18)
  let at = 0
  for (const patch of patches) {
    const [x1, z1, x2, z2] = [patch.x, patch.z, patch.x + patch.w, patch.z + patch.d]
    points.set([x1, y, z1, x1, y, z2, x2, y, z2, x1, y, z1, x2, y, z2, x2, y, z1], at)
    at += 18
  }
  return buffer(points)
}

/** Lines on the ground as one buffer. */
function strokes(lines: readonly Line[], y: number): THREE.BufferGeometry {
  const points = new Float32Array(lines.length * 6)
  let at = 0
  for (const line of lines) {
    points.set([line.x1, y, line.z1, line.x2, y, line.z2], at)
    at += 6
  }
  return buffer(points)
}

/** Points as one geometry, whatever they are going to be drawn as. */
function buffer(points: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3))
  geometry.computeBoundingSphere()
  return geometry
}

/** The four sides of a rectangle. */
function edgesOf(patch: Patch): Line[] {
  const [x1, z1, x2, z2] = [patch.x, patch.z, patch.x + patch.w, patch.z + patch.d]
  return [
    { x1, z1, x2, z2: z1 },
    { x1: x2, z1, x2, z2 },
    { x1: x2, z1: z2, x2: x1, z2 },
    { x1, z1: z2, x2: x1, z2: z1 },
  ]
}

/**
 * Three tones over the faces of one box: the roof lightest, the faces along one
 * axis mid, the faces along the other darkest. `BoxGeometry` lays its corners
 * out one face at a time, four apiece, in the order +X, -X, +Y, -Y, +Z, -Z.
 */
function faceShades(palette: CityPalette): Float32Array {
  const sides = tone(palette['--gb-lift'])
  const fronts = tone(palette['--gb-edge'])
  const roof = tone(palette['--gb-edge-lit'])
  const shades = new Float32Array(24 * 3)
  for (const [face, shade] of [sides, sides, roof, roof, fronts, fronts].entries()) {
    for (let corner = 0; corner < 4; corner++) shades.set(shade, (face * 4 + corner) * 3)
  }
  return shades
}

function tone({ colour }: Tone): [number, number, number] {
  return new THREE.Color(colour).toArray() as [number, number, number]
}
