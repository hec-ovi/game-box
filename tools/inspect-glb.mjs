/**
 * What a downloaded model would cost the city, before it is adopted.
 *
 *   node tools/inspect-glb.mjs <file-or-folder> [more...]
 *
 * Measures against the budget in tools/model/measure.mjs, which is what the
 * pack that ships costs, rather than against how the model looks in a viewer.
 * It also prints the licence out of the file's own metadata, because a model we
 * may not redistribute is one that cannot be in the pack at any price.
 *
 * `node tools/fit-model.mjs` is the same measurement with the fitting.
 */
import { readdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { against, BUDGET, measureFile, reader } from './model/measure.mjs'
import { licenceOf, mayShip } from './licences.mjs'

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error('usage: node tools/inspect-glb.mjs <file-or-folder> [more...]')
  process.exit(1)
}

const io = reader()
const files = targets.flatMap(filesIn)
if (files.length === 0) {
  console.error('no .glb or .gltf found')
  process.exit(1)
}

const rows = []
for (const file of files) {
  try {
    const licence = licenceOf(await io.read(file))
    rows.push({ file, licence, ...(await measureFile(file, io)) })
  } catch (error) {
    console.log(`${file.split('/').pop()}: cannot read it, ${error.message}`)
  }
}

rows.sort((a, b) => a.triangles - b.triangles)
console.log(
  `${'model'.padEnd(34)} ${'tris'.padStart(8)} ${'draws'.padStart(6)} ${'mats'.padStart(5)} ` +
    `${'tex'.padStart(4)} ${'widest'.padStart(7)} ${'MB'.padStart(6)}  licence`,
)
for (const one of rows) {
  const name = one.file.split('/').pop().slice(0, 34)
  console.log(
    `${name.padEnd(34)} ${String(one.triangles).padStart(8)} ${String(one.draws).padStart(6)} ` +
      `${String(one.materials).padStart(5)} ${String(one.textures).padStart(4)} ${String(one.widest || '-').padStart(7)} ` +
      `${(one.bytes / 1048576).toFixed(2).padStart(6)}  ${one.licence.id}`,
  )
}

console.log('')
for (const one of rows) {
  const name = one.file.split('/').pop()
  const shippable = mayShip(one.licence.id)
  const said = against(one)
  if (!shippable.ok) console.log(`${name}: cannot ship it, ${shippable.why}`)
  else if (said.length > 0) console.log(`${name}: ${said.join('; ')}`)
  else console.log(`${name}: fits`)
}

const usable = rows.filter((one) => mayShip(one.licence.id).ok && against(one).length === 0)
console.log(`\n${rows.length} models, ${usable.length} shippable and within budget.`)
console.log(`A street holds tens of cars at once, so the number that matters is the per-car one, not the total.`)
console.log(`Budget: ${BUDGET.triangles.toLocaleString()} triangles, ${BUDGET.draws} draws, ${BUDGET.texture} px.`)

function filesIn(target) {
  const path = resolve(target)
  if (!statSync(path).isDirectory()) return [path]
  return readdirSync(path)
    .filter((name) => ['.glb', '.gltf'].includes(extname(name).toLowerCase()))
    .map((name) => join(path, name))
    .sort()
}
