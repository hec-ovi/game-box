/**
 * The binding gate. Every skinned file the game ships must carry the same
 * skeleton, in the same order, or a clip written for one will tear another
 * apart. Anything that renumbers joints is caught here rather than on screen.
 *
 * Run: node tools/check-rig.mjs <canonical.glb> <file.glb ...>
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const [canonicalFile, ...files] = process.argv.slice(2)
if (!canonicalFile || !files.length) {
  console.error('usage: node tools/check-rig.mjs <canonical> <file ...>')
  process.exit(1)
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const canonical = await jointsOf(canonicalFile)
console.log(`canonical: ${canonical.length} joints (${canonicalFile.split('/').pop()})`)

let bad = 0
for (const file of files) {
  const joints = await jointsOf(file)
  const name = file.split('/').pop()
  if (joints.length !== canonical.length) {
    console.error(`  FAIL ${name}: ${joints.length} joints, expected ${canonical.length}`)
    bad++
    continue
  }
  const wrong = joints.findIndex((joint, index) => joint !== canonical[index])
  if (wrong >= 0) {
    console.error(`  FAIL ${name}: joint ${wrong} is ${joints[wrong]}, expected ${canonical[wrong]}`)
    bad++
    continue
  }
  console.log(`  ok   ${name}`)
}

if (bad) {
  console.error(`\n${bad} file(s) off the canonical skeleton`)
  process.exit(1)
}

async function jointsOf(file) {
  const doc = await io.read(file)
  const skins = doc.getRoot().listSkins()
  if (!skins.length) throw new Error(`${file}: no skin`)
  return skins[0].listJoints().map((joint) => joint.getName())
}
