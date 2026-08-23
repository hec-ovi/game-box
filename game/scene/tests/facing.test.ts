import { FACINGS, World, type Anchor, type Facing, type Furniture, type Npc, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, buildInterior, Greybox, storeyHeight } from '../src/index.ts'
import { bar } from './bar.ts'

/** The compass the world stores headings in: 0 north, 90 east, clockwise seen from above. */
const COMPASS = [
  { heading: 0, side: 'north', front: { x: 0, z: -1 } },
  { heading: 90, side: 'east', front: { x: 1, z: 0 } },
  { heading: 180, side: 'south', front: { x: 0, z: 1 } },
  { heading: 270, side: 'west', front: { x: -1, z: 0 } },
] as const

const AWAY: Record<Facing, { x: number; z: number }> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
  east: { x: 1, z: 0 },
}

/** Where a direction points, to the millimetre, named so a failure says which way it went wrong. */
function pointing(side: string, x: number, z: number): string {
  const round = (n: number) => Math.round(n * 1000) / 1000
  return `${side} ${round(x)} ${round(z)}`
}

/** Which way the front of this object points, read off its transform and not off the number that made it. */
function frontOf(object: THREE.Object3D): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()))
}

/** One plot in the middle of town, its door on the side named, and the pavement cell in front of it. */
function plotFacing(facing: Facing): { world: World; plot: Plot } {
  const world = World.create({ name: 'Facing', theme: 'test', seed: facing, width: 12, height: 12 })
  const rect = { x: 4, y: 4, w: 3, h: 3 }
  const cell = {
    x: rect.x + 1 + AWAY[facing].x * 2,
    y: rect.y + 1 + AWAY[facing].z * 2,
  }
  const plot = world.addPlot({ kind: 'shop', name: 'Shop', rect, entrance: { cell, facing }, storeys: 1, style: 'plain' })
  if (!plot.ok) throw new Error(plot.error.code)
  return { world, plot: plot.value }
}

describe('which way things point', () => {
  it('turns a stored compass heading into the way a piece of furniture actually faces', () => {
    const furniture: Furniture[] = COMPASS.map((point, index) => ({
      id: `prop_${index}`,
      prop: 'chair',
      roomId: 'room_1',
      pos: { x: 2 + index, y: 4 },
      rot: point.heading,
    }))
    const { world, interior } = bar(furniture, [])
    const build = buildInterior(world, interior, new Greybox())

    for (const [index, point] of COMPASS.entries()) {
      const front = frontOf(build.props.get(`prop_${index}`)!)
      expect(pointing(point.side, front.x, front.z)).toBe(pointing(point.side, point.front.x, point.front.z))
    }
  })

  it('turns an anchor the same way, so whoever stands on it faces where the plan says', () => {
    const anchors: Anchor[] = COMPASS.map((point, index) => ({
      id: `anchor_${index}`,
      kind: 'stand',
      roomId: 'room_1',
      pos: { x: 2 + index, y: 4 },
      rot: point.heading,
    }))
    const { world, interior } = bar([], anchors)
    const build = buildInterior(world, interior, new Greybox())

    for (const [index, point] of COMPASS.entries()) {
      const front = frontOf(build.anchors.get(`anchor_${index}`)!)
      expect(pointing(point.side, front.x, front.z)).toBe(pointing(point.side, point.front.x, point.front.z))
    }
  })

  it('stands the bartender facing the bar, not with their back to it', () => {
    const counter: Furniture = { id: 'prop_bar', prop: 'bar-counter', roomId: 'room_1', pos: { x: 5, y: 4 }, rot: 270 }
    // the anchor is west of the counter, so the heading that looks at it is east
    const serving: Anchor = { id: 'anchor_bar', kind: 'serve', roomId: 'room_1', pos: { x: 4, y: 4 }, rot: 90, propId: counter.id }
    const bartender: Npc = {
      id: 'npc_1',
      name: 'Mara',
      role: 'bartender',
      appearance: { base: 'female', variant: 1 },
      station: { interiorId: 'interior_1', anchorId: serving.id },
      personality: 'Pours and listens.',
      knowledge: [],
    }
    const { world, interior } = bar([counter], [serving], [bartender])
    const build = buildInterior(world, interior, new Greybox())

    const toCounter = new THREE.Vector3(counter.pos.x - serving.pos.x, 0, counter.pos.y - serving.pos.y).normalize()
    expect(frontOf(build.people.get('npc_1')!).dot(toCounter)).toBeCloseTo(1, 5)
    expect(frontOf(build.anchors.get(serving.id)!).dot(toCounter)).toBeCloseTo(1, 5)
  })

  it('puts the front door and the doorstep on the side the entrance names', () => {
    for (const facing of FACINGS) {
      const { world, plot } = plotFacing(facing)
      const city = buildCity(world, new Greybox())
      const building = city.buildings.get(plot.id)!
      const away = new THREE.Vector3(AWAY[facing].x, 0, AWAY[facing].z)
      const centre = building.bounds.getCenter(new THREE.Vector3())

      // the dressing puts the door on that wall
      const size = { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: storeyHeight(plot.storeys) }
      const door = new Greybox().building(plot, size).getObjectByName(`${plot.id}:door`)!
      const out = door.position.clone().setY(0).normalize()
      expect(`${facing} ${out.dot(away).toFixed(3)}`).toBe(`${facing} 1.000`)

      // and the city puts the doorstep out in front of it
      const toStep = city.doorsteps.get(plot.id)!.clone().sub(centre).setY(0).normalize()
      expect(`${facing} ${toStep.dot(away).toFixed(3)}`).toBe(`${facing} 1.000`)
    }
  })

  it('starts the player looking at the door, whichever way the door faces', () => {
    for (const facing of FACINGS) {
      const { world, plot } = plotFacing(facing)
      const city = buildCity(world, new Greybox())
      const doorstep = city.doorsteps.get(plot.id)!

      // the spawn heading is a three.js yaw, the way the app turns its camera
      const look = new THREE.Vector3(-Math.sin(city.spawn.heading), 0, -Math.cos(city.spawn.heading))
      const toDoor = new THREE.Vector3(doorstep.x - city.spawn.x, 0, doorstep.z - city.spawn.z).normalize()
      expect(`${facing} ${look.dot(toDoor).toFixed(3)}`).toBe(`${facing} 1.000`)
    }
  })
})
