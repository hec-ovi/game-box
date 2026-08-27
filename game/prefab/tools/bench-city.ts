/**
 * What a city costs to open, with the shell path and without it, measured
 * headless in Node on a forged town: `@gb/prefab` over `@gb/kitbash`, which is
 * how the game dresses one, or the kit alone, which is what the town falls back
 * to for a plot the pack has no shape for.
 *
 * `lod` is the streaming path `@gb/scene` runs when the dressing publishes a
 * `shell`: the whole town as its skyline, the dressing's shell within
 * `SHELL_RADIUS` of the spawn and the whole building within `DETAIL_RADIUS`.
 * `whole` hides the shell, which is what a dressing without one costs.
 * `--shell all` puts a shell on every plot in the town, which is what the city
 * cost before the skyline carried the far field.
 *
 * It prints what the town holds, what a camera standing in the street submits
 * of it, and what walking costs, so a change here can be read as a number.
 *
 *   node tools/bench-city.ts [--seed metro] [--blocks 20] [--storeys 24] [--mode lod|whole] [--dressing prefab|kit] [--shell 256|all] [--far 4000]
 *
 * Reads: pack/ here, and assets/dist/downtown-kit.glb (GB_ASSETS_DIST overrides).
 */
import { Forge, OfflineNarrator } from '@gb/forge'
import { KitDressing, loadKit } from '@gb/kitbash'
import { buildCity, SHELL_RADIUS, type CityBuild, type Dressing } from '@gb/scene'
import { inPlotBand, plotShape } from '@gb/world'
import * as THREE from 'three'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PrefabDressing } from '../src/dressing.ts'
import { flag } from './args.ts'
import { readPack, scenesOf } from './headless.ts'

const DIST = process.env['GB_ASSETS_DIST'] ?? join(resolve(import.meta.dirname, '../../..'), 'assets/dist')

const args = process.argv.slice(2)
const seed = flag(args, '--seed') ?? 'metro'
const blocks = Number(flag(args, '--blocks') ?? 20)
const storeys = flag(args, '--storeys')
const mode = flag(args, '--mode') ?? 'lod'
const dressed = flag(args, '--dressing') ?? 'prefab'
const reach = flag(args, '--shell')
const shell = reach === 'all' ? Number.POSITIVE_INFINITY : Number(reach ?? SHELL_RADIUS)
/** The far plane the game gives the camera comes off the air, and it is kilometres: the whole town is inside it. */
const far = Number(flag(args, '--far') ?? 4000)

/** What one call to the dressing landed in the city, and what it cost. */
class Tally {
  triangles = 0
  meshes = 0
  calls = 0
  ms = 0
  readonly materials = new Set<string>()

  /** Times one call and reads what it answered. */
  of(build: () => THREE.Object3D): THREE.Object3D {
    const at = performance.now()
    const object = build()
    this.ms += performance.now() - at
    this.calls++
    object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      this.meshes++
      this.triangles += (mesh.geometry.getIndex()?.count ?? mesh.geometry.getAttribute('position').count) / 3
      this.materials.add((mesh.material as THREE.Material).name)
    })
    return object
  }
}

const shells = new Tally()
const buildings = new Tally()

/** A dressing with a shell on it, which is both of the ones measured here. */
type Streaming = Required<Pick<Dressing, 'shell' | 'lights'>> & Dressing

/** The dressing under measurement, counted, with its shell hidden when the mode says so. */
function counted(inner: Streaming, lod: boolean): Dressing {
  const dressing: Dressing = {
    building: (plot, size, charter) => buildings.of(() => inner.building(plot, size, charter)),
    lights: (plot, size, charter) => inner.lights(plot, size, charter),
    prop: (prop) => inner.prop(prop),
    character: (npc, doing) => inner.character(npc, doing),
    pickup: (item) => inner.pickup(item),
    ground: (kind) => inner.ground(kind),
    surface: (part, size) => inner.surface(part, size),
  }
  if (!lod) return dressing
  return { ...dressing, shell: (plot, size, charter) => shells.of(() => inner.shell(plot, size, charter)) }
}

// three reaches for browser globals while decoding the kit's textures; the geometry does not need them
const globals = globalThis as Record<string, unknown>
globals.self ??= globalThis
globals.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

// one clock for the whole city, the way the game wires it: the kit owns it and the pack reads it
const kit = loadKit(await scenesOf(pathToFileURL(join(DIST, 'downtown-kit.glb'))))
const library = await readPack(kit.night)
const behind = new KitDressing(kit)
const dressing: Streaming = dressed === 'kit' ? behind : new PrefabDressing(library, behind)

// the brief's own default unless asked otherwise, so the town measured is the town the game builds, skyline and all
const built = await new Forge(new OfflineNarrator(seed)).build({ theme: 'a neon port city', seed, blocksX: blocks, blocksY: blocks, density: 1, ...(storeys ? { maxStoreys: Number(storeys) } : {}) })
if (!built.ok) throw new Error(`the forge refused: ${JSON.stringify(built.error)}`)
const world = built.value.world

const at = performance.now()
const city = buildCity(world, counted(dressing, mode === 'lod'), { shell })
const open = performance.now() - at

/** The batches the buildings are drawn out of, as against the rubbish, which is charged to the streets. */
const isBuilding = (name: string) => name.startsWith('city:') || name.startsWith('detail:')

/** What one camera on the ground would put in the draw, culled per instance the way three culls it. */
function submitted(built: CityBuild, x: number, z: number, yaw: number): { triangles: number; rubbish: number; draws: number } {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, far)
  camera.position.set(x, 1.7, z)
  camera.rotation.order = 'YXZ'
  camera.rotation.y = yaw
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))

  const sphere = new THREE.Sphere()
  const matrix = new THREE.Matrix4()
  const total = { triangles: 0, rubbish: 0, draws: 0 }
  for (const child of built.root.children) {
    const batch = child as THREE.BatchedMesh
    if (!batch.isBatchedMesh || !batch.visible) continue
    let drawn = 0
    for (let instance = 0; instance < batch.instanceCount; instance++) {
      const geometry = batch.getGeometryIdAt(instance)
      const range = geometry < 0 ? undefined : batch.getGeometryRangeAt(geometry)
      if (!range || !batch.getVisibleAt(instance)) continue
      const bounds = batch.getBoundingSphereAt(geometry, sphere)
      if (!bounds) continue
      bounds.applyMatrix4(batch.getMatrixAt(instance, matrix).premultiply(batch.matrixWorld))
      if (!frustum.intersectsSphere(bounds)) continue
      drawn += range.count / 3
    }
    if (drawn === 0) continue
    if (isBuilding(batch.name)) total.triangles += drawn
    else total.rubbish += drawn
    total.draws++
  }
  return total
}

/** Everything the batches hold, drawn or not: what the city costs to keep standing. */
function heldBy(built: CityBuild): { buildings: number; rubbish: number } {
  const total = { buildings: 0, rubbish: 0 }
  for (const child of built.root.children) {
    const batch = child as THREE.BatchedMesh
    if (!batch.isBatchedMesh) continue
    let triangles = 0
    for (let instance = 0; instance < batch.instanceCount; instance++) {
      const geometry = batch.getGeometryIdAt(instance)
      const range = geometry < 0 ? undefined : batch.getGeometryRangeAt(geometry)
      if (range) triangles += range.count / 3
    }
    if (isBuilding(batch.name)) total.buildings += triangles
    else total.rubbish += triangles
  }
  return total
}

/**
 * What `follow` costs along a walk from the spawn, frame by frame, the way the
 * game calls it: told the frame's own elapsed time, so the rings take their
 * backlog a few buildings at a time.
 */
function walked(built: CityBuild): { median: number; ninetyNinth: number; worst: number; frames: number; crossings: number } {
  const took: number[] = []
  let crossings = 0
  let last = Math.floor(built.spawn.x / world.cellSize)
  for (let metres = 0.25; metres <= 120; metres += 0.25) {
    const x = built.spawn.x + metres
    const now = Math.floor(x / world.cellSize)
    if (now !== last) crossings++
    last = now
    const began = performance.now()
    built.follow(x, built.spawn.z, 1 / 60)
    took.push(performance.now() - began)
  }
  const sorted = [...took].sort((a, b) => a - b)
  return {
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    ninetyNinth: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
    worst: sorted.at(-1) ?? 0,
    frames: took.length,
    crossings,
  }
}

const batches = city.root.children.filter((child) => child.name.startsWith('city:') || child.name.startsWith('detail:'))
const materials = new Set([...shells.materials, ...buildings.materials])
const rounded = (value: number) => Math.round(value).toLocaleString('en-GB')

const plots = [...world.plots()]
const towers = plots.filter((plot) => !inPlotBand(plotShape(plot)))
console.log(`${blocks} by ${blocks} blocks (${world.grid.width} by ${world.grid.height} cells), ${dressed} ${mode}, shells to ${reach ?? SHELL_RADIUS} m: ${plots.length} plots, ${towers.length} over the band (tallest ${Math.max(...plots.map((plot) => plot.storeys))} storeys), pack ${library.catalogue.version}`)
console.log(`  open ${rounded(open)} ms, of it ${rounded(shells.ms + buildings.ms)} ms in the dressing, rss ${rounded(process.memoryUsage().rss / 1e6)} MB`)
console.log(`  shells: ${rounded(shells.calls)} built, ${rounded(shells.triangles)} triangles, ${rounded(shells.meshes)} meshes`)
console.log(`  buildings: ${rounded(buildings.calls)} built, ${rounded(buildings.triangles)} triangles, ${rounded(buildings.meshes)} meshes`)
console.log(`  ${materials.size} materials: ${[...materials].join(', ')}`)
console.log(`  ${batches.length} building draws: ${batches.map((batch) => batch.name).join(', ')}`)

const eye = { x: city.spawn.x, z: city.spawn.z }
const headings = [city.spawn.heading + Math.PI / 2, 0, Math.PI / 2, Math.PI, -Math.PI / 2]
const views = headings.map((yaw) => submitted(city, eye.x, eye.z, yaw))
const worst = views.reduce((a, b) => (b.triangles > a.triangles ? b : a))
const holding = heldBy(city)
console.log(`  buildings held ${rounded(holding.buildings)} triangles, of it ${rounded(plots.length * 12)} of skyline; rubbish ${rounded(holding.rubbish)}`)
console.log(`  standing at the spawn, far plane ${rounded(far)} m: ${rounded(views[0]!.triangles)} triangles of buildings facing the door, ${worst.draws} draws`)
console.log(`  turning on the spot from there: ${views.slice(1).map((one) => rounded(one.triangles)).join(' | ')}, and ${rounded(worst.rubbish)} of rubbish whichever way`)
const walk = walked(city)
console.log(
  `  follow over a 120 m walk (${walk.frames} frames, ${walk.crossings} of them a new cell): median ${(walk.median * 1000).toFixed(0)} us, 99th ${walk.ninetyNinth.toFixed(2)} ms, worst ${walk.worst.toFixed(2)} ms`,
)
