/**
 * Prints what the catalog costs: every piece of furniture in both languages, in
 * every screening it can carry, and every thing a player picks up in every cast,
 * counting a buffer two of them share only once. The triangle and byte figures
 * in CONTRACT.md come from here.
 *
 * Run: node game/furnish/tools/print-cost.ts
 */
import { FURNITURE_PROPS, ITEM_ARCHETYPES } from '@gb/world'
import { FURNISH_STYLES, ITEM_CASTS, furnishKit } from '../src/index.ts'

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
