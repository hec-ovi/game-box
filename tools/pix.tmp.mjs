import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import sharp from '/home/hec/workspace/game-box/node_modules/.pnpm/sharp@0.35.3_@types+node@26.2.0/node_modules/sharp/dist/index.mjs'
import { readFileSync } from 'node:fs'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(process.argv[2])
for (const tex of doc.getRoot().listTextures()) {
  const img = tex.getImage()
  if (!img) { console.log(tex.getName(), 'NO IMAGE'); continue }
  const s = sharp(Buffer.from(img))
  const meta = await s.metadata()
  const stats = await s.stats()
  console.log(
    `${tex.getName().padEnd(34)} ${meta.format} ${meta.width}x${meta.height} ch=${meta.channels} mean=[${stats.channels.map(c => c.mean.toFixed(0)).join(',')}] min=[${stats.channels.map(c=>c.min).join(',')}] max=[${stats.channels.map(c=>c.max).join(',')}]`,
  )
}
