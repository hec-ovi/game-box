import { Forge, OfflineNarrator } from '@gb/forge'
import { METRICS, type World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, buildInterior, Greybox, storeyHeight } from '../src/index.ts'

async function town(): Promise<World> {
  const built = await new Forge(new OfflineNarrator('scene')).build({
    theme: 'quiet coastal town',
    seed: 'scene',
    blocksX: 1,
    blocksY: 1,
    blockCells: 14,
  })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  return built.value.world
}

function boundsOf(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object)
}

describe('buildCity', () => {
  it('puts every building where the grid says, at the size the plot says', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())

    expect(city.buildings.size).toBe(world.plots().length)
    for (const plot of world.plots()) {
      const object = city.buildings.get(plot.id)!
      const bounds = boundsOf(object)
      const size = bounds.getSize(new THREE.Vector3())

      expect(size.x).toBeCloseTo(plot.rect.w * world.cellSize, 1)
      expect(size.z).toBeCloseTo(plot.rect.h * world.cellSize, 1)
      expect(size.y).toBeCloseTo(storeyHeight(plot.storeys), 1)
      // sitting on the ground, not floating or sunk
      expect(bounds.min.y).toBeCloseTo(0, 1)
    }
  })

  it('gives every building a doorstep on the pavement in front of it', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())

    for (const plot of world.plots()) {
      const doorstep = city.doorsteps.get(plot.id)!
      const expected = {
        x: (plot.entrance.cell.x + 0.5) * world.cellSize,
        z: (plot.entrance.cell.y + 0.5) * world.cellSize,
      }
      expect(doorstep.x).toBeCloseTo(expected.x, 5)
      expect(doorstep.z).toBeCloseTo(expected.z, 5)
      // and it is right next to the building it belongs to
      expect(boundsOf(city.buildings.get(plot.id)!).distanceToPoint(doorstep)).toBeLessThan(world.cellSize * 1.5)
    }
  })

  it('lays the ground once per surface instead of once per cell', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())

    const ground = city.root.children.filter((child) => child.name.startsWith('ground:'))
    expect(ground.map((g) => g.name).sort()).toEqual(['ground:empty', 'ground:sidewalk', 'ground:street'])

    const street = ground.find((g) => g.name === 'ground:street') as THREE.Mesh
    const cells = world.grid.count('street')
    expect(street.geometry.getAttribute('position').count).toBe(cells * 6)

    // the pavement stands proud of the road, as a kerb does
    const sidewalk = ground.find((g) => g.name === 'ground:sidewalk') as THREE.Mesh
    expect(boundsOf(sidewalk).max.y).toBeCloseTo(METRICS.street.curbHeight, 3)
  })

  it('rings the valley in mountains, as one instanced block per cell', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())

    const mountains = city.root.getObjectByName('mountains') as THREE.InstancedMesh
    expect(mountains).toBeDefined()
    expect(mountains.count).toBe(world.grid.count('mountain'))
    expect(boundsOf(mountains).max.y).toBeGreaterThan(20)
  })
})

describe('buildInterior', () => {
  it('builds a room you can stand in, with the furniture and the anchors where the plan puts them', async () => {
    const world = await town()
    const interior = world.interiors().find((i) => i.anchors.length > 0 && i.furniture.length > 0)!
    const build = buildInterior(world, interior, new Greybox())

    expect(build.anchors.size).toBe(interior.anchors.length)
    expect(build.props.size).toBe(interior.furniture.length)

    for (const anchor of interior.anchors) {
      const spot = build.anchors.get(anchor.id)!
      expect(spot.position.x).toBeCloseTo(anchor.pos.x, 5)
      expect(spot.position.z).toBeCloseTo(anchor.pos.y, 5)
      expect(spot.userData.kind).toBe(anchor.kind)
    }
    for (const piece of interior.furniture) {
      const prop = build.props.get(piece.id)!
      expect(prop.position.x).toBeCloseTo(piece.pos.x, 5)
      expect(prop.position.z).toBeCloseTo(piece.pos.y, 5)
      // standing on the floor
      expect(boundsOf(prop).min.y).toBeCloseTo(0, 2)
    }

    const floor = build.root.getObjectByName('floor')!
    const floorSize = boundsOf(floor).getSize(new THREE.Vector3())
    expect(floorSize.x).toBeCloseTo(interior.size.w, 1)
    expect(floorSize.z).toBeCloseTo(interior.size.h, 1)
    expect(boundsOf(build.root).max.y).toBeCloseTo(METRICS.building.groundFloorHeight, 1)
  })

  it('leaves a gap in the wall where a door is', async () => {
    const world = await town()
    const interior = world.interiors()[0]!
    const build = buildInterior(world, interior, new Greybox())
    const door = interior.doors.find((d) => d.from === 'outside')!

    const walls = build.root.children.filter((child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry)
    const blocking = walls.filter((wall) => {
      const bounds = boundsOf(wall)
      return bounds.min.y < 1 && bounds.containsPoint(new THREE.Vector3(door.pos.x, 1, door.pos.y))
    })
    expect(blocking).toEqual([])
    expect(build.entrance.x).toBeCloseTo(door.pos.x, 5)
  })
})
