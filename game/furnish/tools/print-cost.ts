/**
 * Prints what a furnished room costs against the greybox it replaces: draws,
 * triangles and materials, per room of a generated town, in both interior
 * languages. Also the build time and the memory of the catalog itself. The
 * numbers in CONTRACT.md come from here.
 *
 * Run: node game/furnish/tools/print-cost.ts
 */
import { FURNITURE_PROPS } from '@gb/world'
import { Forge, OfflineNarrator } from '@gb/forge'
import { buildInterior, Greybox, type Dressing } from '@gb/scene'
import * as THREE from 'three'
import { FURNISH_STYLES, FurnishDressing, furnishKit } from '../src/index.ts'

const started = performance.now()
const kit = furnishKit()
const build = performance.now() - started

let bytes = 0
let triangles = 0
for (const style of FURNISH_STYLES) {
  for (const prop of FURNITURE_PROPS) {
    const geometry = kit.geometry(prop, style)
    for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength
    bytes += geometry.getIndex()!.array.byteLength
    triangles += kit.triangles(prop, style)
  }
}

console.log(
  `catalog: ${FURNISH_STYLES.length} languages by ${FURNITURE_PROPS.length} props, ` +
    `${triangles} triangles, ${(bytes / 1e3).toFixed(0)} KB, built in ${build.toFixed(0)} ms\n`,
)

const built = await new Forge(new OfflineNarrator('furnish')).build({
  theme: 'old harbour town',
  seed: 'furnish',
  blocksX: 1,
  blocksY: 1,
  blockCells: 14,
})
if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
const world = built.value.world

const corpo = new FurnishDressing(kit, undefined, 'corpo')
const home = corpo.as('home')
const greybox = new Greybox()

console.log('a whole room, shell included. Every piece of furniture in it is one mesh on one material.\n')
console.log(`${'room'.padEnd(12)}${'pieces'.padStart(6)}   ${'corpo'.padEnd(30)}${'home'.padEnd(30)}greybox`)
for (const interior of [...world.interiors()].sort((a, b) => b.furniture.length - a.furniture.length)) {
  const kind = world.plot(interior.plotId)?.kind ?? '?'
  console.log(
    `${kind.padEnd(12)}${String(interior.furniture.length).padStart(4)}   ` +
      `${cost(interior.id, corpo).padEnd(30)}${cost(interior.id, home).padEnd(30)}${cost(interior.id, greybox)}`,
  )
}

function cost(id: string, dressing: Dressing): string {
  const interior = world.interior(id)!
  const room = buildInterior(world, interior, dressing)
  const meshes: THREE.Mesh[] = []
  room.root.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })
  const tris = meshes.reduce((total, mesh) => total + (mesh.geometry.getIndex()?.count ?? 0) / 3, 0)
  const materials = new Set(meshes.map((mesh) => mesh.material)).size
  return `${meshes.length} draws, ${tris} tris, ${materials} mats`
}
