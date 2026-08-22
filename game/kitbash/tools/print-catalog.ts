/**
 * Prints the PIECES table of src/catalog/pieces.ts as the kit's own files
 * measure today. Paste the result over the record when the piece list changes.
 *
 * Run: node game/kitbash/tools/print-catalog.ts
 */
import { PIECE_IDS } from '../src/catalog/pieces.ts'
import { measurePiece } from './measure.ts'

for (const id of PIECE_IDS) {
  const { node, min, max, materials } = measurePiece(id)
  const named = node === id ? '' : `, node: '${node}'`
  console.log(`  ${id}: { min: [${min}], max: [${max}], materials: [${materials.map((m) => `'${m}'`).join(', ')}]${named} },`)
}
