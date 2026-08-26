/**
 * What a city costs to open, with the shell path and without it, measured
 * headless in Node on a forged town: `@gb/prefab` over `@gb/kitbash`, which is
 * how the game dresses one, or the kit alone, which is what the town falls back
 * to for a plot the pack has no shape for.
 *
 * `lod` is the streaming path `@gb/scene` runs when the dressing publishes a
 * `shell`: every plot batched as its far look at open, the whole building only
 * within `DETAIL_RADIUS` of the spawn. `whole` hides the shell, which is what
 * a dressing without one costs: every plot dressed in full at open.
 *
 *   node tools/bench-city.ts [--seed metro] [--blocks 20] [--storeys 24] [--mode lod|whole] [--dressing prefab|kit]
 *
 * Reads: pack/ here, and assets/dist/downtown-kit.glb (GB_ASSETS_DIST overrides).
 */
import { Forge, OfflineNarrator } from '@gb/forge'
import { KitDressing, loadKit } from '@gb/kitbash'
import { buildCity, type Dressing } from '@gb/scene'
import { inPlotBand, plotShape } from '@gb/world'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type * as THREE from 'three'
import { PrefabDressing } from '../src/dressing.ts'
import { flag } from './args.ts'
import { readPack, scenesOf } from './headless.ts'

const DIST = process.env['GB_ASSETS_DIST'] ?? join(resolve(import.meta.dirname, '../../..'), 'assets/dist')

const args = process.argv.slice(2)
const seed = flag(args, '--seed') ?? 'metro'
const blocks = Number(flag(args, '--blocks') ?? 20)
const storeys = flag(args, '--storeys')
const mode = flag(args, '--mode') ?? 'lod'
const dressed = flag(args, '--dressing') ?? 'prefab'

/** What one call to the dressing landed in the city, and what it cost. */
class Tally {
  triangles = 0
  meshes = 0
  calls = 0
  ms = 0
  readonly materials = new Set<string>()

  /** Times one call and reads what it answered. */
  of(build: () => THREE.Object3D): THREE.Object3D {
    const at = performance.now()
    const object = build()
    this.ms += performance.now() - at
    this.calls++
    object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      this.meshes++
      this.triangles += (mesh.geometry.getIndex()?.count ?? mesh.geometry.getAttribute('position').count) / 3
      this.materials.add((mesh.material as THREE.Material).name)
    })
    return object
  }
}

const shells = new Tally()
const buildings = new Tally()

/** A dressing with a shell on it, which is both of the ones measured here. */
type Streaming = Required<Pick<Dressing, 'shell' | 'lights'>> & Dressing

/** The dressing under measurement, counted, with its shell hidden when the mode says so. */
function counted(inner: Streaming, lod: boolean): Dressing {
  const dressing: Dressing = {
    building: (plot, size, charter) => buildings.of(() => inner.building(plot, size, charter)),
    lights: (plot, size, charter) => inner.lights(plot, size, charter),
    prop: (prop) => inner.prop(prop),
    character: (npc, doing) => inner.character(npc, doing),
    pickup: (item) => inner.pickup(item),
    ground: (kind) => inner.ground(kind),
    surface: (part, size) => inner.surface(part, size),
  }
  if (!lod) return dressing
  return { ...dressing, shell: (plot, size, charter) => shells.of(() => inner.shell(plot, size, charter)) }
}

// three reaches for browser globals while decoding the kit's textures; the geometry does not need them
const globals = globalThis as Record<string, unknown>
globals.self ??= globalThis
globals.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

// one clock for the whole city, the way the game wires it: the kit owns it and the pack reads it
const kit = loadKit(await scenesOf(pathToFileURL(join(DIST, 'downtown-kit.glb'))))
const library = await readPack(kit.night)
const behind = new KitDressing(kit)
const dressing: Streaming = dressed === 'kit' ? behind : new PrefabDressing(library, behind)

// the brief's own default unless asked otherwise, so the town measured is the town the game builds, skyline and all
const built = await new Forge(new OfflineNarrator(seed)).build({ theme: 'a neon port city', seed, blocksX: blocks, blocksY: blocks, density: 1, ...(storeys ? { maxStoreys: Number(storeys) } : {}) })
if (!built.ok) throw new Error(`the forge refused: ${JSON.stringify(built.error)}`)
const world = built.value.world

const at = performance.now()
const city = buildCity(world, counted(dressing, mode === 'lod'))
const open = performance.now() - at

const batches = city.root.children.filter((child) => child.name.startsWith('city:') || child.name.startsWith('detail:'))
const materials = new Set([...shells.materials, ...buildings.materials])
const rounded = (value: number) => Math.round(value).toLocaleString('en-GB')

const plots = [...world.plots()]
const towers = plots.filter((plot) => !inPlotBand(plotShape(plot)))
console.log(`${blocks} by ${blocks} blocks, ${dressed} ${mode}: ${plots.length} plots, ${towers.length} over the band (tallest ${Math.max(...plots.map((plot) => plot.storeys))} storeys), pack ${library.catalogue.version}`)
console.log(`  open ${rounded(open)} ms, of it ${rounded(shells.ms + buildings.ms)} ms in the dressing, rss ${rounded(process.memoryUsage().rss / 1e6)} MB`)
console.log(`  shells: ${rounded(shells.calls)} built, ${rounded(shells.triangles)} triangles, ${rounded(shells.meshes)} meshes`)
console.log(`  buildings: ${rounded(buildings.calls)} built, ${rounded(buildings.triangles)} triangles, ${rounded(buildings.meshes)} meshes`)
console.log(`  ${materials.size} materials: ${[...materials].join(', ')}`)
console.log(`  ${batches.length} building draws: ${batches.map((batch) => batch.name).join(', ')}`)
