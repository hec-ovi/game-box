/**
 * What a city costs to open, with the shell path and without it, measured
 * headless in Node on a planned town: `@gb/prefab` over `@gb/kitbash`, which is
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
 * of it, what walking costs and what arriving somewhere new costs, so a change
 * here can be read as a number.
 *
 * A city opens round the spawn `@gb/scene` picks, which on a town nobody has
 * written is its first plot and so a corner. Everything measured after the open
 * is measured in the middle of town instead, where a city is dense enough to
 * cost what it costs.
 *
 * A slow frame says what it was doing: the ten dearest of the walk carry the
 * plots they dressed, how tall each is, how many triangles it answered with,
 * how long the dressing took, how long the rest of the frame took and how much
 * of it the runtime spent collecting. That last column is why the frames are
 * read together rather than one at a time: a major collection lands wherever it
 * lands, and without it a cheap build looks like a stall.
 *
 *   node tools/bench-city.ts [--seed metro] [--blocks 20] [--storeys 24] [--mode lod|whole] [--dressing prefab|kit] [--shell 256|all] [--far 4000]
 *
 * Reads: pack/ here, and assets/dist/downtown-kit.glb (GB_ASSETS_DIST overrides).
 */
import { Forge } from '@gb/forge'
import { KitDressing, loadKit } from '@gb/kitbash'
import { buildCity, SHELL_RADIUS, type CityBuild, type Dressing } from '@gb/scene'
import { inPlotBand, plotShape, type Plot } from '@gb/world'
import * as THREE from 'three'
import { PerformanceObserver } from 'node:perf_hooks'
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

/** One call to the dressing, as the frame it landed on saw it. */
interface Call {
  readonly step: 'shell' | 'detail'
  readonly plotId: string
  readonly storeys: number
  readonly triangles: number
  readonly ms: number
}

/** The calls the frame under measurement has taken so far. Nothing while the city is opening. */
let frame: Call[] | undefined

/** What one call to the dressing landed in the city, and what it cost. */
class Tally {
  readonly #step: 'shell' | 'detail'
  triangles = 0
  meshes = 0
  calls = 0
  ms = 0
  readonly materials = new Set<string>()

  constructor(step: 'shell' | 'detail') {
    this.#step = step
  }

  /** Forgets what has been counted so far, so one phase can be read without the one before it. */
  reset(): void {
    this.triangles = 0
    this.meshes = 0
    this.calls = 0
    this.ms = 0
  }

  /** Times one call and reads what it answered. */
  of(plot: Plot, build: () => THREE.Object3D): THREE.Object3D {
    const at = performance.now()
    const object = build()
    const took = performance.now() - at
    this.ms += took
    this.calls++
    let triangles = 0
    object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      this.meshes++
      triangles += (mesh.geometry.getIndex()?.count ?? mesh.geometry.getAttribute('position').count) / 3
      this.materials.add((mesh.material as THREE.Material).name)
    })
    this.triangles += triangles
    frame?.push({ step: this.#step, plotId: plot.id, storeys: plot.storeys, triangles, ms: took })
    return object
  }
}

const shells = new Tally('shell')
const buildings = new Tally('detail')

/** A dressing with a shell on it, which is both of the ones measured here. */
type Streaming = Required<Pick<Dressing, 'shell' | 'lights'>> & Dressing

/** The dressing under measurement, counted, with its shell hidden when the mode says so. */
function counted(inner: Streaming, lod: boolean): Dressing {
  const dressing: Dressing = {
    building: (plot, size, charter) => buildings.of(plot, () => inner.building(plot, size, charter)),
    lights: (plot, size, charter) => inner.lights(plot, size, charter),
    prop: (prop) => inner.prop(prop),
    character: (npc, doing) => inner.character(npc, doing),
    pickup: (item) => inner.pickup(item),
    ground: (kind) => inner.ground(kind),
    surface: (part, size) => inner.surface(part, size),
  }
  if (!lod) return dressing
  return { ...dressing, shell: (plot, size, charter) => shells.of(plot, () => inner.shell(plot, size, charter)) }
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

// The brief's own default unless asked otherwise, so the town measured is the
// town the game builds, skyline and all. It is the plan rather than the whole
// build: what a city costs to stand up is its plots, their footprints and their
// heights, which the plan draws exactly as the build raises them.
const plan = Forge.plan({ theme: 'a neon port city', seed, blocksX: blocks, blocksY: blocks, density: 1, ...(storeys ? { maxStoreys: Number(storeys) } : {}) })
if (!plan.ok) throw new Error(`the forge refused the brief: ${JSON.stringify(plan.error)}`)
const world = plan.value

const at = performance.now()
const city = buildCity(world, counted(dressing, mode === 'lod'), { shell })
const open = performance.now() - at

/** The doorstep nearest the middle of the town, which is where a city is dense enough to cost what it costs. */
function middleOfTown(built: CityBuild): THREE.Vector3 {
  const middle = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
  let nearest = Number.POSITIVE_INFINITY
  let best = new THREE.Vector3(middle.x, 0, middle.z)
  for (const door of built.doorsteps.values()) {
    const away = (door.x - middle.x) ** 2 + (door.z - middle.z) ** 2
    if (away >= nearest) continue
    nearest = away
    best = door
  }
  return best
}

// `@gb/scene` opens a city round its own spawn, which on a town nobody has
// written is its first plot and so a corner, where three quarters of the ring
// is off the map.
// What a neighbourhood costs is measured where a town is dense: stand in the
// middle and settle, which takes the whole backlog on one call the way opening
// a city does. The corner's rings are let go on that same call, so the tallies
// are reset first and what they hold afterwards is the neighbourhood alone.
const standing = middleOfTown(city)
/** What one phase of the streaming asked the dressing for, read before the next phase starts. */
const asked = (tally: Tally) => ({ calls: tally.calls, triangles: tally.triangles, ms: tally.ms })
const atOpen = { shells: asked(shells), buildings: asked(buildings) }
shells.reset()
buildings.reset()
const stood = performance.now()
city.follow(standing.x, standing.z)
city.settle()
const settled = performance.now() - stood

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

/** One frame of the walk: what it cost and what it was doing. */
interface Frame {
  readonly metres: number
  readonly ms: number
  readonly crossed: boolean
  readonly calls: readonly Call[]
  /** Milliseconds of it the runtime spent collecting rather than building. */
  readonly gc: number
}

/** Every collection since the process opened, so a slow frame can say whether it was work or a sweep. */
const collections: Array<{ at: number; ms: number }> = []
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) collections.push({ at: entry.startTime, ms: entry.duration })
}).observe({ entryTypes: ['gc'] })

/** What the runtime collected inside one frame. */
function collected(began: number, ended: number): number {
  let ms = 0
  for (const one of collections) if (one.at >= began && one.at <= ended) ms += one.ms
  return ms
}

/**
 * What `follow` costs along a walk across the middle of town, frame by frame,
 * the way the game calls it: told the frame's own elapsed time, so the rings take their
 * backlog a few buildings at a time.
 *
 * Every frame carries the calls the dressing took on it, so a slow one can say
 * whether it went on drawing a building or on copying it into a batch: the ms
 * the calls add up to is the dressing, and the rest of the frame is the batch,
 * the lights and the sweep over the plots.
 */
function walked(built: CityBuild): { median: number; ninetyNinth: number; worst: number; frames: Frame[]; crossings: number } {
  const frames: Frame[] = []
  let crossings = 0
  let last = Math.floor(standing.x / world.cellSize)
  for (let metres = 0.25; metres <= 120; metres += 0.25) {
    const x = standing.x + metres
    const now = Math.floor(x / world.cellSize)
    const crossed = now !== last
    if (crossed) crossings++
    last = now
    const calls: Call[] = []
    frame = calls
    const began = performance.now()
    built.follow(x, standing.z, 1 / 60)
    const ended = performance.now()
    frame = undefined
    frames.push({ metres, ms: ended - began, crossed, calls, gc: collected(began, ended) })
  }
  const sorted = frames.map((one) => one.ms).sort((a, b) => a - b)
  return {
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    ninetyNinth: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
    worst: sorted.at(-1) ?? 0,
    frames,
    crossings,
  }
}

/** One line saying what a frame did: what it dressed, how big it was, and where the time went. */
function why(one: Frame): string {
  const dressed = one.calls.reduce((sum, call) => sum + call.ms, 0)
  const triangles = one.calls.reduce((sum, call) => sum + call.triangles, 0)
  const shellCalls = one.calls.filter((call) => call.step === 'shell').length
  const tallest = one.calls.reduce((most, call) => Math.max(most, call.storeys), 0)
  const what = one.calls.length === 0
    ? one.crossed ? 'no build, the cell changed' : 'no build'
    : `${one.calls.length} built (${shellCalls} shell, ${one.calls.length - shellCalls} detail), tallest ${tallest} storeys, ${rounded(triangles)} triangles`
  const each = one.calls.map((call) => `${call.step} ${call.plotId} ${call.storeys}st ${rounded(call.triangles)}tri ${call.ms.toFixed(1)}ms`).join(' | ')
  return `${one.ms.toFixed(2)} ms at ${one.metres.toFixed(2)} m${one.crossed ? ' (a new cell)' : ''}: ${what}; ${dressed.toFixed(2)} ms dressing, ${(one.ms - dressed - one.gc).toFixed(2)} ms batching and the rest, ${one.gc.toFixed(2)} ms collecting${each ? `\n        ${each}` : ''}`
}

/** Doorsteps taken evenly across the town's own list of plots, so every arrival lands in a different neighbourhood. */
function doorstepsAcross(built: CityBuild, wanted: number): THREE.Vector3[] {
  const plots = [...world.plots()]
  const out: THREE.Vector3[] = []
  for (let at = 0; at < Math.min(wanted, plots.length); at++) {
    const door = built.doorsteps.get(plots[Math.floor((at * plots.length) / wanted)]!.id)
    if (door) out.push(door)
  }
  return out
}

/**
 * What arriving costs: standing on a doorstep across town and letting the
 * neighbourhood come up around you.
 *
 * Arriving somewhere new is the dearest thing the streaming does, because a
 * whole ring comes in at once, and it is what a train, a load and a walk into
 * a dense block all look like. The frames are budgeted the way the game
 * budgets them, so what is measured is the worst single frame of the arrival
 * and how long the whole ring takes to stand up.
 */
function arrivals(built: CityBuild): { arrival: number[]; settle: number[]; frames: Frame[] } {
  const arrival: number[] = []
  const settle: number[] = []
  const frames: Frame[] = []
  for (const door of doorstepsAcross(built, 24)) {
    let worst: Frame = { metres: 0, ms: 0, crossed: false, calls: [], gc: 0 }
    let spent = 0
    // stand on the doorstep and let the rings catch up a frame at a time, the
    // way a player who has just arrived does
    for (let at = 0; at < 240; at++) {
      const calls: Call[] = []
      frame = calls
      const began = performance.now()
      built.follow(door.x, door.z, 1 / 60)
      const ended = performance.now()
      const ms = ended - began
      frame = undefined
      spent += ms
      if (ms > worst.ms) worst = { metres: at, ms, crossed: at === 0, calls, gc: collected(began, ended) }
    }
    arrival.push(worst.ms)
    settle.push(spent)
    frames.push(worst)
  }
  return { arrival, settle, frames }
}

const batches = city.root.children.filter((child) => child.name.startsWith('city:') || child.name.startsWith('detail:'))
const materials = new Set([...shells.materials, ...buildings.materials])
const rounded = (value: number) => Math.round(value).toLocaleString('en-GB')

const plots = [...world.plots()]
const towers = plots.filter((plot) => !inPlotBand(plotShape(plot)))
console.log(`${blocks} by ${blocks} blocks (${world.grid.width} by ${world.grid.height} cells), ${dressed} ${mode}, shells to ${reach ?? SHELL_RADIUS} m: ${plots.length} plots, ${towers.length} over the band (tallest ${Math.max(...plots.map((plot) => plot.storeys))} storeys), pack ${library.catalogue.version}`)
console.log(`  open ${rounded(open)} ms, of it ${rounded(atOpen.shells.ms + atOpen.buildings.ms)} ms in the dressing, rss ${rounded(process.memoryUsage().rss / 1e6)} MB`)
console.log(`    the ring round the city's own spawn, which stands in a corner: ${rounded(atOpen.shells.calls)} shells, ${rounded(atOpen.buildings.calls)} buildings`)
console.log(`  standing in the middle of town: ${rounded(settled)} ms, of it ${rounded(shells.ms + buildings.ms)} ms in the dressing`)
console.log(`  shells: ${rounded(shells.calls)} built, ${rounded(shells.triangles)} triangles, ${rounded(shells.meshes)} meshes`)
console.log(`  buildings: ${rounded(buildings.calls)} built, ${rounded(buildings.triangles)} triangles, ${rounded(buildings.meshes)} meshes`)
console.log(`  ${materials.size} materials: ${[...materials].join(', ')}`)
console.log(`  ${batches.length} building draws: ${batches.map((batch) => batch.name).join(', ')}`)

const views = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((yaw) => submitted(city, standing.x, standing.z, yaw))
const worst = views.reduce((a, b) => (b.triangles > a.triangles ? b : a))
const holding = heldBy(city)
console.log(`  buildings held ${rounded(holding.buildings)} triangles, of it ${rounded(plots.length * 12)} of skyline; rubbish ${rounded(holding.rubbish)}`)
console.log(`  turning on the spot there, far plane ${rounded(far)} m: ${views.map((one) => rounded(one.triangles)).join(' | ')} triangles of buildings, ${worst.draws} draws, and ${rounded(worst.rubbish)} of rubbish whichever way`)
const walk = walked(city)
const FRAME = 1000 / 60
const missed = walk.frames.filter((one) => one.ms > FRAME)
const spent = walk.frames.reduce((sum, one) => sum + one.ms, 0)
console.log(
  `  follow over a 120 m walk from there (${walk.frames.length} frames, ${walk.crossings} of them a new cell): median ${(walk.median * 1000).toFixed(0)} us, 99th ${walk.ninetyNinth.toFixed(2)} ms, worst ${walk.worst.toFixed(2)} ms`,
)
console.log(
  `    ${missed.length} frames over 16.7 ms, ${rounded(missed.reduce((sum, one) => sum + one.ms - FRAME, 0))} ms of them over; ${rounded(spent)} ms of streaming over the whole walk`,
)
const bare = walk.frames.filter((one) => one.crossed && one.calls.length === 0).map((one) => one.ms).sort((a, b) => a - b)
const still = walk.frames.filter((one) => !one.crossed && one.calls.length === 0).map((one) => one.ms).sort((a, b) => a - b)
console.log(
  `    a crossing that built nothing: ${bare.length} frames, median ${((bare[Math.floor(bare.length / 2)] ?? 0) * 1000).toFixed(0)} us, worst ${(bare.at(-1) ?? 0).toFixed(2)} ms; a frame that did neither: median ${((still[Math.floor(still.length / 2)] ?? 0) * 1000).toFixed(0)} us`,
)
const slowest = [...walk.frames].sort((a, b) => b.ms - a.ms).slice(0, 10)
for (const [at, one] of slowest.entries()) console.log(`    ${String(at + 1).padStart(2)}. ${why(one)}`)

const doors = arrivals(city)
const middle = (list: readonly number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] ?? 0
for (const one of [...doors.frames].sort((a, b) => b.ms - a.ms).slice(0, 3)) console.log(`    arrival: ${why(one)}`)
console.log(
  `  walking up to ${doors.arrival.length} doors across the town: arriving costs a worst frame of ${middle(doors.arrival).toFixed(2)} ms median, ${Math.max(...doors.arrival).toFixed(2)} ms worst, over ${rounded(middle(doors.settle))} ms median of streaming (${rounded(Math.max(...doors.settle))} ms worst) before the neighbourhood is up`,
)
