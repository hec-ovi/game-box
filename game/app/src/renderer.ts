import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'

export interface Stage {
  readonly renderer: WebGPURenderer
  readonly camera: THREE.PerspectiveCamera
  readonly scene: THREE.Scene
  /** Swap what is being rendered: the city, or the inside of a building. */
  show(root: THREE.Object3D): void
  start(frame: (seconds: number) => void): void
  dispose(): void
}

const SKY = 0x9fb6c6

/** Renderer, camera and daylight. WebGPU where it exists, WebGL2 where it does not. */
export async function createStage(mount: HTMLElement): Promise<Stage> {
  const renderer = new WebGPURenderer({ antialias: true })
  await renderer.init()
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))
  renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight)
  renderer.setClearColor(SKY)
  mount.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SKY)
  scene.fog = new THREE.Fog(SKY, 40, 220)

  const sun = new THREE.DirectionalLight(0xfff2e0, 2.4)
  sun.position.set(60, 90, 40)
  scene.add(sun)
  scene.add(new THREE.HemisphereLight(0xbfd8ea, 0x4a4438, 1.1))

  const camera = new THREE.PerspectiveCamera(75, aspect(mount), 0.1, 500)

  let current: THREE.Object3D | undefined
  const stage: Stage = {
    renderer,
    camera,
    scene,
    show(root) {
      if (current) scene.remove(current)
      current = root
      scene.add(root)
    },
    start(frame) {
      const clock = new THREE.Clock()
      renderer.setAnimationLoop(() => {
        frame(Math.min(clock.getDelta(), 0.1))
        renderer.render(scene, camera)
      })
    },
    dispose() {
      renderer.setAnimationLoop(null)
      renderer.dispose()
      window.removeEventListener('resize', resize)
    },
  }

  function resize() {
    const width = mount.clientWidth || window.innerWidth
    const height = mount.clientHeight || window.innerHeight
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)

  return stage
}

function aspect(mount: HTMLElement): number {
  const width = mount.clientWidth || window.innerWidth
  const height = mount.clientHeight || window.innerHeight
  return width / Math.max(1, height)
}
