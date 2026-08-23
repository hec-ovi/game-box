import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * A throwaway look at buildings from the glb-buildings toolkit, so we can judge
 * them standing in our own street before deciding whether to wire them in
 * properly. Off unless the url asks for it: `?glb=voltspire-haiku`, or
 * `?glb=all` to line every build up along the street.
 *
 * Delete this file and its one call in game.ts once the decision is made.
 */
const SPIKE = ['voltspire-haiku', 'tinbox-haiku', 'ironclad-qwen', 'noodlebay-qwen']

/** How far ahead of the player the first one stands, and how far apart they line up. */
const AHEAD = 45
const APART = 40

export function spikeGlb(
  root: THREE.Object3D,
  spawn: { x: number; z: number; heading: number },
  ask: string | null,
): void {
  if (!ask) return
  const names = ask === 'all' ? SPIKE : [ask]

  const forward = new THREE.Vector3(-Math.sin(spawn.heading), 0, -Math.cos(spawn.heading))
  const across = new THREE.Vector3(forward.z, 0, -forward.x)
  const loader = new GLTFLoader()

  names.forEach((name, index) => {
    loader.load(
      `/spike/${name}.glb`,
      (gltf) => {
        const model = gltf.scene
        // the toolkit does not promise ground level at y=0, so sit it on the
        // street by its own bounding box rather than trusting the origin
        const box = new THREE.Box3().setFromObject(model)
        const spot = new THREE.Vector3(spawn.x, 0, spawn.z)
          .addScaledVector(forward, AHEAD)
          .addScaledVector(across, (index - (names.length - 1) / 2) * APART)
        model.position.set(spot.x, -box.min.y, spot.z)
        model.name = `spike:${name}`
        root.add(model)
        report(name, model, box)
      },
      undefined,
      (error) => console.error(`[spike] ${name} failed to load`, error),
    )
  })
}

function report(name: string, model: THREE.Object3D, box: THREE.Box3): void {
  const size = box.getSize(new THREE.Vector3())
  let meshes = 0
  let triangles = 0
  const materials = new Set<THREE.Material>()
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    meshes += 1
    const index = child.geometry.getIndex()
    triangles += (index?.count ?? child.geometry.getAttribute('position').count) / 3
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      materials.add(material)
    }
  })
  console.log(
    `[spike] ${name}: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)} m, ` +
      `${meshes} meshes, ${materials.size} materials, ${Math.round(triangles)} triangles`,
  )
}
