import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'

export interface Stage {
  readonly renderer: WebGPURenderer
  readonly camera: THREE.PerspectiveCamera
  readonly scene: THREE.Scene
  /** Sky, sun and colour for when the landscape is not there to provide them. */
  plainDaylight(): void
  /** Swap what is being rendered: the city, or the inside of a building. */
  show(root: THREE.Object3D): void
  start(frame: (seconds: number) => void): void
  /** Draw one frame now, whatever the browser is doing with its frame loop. */
  draw(): void
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
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.toneMappingExposure = 1.15

  const camera = new THREE.PerspectiveCamera(75, aspect(mount), 0.1, 500)

  let current: THREE.Object3D | undefined
  const stage: Stage = {
    renderer,
    camera,
    scene,
    plainDaylight() {
      scene.background = new THREE.Color(SKY)
      scene.fog = new THREE.Fog(SKY, 40, 220)
      renderer.setClearColor(SKY)

      const sun = new THREE.DirectionalLight(0xfff2e0, 3.2)
      sun.position.set(60, 90, 40)
      scene.add(sun)
      // the sky is most of the light outdoors, and it is what keeps the faces
      // the sun does not reach from going black
      scene.add(new THREE.HemisphereLight(0xbfd8ea, 0x6a6152, 2.6))
      const fill = new THREE.DirectionalLight(0xdfe8f0, 0.8)
      fill.position.set(-40, 30, -50)
      scene.add(fill)
    },
    show(root) {
      if (current) scene.remove(current)
      current = root
      scene.add(root)
    },
    draw() {
      renderer.render(scene, camera)
    },
    start(frame) {
      const timer = new THREE.Timer()
      renderer.setAnimationLoop(() => {
        timer.update()
        frame(Math.min(timer.getDelta(), 0.1))
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
