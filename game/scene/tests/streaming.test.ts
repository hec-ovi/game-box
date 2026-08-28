import type { Plot, ResolvedCharter, World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, Greybox, type BuildingSize, type BuildingStep, type CityBuild, type CityOptions, type Dressing, type LightEmitter } from '../src/index.ts'
import { drawn, inView, looking } from './seen.ts'
import { otherTown, town } from './town.ts'

/**
 * Streaming a city round the player, judged the way a camera judges it.
 *
 * A dressing decides what a building looks like; it never decides whether there
 * is one. So whatever it publishes, a camera standing anywhere in the town and
 * turned any way draws every building its frustum reaches, and no light burns
 * over ground its building is not on.
 *
 * The camera is the whole point of the test. A ray ignores the frustum and a
 * `BatchedMesh` culls each instance against its own bounds, so a town can be
 * culled off the screen entirely and still answer every ray: what is measured
 * here is what three would put in the draw.
 */

/**
 * A greybox that draws a building the way a kit does: a lit sign and its panes
 * on materials of their own, so a near building lands in several batches and
 * each of them is small enough to have to grow as the player walks.
 */
class Kit extends Greybox {
  readonly #sign = new THREE.MeshStandardMaterial({ color: 0x40e0ff, emissive: 0x40e0ff, name: 'sign' })
  readonly #pane = new THREE.MeshStandardMaterial({ color: 0x203040, emissive: 0x506070, name: 'pane' })

  override building(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const group = super.building(plot, size, charter)
    for (let storey = 0; storey < plot.storeys; storey++) {
      const y = 3 * storey + 2.5
      const sign = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.6, 0.6, 0.1), this.#sign)
      sign.position.set(0, y, -size.depth / 2 - 0.1)
      group.add(sign)
      for (let pane = -1; pane <= 1; pane++) {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.05), this.#pane)
        glass.position.set(pane * 2.5, y + 0.5, -size.depth / 2)
        group.add(glass)
      }
    }
    return group
  }

  override lights(plot: Plot, size: BuildingSize): readonly LightEmitter[] {
    return [...super.lights(plot, size), { kind: 'sign', position: [0, 2.5, -size.depth / 2 - 0.3], colour: 0x40e0ff, intensity: 30, radius: 12 }]
  }
}

/** A `Greybox` with one seam member answered differently, the way a wrapper does. */
function greyboxWith(over: Partial<Dressing>): Dressing {
  const grey = new Greybox()
  return {
    building: (plot, size, charter) => grey.building(plot, size, charter),
    shell: (plot, size, charter) => grey.shell(plot, size, charter),
    lights: (plot, size) => grey.lights(plot, size),
    prop: (prop) => grey.prop(prop),
    character: (npc, doing) => grey.character(npc, doing),
    pickup: (item) => grey.pickup(item),
    ground: (kind) => grey.ground(kind),
    surface: (part) => grey.surface(part),
    ...over,
  }
}

/** A dressing that does not carry a far look at all. */
function withoutShell(): Dressing {
  const dressing = greyboxWith({})
  delete dressing.shell
  return dressing
}

/** Every way a dressing can answer, and which of the three steps that leaves a building standing at. */
const CHAINS: ReadonlyArray<{ how: string; dressing: () => Dressing; stands: BuildingStep[] }> = [
  { how: 'publishes a shell', dressing: () => new Greybox(), stands: ['massing', 'shell', 'detail'] },
  // no near ring at all, so the far one draws the whole building
  { how: 'publishes no shell at all', dressing: withoutShell, stands: ['massing', 'shell'] },
  { how: 'carries a shell that answers nothing', dressing: () => greyboxWith({ shell: () => undefined as unknown as THREE.Object3D }), stands: ['massing', 'shell', 'detail'] },
  { how: 'carries a shell that answers an empty object', dressing: () => greyboxWith({ shell: () => new THREE.Group() }), stands: ['massing', 'shell', 'detail'] },
  // nothing to dress a near building in, so it stands as the shell it had
  { how: 'answers an empty object for the whole building', dressing: () => greyboxWith({ building: () => new THREE.Group() }), stands: ['massing', 'shell'] },
  { how: 'draws a building out of several materials, the way a kit does', dressing: () => new Kit(), stands: ['massing', 'shell', 'detail'] },
]

/** Where the player stands, crossing the town cell by cell: east along the middle, then south down it. */
function* walk(world: World): Generator<{ x: number; z: number }> {
  const step = world.cellSize * 3
  const width = world.grid.width * world.cellSize
  const depth = world.grid.height * world.cellSize
  for (let x = step; x < width; x += step) yield { x, z: depth / 2 }
  for (let z = step; z < depth; z += step) yield { x: width / 2, z }
}

/** Turning on the spot: the owner's frames are seconds apart from one place. */
const TURNS = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
const PITCHES = [0, 0.5, -0.35, 0.25]

/**
 * How far the rings reach. The towns here are a couple of hundred metres
 * across, so the published radii would put the whole of one inside the shell
 * ring and never draw a massing; the tight pair puts all three steps on screen
 * at once, which is the case a camera can catch out.
 */
const RINGS: ReadonlyArray<CityOptions> = [{}, { detail: 16, shell: 48 }]

describe('streaming a city round the player', () => {
  for (const chain of CHAINS) {
    it(`draws every building a camera reaches, and lights only the ones it draws, when the dressing ${chain.how}`, () => {
      const stood = new Set<string>()
      for (const [world, rings] of [town(), otherTown()].flatMap((one) => RINGS.map((how) => [one, how] as const))) {
        const city = buildCity(world, chain.dressing(), { clutter: false, ...rings })
        expect(world.plots().length).toBeGreaterThan(0)

        for (const at of [{ x: city.spawn.x, z: city.spawn.z }, ...walk(world)]) {
          city.follow(at.x, at.z)
          for (const building of city.buildings.values()) stood.add(building.step)
          for (const [turn, yaw] of TURNS.entries()) {
            const camera = looking(at.x, at.z, yaw, PITCHES[turn]!)
            const where = `${world.id} from ${at.x.toFixed(0)},${at.z.toFixed(0)} facing ${((yaw * 180) / Math.PI).toFixed(0)}`
            const drawing = drawn(city, camera)
            for (const plotId of inView(city, camera)) {
              expect(drawing.has(plotId), `${plotId} is in view and not drawn, ${where}`).toBe(true)
            }
          }
          // a light burning over ground its building is not on is what the player sees first
          for (const light of city.lights.lights) {
            if (!light.visible) continue
            const plotId = (light.userData['emitter'] as { plotId: string }).plotId
            const camera = looking(at.x, at.z, 0)
            camera.lookAt(light.position)
            camera.updateMatrixWorld(true)
            expect(drawn(city, camera).has(plotId), `a light burns over the undrawn ${plotId}, ${world.id} at ${at.x.toFixed(0)},${at.z.toFixed(0)}`).toBe(true)
          }
        }
      }
      // a walk that never drew a massing would prove nothing about the far field
      expect(stood).toEqual(new Set(chain.stands))
    })
  }

  it('never swaps the buffers a batch is drawn through without telling the renderer', () => {
    const world = otherTown()
    const city = buildCity(world, new Kit(), { clutter: false, detail: 16, shell: 48 })
    new THREE.Scene().add(city.root)

    let grew = 0
    let before = readings(city)
    for (const at of [...walk(world)].flatMap((one, index, all) => [one, all[all.length - 1 - index]!])) {
      city.follow(at.x, at.z)
      const after = readings(city)
      for (const [name, now] of after) {
        const was = before.get(name)
        if (!was || was.buffers === now.buffers) continue
        grew++
        expect(now.version, `${name} grew at ${at.x.toFixed(0)},${at.z.toFixed(0)} and the renderer was not told`).not.toBe(was.version)
      }
      before = after
    }
    // a walk that never grew a batch would prove nothing about what growing does
    expect(grew, 'no batch grew on this walk, so nothing was proved').toBeGreaterThan(0)
  })
})

/**
 * What a renderer reads a batch through, and the program version it reads them
 * with. Growing a batch replaces the textures an instance's matrix and its
 * place in the draw order live in; a renderer that captured them into a
 * material's program only looks again when that material's version moves, so a
 * growth that says nothing leaves the batch drawing through what it threw away.
 */
function readings(city: CityBuild): Map<string, { buffers: string; version: number }> {
  const now = new Map<string, { buffers: string; version: number }>()
  for (const child of city.root.children) {
    const batch = child as THREE.BatchedMesh & { _matricesTexture: THREE.Texture; _indirectTexture: THREE.Texture }
    if (!batch.isBatchedMesh) continue
    now.set(batch.name, {
      buffers: `${batch._matricesTexture.uuid}|${batch._indirectTexture.uuid}|${batch.geometry.id}`,
      version: (batch.material as THREE.Material).version,
    })
  }
  return now
}
