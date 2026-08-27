/**
 * What a kit building costs against the shell `@gb/scene` draws it as from far
 * off, measured headless in Node on the shipped kit over a town of plots of
 * every kind, height and facing: triangles, meshes, materials and the time to
 * build one. Then the same for one plot as it grows storeys, which is where a
 * tower's numbers come from.
 *
 * Run: node game/kitbash/tools/measure-shell.ts [plots]
 * Reads: assets/dist/downtown-kit.glb (GB_ASSETS_DIST overrides)
 */
import { METRICS } from '@gb/world'
import * as THREE from 'three'
import { KitDressing } from '../src/index.ts'
import { loadPackedKit } from '../tests/pack.ts'
import { charterOf, plotOf, sizeOf, townOf } from '../tests/support.ts'

const count = Number(process.argv[2] ?? 60)
const dressing = new KitDressing(await loadPackedKit())
const town = townOf('measure', count).map((plot) => ({
  plot,
  size: sizeOf(plot, METRICS.building.groundFloorHeight + (plot.storeys - 1) * METRICS.building.storeyHeight),
  charter: charterOf(plot),
}))

/** What one building's worth of objects holds. */
function read(object: THREE.Object3D): { triangles: number; meshes: number; materials: Set<string> } {
  const materials = new Set<string>()
  let triangles = 0
  let meshes = 0
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    meshes++
    triangles += (mesh.geometry.getIndex()?.count ?? mesh.geometry.getAttribute('position').count) / 3
    materials.add((mesh.material as THREE.Material).name)
  })
  return { triangles, meshes, materials }
}

function measure(name: string, build: (job: (typeof town)[number]) => THREE.Object3D): void {
  const totals = { triangles: 0, meshes: 0 }
  const materials = new Set<string>()
  for (const job of town) {
    const one = read(build(job))
    totals.triangles += one.triangles
    totals.meshes += one.meshes
    for (const material of one.materials) materials.add(material)
  }
  const at = performance.now()
  for (const job of town) build(job)
  const ms = (performance.now() - at) / town.length

  console.log(`${name}: ${(totals.triangles / town.length).toFixed(0)} triangles, ${(totals.meshes / town.length).toFixed(1)} meshes, ${ms.toFixed(2)} ms a building`)
  console.log(`  ${materials.size} materials: ${[...materials].join(', ')}`)
}

console.log(`${town.length} buildings on the shipped kit`)
measure('building', (job) => dressing.building(job.plot, job.size, job.charter))
measure('shell', (job) => dressing.shell(job.plot, job.size, job.charter))

/** One plot as it grows: a shell is the whole kit up to the massing, and the shopfront plus a stretched course over it after. */
console.log(`\none 8 by 12 m plot as it grows storeys`)
const rect = { x: 6, y: 6, w: 4, h: 6 }
const entrance = { cell: { x: 8, y: 5 }, facing: 'north' as const }
for (const storeys of [1, 2, 4, 5, 6, 12, 20, 23, 24, 40]) {
  const plot = plotOf({ kind: 'office', storeys, rect, entrance })
  const job = { plot, size: sizeOf(plot, METRICS.building.groundFloorHeight + (storeys - 1) * METRICS.building.storeyHeight), charter: charterOf(plot) }
  const build = () => dressing.shell(job.plot, job.size, job.charter)
  const one = read(build())
  const at = performance.now()
  const runs = 40
  for (let run = 0; run < runs; run++) build()
  console.log(`  ${String(storeys).padStart(3)} storeys, ${job.size.height.toFixed(1).padStart(5)} m: ${String(one.triangles).padStart(7)} triangles, ${((performance.now() - at) / runs).toFixed(2)} ms`)
}
