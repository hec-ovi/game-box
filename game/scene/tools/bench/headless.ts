import { Forge, OfflineNarrator } from '@gb/forge'
import type { Plot, ResolvedCharter } from '@gb/world'
import * as THREE from 'three'
import { buildCity, Greybox, type BuildingSize, type BuildingStep, type CityBuild, type CityOptions, type Dressing, type LightEmitter } from '../../src/index.ts'

/**
 * What a city costs with no browser: how long it takes to open, how many
 * meshes it is, what it holds, what a camera at the spawn would submit, and
 * what following the player costs a frame. A draw is a mesh in the frustum, or
 * a batch with at least one visible instance in it; the triangles are those
 * instances' own, culled per instance the way three culls them.
 *
 * Each dressing is measured three ways: `lod`, the streaming path, with the
 * skyline for the whole town, the shell within `SHELL_RADIUS` and the detail
 * within `DETAIL_RADIUS`; `all`, with a shell on every plot in the town, which
 * is what a city cost before the skyline carried the far field; and `whole`,
 * with no far look at all, which is what a dressing without one costs.
 *
 *   node game/scene/tools/bench/headless.ts 20
 */

const blocks = Number(process.argv[2] ?? 7)

/** How far the walk goes to cost `follow`, in metres, and how long a step is. */
const WALK = { metres: 120, step: 0.25 }

/**
 * A greybox that hangs what a kit hangs: a lit sign per storey on the front, a
 * screen over the door, and a pane per storey on every wall, each its own box
 * on its own material, with an emitter for every lit thing. It stands in for
 * the signs, screens and rooms a kit draws until the kit publishes a shell.
 */
class Dressed extends Greybox {
  readonly #sign = new THREE.MeshStandardMaterial({ color: 0x40e0ff, emissive: 0x40e0ff, name: 'sign' })
  readonly #screen = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xffa040, name: 'screen' })
  readonly #pane = new THREE.MeshStandardMaterial({ color: 0x203040, emissive: 0x506070, name: 'pane' })

  override building(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const group = super.building(plot, size, charter)
    for (let storey = 0; storey < plot.storeys; storey++) {
      const y = 3 * storey + 2.5
      const sign = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.6, 0.6, 0.1), this.#sign)
      sign.position.set(0, y, -size.depth / 2 - 0.1)
      group.add(sign)
      for (const [x, z, turn] of [[0, -size.depth / 2, 0], [0, size.depth / 2, 0], [-size.width / 2, 0, 1], [size.width / 2, 0, 1]] as const) {
        for (let pane = -1; pane <= 1; pane++) {
          const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.05), this.#pane)
          glass.position.set(x + (turn ? 0 : pane * 2.5), y + 0.5, z + (turn ? pane * 2.5 : 0))
          if (turn) glass.rotation.y = Math.PI / 2
          group.add(glass)
        }
      }
    }
    const screen = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.1), this.#screen)
    screen.position.set(0, size.height - 1, -size.depth / 2 - 0.1)
    group.add(screen)
    return group
  }

  override lights(plot: Plot, size: BuildingSize): readonly LightEmitter[] {
    const signs: LightEmitter[] = []
    for (let storey = 0; storey < plot.storeys; storey++) {
      signs.push({ kind: 'sign', position: [0, 3 * storey + 2.5, -size.depth / 2 - 0.3], colour: 0x40e0ff, intensity: 30, radius: 12 })
    }
    signs.push({ kind: 'screen', position: [0, size.height - 1, -size.depth / 2 - 0.3], colour: 0xffa040, intensity: 20, radius: 10 })
    return [...super.lights(plot, size), ...signs]
  }
}

/**
 * A greybox whose far look costs what a real kit's does: a band of geometry per
 * storey rather than one box, so a tall building's shell is thousands of
 * triangles and not twelve. It stands in for the shipped pack, which is where
 * the far field's cost really lives; `game/prefab/tools/bench-city.ts` measures
 * that one.
 */
class Kitted extends Dressed {
  readonly #stone = new THREE.MeshStandardMaterial({ color: 0x6a6a70, name: 'stone' })

  override shell(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const group = super.shell(plot, size, charter)
    for (let storey = 0; storey < plot.storeys; storey++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(size.width / 2, size.width / 2, 0.4, 24), this.#stone)
      band.position.y = 3 * storey + 2.8
      group.add(band)
    }
    return group
  }
}

/** The same dressing with its far look taken away: every building whole, at every distance. */
function whole(dressing: Greybox): Dressing {
  return {
    building: (plot, size, charter) => dressing.building(plot, size, charter),
    lights: (plot, size) => dressing.lights(plot, size),
    prop: (prop) => dressing.prop(prop),
    character: (npc, doing) => dressing.character(npc, doing),
    pickup: (item) => dressing.pickup(item),
    ground: (kind) => dressing.ground(kind),
    surface: (part) => dressing.surface(part),
    marking: (paint) => dressing.marking(paint),
    clutter: () => dressing.clutter(),
  }
}

const result = await new Forge(new OfflineNarrator('bench')).build({ theme: 'quiet coastal town', seed: 'bench', blocksX: blocks, blocksY: blocks })
if (!result.ok) throw new Error(JSON.stringify(result.error).slice(0, 400))
const world = result.value.world

/** What one object would cost on screen, and what it holds. */
function submitted(object: THREE.Object3D, frustum: THREE.Frustum): { draws: number; triangles: number; held: number } {
  const batch = object as THREE.BatchedMesh
  if (batch.isBatchedMesh) return batched(batch, frustum)
  const mesh = object as THREE.Mesh
  if (!mesh.isMesh) return { draws: 0, triangles: 0, held: 0 }
  const geometry = mesh.geometry
  const count = (geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 3
  const copies = (mesh as unknown as THREE.InstancedMesh).isInstancedMesh ? (mesh as unknown as THREE.InstancedMesh).count : 1
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  const sphere = geometry.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld)
  const inView = mesh.visible && frustum.intersectsSphere(sphere)
  return { draws: inView ? 1 : 0, triangles: inView ? count * copies : 0, held: count * copies }
}

function batched(batch: THREE.BatchedMesh, frustum: THREE.Frustum): { draws: number; triangles: number; held: number } {
  const sphere = new THREE.Sphere()
  const matrix = new THREE.Matrix4()
  let triangles = 0
  let held = 0
  for (let instance = 0; instance < batch.maxInstanceCount; instance++) {
    let geometryId: number
    try {
      geometryId = batch.getGeometryIdAt(instance)
    } catch {
      continue
    }
    if (geometryId < 0) continue
    const range = batch.getGeometryRangeAt(geometryId)
    if (!range) continue
    const count = range.count / 3
    held += count
    if (!batch.visible || !batch.getVisibleAt(instance)) continue
    const bounds = batch.getBoundingSphereAt(geometryId, sphere)
    if (!bounds) continue
    bounds.applyMatrix4(batch.getMatrixAt(instance, matrix).premultiply(batch.matrixWorld))
    if (frustum.intersectsSphere(bounds)) triangles += count
  }
  return { draws: triangles > 0 ? 1 : 0, triangles, held }
}

/**
 * The camera at the spawn, looking the way the player opens their eyes. Its
 * far plane is the one the game gives it, which comes off the air rather than
 * off the size of the map and is kilometres: the whole town is inside it, and
 * what a heading does not reach is what the frustum throws away.
 */
function frustumAt(city: CityBuild): THREE.Frustum {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 4_000)
  camera.position.set(city.spawn.x, 1.7, city.spawn.z)
  camera.rotation.order = 'YXZ'
  camera.rotation.y = city.spawn.heading + Math.PI / 2
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
}

/** The batches the buildings are drawn out of, as against the ground, the paint and the rubbish. */
const isBuilding = (name: string) => name.startsWith('city:') || name.startsWith('detail:')

function costOf(city: CityBuild): { meshes: number; held: number; draws: number; triangles: number; heldBuildings: number; buildings: number } {
  const frustum = frustumAt(city)
  city.root.updateMatrixWorld(true)
  const total = { meshes: 0, held: 0, draws: 0, triangles: 0, heldBuildings: 0, buildings: 0 }
  city.root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    total.meshes++
    const cost = submitted(child, frustum)
    total.draws += cost.draws
    total.triangles += cost.triangles
    total.held += cost.held
    if (!isBuilding(child.name)) return
    total.buildings += cost.triangles
    total.heldBuildings += cost.held
  })
  return total
}

/**
 * A walk along +x from the spawn, `follow` every frame the way the game calls
 * it, told the frame's own elapsed time so the rings take their backlog a few
 * buildings at a time: what the worst frame of the walk costs, and the usual one.
 */
function walk(city: CityBuild): { frames: number; crossings: number; medianUs: number; ninetyNinthMs: number; worstMs: number } {
  const took: number[] = []
  const cell = world.cellSize
  let crossings = 0
  let last = Math.floor(city.spawn.x / cell)
  for (let metres = WALK.step; metres <= WALK.metres; metres += WALK.step) {
    const x = city.spawn.x + metres
    const now = Math.floor(x / cell)
    if (now !== last) crossings++
    last = now
    const started = performance.now()
    city.follow(x, city.spawn.z, 1 / 60)
    took.push(performance.now() - started)
  }
  const sorted = [...took].sort((a, b) => a - b)
  return {
    frames: took.length,
    crossings,
    medianUs: Number(((sorted[Math.floor(sorted.length / 2)] ?? 0) * 1000).toFixed(1)),
    ninetyNinthMs: Number((sorted[Math.floor(sorted.length * 0.99)] ?? 0).toFixed(3)),
    worstMs: Number((sorted.at(-1) ?? 0).toFixed(3)),
  }
}

/** How many buildings are drawn each way right now. */
function stepsOf(city: CityBuild): Record<BuildingStep, number> {
  const counted = { massing: 0, shell: 0, detail: 0 }
  for (const building of city.buildings.values()) counted[building.step]++
  return counted
}

function measure(name: string, dressing: Dressing, options: CityOptions = {}): void {
  const started = performance.now()
  const city = buildCity(world, dressing, options)
  const openMs = Number((performance.now() - started).toFixed(0))
  console.log(JSON.stringify({ dressing: name, openMs, ...costOf(city), ...stepsOf(city), emitters: city.lights.emitters.length, walk: walk(city) }))
}

/** Every plot shelled at open, which is what the city cost before the skyline carried the far field. */
const EVERY: CityOptions = { shell: Number.POSITIVE_INFINITY }

console.log(JSON.stringify({ blocks, cells: [world.grid.width, world.grid.height], plots: world.plots().length, interiors: world.interiors().length }))
measure('greybox all', new Greybox(), EVERY)
measure('greybox lod', new Greybox())
measure('greybox whole', whole(new Greybox()))
measure('dressed all', new Dressed(), EVERY)
measure('dressed lod', new Dressed())
measure('dressed whole', whole(new Dressed()))
measure('kitted all', new Kitted(), EVERY)
measure('kitted lod', new Kitted())
