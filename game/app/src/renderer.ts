import * as THREE from 'three'
import { PMREMGenerator, WebGPURenderer } from 'three/webgpu'
import { Grade } from './grade.ts'
import { type Api, pictureOf } from './readback.ts'
import { Stall } from './stall.ts'
import type { Stage } from './stage.ts'

const SKY = 0x9fb6c6

/** Renderer, camera and daylight. WebGPU where it exists, WebGL2 where it does not. */
export async function createStage(mount: HTMLElement): Promise<Stage> {
  // the chain multisamples the scene pass itself; the frame buffer under it
  // only ever holds one full screen quad, which has nothing to antialias
  const renderer = new WebGPURenderer()
  await renderer.init()
  // three picks the fallback itself, and the two APIs hand a readback back in
  // opposite row orders with different padding, so which one is really under
  // this renderer has to be asked rather than assumed
  const api: Api = renderer.coordinateSystem === THREE.WebGLCoordinateSystem ? 'webgl' : 'webgpu'
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))
  renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight)
  renderer.setClearColor(SKY)
  mount.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  // every castShadow flag in the art boxes was doing nothing without this
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // AgX rolls a saturated highlight off towards white without turning it a
  // different colour on the way, which is exactly what a neon core does. The
  // exposure is not fixed here: the grade sets it per hour.
  renderer.toneMapping = THREE.AgXToneMapping

  const camera = new THREE.PerspectiveCamera(75, aspect(mount), 0.1, 500)
  const grade = new Grade(renderer, scene, camera)

  let current: THREE.Object3D | undefined
  let daylight: THREE.Group | undefined
  let horizon: PMREMGenerator | undefined
  let reflected: ReturnType<PMREMGenerator['fromScene']> | undefined
  const stage: Stage = {
    canvas: renderer.domElement,
    camera,
    scene,
    plainDaylight() {
      scene.background = new THREE.Color(SKY)
      scene.fog = new THREE.Fog(SKY, 40, 220)
      renderer.setClearColor(SKY)

      const outdoor = new THREE.Group()
      outdoor.name = 'plain-daylight'
      const sun = new THREE.DirectionalLight(0xfff2e0, 3.2)
      sun.position.set(60, 90, 40)
      outdoor.add(sun)
      // the sky is most of the light outdoors, and it is what keeps the faces
      // the sun does not reach from going black
      outdoor.add(new THREE.HemisphereLight(0xbfd8ea, 0x6a6152, 2.6))
      const fill = new THREE.DirectionalLight(0xdfe8f0, 0.8)
      fill.position.set(-40, 30, -50)
      outdoor.add(fill)
      scene.add(outdoor)
      daylight = outdoor
    },
    reflect(sky) {
      horizon ??= new PMREMGenerator(renderer)
      const holder = new THREE.Scene()
      const parent = sky.parent
      // the dome rides on the player and the camera that prefilters it sits at
      // the origin, so taken where it stands the whole sky comes out skewed by
      // however far the player has walked
      const rode = sky.position.clone()
      sky.position.set(0, 0, 0)
      // prefilter the sky on its own: the city reflecting itself would cost far
      // more and look worse
      holder.add(sky)
      // into the same target every time, so `scene.environment` is the same
      // texture object it was last hour. Given a new one, three rebuilds the
      // shader of every object in the scene, because the environment's node is
      // part of each render object's cache key: measured on this machine's
      // WebGL2 fallback, that is a 200 ms stall on the frame after the hour
      // turns, four times a real minute at the default clock rate. Filtering
      // the dome itself is 1.4 ms.
      reflected = horizon.fromScene(holder, 0, 0.1, 100, reflected ? { renderTarget: reflected } : {})
      sky.position.copy(rode)
      parent?.add(sky)

      scene.environment = reflected.texture
    },
    carrySky(brighter, turned) {
      grade.carrySky(brighter, turned)
    },
    indoors(on) {
      // a room carries its own light: the fixtures its art drew, standing where
      // they are drawn, under `@gb/scene`'s budget, and the bounce off its own
      // surfaces. Nothing is added here, because a light added here would be
      // the same light in every room in the city, from the same direction,
      // whatever is over the player's head, which is the whole of what made a
      // room read as a cartoon.
      //
      // Whichever daylight is in play goes off, so a room is never lit by a sun
      // it cannot see. The sky reflected into every material goes with it: that
      // is the grade's, and it takes the room's own level while the player is
      // inside rather than holding the hour they walked in at
      if (daylight) daylight.visible = !on
      grade.indoors = on
    },
    grade(night) {
      grade.setNight(night)
    },
    show(root) {
      if (current) scene.remove(current)
      current = root
      scene.add(root)
    },
    async snapshot(scene, camera, size) {
      const target = new THREE.RenderTarget(size, size)
      // the picture goes straight from here into an `<img>`, so it has to leave
      // the GPU in the space a screen shows. A target left in linear light
      // reads back at about a third of the brightness it was drawn at.
      target.texture.colorSpace = THREE.SRGBColorSpace
      const was = renderer.getRenderTarget()
      // nothing behind the subject: the panel this lands on has a ground of its
      // own, and a square of the city's sky sitting on it is not a portrait
      const opaque = renderer.getClearAlpha()
      try {
        renderer.setClearAlpha(0)
        renderer.setRenderTarget(target)
        renderer.render(scene, camera)
        const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, size, size)
        const picture = pictureOf(pixels, size, api)
        return picture && pngOf(picture, size)
      } catch (cause) {
        // a face is worth nothing to fail a conversation over
        console.warn('no portrait', cause)
        return undefined
      } finally {
        renderer.setClearAlpha(opaque)
        renderer.setRenderTarget(was)
        target.dispose()
      }
    },
    draw() {
      // By hand, for a suspended frame loop. The shadow map only redraws while
      // the node frame advances, which happens inside `setAnimationLoop`, so a
      // loop built out of this instead of `start` would freeze every shadow
      // where the player last stood.
      grade.render()
    },
    start(frame) {
      const timer = new THREE.Timer()
      const stall = new Stall()
      renderer.setAnimationLoop(() => {
        timer.update()
        stall.begin()
        const drawing = frame(Math.min(timer.getDelta(), 0.1), stall)
        if (drawing !== false) grade.render()
        stall.end()
      })
    },
    dispose() {
      grade.dispose()
      reflected?.dispose()
      horizon?.dispose()
      renderer.setAnimationLoop(null)
      renderer.dispose()
      renderer.domElement.remove()
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

/** A square picture, top row first, as a PNG the interface can put in an `<img>`. */
function pngOf(picture: Uint8ClampedArray<ArrayBuffer>, size: number): string | undefined {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const paint = canvas.getContext('2d')
  if (!paint) return undefined
  paint.putImageData(new ImageData(picture, size, size), 0, 0)
  return canvas.toDataURL('image/png')
}

function aspect(mount: HTMLElement): number {
  const width = mount.clientWidth || window.innerWidth
  const height = mount.clientHeight || window.innerHeight
  return width / Math.max(1, height)
}
