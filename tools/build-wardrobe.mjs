/**
 * Merges the modular outfit parts into one GLB per outfit, so dressing an NPC
 * is one file and one bind rather than five requests.
 *
 * Run: node tools/build-wardrobe.mjs
 */
import { NodeIO } from '@gltf-transform/core'
import { dedup, mergeDocuments, prune } from '@gltf-transform/functions'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PARTS = findParts(join(ROOT, 'assets', 'src', 'quaternius-outfits', 'extracted'))
const DIST = join(ROOT, 'assets', 'dist', 'outfits')

/** An outfit is every part whose name starts the same way. */
const OUTFITS = ['Male_Peasant', 'Female_Peasant', 'Male_Ranger', 'Female_Ranger']

mkdirSync(DIST, { recursive: true })
const io = new NodeIO()

for (const outfit of OUTFITS) {
  const files = readdirSync(PARTS)
    .filter((name) => name.startsWith(`${outfit}_`) && name.endsWith('.gltf'))
    // a hood replaces the hair and a pauldron is a whole other silhouette; skip both for now
    .filter((name) => !/_Head_|_Acc_/.test(name))
    .sort()
  if (!files.length) continue

  const merged = await io.read(join(PARTS, files[0]))
  for (const file of files.slice(1)) mergeDocuments(merged, await io.read(join(PARTS, file)))

  const root = merged.getRoot()
  const scenes = root.listScenes()
  for (const scene of scenes.slice(1)) {
    for (const child of scene.listChildren()) scenes[0].addChild(child)
    scene.dispose()
  }
  root.setDefaultScene(scenes[0])

  const buffers = root.listBuffers()
  for (const accessor of root.listAccessors()) accessor.setBuffer(buffers[0])
  for (const buffer of buffers.slice(1)) buffer.dispose()

  await merged.transform(dedup(), prune())
  const raw = join(DIST, `${outfit}.raw.glb`)
  const out = join(DIST, `${outfit}.glb`)
  await io.write(raw, merged)

  execFileSync('npx', ['gltf-transform', 'optimize', raw, out,
    '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024', '--simplify', 'false'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  console.log(`${outfit}: ${files.length} parts -> ${(statSync(out).size / 1e6).toFixed(2)} MB`)
}

for (const name of readdirSync(DIST)) {
  if (name.endsWith('.raw.glb')) execFileSync('rm', [join(DIST, name)])
}

function findParts(from) {
  const stack = [from]
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'Modular Parts') return join(dir, entry.name)
      stack.push(join(dir, entry.name))
    }
  }
  throw new Error('no "Modular Parts" folder under the outfits pack')
}
