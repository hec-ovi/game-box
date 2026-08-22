import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { PIECES, PIECE_IDS, nodeNamesOf } from '../src/catalog/pieces.ts'

const globals = globalThis as Record<string, unknown>
globals.self ??= globalThis
globals.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

const file = resolve(import.meta.dirname, '../../../assets/dist/downtown-kit.glb')
const bytes = readFileSync(file)
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const gltf = await new Promise<any>((res, rej) => loader.parse(buffer, '', res, rej))
const root = gltf.scenes[0]
root.updateMatrixWorld(true)

// hierarchy of first piece
const first = root.getObjectByName('Brick_BottomTrim')!
console.log('root children:', root.children.length, root.children.slice(0, 3).map((c: any) => `${c.type}:${c.name}`))
console.log('piece type', first.type, 'pos', first.position.toArray(), 'scale', first.scale.toArray())
console.log('child0', first.children[0]!.type, first.children[0]!.position.toArray(), first.children[0]!.scale.toArray())

const fmt = (v: THREE.Vector3) => `[${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)}]`
for (const id of PIECE_IDS) {
  let node: THREE.Object3D | undefined
  for (const name of nodeNamesOf(id)) { const f = root.getObjectByName(name); if (f) { node = f; break } }
  if (!node) { console.log(id, 'MISSING'); continue }
  const world = new THREE.Box3().setFromObject(node)
  // what load.ts produces: geometry in the piece's frame
  const toPiece = node.matrixWorld.clone().invert()
  const local = new THREE.Box3()
  node.traverse((child: any) => {
    if (!(child instanceof THREE.Mesh)) return
    const g = child.geometry.clone()
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toPiece, child.matrixWorld))
    g.computeBoundingBox()
    local.union(g.boundingBox!)
  })
  const want = new THREE.Box3(new THREE.Vector3(...PIECES[id].min), new THREE.Vector3(...PIECES[id].max))
  console.log(id.padEnd(28), 'world', fmt(world.min), fmt(world.max), '| loadKit-frame', fmt(local.min), fmt(local.max), '| catalog', fmt(want.min), fmt(want.max))
}
