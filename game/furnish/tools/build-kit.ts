/**
 * Packs the tiling surfaces a room is built out of into one file the game loads
 * once. The furniture is generated at load time and is not in here.
 *
 * Run: node game/furnish/tools/build-kit.ts
 * Reads:  the Downtown textures (GB_DOWNTOWN_TEXTURES overrides)
 * Writes: assets/dist/interior-kit.glb (GB_ASSETS_DIST overrides)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { SURFACE_TEXTURES, SURFACE_TEXTURE_IDS } from '../src/surfaces/surfaces.ts'
import { writePack } from './pack.ts'

const DIST = process.env['GB_ASSETS_DIST'] ?? join(resolve(import.meta.dirname, '../../..'), 'assets/dist')
mkdirSync(DIST, { recursive: true })

const output = join(DIST, 'interior-kit.glb')
const working = join(DIST, 'interior-kit.working.glb')

const run = (...args: string[]): void => {
  execFileSync('npx', ['gltf-transform', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
}

await writePack(working)
// the maps are photographic 1k and 2k: half a metre of wall at 512 is more than
// the eye asks for indoors, and webp is a third of the bytes at that size
run('resize', working, output, '--width', '512', '--height', '512')
run('webp', output, output)
rmSync(working)

// a surface the game cannot find by name is a room back to flat colour
const packed = nodeNames(output)
const missing = SURFACE_TEXTURE_IDS.map((id) => SURFACE_TEXTURES[id].node).filter((node) => !packed.has(node))
if (missing.length) throw new Error(`build-kit: the pack has no node for ${missing.join(', ')}`)

/** Every node name in a .glb, read out of its JSON chunk. */
function nodeNames(file: string): Set<string> {
  const glb = readFileSync(file)
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string }[] }
  return new Set(json.nodes.map((node) => node.name).filter((name) => name !== undefined))
}

console.log(`${SURFACE_TEXTURE_IDS.length} surfaces -> ${output} (${(statSync(output).size / 1e6).toFixed(2)} MB)`)
