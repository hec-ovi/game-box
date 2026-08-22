import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const g = globalThis
g.self ??= globalThis
g.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

const bytes = readFileSync(process.argv[2])
const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej))

gltf.scene.traverse((child) => {
  if (!child.isMesh) return
  const m = child.material
  console.log(`${child.name} [${child.isSkinnedMesh ? 'skinned' : 'mesh'}] material=${m.name} type=${m.type}`)
  console.log(`   color=#${m.color.getHexString()} vertexColors=${m.vertexColors} map=${m.map ? m.map.name || 'yes' : 'NULL'} normalMap=${!!m.normalMap} rmMap=${!!m.roughnessMap}`)
  if (m.map) console.log(`   map.channel=${m.map.channel} colorSpace=${m.map.colorSpace} image=${m.map.image ? `${m.map.image.width}x${m.map.image.height}` : 'none'}`)
  const attrs = Object.keys(child.geometry.attributes)
  console.log(`   attrs=${attrs.join(',')}`)
  const c = child.geometry.attributes.color
  if (c) {
    let min = [9, 9, 9], max = [-9, -9, -9]
    for (let i = 0; i < c.count; i++) for (let k = 0; k < 3; k++) {
      const v = c.getComponent(i, k)
      min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v)
    }
    console.log(`   COLOR_0 itemSize=${c.itemSize} normalized=${c.normalized} min=[${min.map(n=>n.toFixed(3))}] max=[${max.map(n=>n.toFixed(3))}]`)
  }
  const uv = child.geometry.attributes.uv
  if (uv) {
    let mn=[9,9], mx=[-9,-9]
    for (let i=0;i<uv.count;i++) for(let k=0;k<2;k++){const v=uv.getComponent(i,k); mn[k]=Math.min(mn[k],v); mx[k]=Math.max(mx[k],v)}
    console.log(`   uv range x[${mn[0].toFixed(3)},${mx[0].toFixed(3)}] y[${mn[1].toFixed(3)},${mx[1].toFixed(3)}]`)
  }
})
