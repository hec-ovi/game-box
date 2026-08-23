/**
 * One of everything on a counter, in a browser, on the renderer the game uses.
 *
 * This is how the sizes get checked: a table of millimetres proves nothing
 * about whether an envelope reads as an envelope at arm's length. It draws the
 * whole item vocabulary standing on the counter this box builds, and prints the
 * draws and triangles the frame actually costs.
 *
 *   npx vite --port 5311     then open /game/furnish/tools/preview/index.html
 *
 * `?view=hand|near|far` is at arm's length, at the counter or across the room
 * (1, 2 and 3 switch live, `?x=` slides along the counter),
 * `?cast=0|1|2` picks which cast of every archetype is shown, `?some=a,b,c`
 * lines up just those in one row, `?batch=1` puts
 * every item into one `BatchedMesh` so the draw count can be read with and
 * without, and `?labels=1` names them.
 */
import { ITEM_ARCHETYPES, type Item, type ItemArchetype } from '@gb/world'
import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { ITEM_SPECS, furnishKit, FurnishDressing } from '../../src/index.ts'

const options = new URLSearchParams(location.search)
const cast = Number(options.get('cast') ?? 0)
const batched = options.get('batch') === '1'
const labelled = options.get('labels') === '1'

const kit = furnishKit()
const dressing = new FurnishDressing(kit, undefined, 'corpo')

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x05070a)

const COUNTERS = 4
const counterWidth = 1.5
const top = 1.0

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 10),
  new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.35, metalness: 0 }),
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

for (let at = 0; at < COUNTERS; at++) {
  const counter = dressing.prop('counter')
  counter.position.x = (at - (COUNTERS - 1) / 2) * counterWidth
  scene.add(counter)
}

/** An item id that lands on the cast being shown. */
function idFor(archetype: ItemArchetype): string {
  for (let at = 1; at < 400; at++) {
    const id = `item_${String(at).padStart(4, '0')}`
    if (kit.castOf({ archetype, id } as Item) === cast) return id
  }
  return 'item_0001'
}

function thing(archetype: ItemArchetype): Item {
  return {
    id: idFor(archetype),
    name: archetype,
    description: archetype,
    archetype,
    value: 1,
    bulk: 'pocket',
  }
}

/**
 * Two rows along the counter, the taller half at the back so nothing hides
 * behind anything, each item on its own footprint plus a hand's gap and clear
 * of the middle line, so no two of them touch. The camera stands on the north
 * side, which is the side a prop's front looks at.
 */
const GAP = 0.055
const some = (options.get('some')?.split(',').filter(Boolean) ?? []) as ItemArchetype[]
const byHeight = [...ITEM_ARCHETYPES].sort((a, b) => ITEM_SPECS[b].height - ITEM_SPECS[a].height)
const rows = some.length
  ? [some, []]
  : [byHeight.slice(0, Math.ceil(byHeight.length / 2)), byHeight.slice(Math.ceil(byHeight.length / 2))]

const placed: { archetype: ItemArchetype; object: THREE.Object3D }[] = []
let widest = 0
rows.forEach((row, index) => {
  const span = row.reduce((total, archetype) => total + ITEM_SPECS[archetype].width + GAP, -GAP)
  widest = Math.max(widest, span)
  let x = -span / 2
  for (const archetype of row) {
    const spec = ITEM_SPECS[archetype]
    const object = dressing.pickup(thing(archetype))
    const z = some.length ? 0 : (index === 0 ? 1 : -1) * (GAP / 2 + spec.depth / 2)
    object.position.set(x + spec.width / 2, top, z)
    object.updateMatrixWorld()
    x += spec.width + GAP
    placed.push({ archetype, object })
  }
})

if (batched) {
  const geometries = placed.map(({ object }) => (object as THREE.Mesh).geometry)
  const vertices = geometries.reduce((total, geometry) => total + geometry.getAttribute('position').count, 0)
  const indices = geometries.reduce((total, geometry) => total + geometry.getIndex()!.count, 0)
  const batch = new THREE.BatchedMesh(placed.length, vertices, indices, kit.material)
  batch.castShadow = true
  for (const [at, { object }] of placed.entries()) {
    const id = batch.addGeometry(geometries[at]!)
    batch.setMatrixAt(batch.addInstance(id), object.matrix.compose(object.position, object.quaternion, object.scale))
  }
  scene.add(batch)
} else {
  for (const { object } of placed) scene.add(object)
}

scene.add(new THREE.HemisphereLight(0x5d8296, 0x101418, 1.5))
const key = new THREE.DirectionalLight(0xdff2ff, 2.6)
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
const fill = new THREE.PointLight(0xff9a6e, 8, 12)
fill.position.set(-2.6, 2.2, -1.6)
scene.add(fill)

const camera = new THREE.PerspectiveCamera(48, 1, 0.02, 60)
/**
 * Three distances: in the hand, at the counter with the whole set in frame, and
 * across the room. The middle one is worked out from how wide the set came out
 * and how wide the window is, so the group photograph frames the same way
 * whatever shape the browser is.
 */
const VIEWS = { hand: 0.62, near: 0, far: 6.4 }
type View = keyof typeof VIEWS
let view: View = (options.get('view') as View) in VIEWS ? (options.get('view') as View) : 'near'
/** How far along the counter the camera has slid, for the close look. */
const pan = Number(options.get('x') ?? 0)

function aim(): void {
  const frame = widest * 1.12
  const fits = frame / 2 / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)
  const back = view === 'near' ? fits : VIEWS[view]
  const eye = view === 'hand' ? top + 0.42 : top + 0.28 + back * 0.16
  camera.position.set(pan, eye, -back)
  camera.lookAt(pan, top + (view === 'hand' ? 0.05 : 0.12), 0)
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
  ? placed.map(({ archetype, object }) => {
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
    `${placed.length} items, cast ${cast}${batched ? ', batched' : ''}\n` +
    `${renderer.info.render.drawCalls} draws  ${renderer.info.render.triangles} triangles`
  for (const { tag, object } of tags) {
    point.set(0, ITEM_SPECS[object.name as ItemArchetype]?.height ?? 0, 0).applyMatrix4(object.matrixWorld)
    point.project(camera)
    tag.style.left = `${((point.x + 1) / 2) * innerWidth}px`
    tag.style.top = `${((1 - point.y) / 2) * innerHeight - 18}px`
    tag.style.display = point.z > 1 ? 'none' : 'block'
  }
})
