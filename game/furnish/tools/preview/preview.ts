/**
 * This box, in a browser, on the renderer the game uses.
 *
 * Three things to look at, because a table of numbers proves none of them.
 * `counter` stands one of every kind of thing a player can pick up on the
 * counter this box builds: a table of millimetres cannot say whether an
 * envelope reads as an envelope at arm's length. `room` puts the surfaces on a
 * plain room with the lit channel running round it: it answers whether a
 * polished floor gives back the room's own light or a hole. `screens` stands
 * three televisions on three different screenings in that same dark room.
 *
 *   npx vite --port 5311     then open /game/furnish/tools/preview/index.html
 *
 * `?show=counter|room|screens`, `?style=corpo|home`, `?view=hand|near|far` (1,
 * 2 and 3 switch live, `?x=` slides along the counter). On the counter:
 * `?cast=0|1|2` picks which cast of every archetype is shown, `?some=a,b,c`
 * lines up just those, `?batch=1` puts every item into one `BatchedMesh` so the
 * draw count can be read with and without, `?labels=1` names them. In the room
 * and on the screens: `?probe=0` takes the room's own probe back off the
 * surfaces.
 */
import type { ItemArchetype } from '@gb/world'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { WebGPURenderer } from 'three/webgpu'
import { FurnishDressing, ITEM_SPECS, furnishKit, loadFurnish, type FurnishStyle } from '../../src/index.ts'
import { buildCounter, COUNTER_TOP } from './counter.ts'
import { buildRoom } from './room.ts'
import { buildScreens } from './screens.ts'

const options = new URLSearchParams(location.search)
const asked = options.get('show')
const show = asked === 'room' || asked === 'screens' ? asked : 'counter'
const style: FurnishStyle = options.get('style') === 'home' ? 'home' : 'corpo'
const labelled = options.get('labels') === '1'

/** The pack carries the two grain images; without it a room keeps flat colour. */
const kit = await packed()
const dressing = new FurnishDressing(kit, undefined, style)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x05070a)

const probed = options.get('probe') !== '0'
const stage =
  show === 'room'
    ? { root: buildRoom(dressing, style, probed), items: [], span: 5.6 }
    : show === 'screens'
      ? { root: buildScreens(kit, style, probed), items: [], span: 6.6 }
      : buildCounter(kit, dressing, {
        cast: Number(options.get('cast') ?? 0),
        batched: options.get('batch') === '1',
        some: (options.get('some')?.split(',').filter(Boolean) ?? []) as ItemArchetype[],
      })
scene.add(stage.root)

if (show === 'counter') {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.35 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x1b2126, roughness: 0.7 }),
  )
  back.position.set(0, 1.6, 2.2)
  back.rotation.y = Math.PI
  scene.add(back)
}

/** How much light is in the stage that is not the room's own: none, on the screens. */
const AMBIENT = { counter: 1, room: 0.34, screens: 0.06 }[show]
scene.add(new THREE.HemisphereLight(0x5d8296, 0x101418, 1.5 * AMBIENT))
const key = new THREE.DirectionalLight(0xdff2ff, 2.6 * AMBIENT)
key.position.set(2.4, 4.2, -2.8)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.normalBias = 0.02
key.shadow.bias = -0.0002
key.shadow.camera.near = 0.5
key.shadow.camera.far = 14
for (const side of ['left', 'right', 'top', 'bottom'] as const) {
  key.shadow.camera[side] = side === 'left' || side === 'bottom' ? -4 : 4
}
scene.add(key)
const fill = new THREE.PointLight(0xff9a6e, 8 * AMBIENT, 12)
fill.position.set(-2.6, 2.2, -1.6)
scene.add(fill)

const camera = new THREE.PerspectiveCamera(48, 1, 0.02, 60)
/** Three distances: in the hand, the whole stage in frame, and across the room. */
const VIEWS = { hand: 0.62, near: 0, far: 6.4 }
type View = keyof typeof VIEWS
let view: View = (options.get('view') as View) in VIEWS ? (options.get('view') as View) : 'near'
/** How far along the counter the camera has slid, for the close look. */
const pan = Number(options.get('x') ?? 0)

function aim(): void {
  const fits = (stage.span * 1.12) / 2 / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)
  const back = view === 'near' ? fits : VIEWS[view]
  if (show === 'screens') {
    camera.position.set(pan, 1.5, view === 'hand' ? -0.9 : 1.4)
    camera.lookAt(pan, 1.1, -2.4)
    return
  }
  if (show === 'room') {
    camera.position.set(pan, 1.62, 2.4)
    camera.lookAt(pan, view === 'hand' ? 0.2 : view === 'far' ? 1.9 : 0.7, -2.4)
    return
  }
  camera.position.set(pan, view === 'hand' ? COUNTER_TOP + 0.42 : COUNTER_TOP + 0.28 + back * 0.16, -back)
  camera.lookAt(pan, COUNTER_TOP + (view === 'hand' ? 0.05 : 0.12), 0)
}

addEventListener('keydown', (event) => {
  if (event.key === '1') view = 'hand'
  if (event.key === '2') view = 'near'
  if (event.key === '3') view = 'far'
  aim()
})

const renderer = new WebGPURenderer({ antialias: true })
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
document.body.appendChild(renderer.domElement)

/** aim() reads the aspect, so the frame is worked out after the size is. */
function resize(): void {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', () => {
  resize()
  aim()
})

const cost = document.getElementById('cost')!
const labels = document.getElementById('labels')!
const tags = labelled
  ? stage.items.map(({ archetype, object }) => {
      const tag = document.createElement('span')
      tag.textContent = archetype
      labels.appendChild(tag)
      return { tag, object }
    })
  : []

await renderer.init()
resize()
aim()

const point = new THREE.Vector3()
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera)
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2'
  cost.textContent =
    `${backend}  ${innerWidth}x${innerHeight}\n` +
    `${show} ${style}${kit.surfaces ? '' : ', no pack'}${options.get('probe') === '0' ? ', no probe' : ''}\n` +
    `${renderer.info.render.drawCalls} draws  ${renderer.info.render.triangles} triangles`
  for (const { tag, object } of tags) {
    point.set(0, ITEM_SPECS[object.name as ItemArchetype]?.height ?? 0, 0).applyMatrix4(object.matrixWorld)
    point.project(camera)
    tag.style.left = `${((point.x + 1) / 2) * innerWidth}px`
    tag.style.top = `${((1 - point.y) / 2) * innerHeight - 18}px`
    tag.style.display = point.z > 1 ? 'none' : 'block'
  }
})

/** The kit with the pack's grain images in it, or without them if it will not load. */
async function packed() {
  try {
    const gltf = await new GLTFLoader().loadAsync('/assets/dist/interior-kit.glb')
    return loadFurnish(gltf.scenes)
  } catch {
    return furnishKit()
  }
}
