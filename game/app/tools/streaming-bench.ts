/**
 * What the city costs to open, in the chain the game actually builds it with.
 *
 * `@gb/scene` draws every building as its shell at open and dresses only the
 * ones near the player, and it lights the street off what the dressing says
 * each building throws. Both ride on the seam, so a link in the chain that
 * drops them costs the whole town. This builds one city twice, once through a
 * chain with them dropped and once through the chain `src/pack.ts` composes,
 * and prints what each is worth.
 *
 * `node game/app/tools/streaming-bench.ts [blocks]`
 */
import { Forge, OfflineNarrator } from '@gb/forge'
import { buildCity, Greybox, type Dressing } from '@gb/scene'
import type { BuildingSize, Plot, ResolvedCharter, World } from '@gb/world'
import * as THREE from 'three'
import { guarded } from '../src/guarded.ts'

const BOARD = new THREE.MeshStandardMaterial({ emissive: 0xff88cc, emissiveIntensity: 2 })

/** A dressing that hangs what a kit hangs: a lit board per storey, with a far look that has none of them. */
class Dressed extends Greybox {
  override building(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const whole = super.building(plot, size, charter)
    for (let storey = 0; storey < Math.max(1, Math.round(size.height / 4)); storey++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.6, 0.6, 0.1), BOARD)
      board.position.set(0, storey * 4 + 3, -size.depth / 2)
      whole.add(board)
    }
    return whole
  }
}

/**
 * What the root would submit and what it would draw: one entry per mesh, and
 * the triangles of every instance a batch is actually drawing, which is not the
 * size of the buffer it reserved for the town.
 */
function count(root: THREE.Object3D): { meshes: number; triangles: number } {
  let meshes = 0
  let triangles = 0
  root.traverse((object) => {
    const mesh = object as THREE.Mesh & Partial<THREE.BatchedMesh> & Partial<THREE.InstancedMesh>
    if (!mesh.isMesh || !mesh.visible) return
    meshes += 1
    if (mesh.isBatchedMesh) {
      const batch = mesh as unknown as THREE.BatchedMesh
      for (let instance = 0; instance < batch.instanceCount; instance++) {
        if (!batch.getVisibleAt(instance)) continue
        triangles += batch.getGeometryRangeAt(batch.getGeometryIdAt(instance))!.indexCount / 3
      }
      return
    }
    const index = mesh.geometry.getIndex()
    const held = index ? index.count / 3 : (mesh.geometry.getAttribute('position')?.count ?? 0) / 3
    triangles += held * (mesh.isInstancedMesh ? (mesh as unknown as THREE.InstancedMesh).count : 1)
  })
  return { meshes, triangles }
}

/** What a ride between two stations costs the frame it lands on: the whole neighbourhood at once. */
function ride(world: World, city: ReturnType<typeof buildCity>): void {
  const stops = world.stations().flatMap((plot) => {
    const at = city.doorsteps.get(plot.id)
    return at ? [{ name: plot.name, at }] : []
  })
  if (stops.length < 2) return console.log('no two stations to ride between')
  let far = { from: stops[0]!, to: stops[1]!, gap: 0 }
  for (const from of stops) {
    for (const to of stops) {
      const gap = Math.hypot(from.at.x - to.at.x, from.at.z - to.at.z)
      if (gap > far.gap) far = { from, to, gap }
    }
  }
  city.follow(far.from.at.x, far.from.at.z)
  const began = performance.now()
  city.follow(far.to.at.x, far.to.at.z)
  const landing = performance.now() - began
  const after = performance.now()
  city.follow(far.to.at.x + 0.25, far.to.at.z)
  console.log(
    `ride ${far.gap.toFixed(0)} m (${far.from.name} to ${far.to.name}): the landing frame ${landing.toFixed(1)} ms, the frame after it ${(performance.now() - after).toFixed(3)} ms`,
  )
}

function open(world: World, dressing: Dressing, label: string): { city: ReturnType<typeof buildCity> } {
  const began = performance.now()
  const city = buildCity(world, dressing)
  const ms = performance.now() - began
  const held = count(city.root)
  const spawn = city.spawn
  let follows = 0
  const walk = performance.now()
  for (let step = 0; step < 200; step++) {
    city.follow(spawn.x + step * 0.25, spawn.z)
    follows += 1
  }
  const perFollow = (performance.now() - walk) / follows
  console.log(
    `${label.padEnd(22)} open ${ms.toFixed(0).padStart(6)} ms   meshes ${String(held.meshes).padStart(5)}   triangles ${String(Math.round(held.triangles)).padStart(9)}   emitters ${String(city.lights.emitters.length).padStart(6)}   follow ${perFollow.toFixed(3)} ms`,
  )
  return { city }
}

const blocks = Number(process.argv[2] ?? 20)
const built = await new Forge(new OfflineNarrator('bench')).build({ theme: 'neon', seed: 'bench', blocksX: blocks, blocksY: blocks })
if (!built.ok) throw new Error(JSON.stringify(built.error))
const world = built.value.world
console.log(`${blocks}x${blocks} blocks, ${world.plots().length} plots, ${world.interiors().length} interiors`)

const dressed = new Dressed()
const plain = new Greybox()
// what every link in the chain answers for, and what a chain that drops the
// optional answers leaves the scene with
const whole: Dressing = {
  building: (plot, size, charter) => dressed.building(plot, size, charter),
  shell: (plot, size, charter) => plain.building(plot, size, charter),
  lights: (plot, size, charter) => dressed.lights(plot, size, charter),
  prop: (prop) => dressed.prop(prop),
  character: (npc, doing) => dressed.character(npc, doing),
  pickup: (item) => dressed.pickup(item),
  ground: (kind) => dressed.ground(kind),
  surface: (part, size) => dressed.surface(part, size),
}
const dropped: Dressing = {
  building: whole.building,
  prop: whole.prop,
  character: whole.character,
  pickup: whole.pickup,
  ground: whole.ground,
  surface: whole.surface,
}
open(world, guarded(dropped), 'shell and lights lost')
ride(world, open(world, guarded(whole), 'the whole seam').city)
