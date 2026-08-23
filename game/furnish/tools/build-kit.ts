/**
 * Packs the furniture this box places, and the tiling surfaces a room is built
 * out of, into one file the game loads once.
 *
 * Run: node game/furnish/tools/build-kit.ts
 * Reads:  assets/src/kenney-furniture, assets/src/kenney-mini-market, the Downtown textures
 * Writes: assets/dist/interior-kit.glb (GB_ASSETS_DIST overrides)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PIECE_IDS } from '../src/catalog/pieces.ts'
import { SURFACE_TEXTURES, SURFACE_TEXTURE_IDS } from '../src/surfaces/surfaces.ts'
import { writePack } from './pack.ts'

const DIST = process.env['GB_ASSETS_DIST'] ?? join(resolve(import.meta.dirname, '../../..'), 'assets/dist')
mkdirSync(DIST, { recursive: true })

const output = join(DIST, 'interior-kit.glb')
const working = join(DIST, 'interior-kit.working.glb')

const run = (...args: string[]): void => {
  execFileSync('npx', ['gltf-transform', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
}

// The steps are spelled out rather than run through `optimize`, because that
// one joins meshes and flattens the graph, and this pack is only useful while
// every piece is still its own named node.
await writePack(working)
run('dedup', working, working)
// the Furniture Kit paints with a couple of dozen flat-colour materials and no
// texture at all: folded into one palette image, a whole room is one draw
run('palette', working, working)
run('prune', working, working)
// the surfaces are photographic 1k and 2k maps and everything else is a palette
// a few pixels across: half a metre of wall at 512 is more than the eye asks
// for indoors, and a swatch grid must not be resampled or compressed at all
run('resize', working, working, '--width', '512', '--height', '512', '--pattern', 'surface_*')
run('webp', working, working, '--pattern', 'surface_*')
run('meshopt', working, output, '--level', 'high')
rmSync(working)

// a model the game cannot find by name is a grey box in a room, and a surface it
// cannot find is a room back to flat colour
const packed = nodeNames(output)
const missing = [
  ...PIECE_IDS.filter((id) => !packed.has(id)),
  ...SURFACE_TEXTURE_IDS.map((id) => SURFACE_TEXTURES[id].node).filter((node) => !packed.has(node)),
]
if (missing.length) throw new Error(`build-kit: the pack has no node for ${missing.join(', ')}`)

/** Every node name in a .glb, read out of its JSON chunk. */
function nodeNames(file: string): Set<string> {
  const glb = readFileSync(file)
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string }[] }
  return new Set(json.nodes.map((node) => node.name).filter((name) => name !== undefined))
}

console.log(
  `${PIECE_IDS.length} models, ${SURFACE_TEXTURE_IDS.length} surfaces` +
    ` -> ${output} (${(statSync(output).size / 1e6).toFixed(2)} MB)`,
)
