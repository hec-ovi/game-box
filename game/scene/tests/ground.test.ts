import { METRICS, World, type CellKind } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, Greybox, type CityBuild } from '../src/index.ts'

const KERB = METRICS.street.curbHeight
const SIDES = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
] as const

/** What the ground is meant to do, said again here so the test does not take the builder's word for it. */
const SURFACE_HEIGHT: Partial<Record<CellKind, number>> = {
  street: 0,
  empty: 0,
  building: 0,
  water: 0,
  sidewalk: KERB,
  park: KERB,
}

/**
 * A hand-laid street, so every case the ground has to close is on it: roadway
 * with pavement beside it, a park, a building footprint the pavement runs into,
 * and pavement that runs off the edge of the grid on three sides.
 */
function street(size = 12): World {
  const world = World.create({ name: 'Kerb Street', theme: 'test', seed: 'kerb', width: size, height: size })
  world.paint({ x: 0, y: 0, w: size, h: 2 }, 'street')
  world.paint({ x: 0, y: 2, w: size, h: 1 }, 'sidewalk')
  world.paint({ x: 0, y: size - 1, w: size, h: 1 }, 'sidewalk')
  world.paint({ x: 1, y: 4, w: 3, h: 3 }, 'park')
  world.paint({ x: 5, y: 3, w: 5, h: 1 }, 'sidewalk')

  const built = world.addPlot({
    kind: 'house',
    name: 'House',
    rect: { x: 6, y: 4, w: 3, h: 3 },
    entrance: { cell: { x: 6, y: 3 }, facing: 'north' },
    storeys: 2,
    style: 'plain',
  })
  if (!built.ok) throw new Error(built.error.code)
  return world
}

interface Triangle {
  readonly normal: THREE.Vector3
  /** A quad's two triangles share its box, so this is the face the triangle is part of. */
  readonly box: THREE.Box3
}

function groundTriangles(city: CityBuild, only?: string): Triangle[] {
  const triangles: Triangle[] = []
  for (const child of city.root.children) {
    if (!child.name.startsWith('ground:')) continue
    if (only && child.name !== only) continue
    const position = (child as THREE.Mesh).geometry.getAttribute('position')
    for (let i = 0; i < position.count; i += 3) {
      const corner = (at: number) => new THREE.Vector3().fromBufferAttribute(position, at)
      const [a, b, c] = [corner(i), corner(i + 1), corner(i + 2)]
      triangles.push({
        normal: new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize(),
        box: new THREE.Box3().setFromPoints([a, b, c]),
      })
    }
  }
  return triangles
}

/** The top of the ground under a point in metres. Past the grid there is nothing to stand on. */
function heightAt(world: World, x: number, z: number): number {
  const kind = world.grid.at(Math.floor(x / world.cellSize), Math.floor(z / world.cellSize))
  return kind === undefined ? -Infinity : SURFACE_HEIGHT[kind] ?? Infinity
}

describe('the ground', () => {
  it('closes the drop from every cell to the lower one beside it', () => {
    const world = street()
    const city = buildCity(world, new Greybox())
    const walls = groundTriangles(city).filter((triangle) => Math.abs(triangle.normal.y) < 1e-6)
    const cell = world.cellSize
    const open: string[] = []

    for (let y = 0; y < world.grid.height; y++) {
      for (let x = 0; x < world.grid.width; x++) {
        const here = SURFACE_HEIGHT[world.grid.at(x, y)!]
        if (here === undefined) continue
        for (const side of SIDES) {
          const beside = world.grid.at(x + side.x, y + side.z)
          // the edge of the grid is closed too, but against nothing: its own test
          const low = beside === undefined ? undefined : SURFACE_HEIGHT[beside]
          if (low === undefined || low >= here) continue

          const along = side.x !== 0 ? { min: y * cell, max: (y + 1) * cell } : { min: x * cell, max: (x + 1) * cell }
          const at = side.x !== 0 ? (x + Math.max(side.x, 0)) * cell : (y + Math.max(side.z, 0)) * cell
          const gap = new THREE.Box3(
            new THREE.Vector3(side.x !== 0 ? at : along.min, low, side.x !== 0 ? along.min : at),
            new THREE.Vector3(side.x !== 0 ? at : along.max, here, side.x !== 0 ? along.max : at),
          )
          const closed = walls.some(
            (wall) =>
              wall.normal.dot(new THREE.Vector3(side.x, 0, side.z)) > 0.99 &&
              wall.box.clone().expandByScalar(1e-4).containsBox(gap),
          )
          if (!closed) open.push(`${x},${y} -> ${x + side.x},${y + side.z}`)
        }
      }
    }
    expect(open).toEqual([])
  })

  it('closes the ground where the grid runs out, so the world has no open edge', () => {
    const world = street()
    const city = buildCity(world, new Greybox())
    const edge = (world.grid.height - 1 + 1) * world.cellSize

    // the pavement along the last row has nothing south of it and is walled off
    const closed = groundTriangles(city, 'ground:sidewalk').some(
      (wall) => wall.normal.z > 0.99 && Math.abs(wall.box.min.z - edge) < 1e-4 && wall.box.min.y < 0,
    )
    expect(closed).toBe(true)
  })

  it('faces every ground triangle where a player can see it', () => {
    const world = street()
    const city = buildCity(world, new Greybox())
    const wrong: string[] = []

    for (const triangle of groundTriangles(city)) {
      if (triangle.normal.y > 0.999) continue
      // nothing points down or halfway: the ground is flat tops and upright kerbs
      if (Math.abs(triangle.normal.y) > 1e-6) {
        wrong.push(`tilted ${triangle.normal.toArray().join(',')}`)
        continue
      }
      // a kerb is seen from the road: what it turns its back on has to be the higher side
      const middle = triangle.box.getCenter(new THREE.Vector3())
      const front = middle.clone().addScaledVector(triangle.normal, 0.05)
      const back = middle.clone().addScaledVector(triangle.normal, -0.05)
      if (heightAt(world, back.x, back.z) <= heightAt(world, front.x, front.z)) {
        wrong.push(`inside out at ${middle.toArray().join(',')}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('stands the pavement on the kerb and the road at zero', () => {
    const city = buildCity(street(), new Greybox())
    const tops = (name: string) => [
      ...new Set(
        groundTriangles(city, name)
          .filter((triangle) => triangle.normal.y > 0.999)
          .map((triangle) => Number(triangle.box.min.y.toFixed(4))),
      ),
    ]

    expect(tops('ground:sidewalk')).toEqual([KERB])
    expect(tops('ground:park')).toEqual([KERB])
    expect(tops('ground:street')).toEqual([0])
  })

  it('lays the same few meshes however many cells the city has', () => {
    const meshes = (world: World) =>
      buildCity(world, new Greybox()).root.children.filter((child) => child.name.startsWith('ground:'))
    const small = meshes(street(12))
    const large = meshes(street(48))

    expect(large.map((mesh) => mesh.name)).toEqual(small.map((mesh) => mesh.name))
    // and sixteen times the cells is not sixteen times the road: runs merge before they are drawn
    const vertices = (list: THREE.Object3D[]) =>
      ((list.find((mesh) => mesh.name === 'ground:street') as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute).count
    expect(vertices(large)).toBe(vertices(small))
  })

  it('measures the texture in metres, so a surface tiles at street scale', () => {
    const world = street()
    const city = buildCity(world, new Greybox())
    const road = city.root.children.find((child) => child.name === 'ground:street') as THREE.Mesh
    const position = road.geometry.getAttribute('position')
    const uv = road.geometry.getAttribute('uv')

    expect(uv.count).toBe(position.count)
    for (let i = 0; i < position.count; i++) {
      // the top of the road: u and v are where the corner is on the ground
      if (Math.abs(position.getY(i)) > 1e-6) continue
      expect(uv.getX(i)).toBeCloseTo(position.getX(i), 5)
      expect(uv.getY(i)).toBeCloseTo(position.getZ(i), 5)
    }
  })
})
