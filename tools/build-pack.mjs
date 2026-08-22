/**
 * Assembles the runtime asset pack the game loads: the clip library, the
 * bodies, and their textures, under assets/dist/.
 *
 * Run: node tools/build-pack.mjs
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'assets', 'src')
const BUILD = join(ROOT, 'assets', 'build')
const DIST = join(ROOT, 'assets', 'dist')

const BODIES = join(SRC, 'quaternius-ubc/extracted/Universal Base Characters[Standard]/Base Characters/Godot - UE')

mkdirSync(join(DIST, 'bodies'), { recursive: true })

// the pack ships a few textures under a name its own gltf does not use
// (T_Eye_Normal.png against a reference to T_Eye_Normal_png.png); alias them
// rather than editing files we did not write
for (const name of readdirSync(BODIES)) {
  if (!name.endsWith('.png') || name.endsWith('_png.png')) continue
  const alias = join(BODIES, name.replace(/\.png$/, '_png.png'))
  if (!existsSync(alias)) copyFileSync(join(BODIES, name), alias)
}

// the clip library, compressed: 84 clips at about half a megabyte over the wire
execFileSync('npx', ['gltf-transform', 'meshopt', join(BUILD, 'anims.glb'), join(DIST, 'anims.glb'), '--level', 'high'], {
  stdio: ['ignore', 'ignore', 'inherit'],
})

// each body becomes one self-contained GLB: one request in the browser, and
// loadable from a buffer in a test with no filesystem behind it
let copied = 0
for (const name of readdirSync(BODIES)) {
  if (!name.endsWith('.gltf')) continue
  const out = join(DIST, 'bodies', name.replace(/\.gltf$/, '.glb'))
  // the source textures are 2k PNGs, which is 15 MB a body over the wire
  execFileSync('npx', ['gltf-transform', 'optimize', join(BODIES, name), out,
    '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024', '--simplify', 'false'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  copied++
}

const size = (path) => `${(statSync(path).size / 1e6).toFixed(2)} MB`
console.log(`anims.glb ${size(join(DIST, 'anims.glb'))}, ${copied} body files -> ${DIST}`)
