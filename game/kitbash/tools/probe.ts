import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as THREE from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { PIECE_IDS, nodeNamesOf } from '../src/catalog/pieces.ts'

const globals = globalThis as Record<string, unknown>
globals.self ??= globalThis
globals.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

const file = resolve(import.meta.dirname, '../../../assets/dist/downtown-kit.glb')
const bytes = readFileSync(file)
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const gltf = await new Promise<any>((res, rej) => loader.parse(buffer, '', res, rej))
console.log('scenes', gltf.scenes.length)
for (const root of gltf.scenes) root.updateMatrixWorld(true)

for (const id of PIECE_IDS) {
  let node: THREE.Object3D | undefined
  for (const name of nodeNamesOf(id)) {
    for (const root of gltf.scenes) { const f = root.getObjectByName(name); if (f) { node = f; break } }
    if (node) break
  }
  if (!node) { console.log(id, 'MISSING'); continue }
  const rows: string[] = []
  node.traverse((child: any) => {
    if (!(child instanceof THREE.Mesh)) return
    const g = child.geometry as THREE.BufferGeometry
    const attrs = Object.entries(g.attributes).map(([n, a]: any) => `${n}:${a.array.constructor.name}/${a.itemSize}${a.normalized ? '/norm' : ''}${a.gpuType === THREE.IntType ? '/int' : ''}`)
    const mats = Array.isArray(child.material) ? child.material.map((m: any) => m.name) : [child.material.name]
    rows.push(`    ${child.name} [${mats.join(',')}] idx=${g.index ? g.index.array.constructor.name : 'none'} groups=${g.groups.length} morph=${Object.keys(g.morphAttributes).length} ${attrs.join(' ')}`)
  })
  console.log(id, `(node ${node.name})`)
  for (const r of rows) console.log(r)
}
