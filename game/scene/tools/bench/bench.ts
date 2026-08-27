import { Forge, OfflineNarrator } from '@gb/forge'
import type { World } from '@gb/world'
import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { buildCity, buildInterior, CEILING_HEIGHT, Greybox, LIVE_LIGHTS, ROOM_SHADOWS, type Dressing, type SurfacePart } from '../../src/index.ts'

/**
 * Two measurements, chosen by `?view=`:
 *
 * `street` (default): the city at `?blocks=N` (default 2), greyboxed, the
 * camera at the spawn, `?lights=N` of the buildings' emitters live as point
 * lights, `?gl=1` for the WebGL2 backend, `?whole=1` for every building whole
 * at every distance instead of the shells past the detail radius, and
 * `?shell=all` for a shell on every plot in the town rather than the skyline
 * past `SHELL_RADIUS`.
 * The frame is timed off requestAnimationFrame, so run the browser with its
 * frame rate uncapped or every answer is the vsync.
 *
 * `room`: one room, its lid and walls painted the colours `@gb/furnish`
 * publishes for a corpo interior, lit by nothing but its own fixtures. The
 * floor is read back in linear light from straight above, so the spread across
 * it is the answer, and the frame is timed from standing in the doorway.
 * `?casters=N` is how many of the room's lights cast (0 for none).
 *
 * Both write what they found to `window.bench` and the page title when done.
 */

const query = new URLSearchParams(location.search)
const out = document.getElementById('out')!

/** What furnish paints a corpo room in: lid 0x4a4d52, walls near 0x53565a. */
class CorpoLid extends Greybox {
  readonly #lid = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.9, metalness: 0 })
  readonly #wall = new THREE.MeshStandardMaterial({ color: 0x53565a, roughness: 0.9, metalness: 0 })
  override surface(part: SurfacePart): THREE.Material {
    return part === 'ceiling' ? this.#lid : part === 'wall' ? this.#wall : super.surface(part)
  }
}

async function city(blocks: number): Promise<World> {
  const result = await new Forge(new OfflineNarrator('bench')).build({ theme: 'quiet coastal town', seed: 'bench', blocksX: blocks, blocksY: blocks })
  if (!result.ok) throw new Error(JSON.stringify(result.error).slice(0, 400))
  return result.value.world
}

/** The renderer the game uses; `?gl=1` holds it to its WebGL2 backend, which is what a browser with no WebGPU runs. */
function renderer(): WebGPURenderer {
  const made = new WebGPURenderer({ antialias: true, forceWebGL: query.get('gl') === '1', trackTimestamp: true })
  made.setSize(innerWidth, innerHeight)
  made.setPixelRatio(1)
  document.body.appendChild(made.domElement)
  return made
}

/** Which GPU the numbers came off. */
function gpuOf(made: WebGPURenderer): string {
  const gl = (made.backend as { gl?: WebGL2RenderingContext }).gl
  if (!gl) return 'webgpu'
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'webgl2'
}

function done(result: Record<string, unknown>): void {
  ;(window as unknown as { bench: unknown }).bench = result
  out.textContent = JSON.stringify(result, null, 2)
  document.title = 'done'
}

/** The greybox with its far look taken away, so every building is whole at every distance: `?whole=1`. */
function whole(grey: Greybox): Dressing {
  return {
    building: (plot, size, charter) => grey.building(plot, size, charter),
    lights: (plot, size) => grey.lights(plot, size),
    prop: (prop) => grey.prop(prop),
    character: (npc, doing) => grey.character(npc, doing),
    pickup: (item) => grey.pickup(item),
    ground: (kind) => grey.ground(kind),
    surface: (part) => grey.surface(part),
    marking: (paint) => grey.marking(paint),
    clutter: () => grey.clutter(),
  }
}

async function street(): Promise<void> {
  const blocks = Number(query.get('blocks') ?? 2)
  const budget = Number(query.get('lights') ?? LIVE_LIGHTS)
  const world = await city(blocks)
  const dressing = query.get('whole') === '1' ? whole(new Greybox()) : new Greybox()
  const reach = query.get('shell')
  const opened = performance.now()
  const built = buildCity(world, dressing, {
    lights: budget,
    night: 1,
    wetness: 0.6,
    ...(reach ? { shell: reach === 'all' ? Number.POSITIVE_INFINITY : Number(reach) } : {}),
  })
  const openMs = Number((performance.now() - opened).toFixed(0))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x06080a)
  scene.add(built.root)
  scene.add(new THREE.HemisphereLight(0x25304a, 0x0c0d10, 0.8))

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 400)
  camera.position.set(built.spawn.x, 1.7, built.spawn.z)
  camera.rotation.order = 'YXZ'
  camera.rotation.y = built.spawn.heading + Math.PI / 2
  built.follow(built.spawn.x, built.spawn.z)

  const made = renderer()
  await made.init()
  for (let warm = 0; warm < 60; warm++) {
    made.render(scene, camera)
    await new Promise(requestAnimationFrame)
  }
  // the frame as the browser paces it, and the render pass as the GPU timed it
  const frames: number[] = []
  const passes: number[] = []
  let draws = 0
  let triangles = 0
  let last = performance.now()
  for (let frame = 0; frame < 240; frame++) {
    made.render(scene, camera)
    draws = made.info.render.drawCalls
    triangles = made.info.render.triangles
    await made.resolveTimestampsAsync('render')
    passes.push(made.info.render.timestamp)
    await new Promise(requestAnimationFrame)
    const now = performance.now()
    frames.push(now - last)
    last = now
  }
  frames.sort((a, b) => a - b)
  passes.sort((a, b) => a - b)
  const median = (list: number[]) => Number(list[Math.floor(list.length / 2)]!.toFixed(3))
  done({
    view: 'street',
    gpu: gpuOf(made),
    size: [innerWidth, innerHeight],
    blocks,
    plots: world.plots().length,
    whole: query.get('whole') === '1',
    shell: reach ?? 'the published reach',
    openMs,
    steps: [...built.buildings.values()].reduce<Record<string, number>>((counted, one) => ({ ...counted, [one.step]: (counted[one.step] ?? 0) + 1 }), {}),
    emitters: built.lights.emitters.length,
    lights: budget,
    live: built.lights.lights.filter((light) => light.visible).length,
    draws,
    triangles,
    frameMs: median(frames),
    renderPassMs: median(passes),
  })
}

async function room(): Promise<void> {
  const casters = Number(query.get('casters') ?? ROOM_SHADOWS.casters)
  const world = await city(1)
  const interior = world.interiors()[0]!
  const built = buildInterior(world, interior, new CorpoLid())
  for (const [at, light] of built.lights.lights.entries()) light.castShadow = at < casters

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  scene.add(built.root)

  const made = renderer()
  await made.init()
  made.shadowMap.enabled = true
  made.shadowMap.type = THREE.PCFSoftShadowMap
  made.toneMapping = THREE.NoToneMapping

  // what the light lays across the floor, from just under the lid looking down
  const above = new THREE.OrthographicCamera(0, interior.size.w, interior.size.h, 0, 0.1, CEILING_HEIGHT)
  above.position.set(0, CEILING_HEIGHT - 0.05, 0)
  above.rotation.set(-Math.PI / 2, 0, 0)
  above.updateProjectionMatrix()
  const size = 64
  const target = new THREE.RenderTarget(size, size, { type: THREE.FloatType })
  made.setRenderTarget(target)
  made.render(scene, above)
  const pixels = await made.readRenderTargetPixelsAsync(target, 0, 0, size, size)
  made.setRenderTarget(null)

  const lit: number[] = []
  for (let at = 0; at < size * size; at++) {
    const light = 0.2126 * Number(pixels[at * 4]) + 0.7152 * Number(pixels[at * 4 + 1]) + 0.0722 * Number(pixels[at * 4 + 2])
    if (light > 0) lit.push(light)
  }
  lit.sort((one, two) => one - two)
  const quantile = (q: number) => Number((lit[Math.min(lit.length - 1, Math.floor(q * lit.length))] ?? 0).toFixed(5))

  // and what it costs to stand in, shadows and all
  const camera = new THREE.PerspectiveCamera(75, innerWidth / Math.max(1, innerHeight), 0.1, 60)
  camera.position.set(built.entrance.x + built.inward.x * 1.2, 1.6, built.entrance.z + built.inward.z * 1.2)
  camera.lookAt(interior.size.w / 2, 1.2, interior.size.h / 2)
  const frames: number[] = []
  let last = performance.now()
  for (let frame = 0; frame < 120; frame++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    made.render(scene, camera)
    const now = performance.now()
    if (frame > 20) frames.push(now - last)
    last = now
  }
  frames.sort((one, two) => one - two)

  let meshes = 0
  built.root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes++
  })

  done({
    view: 'room',
    gpu: gpuOf(made),
    interior: interior.id,
    size: [interior.size.w, interior.size.h],
    meshes,
    fixtures: built.lights.fixtures.length,
    live: built.lights.lights.filter((light) => light.visible).length,
    casters,
    floorLinear: { p05: quantile(0.05), median: quantile(0.5), p95: quantile(0.95) },
    floorSpread: Number((quantile(0.95) / Math.max(quantile(0.05), 1e-6)).toFixed(2)),
    frameMs: Number(frames[Math.floor(frames.length / 2)]!.toFixed(3)),
  })
}

;(query.get('view') === 'room' ? room() : street()).catch((error: unknown) => {
  out.textContent = String(error)
  document.title = 'failed'
})
