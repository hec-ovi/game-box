/**
 * Packs the kit pieces this box builds with into one file the game loads once.
 * The pieces share their textures, so the pack is a fraction of the size of
 * the folder it comes from.
 *
 * Run: node game/kitbash/tools/build-kit.ts
 * Reads:  assets/src/quaternius-downtown/... (GB_DOWNTOWN_KIT overrides)
 * Writes: assets/dist/downtown-kit.glb       (GB_ASSETS_DIST overrides)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { nodeNamesOf, PIECE_IDS } from '../src/catalog/pieces.ts'
import { KIT_DIRECTORY } from './measure.ts'

const DIST = process.env['GB_ASSETS_DIST'] ?? join(resolve(import.meta.dirname, '../../..'), 'assets/dist')
mkdirSync(DIST, { recursive: true })

const output = join(DIST, 'downtown-kit.glb')
const working = join(DIST, 'downtown-kit.working.glb')

const run = (...args: string[]): void => {
  execFileSync('npx', ['gltf-transform', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
}

// One scene with every piece in it, so the game can hand the loaded scene over
// whole. The steps are spelled out rather than run through `optimize`, because
// that one joins meshes and flattens the graph, and this pack is only useful
// while every piece is still its own named node.
run('merge', ...PIECE_IDS.map((id) => join(KIT_DIRECTORY, `${id}.gltf`)), working, '--merge-scenes')
run('dedup', working, working)
run('prune', working, working)
run('resize', working, working, '--width', '1024', '--height', '1024')
run('webp', working, working)
run('meshopt', working, output, '--level', 'high')
rmSync(working)

// a piece the game cannot find by name is a building it cannot draw
const packed = nodeNames(output)
const missing = PIECE_IDS.filter((id) => !nodeNamesOf(id).some((name) => packed.has(name)))
if (missing.length) throw new Error(`build-kit: the pack has no node for ${missing.join(', ')}`)

/** Every node name in a .glb, read out of its JSON chunk. */
function nodeNames(file: string): Set<string> {
  const glb = readFileSync(file)
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string }[] }
  return new Set(json.nodes.map((node) => node.name).filter((name) => name !== undefined))
}

console.log(`${PIECE_IDS.length} pieces -> ${output} (${(statSync(output).size / 1e6).toFixed(2)} MB)`)
