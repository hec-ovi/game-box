import { METRICS, type World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, CLEARANCE, CLUTTER, Greybox, MARKING, STEP_OVER_HEIGHT, SURFACE, type ClutterPiece, type Marking } from '../src/index.ts'
import { bigTown, town } from './town.ts'

const KERB = METRICS.street.curbHeight

/** The box a piece really stands in, in world metres. */
function boxOf(piece: ClutterPiece): THREE.Box2 {
  const c = Math.abs(Math.cos(piece.rot))
  const s = Math.abs(Math.sin(piece.rot))
  const x = piece.halfWidth * c + piece.halfDepth * s
  const z = piece.halfWidth * s + piece.halfDepth * c
  return new THREE.Box2(new THREE.Vector2(piece.x - x, piece.z - z), new THREE.Vector2(piece.x + x, piece.z + z))
}

/** The paint a marking covers, in world metres. */
function boxOfMarking(marking: Marking, margin: number): THREE.Box2 {
  const alongZ = Math.abs(Math.cos(marking.rot)) > 0.5
  const x = (alongZ ? marking.width : marking.length) / 2 + margin
  const z = (alongZ ? marking.length : marking.width) / 2 + margin
  return new THREE.Box2(new THREE.Vector2(marking.x - x, marking.z - z), new THREE.Vector2(marking.x + x, marking.z + z))
}

/** How far a point is from the rectangle a piece actually occupies, turned as it stands. */
function metresFrom(piece: ClutterPiece, x: number, z: number): number {
  const local = new THREE.Vector2(x - piece.x, z - piece.z).rotateAround(new THREE.Vector2(), piece.rot)
  const out = new THREE.Vector2(
    Math.max(0, Math.abs(local.x) - piece.halfWidth),
    Math.max(0, Math.abs(local.y) - piece.halfDepth),
  )
  return out.length()
}

function cellsOf(world: World, kind: string): Array<{ x: number; z: number }> {
  const cells: Array<{ x: number; z: number }> = []
  for (let y = 0; y < world.grid.height; y++) {
    for (let x = 0; x < world.grid.width; x++) {
      if (world.grid.at(x, y) === kind) {
        cells.push({ x: (x + 0.5) * world.cellSize, z: (y + 0.5) * world.cellSize })
      }
    }
  }
  return cells
}

describe('what is lying on the street', () => {
  it('never lands on a doorstep, a crossing or the middle of a road', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Greybox())
    const onPaint: string[] = []
    const onDoorstep: string[] = []

    const paint = city.markings
      .filter((marking) => marking.kind !== 'edge-line')
      .map((marking) => boxOfMarking(marking, 0))
    const doorsteps = [...city.doorsteps.values()]

    for (const piece of city.clutter) {
      const box = boxOf(piece)
      // the plain promise, with no margin in it at all: no rubbish on the paint
      if (paint.some((rect) => rect.intersectsBox(box))) onPaint.push(`${piece.kind} at ${piece.x},${piece.z}`)
      for (const doorstep of doorsteps) {
        const step = new THREE.Box2(
          new THREE.Vector2(doorstep.x - CLEARANCE.doorstep, doorstep.z - CLEARANCE.doorstep),
          new THREE.Vector2(doorstep.x + CLEARANCE.doorstep, doorstep.z + CLEARANCE.doorstep),
        )
        if (step.intersectsBox(box)) onDoorstep.push(`${piece.kind} at ${piece.x},${piece.z}`)
      }
    }

    expect(city.clutter.length).toBeGreaterThan(500)
    expect(paint.length).toBeGreaterThan(100)
    expect(onPaint).toEqual([])
    expect(onDoorstep).toEqual([])
  })

  it('leaves the middle of every pavement walkable', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Greybox())
    const tight: string[] = []

    for (const cell of cellsOf(world, 'sidewalk')) {
      for (const piece of city.clutter) {
        if (piece.height <= STEP_OVER_HEIGHT) continue
        if (Math.abs(piece.x - cell.x) > 3 || Math.abs(piece.z - cell.z) > 3) continue
        const gap = metresFrom(piece, cell.x, cell.z)
        if (gap < METRICS.player.radius) tight.push(`${piece.kind} ${gap.toFixed(2)} m from ${cell.x},${cell.z}`)
      }
    }
    expect(tight).toEqual([])
  })

  it('keeps everything that would stop you off the roadway', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Greybox())
    const wrong: string[] = []

    for (const piece of city.clutter) {
      const cell = world.grid.at(Math.floor(piece.x / world.cellSize), Math.floor(piece.z / world.cellSize))
      if (piece.height > STEP_OVER_HEIGHT && cell !== 'sidewalk') wrong.push(`${piece.kind} on ${cell}`)
      // and nothing on the street is tall enough to be a wall
      if (piece.height > 1.2) wrong.push(`${piece.kind} is ${piece.height} m tall`)
    }
    expect(wrong).toEqual([])
  })

  it('stands everything on the ground the grid says, clear of the wet film under it', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())
    const bases = new Set<number>()
    for (const piece of city.clutter) {
      if (piece.kind === 'crate') continue // the only one that stacks
      bases.add(Number(piece.y.toFixed(4)))
    }
    // the roadway and the pavement, each a hair over the film that covers them
    expect([...bases].sort((a, b) => a - b)).toEqual([
      Number((SURFACE.lift + 0.004).toFixed(4)),
      Number((KERB + SURFACE.lift + 0.004).toFixed(4)),
    ])
    for (const piece of city.clutter) expect(piece.y).toBeGreaterThan(SURFACE.lift)
  })

  it('builds the same street twice from the same seed, and a different one from another', async () => {
    const world = await town()
    const build = (seed?: string) => buildCity(world, new Greybox(), seed ? { seed } : {})
    const skin = (city: ReturnType<typeof build>) =>
      Array.from(((city.root.children.find((c) => c.name === 'street:skin') as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute).array)

    const once = build()
    const again = build()
    const other = build('another night')

    expect(once.clutter.length).toBeGreaterThan(20)
    expect(again.clutter).toEqual(once.clutter)
    expect(skin(again)).toEqual(skin(once))
    expect(other.clutter).not.toEqual(once.clutter)
  })

  it('is drawn at the size it publishes, measured off the model rather than declared', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())
    const batch = city.root.children.find((child) => child.name === 'clutter') as THREE.BatchedMesh
    const box = new THREE.Box3()

    for (let at = 0; at < city.clutter.length; at++) {
      const piece = city.clutter[at]!
      batch.getBoundingBoxAt(batch.getGeometryIdAt(at), box)
      const spec = CLUTTER[piece.kind]
      // the model is inside the footprint the piece publishes, within a
      // millimetre: nothing hangs over a rectangle the game says is clear
      expect(box.max.x - box.min.x, piece.kind).toBeLessThanOrEqual(spec.width + 0.001)
      expect(box.max.z - box.min.z, piece.kind).toBeLessThanOrEqual(spec.depth + 0.001)
      expect(box.max.y, piece.kind).toBeLessThanOrEqual(spec.height + 0.001)
      // and it is drawn where the piece says it is
      const at3 = new THREE.Matrix4()
      batch.getMatrixAt(at, at3)
      const where = new THREE.Vector3().setFromMatrixPosition(at3)
      expect(where.x).toBeCloseTo(piece.x, 5)
      expect(where.y).toBeCloseTo(piece.y, 5)
      expect(where.z).toBeCloseTo(piece.z, 5)
    }
  })
})

describe('the wet street', () => {
  it('lays one surface over the roadway and the pavement, under the paint and well under the kerb', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())
    const skin = city.root.children.filter((child) => child.name === 'street:skin')
    expect(skin).toHaveLength(1)

    const position = (skin[0] as THREE.Mesh).geometry.getAttribute('position')
    const tops = new Set<number>()
    for (let i = 0; i < position.count; i++) tops.add(Number(position.getY(i).toFixed(4)))
    const heights = [...tops].sort((a, b) => a - b)

    // the roadway, the foot of the kerb and the pavement, each lifted clear
    expect(heights.at(-1)).toBeCloseTo(KERB + SURFACE.lift, 4)
    expect(heights).toContain(Number(SURFACE.lift.toFixed(4)))
    // the paint clears the film, so grime and water go under the lines rather
    // than over them, and neither of them comes near the top of the kerb
    expect(MARKING.lift).toBeGreaterThan(SURFACE.lift)
    expect(MARKING.lift).toBeLessThan(KERB / 2)
  })

  it('follows the weather rather than being wet all the time', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())

    // a city is built dry: the weather has not said anything yet
    expect(city.wetness).toBe(0)
    city.wetness = 0.45
    expect(city.wetness).toBe(0.45)
    city.wetness = 0
    expect(city.wetness).toBe(0)

    // and a reading that is not a wetness is no reading at all
    city.wetness = 4
    expect(city.wetness).toBe(1)
    city.wetness = -1
    expect(city.wetness).toBe(0)
    city.wetness = Number.NaN
    expect(city.wetness).toBe(0)
  })

  it('starts at the wetness it was built with', async () => {
    const world = await town()
    expect(buildCity(world, new Greybox(), { wetness: 0.8 }).wetness).toBe(0.8)
  })

  it('gives the neon back only after dark, and takes that from the clock as well', async () => {
    const world = await town()
    const city = buildCity(world, new Greybox())

    // a city is built for the hour the references are set at
    expect(city.night).toBe(1)
    city.night = 0.25
    expect(city.night).toBe(0.25)
    city.night = 12
    expect(city.night).toBe(1)
    city.night = Number.NaN
    expect(city.night).toBe(0)
    expect(buildCity(world, new Greybox(), { night: 0 }).night).toBe(0)
  })

  it('costs one draw for the whole city, however big the city is', async () => {
    const small = buildCity(await town(), new Greybox())
    const large = buildCity(await bigTown(), new Greybox())
    const skins = (root: THREE.Object3D) => root.children.filter((child) => child.name === 'street:skin')

    expect(skins(small.root)).toHaveLength(1)
    expect(skins(large.root)).toHaveLength(1)
  })
})
