/**
 * Assembles the part of the runtime asset pack that is not a person: the clip
 * library, compressed, under assets/dist/. The people come from
 * tools/build-wardrobe.mjs.
 *
 * Run: node tools/build-pack.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const BUILD = join(ROOT, 'assets', 'build')
const DIST = join(ROOT, 'assets', 'dist')

mkdirSync(DIST, { recursive: true })

// 84 clips at about half a megabyte over the wire
execFileSync(
  'npx',
  ['gltf-transform', 'meshopt', join(BUILD, 'anims.glb'), join(DIST, 'anims.glb'), '--level', 'high'],
  { stdio: ['ignore', 'ignore', 'inherit'] },
)

console.log(`anims.glb ${(statSync(join(DIST, 'anims.glb')).size / 1e6).toFixed(2)} MB -> ${DIST}`)
