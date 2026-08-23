/**
 * Packs the kit pieces this box builds with, and the tiling surfaces the city
 * floor is made of, into one file the game loads once. Everything shares the
 * kit's textures, so the pack is a fraction of the size of the folder it comes
 * from.
 *
 * Run: node game/kitbash/tools/build-kit.ts
 * Reads:  assets/src/quaternius-downtown/... (GB_DOWNTOWN_KIT overrides)
 * Writes: assets/dist/downtown-kit.glb       (GB_ASSETS_DIST overrides)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { FURNITURE_IDS } from '../src/catalog/furniture.ts'
import { nodeNamesOf, PIECE_IDS } from '../src/catalog/pieces.ts'
import { GROUND_TEXTURES, GROUND_TEXTURE_IDS } from '../src/ground/surfaces.ts'
import { writeGroundSurfaces } from './ground-surfaces.ts'
import { KIT_DIRECTORY } from './measure.ts'
import { writeStreetFurniture } from './street-furniture.ts'

const DIST = process.env['GB_ASSETS_DIST'] ?? join(resolve(import.meta.dirname, '../../..'), 'assets/dist')
mkdirSync(DIST, { recursive: true })

const output = join(DIST, 'downtown-kit.glb')
const working = join(DIST, 'downtown-kit.working.glb')
const ground = join(DIST, 'downtown-ground.working.glb')
const street = join(DIST, 'downtown-street.working.glb')

const run = (...args: string[]): void => {
  execFileSync('npx', ['gltf-transform', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
}

// One scene with every piece and every ground surface in it, so the game can
// hand the loaded scene over whole. The steps are spelled out rather than run
// through `optimize`, because that one joins meshes and flattens the graph, and
// this pack is only useful while every piece is still its own named node.
await writeGroundSurfaces(ground)
await writeStreetFurniture(street)
run('merge', ...PIECE_IDS.map((id) => join(KIT_DIRECTORY, `${id}.gltf`)), ground, street, working, '--merge-scenes')
// the ground shares the buildings' asphalt and concrete: dedup folds it to one copy
run('dedup', working, working)
run('prune', working, working)
run('resize', working, working, '--width', '1024', '--height', '1024')
run('webp', working, working)
run('meshopt', working, output, '--level', 'high')
rmSync(working)
rmSync(ground)
rmSync(street)

// a piece the game cannot find by name is a building it cannot draw, a surface
// it cannot find is a street back to flat colour, and a lamp it cannot find is
// a street with nothing on it after dark
const packed = nodeNames(output)
const missing = [
  ...PIECE_IDS.filter((id) => !nodeNamesOf(id).some((name) => packed.has(name))),
  ...GROUND_TEXTURE_IDS.map((id) => GROUND_TEXTURES[id].node).filter((node) => !packed.has(node)),
  ...FURNITURE_IDS.filter((id) => !packed.has(id)),
]
if (missing.length) throw new Error(`build-kit: the pack has no node for ${missing.join(', ')}`)

/** Every node name in a .glb, read out of its JSON chunk. */
function nodeNames(file: string): Set<string> {
  const glb = readFileSync(file)
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { nodes: { name?: string }[] }
  return new Set(json.nodes.map((node) => node.name).filter((name) => name !== undefined))
}

console.log(
  `${PIECE_IDS.length} pieces, ${GROUND_TEXTURE_IDS.length} ground surfaces, ${FURNITURE_IDS.length} street pieces` +
  ` -> ${output} (${(statSync(output).size / 1e6).toFixed(2)} MB)`,
)
