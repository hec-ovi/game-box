/**
 * Prints the skeleton and clip list of a glTF/GLB, so two packs can be diffed
 * before anything is built on the assumption that they match.
 *
 * Run: node tools/rig-report.mjs <file.glb> [--bones|--clips]
 */
import { readFileSync } from 'node:fs'

const [file, what = '--both'] = process.argv.slice(2)
if (!file) {
  console.error('usage: node tools/rig-report.mjs <file.glb|file.gltf> [--bones|--clips]')
  process.exit(1)
}

const gltf = read(file)
const nodes = gltf.nodes ?? []

if (what !== '--clips') {
  const joints = new Set((gltf.skins ?? []).flatMap((skin) => skin.joints ?? []))
  const bones = [...joints].map((index) => nodes[index]?.name ?? `node_${index}`)
  console.log(`# bones (${bones.length})`)
  for (const bone of bones) console.log(bone)
}

if (what !== '--bones') {
  const clips = (gltf.animations ?? []).map((animation) => animation.name).filter(Boolean)
  console.log(`# clips (${clips.length})`)
  for (const clip of clips.sort()) console.log(clip)
}

/** Reads the JSON chunk of a .glb, or a plain .gltf. */
function read(path) {
  const bytes = readFileSync(path)
  if (bytes.subarray(0, 4).toString('utf8') !== 'glTF') return JSON.parse(bytes.toString('utf8'))

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 12
  while (offset < bytes.byteLength) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    if (type === 0x4e4f534a) return JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString('utf8'))
    offset += 12 + length
  }
  throw new Error(`${path}: no JSON chunk`)
}
