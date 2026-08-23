/**
 * Builds the shared animation library: every clip the game can play, on the
 * canonical skeleton, with no meshes, materials or textures attached.
 *
 * The clip library ships with the game runtime. A world file names clips; it
 * never carries them. See docs/DECISIONS.md D12.
 *
 * Run: node tools/build-anims.mjs
 */
import { NodeIO } from '@gltf-transform/core'
import { prune, dedup, mergeDocuments, resample } from '@gltf-transform/functions'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'assets', 'src')
const OUT = join(ROOT, 'assets', 'build')

const SOURCES = [
  join(SRC, 'quaternius-ual1/extracted/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'),
  join(SRC, 'quaternius-ual2/extracted/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'),
]

/** A rest pose is not a clip. */
const DROP = new Set(['A_TPose'])

const io = new NodeIO()
const merged = await io.read(SOURCES[0])
const root = merged.getRoot()

// the first file's skeleton is the one every clip has to drive. Two files mean
// two copies of it, and a loader that meets two bones called `Head` renames the
// second one, so every clip pointing at that copy would drive nothing and the
// NPC would stand in the rest pose.
const canonical = new Map(root.listNodes().map((node) => [node.getName(), node]))

for (const source of SOURCES.slice(1)) {
  const known = new Set(root.listNodes())
  mergeDocuments(merged, await io.read(source))
  const copies = root.listNodes().filter((node) => !known.has(node))
  retarget(copies)
  for (const scene of root.listScenes().slice(1)) scene.dispose()
  for (const node of copies) node.dispose()
}
root.setDefaultScene(root.listScenes()[0])

// the clips are the point; the mannequin they were authored on is not
for (const node of root.listNodes()) node.setMesh(null)
for (const mesh of root.listMeshes()) mesh.dispose()
for (const material of root.listMaterials()) material.dispose()
for (const texture of root.listTextures()) texture.dispose()
for (const skin of root.listSkins()) skin.dispose()

let dropped = 0
for (const animation of root.listAnimations()) {
  if (!DROP.has(animation.getName())) continue
  animation.dispose()
  dropped++
}

// two files means two buffers; a GLB carries one
const buffers = root.listBuffers()
for (const accessor of root.listAccessors()) accessor.setBuffer(buffers[0])
for (const buffer of buffers.slice(1)) buffer.dispose()

// resample first: it drops the redundant keyframes, which is most of the file
await merged.transform(dedup(), resample(), prune())

const names = root.listNodes().map((node) => node.getName())
const twice = names.filter((name, index) => names.indexOf(name) !== index)
if (twice.length) throw new Error(`${twice.length} bone name(s) appear twice: ${[...new Set(twice)].join(', ')}`)

mkdirSync(OUT, { recursive: true })
const target = join(OUT, 'anims.glb')
await io.write(target, merged)

const clips = root.listAnimations().map((a) => a.getName())
console.log(`${clips.length} clips (${dropped} rest poses dropped) on ${names.length} bones -> ${target}`)
console.log(clips.sort().join(', '))

/** Moves every channel that drives one of these nodes onto the bone of the same name. */
function retarget(copies) {
  const strangers = new Set(copies)
  for (const animation of root.listAnimations()) {
    for (const channel of animation.listChannels()) {
      const target = channel.getTargetNode()
      if (!target || !strangers.has(target)) continue
      const bone = canonical.get(target.getName())
      if (!bone) throw new Error(`${animation.getName()}: no bone named ${target.getName()} on the canonical skeleton`)
      channel.setTargetNode(bone)
    }
  }
}
