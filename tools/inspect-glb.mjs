/**
 * What a downloaded model would cost the city, before it is adopted.
 *
 *   node tools/inspect-glb.mjs <file-or-folder> [more...]
 *
 * Triangles are the obvious number and rarely the one that hurts. Materials are:
 * every distinct material on a model is another draw call, and a car whose door,
 * handle, mirror and badge each carry their own is several draws rather than
 * one, on every car on the road. Textures are third: a 4K sheet on something
 * seen from ten metres is memory spent on nothing.
 *
 * The budgets below are what a car in this city can afford, taken from the pack
 * that ships: measure against them rather than against how the model looks in a
 * viewer.
 */
import { readdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

/** What a street car can afford. A hero the player drives may spend more. */
const BUDGET = { triangles: 12000, materials: 3, texture: 1024 }

// our own pack ships meshopt-compressed, and so do plenty of downloads
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

async function look(file) {
  const document = await io.read(file)
  const root = document.getRoot()

  let triangles = 0
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices()
      const position = primitive.getAttribute('POSITION')
      const count = indices ? indices.getCount() : (position?.getCount() ?? 0)
      triangles += Math.floor(count / 3)
    }
  }

  const textures = root.listTextures().map((texture) => {
    const size = texture.getSize()
    return { name: texture.getName() || '(unnamed)', w: size?.[0] ?? 0, h: size?.[1] ?? 0 }
  })
  const widest = textures.reduce((most, one) => Math.max(most, one.w, one.h), 0)

  return {
    file,
    triangles,
    materials: root.listMaterials().length,
    meshes: root.listMeshes().length,
    nodes: root.listNodes().length,
    textures: textures.length,
    widest,
    skinned: root.listSkins().length > 0,
    animations: root.listAnimations().length,
    bytes: statSync(file).size,
  }
}

/** The reasons this one would cost more than it is worth. */
function against(one) {
  const said = []
  if (one.triangles > BUDGET.triangles) said.push(`${one.triangles.toLocaleString()} triangles, over ${BUDGET.triangles.toLocaleString()}`)
  if (one.materials > BUDGET.materials) said.push(`${one.materials} materials, so ${one.materials} draws a car`)
  if (one.widest > BUDGET.texture) said.push(`a ${one.widest} px texture`)
  return said
}

function filesIn(target) {
  const path = resolve(target)
  if (!statSync(path).isDirectory()) return [path]
  return readdirSync(path)
    .filter((name) => extname(name).toLowerCase() === '.glb' || extname(name).toLowerCase() === '.gltf')
    .map((name) => join(path, name))
    .sort()
}

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error('usage: node tools/inspect-glb.mjs <file-or-folder> [more...]')
  process.exit(1)
}

const files = targets.flatMap(filesIn)
if (files.length === 0) {
  console.error('no .glb or .gltf found')
  process.exit(1)
}

const rows = []
for (const file of files) {
  try {
    rows.push(await look(file))
  } catch (error) {
    console.log(`${file.split('/').pop()}: cannot read it, ${error.message}`)
  }
}

rows.sort((a, b) => a.triangles - b.triangles)
console.log(`${'model'.padEnd(34)} ${'tris'.padStart(8)} ${'mats'.padStart(5)} ${'tex'.padStart(4)} ${'widest'.padStart(7)} ${'MB'.padStart(6)}`)
for (const one of rows) {
  const name = one.file.split('/').pop().slice(0, 34)
  const mb = (one.bytes / 1048576).toFixed(2)
  console.log(`${name.padEnd(34)} ${String(one.triangles).padStart(8)} ${String(one.materials).padStart(5)} ${String(one.textures).padStart(4)} ${String(one.widest || '-').padStart(7)} ${mb.padStart(6)}`)
}

console.log('')
for (const one of rows) {
  const said = against(one)
  const name = one.file.split('/').pop()
  if (said.length > 0) console.log(`${name}: ${said.join('; ')}`)
  else console.log(`${name}: fits`)
}

const total = rows.reduce((sum, one) => sum + one.triangles, 0)
console.log(`\n${rows.length} models, ${total.toLocaleString()} triangles between them, ${rows.filter((one) => against(one).length === 0).length} within budget.`)
console.log(`A street holds tens of cars at once, so the number that matters is the per-car one, not the total.`)
