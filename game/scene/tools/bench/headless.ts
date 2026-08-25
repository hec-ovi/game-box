import { Forge, OfflineNarrator } from '@gb/forge'
import type { Plot, ResolvedCharter } from '@gb/world'
import * as THREE from 'three'
import { buildCity, Greybox, type BuildingSize, type CityBuild, type Dressing, type LightEmitter } from '../../src/index.ts'

/**
 * What a city costs with no browser: how long it takes to open, how many
 * meshes it is, what a camera at the spawn would submit, and what following
 * the player costs a frame. A draw is a mesh in the frustum, or a batch with
 * at least one visible instance in it; the triangles are those instances'
 * own, culled per instance the way three culls them.
 *
 * Each dressing is measured twice: `whole`, with no far look, so every
 * building is dressed at open and drawn at every distance, and `lod`, with
 * the shell batched for every plot and the detail on the near ones only.
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

/** The camera at the spawn, looking the way the player opens their eyes. */
function frustumAt(city: CityBuild): THREE.Frustum {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 400)
  camera.position.set(city.spawn.x, 1.7, city.spawn.z)
  camera.rotation.order = 'YXZ'
  camera.rotation.y = city.spawn.heading + Math.PI / 2
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
}

function costOf(city: CityBuild): { meshes: number; held: number; draws: number; triangles: number } {
  const frustum = frustumAt(city)
  city.root.updateMatrixWorld(true)
  const total = { meshes: 0, held: 0, draws: 0, triangles: 0 }
  city.root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    total.meshes++
    const cost = submitted(child, frustum)
    total.draws += cost.draws
    total.triangles += cost.triangles
    total.held += cost.held
  })
  return total
}

/** A walk along +x from the spawn, `follow` every step: what the calls that cross a cell cost, and the ones that do not. */
function walk(city: CityBuild): { steps: number; crossings: number; sameCellUs: number; crossingMs: number; worstCrossingMs: number } {
  const same: number[] = []
  const crossing: number[] = []
  const cell = world.cellSize
  let last = Math.floor(city.spawn.x / cell)
  for (let metres = WALK.step; metres <= WALK.metres; metres += WALK.step) {
    const x = city.spawn.x + metres
    const now = Math.floor(x / cell)
    const started = performance.now()
    city.follow(x, city.spawn.z)
    const took = performance.now() - started
    if (now === last) same.push(took)
    else crossing.push(took)
    last = now
  }
  const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] ?? 0
  return {
    steps: same.length + crossing.length,
    crossings: crossing.length,
    sameCellUs: Number((median(same) * 1000).toFixed(1)),
    crossingMs: Number(median(crossing).toFixed(3)),
    worstCrossingMs: Number(Math.max(0, ...crossing).toFixed(3)),
  }
}

function measure(name: string, dressing: Dressing): void {
  const started = performance.now()
  const city = buildCity(world, dressing)
  const openMs = Number((performance.now() - started).toFixed(0))
  const detailed = [...city.buildings.values()].filter((one) => one.detailed).length
  console.log(JSON.stringify({ dressing: name, openMs, ...costOf(city), detailed, emitters: city.lights.emitters.length, walk: walk(city) }))
}

console.log(JSON.stringify({ blocks, cells: [world.grid.width, world.grid.height], plots: world.plots().length, interiors: world.interiors().length }))
measure('greybox whole', whole(new Greybox()))
measure('greybox lod', new Greybox())
measure('dressed whole', whole(new Dressed()))
measure('dressed lod', new Dressed())
