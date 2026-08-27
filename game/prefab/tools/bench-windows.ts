/**
 * What a window costs, measured rather than argued: the shader the wall
 * material really compiles to, and how many of a forged town's windows take
 * each path through it.
 *
 *   node tools/bench-windows.ts [--seed metro] [--blocks 8] [--dump shader.wgsl]
 *
 * The fragment figures come out of the WGSL `WebGPURenderer` generates for
 * `prefabMaterial`, built here without a device: the two branches of the kind
 * decision are counted where they are emitted, so the numbers are the shipped
 * shader's rather than a reading of the source. The census walks the committed
 * geometry every plot is actually drawn with and asks `boxedAt`, which is the
 * same answer the shader gets.
 */
import { writeFileSync } from 'node:fs'
import { Forge, OfflineNarrator } from '@gb/forge'
import { CityNight } from '@gb/kitbash'
import { storeyHeight } from '@gb/scene'
import * as THREE from 'three'
import { context, vec4 } from 'three/tsl'
import { WGSLNodeBuilder } from 'three/webgpu'
import { prefabMaterial } from '../src/material.ts'
import { ENTRANCE_ATTRIBUTE } from '../src/doorway.ts'
import { LAYER_ATTRIBUTE } from '../src/pack.ts'
import { BOXED, boxedAt } from '../src/pick.ts'
import { designFor } from '../src/pin.ts'
import { orient, turnsFor } from '../src/orient.ts'
import { glassShareOf, windowsOn } from '../src/windows.ts'
import { flag } from './args.ts'
import { readPack } from './headless.ts'

const args = process.argv.slice(2)
const seed = flag(args, '--seed') ?? 'metro'
const blocks = Number(flag(args, '--blocks') ?? 8)

/** Below this a window looks into a shop, which is the same line `src/interior.ts` draws. */
const STREET_LEVEL = 4.6

const library = await readPack()
const strip = library.catalogue.atlas.rooms

// what the shader costs
const wgsl = fragmentOf(prefabMaterial({ ...atlasOf(), finishes: library.catalogue.atlas.finishes }, new CityNight()))
const dump = flag(args, '--dump')
if (dump) writeFileSync(dump, wgsl)
const branch = kindBranch(wgsl)
const cost = (of: string) => `${statements(of)} statements, ${fetches(of)} texture ${fetches(of) === 1 ? 'fetch' : 'fetches'}`
console.log(`fragment shader: ${cost(wgsl)}`)
console.log(`  the flat kind: ${cost(branch.flat)}`)
console.log(`  the boxed kind: ${cost(branch.boxed)}`)
console.log(`  a boxed window is ${(statements(branch.boxed) / Math.max(1, statements(branch.flat))).toFixed(1)}x the flat one's arithmetic`)

// what the strip holds. The two banks of a run overlap where one picture
// serves both kinds of window, so a run is its span rather than its two counts
const span = (banks: { upper: { first: number; count: number }; street: { first: number; count: number } }) =>
  Math.max(banks.upper.first + banks.upper.count, banks.street.first + banks.street.count) - Math.min(banks.upper.first, banks.street.first)
const rooms = span(strip.rooms)
const panels = span(strip.panels)
console.log(
  `glazing strip: ${strip.layers} layers at ${strip.size} px (${((strip.layers * strip.size * strip.size * 4) / 1e6).toFixed(1)} MB on the GPU): ` +
    `${rooms} back walls, ${panels} flat panels, 4 shared faces`,
)
console.log(`  five unique faces a room would be ${rooms * 5 + panels} layers, one folded picture a room would be ${rooms + panels}`)

// what a town takes
const built = await new Forge(new OfflineNarrator(seed)).build({ theme: 'a neon port city', seed, blocksX: blocks, blocksY: blocks, density: 1 })
if (!built.ok) throw new Error(`the forge refused: ${JSON.stringify(built.error)}`)
const world = built.value.world

const tally = { bays: 0, boxed: 0, street: 0, glass: 0, boxedGlass: 0 }
let plots = 0
let drawn = 0
for (const plot of world.plots()) {
  plots++
  const charter = world.charter(plot.kind)!
  const size = { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: storeyHeight(plot.storeys) }
  const design = designFor(library.catalogue, plot, size, charter.suits)
  const geometry = design && library.geometry(design.model)
  if (!design || !geometry) continue
  drawn++
  count(orient(geometry, turnsFor(plot.entrance.facing), design.mirror, design.rooms))
}

console.log(`${blocks} by ${blocks} blocks, seed ${seed}: ${plots} plots, ${drawn} on the pack`)
console.log(
  `  ${tally.bays.toLocaleString('en-GB')} window bays, ${((tally.street / tally.bays) * 100).toFixed(1)}% of them shop windows on the pavement: ` +
    `${((tally.boxed / tally.bays) * 100).toFixed(1)}% march a box, ${(((tally.bays - tally.boxed) / tally.bays) * 100).toFixed(1)}% are flat panels`,
)
console.log(
  `  ${Math.round(tally.glass).toLocaleString('en-GB')} m2 of glass, of it ${Math.round(tally.boxedGlass).toLocaleString('en-GB')} m2 marched ` +
    `(${((tally.boxedGlass / tally.glass) * 100).toFixed(1)}%)`,
)

/** Every window bay of one building, and which kind each takes. */
function count(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const layers = geometry.getAttribute(LAYER_ATTRIBUTE)
  const index = geometry.getIndex()!
  const finishes = library.catalogue.atlas.finishes
  const seen = new Set<string>()

  for (let at = 0; at + 2 < index.count; at += 3) {
    const tri = [index.getX(at), index.getX(at + 1), index.getX(at + 2)]
    const kind = windowsOn(finishes[Math.round(layers.getX(tri[0]!))]!)
    if (!kind) continue

    // how tall a bay is here, off the same two vectors the shader reads
    const points = tri.map((k) => ({ u: uv.getX(k!), v: uv.getY(k!), x: position.getX(k!), y: position.getY(k!), z: position.getZ(k!) }))
    const tall = bayHeight(points, kind.grid.down)
    if (!(tall >= kind.shortest)) continue
    const wide = bayWidth(points, kind.grid.across)

    // one bay is counted once per wall it is cut into, so the wall's own plane
    // is part of its name: two faces of a building sharing a uv range are two
    // windows, not one
    const face = normalOf(normal, tri[0]!)
    const wall = `${face.x.toFixed(1)}:${face.z.toFixed(1)}:${(points[0]!.x * face.x + points[0]!.z * face.z).toFixed(1)}`
    const low = Math.min(...points.map((point) => point.y))
    for (const cell of cellsIn(points, kind.grid)) {
      const key = `${wall}:${cell.across}:${cell.down}:${Math.round(low)}`
      if (seen.has(key)) continue
      seen.add(key)
      const street = kind.street && low <= STREET_LEVEL
      const glass = wide * tall * glassShareOf(kind)
      tally.bays++
      tally.glass += glass
      if (street) tally.street++
      if (boxedAt(cell.across, cell.down, street)) {
        tally.boxed++
        tally.boxedGlass += glass
      }
    }
  }
}

interface Point {
  u: number
  v: number
  x: number
  y: number
  z: number
}

/** Which way a face points, so bays on two walls of one building are not the same bay. */
function normalOf(normal: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, at: number): { x: number; z: number } {
  return { x: normal.getX(at), z: normal.getZ(at) }
}

/** Which bays a triangle covers: every whole cell its uv box touches. */
function cellsIn(points: readonly Point[], grid: { across: number; down: number }): Array<{ across: number; down: number }> {
  const out: Array<{ across: number; down: number }> = []
  const from = { u: Math.min(...points.map((p) => p.u)) * grid.across, v: Math.min(...points.map((p) => p.v)) * grid.down }
  const to = { u: Math.max(...points.map((p) => p.u)) * grid.across, v: Math.max(...points.map((p) => p.v)) * grid.down }
  for (let down = Math.floor(from.v); down <= Math.floor(to.v - 1e-4); down++) {
    for (let across = Math.floor(from.u); across <= Math.floor(to.u - 1e-4); across++) out.push({ across, down })
  }
  return out
}

/** Metres one bay stands, read off the surface the way `surfaceFrame` reads it. */
function bayHeight(points: readonly Point[], down: number): number {
  const spread = Math.max(...points.map((p) => p.v)) - Math.min(...points.map((p) => p.v))
  const rise = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))
  return spread > 1e-6 ? rise / spread / down : 0
}

function bayWidth(points: readonly Point[], across: number): number {
  const spread = Math.max(...points.map((p) => p.u)) - Math.min(...points.map((p) => p.u))
  const run = Math.hypot(
    Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
    Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z)),
  )
  return spread > 1e-6 ? run / spread / across : 0
}

/** The atlas the material is built against here: real layer counts, one grey pixel each. */
function atlasOf() {
  const grey = (layers: number) => new THREE.DataArrayTexture(new Uint8Array(4 * layers).fill(128), 1, 1, layers)
  return {
    colour: grey(library.catalogue.atlas.colour.layers),
    emissive: grey(library.catalogue.atlas.emissive.layers),
    rooms: grey(strip.layers),
    glazing: strip,
    screens: grey(library.catalogue.atlas.screens.layers),
    finishes: library.catalogue.atlas.finishes,
  }
}

/**
 * The WGSL a node material compiles to, without a device.
 *
 * `WGSLNodeBuilder` is what `WebGPURenderer` runs to write a shader; it reads a
 * handful of fields off the renderer and nothing else, so the fragment source
 * here is the fragment source the game runs.
 */
function fragmentOf(material: THREE.Material): string {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material)
  const vertices = mesh.geometry.getAttribute('position').count
  mesh.geometry.setAttribute(LAYER_ATTRIBUTE, new THREE.Float32BufferAttribute(new Float32Array(vertices), 1))
  mesh.geometry.setAttribute(ENTRANCE_ATTRIBUTE, new THREE.Float32BufferAttribute(new Float32Array(vertices * 4), 4))
  const scene = new THREE.Scene()
  scene.add(mesh)
  const renderer = {
    contextNode: context(vec4(0)),
    library: { fromMaterial: (of: THREE.Material) => of },
    lighting: { enabled: false },
    shadowMap: { enabled: false, type: THREE.PCFShadowMap },
    hasFeature: () => true,
    getRenderTarget: () => null,
    getMRT: () => null,
    backend: { utils: { getTextureSampleData: () => ({ primarySamples: 1 }) } },
    currentColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGPUCoordinateSystem,
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
  }
  const builder = new WGSLNodeBuilder(mesh, renderer as never) as unknown as Builder
  builder.material = material
  builder.geometry = mesh.geometry
  builder.scene = scene
  builder.camera = new THREE.PerspectiveCamera()
  builder.build()
  return builder.fragmentShader
}

/**
 * The two arms of the kind decision, as the shader emits them.
 *
 * The condition is `hash < mix(BOXED.upper, BOXED.street, shop)`, and those two
 * numbers are written into the WGSL as they are, so the branch names itself.
 */
function kindBranch(source: string): { boxed: string; flat: string } {
  const condition = `mix( ${BOXED.upper}, ${BOXED.street},`
  const at = source.indexOf(condition)
  if (at < 0) throw new Error(`the kind decision is not in the shader: no "${condition}"`)
  const opens = source.indexOf('{', at)
  const closes = blockEnd(source, opens + 1)
  const otherwise = source.indexOf('{', closes)
  return { boxed: source.slice(opens + 1, closes), flat: source.slice(otherwise + 1, blockEnd(source, otherwise + 1)) }
}

/** On from an opening brace to the `}` that closes it. */
function blockEnd(source: string, open: number): number {
  let depth = 1
  for (let at = open; at < source.length; at++) {
    if (source[at] === '{') depth++
    else if (source[at] === '}' && --depth === 0) return at
  }
  throw new Error('unbalanced braces in the emitted shader')
}

/** Emitted statements: one line of WGSL that does something. */
function statements(source: string): number {
  return source.split('\n').filter((line) => line.trim().endsWith(';')).length
}

function fetches(source: string): number {
  return (source.match(/textureSample|textureLoad/g) ?? []).length
}

/** What a node builder is told and what it writes; `three/webgpu` does not type these for an outside caller. */
interface Builder {
  material: THREE.Material
  geometry: THREE.BufferGeometry
  scene: THREE.Scene
  camera: THREE.Camera
  build(): void
  fragmentShader: string
}
