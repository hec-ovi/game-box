import { cellCentre, METRICS, World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DISTRICT } from '../src/street/districts.ts'
import { GROUP, LAMP_ATTRIBUTES } from '../src/street/lamp/design.ts'
import { lampGeometry } from '../src/street/lamp/model.ts'
import { lampsFor } from '../src/street/lamp/variants.ts'
import { KitDressing, lampSpots, LAMP_SPACING, placeholderKit, STREETLIGHT } from '../src/index.ts'

/** A block of buildings with a pavement round it and a road round that. */
function town(seed = 'street', side = 40): World {
  const world = World.create({ name: 'street', theme: 'test', seed, width: side, height: side })
  world.paint({ x: 2, y: 2, w: side - 4, h: side - 4 }, 'street')
  world.paint({ x: 4, y: 4, w: side - 8, h: side - 8 }, 'sidewalk')
  world.paint({ x: 5, y: 5, w: side - 10, h: side - 10 }, 'building')
  return world
}

const lamps = (world: World, dressing: KitDressing): THREE.Mesh[] => {
  const found: THREE.Mesh[] = []
  dressing.streetlights(world).traverse((child) => { if (child instanceof THREE.Mesh) found.push(child) })
  return found
}

const postsOf = (drawn: readonly THREE.Mesh[]): THREE.InstancedMesh[] =>
  drawn.filter((mesh) => mesh.name.startsWith('kit:streetlights:posts:')) as THREE.InstancedMesh[]

describe('street lamps', () => {
  const world = town()
  const dressing = new KitDressing(placeholderKit())

  it('draws the posts a district at a time and every halo in one buffer', () => {
    const drawn = lamps(world, dressing)
    const spots = lampSpots(world)
    const posts = postsOf(drawn)
    const haloes = drawn.filter((mesh) => mesh.name === 'kit:streetlights:halo')

    expect(spots.length).toBeGreaterThan(8)
    expect(haloes).toHaveLength(1)
    expect(posts.length + 1).toBe(drawn.length)
    // every lamp stands in exactly one district, and every one has its glow
    expect(posts.reduce((total, mesh) => total + mesh.count, 0)).toBe(spots.length)
    expect((haloes[0]!.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(spots.length)
    // and one material for the lot, whatever the town is
    expect(new Set(drawn.map((mesh) => mesh.material as THREE.Material)).size).toBe(2)
    // one set of vertices too: a district carries its own lamps, not its own lamp
    expect(new Set(posts.map((mesh) => mesh.geometry.getAttribute('position'))).size).toBe(1)
  })

  it('gives each district a volume the frustum can throw away', () => {
    const posts = postsOf(lamps(world, dressing))
    const across = new THREE.Box3().setFromObject(dressing.streetlights(world)).getSize(new THREE.Vector3()).length()

    expect(posts.length, 'a town this size is more than one district').toBeGreaterThan(1)
    expect(across, 'and it is wider than a district').toBeGreaterThan(DISTRICT * 2)
    for (const mesh of posts) {
      // a district's lamps reach across that district, never across the town
      expect(mesh.boundingSphere!.radius, mesh.name).toBeLessThan(DISTRICT)
    }
  })

  it('stands them on the pavement at the kerb, never in the road', () => {
    const cell = world.cellSize
    for (const spot of lampSpots(world)) {
      const [x, y] = [Math.floor(spot.x / cell), Math.floor(spot.z / cell)]
      expect(world.grid.at(x, y), `${x},${y}`).toBe('sidewalk')

      // pulled off the middle of the cell toward the road it lights, and still
      // standing clear of the kerb by the whole width of its own shoe
      const centre = cellCentre(x, y, cell)
      const reach = Math.hypot(spot.x - centre.x, spot.z - centre.z)
      expect(reach).toBeCloseTo(cell / 2 - 0.55, 6)
      expect(cell / 2 - reach).toBeGreaterThan(STREETLIGHT.mast.footRadius)
    }
  })

  it('lights every kerb, and no denser than it was asked for', () => {
    const perimeter = 4 * 32 * METRICS.cellSize // the pavement ring of the town above
    const spots = lampSpots(world)

    expect(spots.length).toBeLessThanOrEqual(Math.ceil(perimeter / LAMP_SPACING) + 4)
    // widening the spacing thins them out rather than moving them somewhere else
    expect(lampSpots(world, LAMP_SPACING * 3).length).toBeLessThan(spots.length)
  })

  it('puts the same lamps, of the same kinds, in the same districts every run', () => {
    const read = (built: World): string[] => postsOf(lamps(built, new KitDressing(placeholderKit())))
      .map((mesh) => [
        mesh.name,
        [...mesh.instanceMatrix.array].map((value) => Math.round(value * 1e6)).join(','),
        [...(mesh.geometry.getAttribute(LAMP_ATTRIBUTES.variant).array as Float32Array)].map((value) => Math.round(value * 1e6)).join(','),
      ].join(' '))

    expect(read(town())).toEqual(read(world))
    // and a different city is a different street
    expect(read(town('elsewhere'))).not.toEqual(read(world))
  })

  it('builds a street of lamps that are not all the same lamp', () => {
    const wide = town('wide', 200)
    const built = lampsFor(lampSpots(wide), wide.seed)
    const share = (group: number): number => built.filter((lamp) => (lamp.kit & 2 ** (group - 1)) !== 0).length / built.length

    expect(built.length).toBeGreaterThan(40)
    // most lean a head out over the road, the rest are a lit line up the column
    expect(share(GROUP.head)).toBeGreaterThan(0.5)
    expect(share(GROUP.head) + share(GROUP.strip)).toBe(1)
    // and some, never all, carry something else
    for (const group of [GROUP.strip, GROUP.camera, GROUP.box]) {
      expect(share(group), `group ${group}`).toBeGreaterThan(0.1)
      expect(share(group), `group ${group}`).toBeLessThan(0.9)
    }
    expect(new Set(built.map((lamp) => Math.round(lamp.scale * 100))).size).toBeGreaterThan(4)
  })

  it('draws one lamp for the city, with every fitting on it and a tag on every vertex', () => {
    const geometry = lampGeometry()
    const part = geometry.getAttribute(LAMP_ATTRIBUTES.part)
    const group = geometry.getAttribute(LAMP_ATTRIBUTES.group)
    const bounds = geometry.computeBoundingBox() ?? geometry.boundingBox!

    expect(part.count).toBe(geometry.getAttribute('position').count)
    expect(group.count).toBe(part.count)
    // every fitting the material can collapse is actually in the buffer
    const groups = new Set(Array.from(group.array as Float32Array))
    expect(groups).toEqual(new Set(Object.values(GROUP)))
    // it stands on the pavement and leans over the road
    expect(bounds.min.y).toBeCloseTo(0, 3)
    expect(bounds.max.y).toBeGreaterThan(STREETLIGHT.mast.height)
    expect(bounds.max.z).toBeGreaterThan(STREETLIGHT.arm.reach)
    expect(bounds.min.z).toBeGreaterThan(-1)
    // and it is cheap enough that a town of them is not the frame
    expect(geometry.getIndex()!.count / 3).toBeLessThan(200)
  })

  it('lights the streets of a kit that has no lamp art in it, and leaves a town with no kerb dark', () => {
    // the lamp is drawn from code, so it does not matter what the pack carries
    expect(postsOf(lamps(world, dressing)).length).toBeGreaterThan(0)

    const empty = World.create({ name: 'empty', theme: 'test', seed: 'empty', width: 20, height: 20 })
    expect(lamps(empty, dressing)).toHaveLength(0)
  })
})
