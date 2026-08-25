import { METRICS, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CAMERA, cellAt, fixturesFor, KIT_MATERIALS, KitDressing, lightsFor, placeholderKit, RELIEF, SIGN, signsFor, SOLID, SUBWAY, wellOf } from '../src/index.ts'
import { CELL, charterOf, fingerprint, inventedCharter, meshesOf, plotOf, presetOf, signMesh, sizeOf, townOf, trianglesOf, wallBounds } from './support.ts'

const dressing = new KitDressing(placeholderKit())
const heightOf = (storeys: number) => METRICS.building.groundFloorHeight + (storeys - 1) * METRICS.building.storeyHeight

const rect = { x: 6, y: 6, w: 4, h: 3 }
/** A doorstep on each side of that footprint. */
const doorsteps: Record<Plot['entrance']['facing'], { x: number; y: number }> = {
  north: { x: rect.x + 2, y: rect.y - 1 },
  south: { x: rect.x + 1, y: rect.y + rect.h },
  east: { x: rect.x + rect.w, y: rect.y + 2 },
  west: { x: rect.x - 1, y: rect.y + 1 },
}

/** The middle of the doorstep cell, in the building's own frame. */
const stepOf = (cell: { x: number; y: number }): THREE.Vector3 =>
  new THREE.Vector3((cell.x + 0.5 - rect.x - rect.w / 2) * CELL, 0, (cell.y + 0.5 - rect.y - rect.h / 2) * CELL)

/** Which way a fixture's own +Z points once it stands turned. */
const outOf = (rotationY: number): THREE.Vector3 => new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)

/** The way a wall looks out, by the direction the world names it. */
const AWAY: Record<Plot['entrance']['facing'], THREE.Vector3> = {
  north: new THREE.Vector3(0, 0, -1),
  south: new THREE.Vector3(0, 0, 1),
  east: new THREE.Vector3(1, 0, 0),
  west: new THREE.Vector3(-1, 0, 0),
}

/** What the lit boxes on a building spell, read back off the geometry. */
function readSigns(building: THREE.Object3D): string {
  const mesh = signMesh(building)
  if (!mesh) return ''
  const uv = mesh.geometry.getAttribute('uv')
  const cells: string[] = []
  for (let quad = 0; quad * 4 < uv.count; quad++) {
    const cell = cellAt(uv.getX(quad * 4), uv.getY(quad * 4))
    if (cell && cell !== SOLID) cells.push(cell)
  }
  return cells.join('')
}

describe('the subway entrance', () => {
  it('stands on the doorstep of a station, its mouth to the street, whichever way the door faces', () => {
    for (const [facing, cell] of Object.entries(doorsteps) as [Plot['entrance']['facing'], { x: number; y: number }][]) {
      const plot = plotOf({ kind: 'station', rect, entrance: { cell, facing } })
      const size = sizeOf(plot, heightOf(plot.storeys))
      const { subway } = fixturesFor(plot, size, charterOf(plot))

      expect(subway, facing).toBeDefined()
      const step = stepOf(cell)
      expect(new THREE.Vector3(...subway!.position).distanceTo(step), facing).toBeLessThan(1e-9)
      expect(subway!.cellSize).toBe(CELL)
      // the stairs are walked into from the street: the mouth looks the way the front wall does
      expect(outOf(subway!.rotationY).dot(AWAY[facing]), facing).toBeCloseTo(1, 9)
    }
    // a place with no transit on its charter has none, whatever else it is
    const house = plotOf({ kind: 'house', rect, entrance: { cell: doorsteps.south, facing: 'south' } })
    expect(fixturesFor(house, sizeOf(house, heightOf(2)), charterOf(house)).subway).toBeUndefined()
  })

  it('is welded into the building over the doorstep cell, on the kit\'s own materials', () => {
    const plot = plotOf({ kind: 'station', rect, entrance: { cell: doorsteps.south, facing: 'south' } })
    const size = sizeOf(plot, heightOf(plot.storeys))
    const station = dressing.building(plot, size, charterOf(plot))
    const shut = dressing.building(plot, size, { ...charterOf(plot), transit: 'none' })

    // one mesh a material and every one a kit material, so the entrance joins the city's batches and no draw is added
    const names = meshesOf(station).map((mesh) => (mesh.material as THREE.Material).name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect([...KIT_MATERIALS, SIGN.material], name).toContain(name)
    expect(trianglesOf(station)).toBeGreaterThan(trianglesOf(shut))
    // the walls stand on the plot; the entrance reaches one cell past the front and nothing else does
    const bounds = wallBounds(station)
    expect(bounds.max.z).toBeCloseTo(size.depth / 2 + CELL, 6)
    expect(bounds.min.z).toBeGreaterThanOrEqual(-size.depth / 2 - RELIEF)
    expect(bounds.min.x).toBeGreaterThanOrEqual(-size.width / 2 - RELIEF)
    expect(bounds.max.x).toBeLessThanOrEqual(size.width / 2 + RELIEF)
    // the well goes down through the pavement and the balustrade stands over it
    expect(bounds.min.y).toBeCloseTo(-SUBWAY.well.depth - 0.05, 6)
  })

  it('carries a lit box over its back wall spelling what the charter calls the place, and a light for it', () => {
    const plot = plotOf({ kind: 'station', name: 'Kettle Row', rect, entrance: { cell: doorsteps.east, facing: 'east' } })
    const size = sizeOf(plot, heightOf(plot.storeys))
    const charter = charterOf(plot)
    const signs = signsFor(plot, size, charter)
    const boxes = signs.filter((sign) => sign.kind === 'subway')
    expect(boxes).toHaveLength(1)
    const box = boxes[0]!
    const { subway } = fixturesFor(plot, size, charter)
    const step = new THREE.Vector3(...subway!.position)
    const out = outOf(subway!.rotationY)

    // it spells the blade word, above the back wall, inside the doorstep cell, facing the street
    expect(readSigns(dressing.building(plot, size, charter))).toContain(charter.blade)
    expect(box.origin[1] - box.height / 2).toBeGreaterThan(SUBWAY.back)
    const fromStep = new THREE.Vector3(...box.origin).sub(step)
    expect(Math.abs(fromStep.x)).toBeLessThan(CELL / 2)
    expect(Math.abs(fromStep.z)).toBeLessThan(CELL / 2)
    expect(fromStep.dot(out), 'at the building end of the well').toBeLessThan(0)
    expect(new THREE.Vector3(-box.right[1], 0, box.right[0]).dot(out)).toBeCloseTo(1, 9)
    expect(box.width).toBeLessThanOrEqual(wellOf(CELL).width + 2 * SUBWAY.well.wall)
    // and the town lights its stations by it
    const light = lightsFor(plot, size, charter).find((emitter) => emitter.kind === 'subway')!
    expect(light.intensity).toBeGreaterThan(0)
    expect(light.colour).toBe(box.ink)
  })
})

describe('the camera', () => {
  const guarded = inventedCharter({ word: 'villa', blade: 'VILLA', access: 'private', suits: ['blank', 'villa'] })
  const admitted = inventedCharter({ word: 'club', blade: 'CLUB', access: 'admitted', suits: ['blank', 'club'] })
  const town = townOf('cameras', 60, [guarded, admitted, presetOf('house')])
  const charters = { [guarded.word]: guarded, [admitted.word]: admitted, house: presetOf('house') }

  it('watches the door of a private place, over the door head and clear of every sign, and no other door', () => {
    const { doorHeight } = METRICS.building
    let watched = 0
    for (const plot of town) {
      const size = sizeOf(plot, heightOf(plot.storeys))
      const charter = charters[plot.kind]!
      const { cameras } = fixturesFor(plot, size, charter)
      if (charter.access !== 'private') {
        expect(cameras, `${plot.id} is ${charter.access}`).toHaveLength(0)
        continue
      }
      watched++
      expect(cameras, plot.id).toHaveLength(1)
      const camera = cameras[0]!
      const door = dressing.building(plot, size, charter).getObjectByName('door')!
      // on the door's wall, looking the way the door does, over its head and within reach of it along the wall
      expect(camera.rotationY, plot.id).toBe(door.rotation.y)
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotationY)
      const fromDoor = new THREE.Vector3(...camera.position).sub(door.position)
      expect(Math.abs(fromDoor.dot(outOf(camera.rotationY))), `${plot.id} on the wall plane`).toBeLessThan(1e-9)
      expect(Math.abs(fromDoor.dot(right)), plot.id).toBeLessThan(2)
      expect(camera.position[1], plot.id).toBeGreaterThan(doorHeight)
      // and no sign is hung through it
      for (const sign of signsFor(plot, size, charter)) {
        if (sign.wall !== camera.wall || sign.mount !== 'flat') continue
        const apart = new THREE.Vector3(...sign.origin).sub(new THREE.Vector3(...camera.position))
        const along = Math.abs(apart.x * sign.right[0] + apart.z * sign.right[1])
        const up = Math.abs(apart.y)
        const crossed = along < sign.width / 2 + CAMERA.claim / 2 && up < sign.height / 2 + CAMERA.claim / 2
        expect(crossed, `${plot.id}: ${sign.kind} through the camera`).toBe(false)
      }
    }
    expect(watched).toBeGreaterThan(10)
  })

  it('is drawn into the front wall on a kit material', () => {
    const plot = plotOf({ kind: guarded.word, rect, entrance: { cell: doorsteps.north, facing: 'north' } }, guarded)
    const size = sizeOf(plot, heightOf(plot.storeys))
    const watched = dressing.building(plot, size, guarded)
    const unwatched = dressing.building(plot, size, { ...guarded, access: 'open' })

    const names = meshesOf(watched).map((mesh) => (mesh.material as THREE.Material).name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain(CAMERA.material)
    expect(trianglesOf(watched)).toBeGreaterThan(trianglesOf(unwatched))
    // it hangs off the north wall and nowhere else
    const bounds = wallBounds(watched)
    expect(bounds.min.z).toBeLessThan(-size.depth / 2 - RELIEF)
    expect(bounds.min.z).toBeGreaterThan(-size.depth / 2 - 0.5)
    expect(bounds.max.z).toBeLessThanOrEqual(size.depth / 2 + RELIEF)
  })

  it('stands in the same place on the same plot every run', () => {
    const plot = plotOf({ kind: guarded.word, rect, entrance: { cell: doorsteps.west, facing: 'west' } }, guarded)
    const size = sizeOf(plot, heightOf(plot.storeys))
    expect(fixturesFor(plot, size, guarded)).toEqual(fixturesFor(plot, size, guarded))
    expect(fingerprint(new KitDressing(placeholderKit()).building(plot, size, guarded))).toBe(fingerprint(dressing.building(plot, size, guarded)))
  })
})
