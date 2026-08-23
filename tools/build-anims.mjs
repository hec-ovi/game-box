/**
 * Builds the shared animation library: every clip the game can play, on the
 * canonical skeleton, with no meshes, materials or textures attached.
 *
 * The clip library ships with the game runtime. A world file names clips; it
 * never carries them. See docs/DECISIONS.md D12.
 *
 * The list of clips is `clipsUsed()` from `game/cast/src/clips.ts`, so the pack
 * holds what the game plays and nothing else. Name a clip there and rerun this.
 *
 * Run: node tools/build-anims.mjs
 */
import { dedup, prune, resample } from '@gltf-transform/functions'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { clipsUsed } from '../game/cast/src/clips.ts'
import { PoseDeriver } from './anims/derive.mjs'
import { ClipLibrary } from './anims/library.mjs'
import { POSES } from './anims/poses.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'assets', 'src')
const OUT = join(ROOT, 'assets', 'build')

const SOURCES = [
  join(SRC, 'quaternius-ual1/extracted/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'),
  join(SRC, 'quaternius-ual2/extracted/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'),
]

const library = await ClipLibrary.open(SOURCES)
library.stripArt()

const deriver = new PoseDeriver(library.document)
for (const pose of POSES) deriver.derive(pose)

const wanted = clipsUsed()
const dropped = library.keepOnly(wanted)

// prune first so the dropped clips' keyframes go with them, then resample:
// most of a rig's tracks never move, and resample is what collapses them
await library.document.transform(prune(), resample(), dedup(), prune())

mkdirSync(OUT, { recursive: true })
const target = join(OUT, 'anims.glb')
const bones = await library.write(target)

const authored = POSES.map((pose) => pose.name)
console.log(`${wanted.length} clips (${authored.length} authored here, ${dropped} the game never plays dropped) on ${bones} bones -> ${target}`)
console.log(wanted.join(', '))
