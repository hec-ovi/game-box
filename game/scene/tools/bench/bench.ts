import { Forge, OfflineNarrator } from '@gb/forge'
import type { World } from '@gb/world'
import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { buildCity, buildInterior, CEILING_FILL, CEILING_HEIGHT, Greybox, LIVE_LIGHTS, type Dressing, type SurfacePart } from '../../src/index.ts'

/**
 * Two measurements, chosen by `?view=`:
 *
 * `street` (default): the city at `?blocks=N` (default 2), greyboxed, the
 * camera at the spawn, `?lights=N` of the buildings' emitters live as point
 * lights, `?gl=1` for the WebGL2 backend, `?whole=1` for every building
 * whole at every distance instead of the shells past the detail radius.
 * The frame is timed off requestAnimationFrame, so run the browser with its
 * frame rate uncapped or every answer is the vsync.
 *
 * `ceiling`: one room, its lid painted the colour `@gb/furnish` publishes for
 * a corpo ceiling, lit by the fill alone, read back in linear light where the
 * camera looks straight up at it. `?fill=0` takes the fill away.
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
  const opened = performance.now()
  const built = buildCity(world, dressing, { lights: budget, night: 1, wetness: 0.6 })
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
    openMs,
    detailed: [...built.buildings.values()].filter((one) => one.detailed).length,
    emitters: built.lights.emitters.length,
    lights: budget,
    live: built.lights.lights.filter((light) => light.visible).length,
    draws,
    triangles,
    frameMs: median(frames),
    renderPassMs: median(passes),
  })
}

async function ceiling(): Promise<void> {
  const fill = Number(query.get('fill') ?? CEILING_FILL)
  const world = await city(1)
  const interior = world.interiors()[0]!
  const room = buildInterior(world, interior, new CorpoLid())
  const light = room.root.getObjectByName('fill') as THREE.DirectionalLight
  light.intensity = fill

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  scene.add(room.root)

  const size = 64
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20)
  camera.position.set(interior.size.w / 2, 1.6, interior.size.h / 2)
  camera.lookAt(interior.size.w / 2, CEILING_HEIGHT, interior.size.h / 2)

  const made = renderer()
  await made.init()
  made.toneMapping = THREE.NoToneMapping
  const target = new THREE.RenderTarget(size, size, { type: THREE.FloatType })
  made.setRenderTarget(target)
  made.render(scene, camera)
  const pixel = await made.readRenderTargetPixelsAsync(target, size / 2, size / 2, 1, 1)
  made.setRenderTarget(null)
  made.render(scene, camera)

  const lid = new THREE.Color(0x4a4d52)
  done({
    view: 'ceiling',
    gpu: gpuOf(made),
    fill,
    lidLinear: [lid.r, lid.g, lid.b].map((n) => Number(n.toFixed(4))),
    predictedLinear: [lid.r, lid.g, lid.b].map((n) => Number(((n * fill) / Math.PI).toFixed(4))),
    readLinear: [pixel[0], pixel[1], pixel[2]].map((n) => Number(Number(n).toFixed(4))),
    readSrgb: [pixel[0], pixel[1], pixel[2]].map((n) => Number(new THREE.Color(Number(n), 0, 0).convertLinearToSRGB().r.toFixed(3))),
  })
}

;(query.get('view') === 'ceiling' ? ceiling() : street()).catch((error: unknown) => {
  out.textContent = String(error)
  document.title = 'failed'
})
