import { readFileSync } from 'node:fs'
import { BufferAttribute, BufferGeometry, Color, Matrix4, Mesh, type MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { CAR_SURFACES, METAL_LIFT, type CarSurface } from '../src/pack-layout.ts'
import type { CarModel } from '../src/settings.ts'
import { LENS } from './car-shading.ts'
import { assemble, type CarBuild, type CarPieces } from './car-parts.ts'
import { splitWheels } from './car-wheels.ts'
import { surfaceTable, type StagedSource } from './car-sources.ts'

/**
 * Turns a model the owner downloaded into the node the game drives.
 *
 * What arrives is a showroom model fitted to a street car's budget: its colour
 * baked onto its vertices, its parts named for whoever modelled it, and no idea
 * which way it faces. What leaves is the same car as the rest of the pack: one
 * material, the surface of every triangle on its vertices, wheels on pivots and
 * the nose down +Z.
 *
 * Three things the file cannot tell us, and where each comes from:
 * the wheels, found by shape in `car-wheels.ts`; what each material is made of,
 * from the table in `car-sources.ts`; and which end is the nose, from the same
 * table and checked here against the model's own lamps.
 */

// three reaches for a browser global while it parses a glb; the geometry does not need one
const globals = globalThis as Record<string, unknown>
globals['self'] ??= globalThis

/** A lens is at least this bright and this far off grey: colour is what a lamp has. */
const LENS_FLOOR = 0.06
const SATURATION = 0.5
/** And a lamp is small. A car with more colour than this on it is a coloured car. */
const LAMP_SHARE = 0.15
/** Inside a wheel, anything brighter than this is the rim rather than the tyre. */
const RIM = 0.04
/** A lens is as bright as a lens, whatever the source baked it at. */
const LIT = 0.85

export async function buildStagedCar(model: CarModel, source: StagedSource, file: string): Promise<CarBuild> {
  const notes: string[] = []
  const whole = await read(model, source, file)
  if (source.nose === -1) whole.applyMatrix4(new Matrix4().makeRotationY(Math.PI))

  const split = splitWheels(model, whole)
  notes.push(split.said)
  const pieces: CarPieces = { body: split.body, wheels: split.wheels }
  if (source.sheet) notes.push(readTheWheels(pieces))
  notes.push(lampsByColour(pieces))

  notes.push(lampsForward(model, pieces))
  paintLamps(pieces)
  storeMetal(pieces)
  return assemble(model, pieces, notes)
}

/** Every mesh in the file as one geometry, with colour and surface on the vertices. */
async function read(model: CarModel, source: StagedSource, file: string): Promise<BufferGeometry> {
  const bytes = readFileSync(file)
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  )
  gltf.scene.updateMatrixWorld(true)

  const table = surfaceTable(source)
  const unlisted = new Set<string>()
  const parts: BufferGeometry[] = []
  gltf.scene.traverse((node) => {
    if (!(node instanceof Mesh)) return
    const worn = node.material as MeshStandardMaterial
    if (Array.isArray(node.material)) throw new Error(`${model}: ${node.name} wears several materials`)
    const surface = table.get(worn.name)
    if (surface === undefined) {
      unlisted.add(worn.name)
      return
    }
    const geometry = (node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()).applyMatrix4(
      node.matrixWorld,
    )
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') geometry.deleteAttribute(name)
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    geometry.setAttribute('color', paint(geometry, worn, surface))
    parts.push(geometry)
  })

  if (unlisted.size > 0) {
    throw new Error(`${model}: ${[...unlisted].join(', ')} not in its surface table (car-sources.ts)`)
  }
  const merged = mergeGeometries(parts)
  if (!merged) throw new Error(`${model}: its parts do not merge`)
  return merged
}

/** The colour a triangle was baked, and which of the pack's surfaces it is, as four bytes. */
function paint(geometry: BufferGeometry, material: MeshStandardMaterial, surface: CarSurface): BufferAttribute {
  const count = geometry.getAttribute('position').count
  const baked = geometry.getAttribute('color')
  const colours = new Uint8Array(count * 4)
  const own = material.color
  for (let i = 0; i < count; i++) {
    colours[i * 4] = byte(baked ? baked.getX(i) : own.r)
    colours[i * 4 + 1] = byte(baked ? baked.getY(i) : own.g)
    colours[i * 4 + 2] = byte(baked ? baked.getZ(i) : own.b)
    colours[i * 4 + 3] = surface
  }
  return new BufferAttribute(colours, 4, true)
}

/**
 * What a model painted with one sheet cannot say about its wheels: inside a
 * wheel, dark is the tyre and bright is the rim.
 */
function readTheWheels(pieces: CarPieces): string {
  let rim = 0
  let tyre = 0
  for (const wheel of pieces.wheels.values()) {
    const colours = bytesOf(wheel)
    for (let i = 0; i < colours.length; i += 4) {
      const bright = luma(colours, i) > RIM
      colours[i + 3] = bright ? CAR_SURFACES.metal : CAR_SURFACES.trim
      if (bright) rim++
      else tyre++
    }
  }
  return `off the sheet: ${rim} rim and ${tyre} tyre vertices`
}

/**
 * The lamps a material name never mentions. Paint, glass, rubber and brightwork
 * are all grey or black on a fitted model; a saturated patch is a lens, whether
 * it wears a material called `blockers` or the one material a whole car shares.
 * A car painted a colour of its own is left alone: a red car is a red car, not
 * a lantern, and its lamps come off its table instead.
 */
function lampsByColour(pieces: CarPieces): string {
  const colours = bytesOf(pieces.body)
  const found: number[] = []
  for (let i = 0; i < colours.length; i += 4) {
    if (colours[i + 3] === CAR_SURFACES.lamp) continue
    const most = Math.max(colours[i]!, colours[i + 1]!, colours[i + 2]!) / 255
    const least = Math.min(colours[i]!, colours[i + 1]!, colours[i + 2]!) / 255
    if (most < LENS_FLOOR || most - least < SATURATION * most) continue
    found.push(i)
  }
  const share = found.length / (colours.length / 4)
  if (share > LAMP_SHARE) return `${found.length} saturated vertices left as paint: ${(share * 100).toFixed(0)}% of the car`
  for (const at of found) colours[at + 3] = CAR_SURFACES.lamp
  return `${found.length} lamp vertices off the colour`
}

/**
 * The end with the brighter lamps is the nose. Head lamps are white or amber
 * and tail lamps are red, on every car and in every sheet, so this is what says
 * whether the table has the model the right way round. A model with lamps at
 * one end only is checked against that end.
 */
function lampsForward(model: CarModel, pieces: CarPieces): string {
  const span = extent(pieces)
  const middle = (span.min + span.max) / 2
  const ends = { front: { sum: 0, count: 0 }, rear: { sum: 0, count: 0 } }
  const colours = bytesOf(pieces.body)
  const position = pieces.body.getAttribute('position')
  for (let i = 0; i < colours.length; i += 4) {
    if (colours[i + 3] !== CAR_SURFACES.lamp) continue
    const end = position.getZ(i / 4) > middle ? ends.front : ends.rear
    end.sum += luma(colours, i)
    end.count++
  }
  if (ends.front.count === 0 && ends.rear.count === 0) return 'no lamps to check the nose against'
  const front = ends.front.count ? ends.front.sum / ends.front.count : -1
  const rear = ends.rear.count ? ends.rear.sum / ends.rear.count : -1
  if (front < rear) {
    throw new Error(
      `${model}: its brighter lamps are at the back (${rear.toFixed(3)} against ${front.toFixed(3)}), so the nose does not point +Z`,
    )
  }
  return `lamps ${ends.front.count} forward at ${front.toFixed(3)}, ${ends.rear.count} behind at ${rear < 0 ? 'none' : rear.toFixed(3)}`
}

/**
 * A lamp takes the colour of the end it is on: near white at the nose, red at
 * the tail, and its own hue at full brightness anywhere else, which is what a
 * roof beacon and a side repeater are. A sheet bakes an unlit lens the muddy
 * colour it is in daylight, and muddy is not what glows at night.
 */
function paintLamps(pieces: CarPieces): void {
  const span = extent(pieces)
  const third = (span.max - span.min) / 3
  const head = new Color(LENS.head)
  const tail = new Color(LENS.tail)
  const colours = bytesOf(pieces.body)
  const position = pieces.body.getAttribute('position')
  for (let i = 0; i < colours.length; i += 4) {
    if (colours[i + 3] !== CAR_SURFACES.lamp) continue
    const z = position.getZ(i / 4)
    if (z > span.max - third) write(colours, i, head.r, head.g, head.b)
    else if (z < span.min + third) write(colours, i, tail.r, tail.g, tail.b)
    else {
      const most = Math.max(colours[i]!, colours[i + 1]!, colours[i + 2]!) / 255 || 1
      const lift = LIT / most
      write(colours, i, (colours[i]! / 255) * lift, (colours[i + 1]! / 255) * lift, (colours[i + 2]! / 255) * lift)
    }
  }
}

/** Brightwork is stored dark because the shader lifts it. */
function storeMetal(pieces: CarPieces): void {
  for (const geometry of [pieces.body, ...pieces.wheels.values()]) {
    const colours = bytesOf(geometry)
    for (let i = 0; i < colours.length; i += 4) {
      if (colours[i + 3] !== CAR_SURFACES.metal) continue
      for (let k = 0; k < 3; k++) colours[i + k] = Math.round(colours[i + k]! / METAL_LIFT)
    }
  }
}

/** How far the whole car reaches along Z, which is what says where its ends are. */
function extent(pieces: CarPieces): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const geometry of [pieces.body, ...pieces.wheels.values()]) {
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const z = position.getZ(i)
      if (z < min) min = z
      if (z > max) max = z
    }
  }
  return { min, max }
}

function bytesOf(geometry: BufferGeometry): Uint8Array {
  return (geometry.getAttribute('color') as BufferAttribute).array as Uint8Array
}

function luma(colours: Uint8Array, at: number): number {
  return (0.2126 * colours[at]! + 0.7152 * colours[at + 1]! + 0.0722 * colours[at + 2]!) / 255
}

function write(colours: Uint8Array, at: number, r: number, g: number, b: number): void {
  colours[at] = byte(r)
  colours[at + 1] = byte(g)
  colours[at + 2] = byte(b)
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)))
}
