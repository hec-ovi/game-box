/**
 * Prints what a furnished room costs against the greybox it replaces: draws,
 * triangles and materials, per room of a generated town, each in the language
 * its building's finish gives it, with and without the bays its walls are made
 * of. Also the build time and the memory of the catalog itself, furniture and
 * carried things. The numbers in CONTRACT.md come from here.
 *
 * Run: node game/furnish/tools/print-cost.ts
 */
import { FURNITURE_PROPS, ITEM_ARCHETYPES } from '@gb/world'
import { Forge, OfflineNarrator } from '@gb/forge'
import { buildInterior, Greybox, type Dressing } from '@gb/scene'
import * as THREE from 'three'
import { FURNISH_STYLES, FurnishDressing, ITEM_CASTS, furnishKit } from '../src/index.ts'

const started = performance.now()
const kit = furnishKit()
const build = performance.now() - started

// every screening of every prop, counting a buffer they share only once: a
// second screening is one attribute rewritten, not a second copy of the piece
const counted = new Set<unknown>()
let bytes = 0
let triangles = 0
for (const style of FURNISH_STYLES) {
  for (const prop of FURNITURE_PROPS) {
    for (let slot = 0; slot < kit.screenings(prop, style); slot++) {
      const geometry = kit.geometry(prop, style, slot)
      for (const attribute of [...Object.values(geometry.attributes), geometry.getIndex()!]) {
        if (counted.has(attribute)) continue
        counted.add(attribute)
        bytes += attribute.array.byteLength
      }
    }
    triangles += kit.triangles(prop, style)
  }
}

let itemBytes = 0
let itemTriangles = 0
for (const archetype of ITEM_ARCHETYPES) {
  for (let cast = 0; cast < ITEM_CASTS; cast++) {
    const geometry = kit.itemGeometry(archetype, cast)
    for (const attribute of Object.values(geometry.attributes)) itemBytes += attribute.array.byteLength
    itemBytes += geometry.getIndex()!.array.byteLength
    itemTriangles += kit.itemTriangles(archetype, cast)
  }
}

console.log(
  `furniture: ${FURNISH_STYLES.length} languages by ${FURNITURE_PROPS.length} props, ` +
    `${triangles} triangles, ${(bytes / 1e3).toFixed(0)} KB`,
)
console.log(
  `items:     ${ITEM_ARCHETYPES.length} archetypes by ${ITEM_CASTS} casts, ` +
    `${itemTriangles} triangles, ${(itemBytes / 1e3).toFixed(0)} KB`,
)
console.log(`both built in ${build.toFixed(0)} ms\n`)

const built = await new Forge(new OfflineNarrator('furnish')).build({
  theme: 'old harbour town',
  seed: 'furnish',
  blocksX: 3,
  blocksY: 3,
  blockCells: 14,
})
if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
const world = built.value.world

const furnished = new FurnishDressing(kit)
const greybox = new Greybox()

const placedIn = new Map<string, number>()
for (const placement of world.toJSON().placements) {
  if (placement.at === 'anchor') placedIn.set(placement.interiorId, (placedIn.get(placement.interiorId) ?? 0) + 1)
}

console.log('a whole room, shell included. Every piece of furniture in it is one mesh on one material,')
console.log('every thing lying on it is another, and every bay of every wall of the interior is one more.\n')
console.log(
  `${'room'.padEnd(12)}${'finish'.padEnd(11)}${'language'.padEnd(9)}${'pieces'.padStart(6)}${'items'.padStart(6)}${'bays'.padStart(6)}   ` +
    `${'furnished'.padEnd(30)}${'furnished + walls'.padEnd(30)}greybox`,
)
for (const interior of [...world.interiors()].sort((a, b) => b.furniture.length - a.furniture.length)) {
  const room = furnished.room(interior, world.charter(interior.kind))
  console.log(
    `${interior.kind.padEnd(12)}${room.finish.padEnd(11)}${room.style.padEnd(9)}${String(interior.furniture.length).padStart(4)}` +
      `${String(placedIn.get(interior.id) ?? 0).padStart(6)}${String(room.bays.length).padStart(6)}   ` +
      `${cost(interior.id, furnished, false).padEnd(30)}${cost(interior.id, furnished, true).padEnd(30)}` +
      `${cost(interior.id, greybox, false)}`,
  )
}

function cost(id: string, dressing: Dressing, walls: boolean): string {
  const interior = world.interior(id)!
  const room = dressing instanceof FurnishDressing ? dressing.room(interior, world.charter(interior.kind)) : undefined
  const shell = buildInterior(world, interior, room?.dressing ?? dressing)
  if (walls && room) shell.root.add(room.decor)

  const meshes: THREE.Mesh[] = []
  shell.root.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })
  const tris = meshes.reduce((total, mesh) => total + (mesh.geometry.getIndex()?.count ?? 0) / 3, 0)
  const materials = new Set(meshes.map((mesh) => mesh.material)).size
  return `${meshes.length} draws, ${tris} tris, ${materials} mats`
}
