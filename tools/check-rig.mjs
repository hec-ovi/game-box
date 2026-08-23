/**
 * The binding gate. Every skinned file the game ships must carry the same
 * skeleton, in the same order, or a clip written for one will tear another
 * apart. Anything that renumbers joints is caught here rather than on screen.
 *
 * A file with no skin is taken for a clip library: every bone it animates has
 * to be a bone the canonical skeleton has, or that track drives nothing and the
 * NPC stands there in a T-pose.
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
if (!canonical) throw new Error(`${canonicalFile}: the canonical file has no skin`)
console.log(`canonical: ${canonical.length} joints (${canonicalFile.split('/').pop()})`)

let bad = 0
for (const file of files) {
  const name = file.split('/').pop()
  const doc = await io.read(file)
  const joints = await jointsOf(file, doc)
  const problem = joints ? sameSkeleton(joints) : sameBones(doc)
  if (problem) {
    console.error(`  FAIL ${name}: ${problem}`)
    bad++
    continue
  }
  console.log(`  ok   ${name}`)
}

if (bad) {
  console.error(`\n${bad} file(s) off the canonical skeleton`)
  process.exit(1)
}

function sameSkeleton(joints) {
  if (joints.length !== canonical.length) return `${joints.length} joints, expected ${canonical.length}`
  const wrong = joints.findIndex((joint, index) => joint !== canonical[index])
  return wrong >= 0 ? `joint ${wrong} is ${joints[wrong]}, expected ${canonical[wrong]}` : undefined
}

function sameBones(doc) {
  const known = new Set(canonical)
  const animated = new Set()
  for (const animation of doc.getRoot().listAnimations()) {
    for (const channel of animation.listChannels()) {
      const target = channel.getTargetNode()
      if (target) animated.add(target.getName())
    }
  }
  if (!animated.size) return 'no skin and no animation: nothing to bind'
  const stray = [...animated].filter((bone) => !known.has(bone))
  if (stray.length) return `animates ${stray.length} bone(s) the skeleton lacks: ${stray.slice(0, 5).join(', ')}`
  return twice(doc)
}

/**
 * Two skeletons in one file read as one: the names look right here, but a
 * loader renames the second copy (`Head` becomes `Head_1`), and every clip
 * pointing at that copy drives nothing and leaves the NPC in the rest pose.
 */
function twice(doc) {
  const names = doc.getRoot().listNodes().map((node) => node.getName())
  const repeated = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))]
  return repeated.length
    ? `${repeated.length} bone name(s) appear more than once, so this file carries more than one skeleton: ${repeated
        .slice(0, 5)
        .join(', ')}`
    : undefined
}

async function jointsOf(file, loaded) {
  const doc = loaded ?? (await io.read(file))
  const skins = doc.getRoot().listSkins()
  return skins.length ? skins[0].listJoints().map((joint) => joint.getName()) : undefined
}
