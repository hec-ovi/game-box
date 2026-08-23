import { METRICS, World, type CellKind } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, Greybox, MARKING, type Marking } from '../src/index.ts'
import { town } from './town.ts'

/**
 * One straight street between two junctions. A pavement run crosses the
 * roadway at the west junction and there is none at the east one, so the same
 * street answers both "does a crossing appear" and "does one appear anyway".
 */
function street(): World {
  const world = World.create({ name: 'Paint Street', theme: 'test', seed: 'paint', width: 32, height: 12 })
  world.paint({ x: 0, y: 4, w: 32, h: 3 }, 'street')
  // a pavement run from one side of town to the other, over the road
  world.paint({ x: 7, y: 0, w: 1, h: 12 }, 'sidewalk')
  world.addRoad(
    [
      { id: 'node_0001', cell: { x: 5, y: 5 } },
      { id: 'node_0002', cell: { x: 26, y: 5 } },
    ],
    [{ id: 'road_0001', from: 'node_0001', to: 'node_0002', kind: 'street', lanes: 2 }],
  )
  return world
}

/** The roadway of that street, in metres: rows 4 to 6 of a 2 m grid. */
const ROADWAY = { width: 6, centre: 11 }

/** Where a marking's corners and middle land, a millimetre inside it: paint that stops on a kerb line is still on the road. */
function footprint(marking: Marking): Array<{ x: number; z: number }> {
  const points: Array<{ x: number; z: number }> = []
  const cos = Math.cos(marking.rot)
  const sin = Math.sin(marking.rot)
  const edge = 0.499
  for (let u = -edge; u <= edge; u += edge / 2) {
    for (let v = -edge; v <= edge; v += edge / 4) {
      const alongWidth = u * marking.width
      const alongLength = v * marking.length
      points.push({
        x: marking.x + alongWidth * cos + alongLength * sin,
        z: marking.z - alongWidth * sin + alongLength * cos,
      })
    }
  }
  return points
}

function kindsUnder(world: World, marking: Marking): Set<CellKind | undefined> {
  const kinds = new Set<CellKind | undefined>()
  for (const point of footprint(marking)) {
    kinds.add(world.grid.at(Math.floor(point.x / world.cellSize), Math.floor(point.z / world.cellSize)))
  }
  return kinds
}

function of(markings: readonly Marking[], kind: Marking['kind']): Marking[] {
  return markings.filter((marking) => marking.kind === kind)
}

function meshes(city: { root: THREE.Group }): THREE.InstancedMesh[] {
  return city.root.children.filter((child): child is THREE.InstancedMesh => child.name.startsWith('markings:'))
}

describe('street markings', () => {
  it('lays every marking on the roadway and nowhere else', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())
    const off = new Set<string>()

    for (const marking of city.markings) {
      for (const kind of kindsUnder(world, marking)) {
        if (kind !== 'street') off.add(`${marking.kind} on ${kind}`)
      }
    }
    expect([...off]).toEqual([])
    // and the city really did give it all four kinds to place
    expect(new Set(city.markings.map((marking) => marking.kind))).toEqual(
      new Set(['centre-line', 'edge-line', 'crossing', 'stop-bar']),
    )
  })

  it('crosses the road where a pavement run meets it, and leaves the junction with none bare of paint', () => {
    const city = buildCity(street(), new Greybox())
    const crossings = of(city.markings, 'crossing')
    const west = crossings.filter((marking) => marking.x < 20)

    // the pavement runs over the road at the west junction: bars from kerb to kerb there
    expect(west.length).toBe(crossings.length)
    expect(west.length).toBeGreaterThan(4)
    const across = west.map((marking) => marking.z).sort((a, b) => a - b)
    expect(across[0]).toBeGreaterThan(ROADWAY.centre - ROADWAY.width / 2)
    expect(across[across.length - 1]).toBeLessThan(ROADWAY.centre + ROADWAY.width / 2)

    // the east junction has no pavement anywhere near it and gets no crossing
    expect(crossings.filter((marking) => marking.x > 40)).toEqual([])
    // both junctions still get a stop bar: a car stops there whether or not anybody crosses
    expect(of(city.markings, 'stop-bar').length).toBe(2)
  })

  it('paints the sizes a real street has, off the grid it is laid on', () => {
    const city = buildCity(street(), new Greybox())

    for (const line of [...of(city.markings, 'centre-line'), ...of(city.markings, 'edge-line')]) {
      expect(line.width).toBeGreaterThanOrEqual(0.1)
      expect(line.width).toBeLessThanOrEqual(0.15)
    }

    // the two edge lines stand inside the kerbs of a roadway the grid says is 6 m
    const edges = of(city.markings, 'edge-line').map((line) => line.z)
    const span = Math.max(...edges) - Math.min(...edges)
    expect(span).toBeLessThan(ROADWAY.width)
    expect(span).toBeGreaterThan(ROADWAY.width - 0.6)

    // the middle is yellow, because the two directions meet there, and nothing else is
    expect(new Set(city.markings.filter((m) => m.paint === 'yellow').map((m) => m.kind))).toEqual(new Set(['centre-line']))
    for (const line of of(city.markings, 'centre-line')) {
      expect(Math.abs(line.z - ROADWAY.centre)).toBeLessThan(0.2)
    }

    // a crossing is bars a stride wide with a stride between them
    const bars = of(city.markings, 'crossing')
      .map((bar) => bar.z)
      .sort((a, b) => a - b)
    for (const bar of of(city.markings, 'crossing')) expect(bar.width).toBeCloseTo(MARKING.stripeWidth, 6)
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i]! - bars[i - 1]!).toBeCloseTo(MARKING.stripeWidth + MARKING.stripeGap, 6)
    }
  })

  it('stops the traffic that is arriving, on the half of the road it drives on', () => {
    const city = buildCity(street(), new Greybox())
    const bars = of(city.markings, 'stop-bar').sort((a, b) => a.x - b.x)

    // right hand traffic: heading west into the west junction you are on the north half
    expect(bars[0]!.z).toBeLessThan(ROADWAY.centre)
    // and heading east into the east junction you are on the south half
    expect(bars[1]!.z).toBeGreaterThan(ROADWAY.centre)
    // each bar stops short of the middle, leaving the oncoming half clear
    for (const bar of bars) expect(Math.abs(bar.z - ROADWAY.centre)).toBeGreaterThan(bar.width / 2)
  })

  it('costs one draw for each paint, however many streets the city has', async () => {
    const small = buildCity(street(), new Greybox())
    const city = buildCity(await town(), new Greybox())

    for (const built of [small, city]) {
      expect(meshes(built).map((mesh) => mesh.name)).toEqual(['markings:white', 'markings:yellow'])
      const instances = meshes(built).reduce((total, mesh) => total + mesh.count, 0)
      expect(instances).toBe(built.markings.length)
    }
    // a whole city is many times the paint of one street and not one draw more
    expect(city.markings.length).toBeGreaterThan(small.markings.length * 4)
  })

  it('stands the paint above the road without standing it on the kerb', () => {
    const city = buildCity(street(), new Greybox())
    for (const marking of city.markings) {
      expect(marking.y).toBeGreaterThan(0)
      expect(marking.y).toBeLessThan(METRICS.street.curbHeight)
    }

    // and what is drawn is what was planned: the same rectangle, at the same lift
    const white = meshes(city).find((mesh) => mesh.name === 'markings:white')!
    const planned = city.markings.filter((marking) => marking.paint === 'white')
    const matrix = new THREE.Matrix4()
    const at = new THREE.Vector3()
    const size = new THREE.Vector3()
    for (let i = 0; i < white.count; i++) {
      white.getMatrixAt(i, matrix)
      at.setFromMatrixPosition(matrix)
      matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), size)
      expect(at.y).toBeCloseTo(MARKING.lift, 6)
      expect(size.x).toBeCloseTo(planned[i]!.width, 6)
      expect(size.z).toBeCloseTo(planned[i]!.length, 6)
    }
  })
})
