import { METRICS, SHIPPED_CHARTERS, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FAR_GLASS, GLASS, KitDressing, RELIEF, ROOM_ATTRIBUTES, SIGN, placeholderKit } from '../src/index.ts'
import { charterOf, inventedCharter, meshesOf, plotOf, sizeOf, townOf, trianglesOf, wallBounds } from './support.ts'

const dressing = new KitDressing(placeholderKit())
const heightOf = (storeys: number) => METRICS.building.groundFloorHeight + (storeys - 1) * METRICS.building.storeyHeight

const materialsOf = (object: THREE.Object3D): string[] => meshesOf(object).map((mesh) => (mesh.material as THREE.Material).name)

/** The one mesh on that material, which is what a welded building has. */
const on = (object: THREE.Object3D, material: string): THREE.Mesh | undefined =>
  meshesOf(object).find((mesh) => (mesh.material as THREE.Material).name === material)

const rect = { x: 6, y: 6, w: 4, h: 3 }
const doorstep = { cell: { x: rect.x + 2, y: rect.y - 1 }, facing: 'north' as const }
const bothOf = (plot: Plot, charter = charterOf(plot)) => {
  const size = sizeOf(plot, heightOf(plot.storeys))
  return { size, whole: dressing.building(plot, size, charter), shell: dressing.shell(plot, size, charter) }
}

describe('the shell', () => {
  it('stands where the building stands, so the town keeps its shape as you walk up to it', () => {
    for (const plot of townOf('shells', 48)) {
      const size = sizeOf(plot, heightOf(plot.storeys))
      const charter = charterOf(plot)
      const shell = wallBounds(dressing.shell(plot, size, charter))
      const measured = shell.getSize(new THREE.Vector3())

      // the same footprint: the wall plane is the plot boundary, and only window and trim relief stands past it
      expect(measured.x, plot.id).toBeGreaterThanOrEqual(size.width - 1e-6)
      expect(measured.x, plot.id).toBeLessThanOrEqual(size.width + 2 * RELIEF)
      expect(measured.z, plot.id).toBeGreaterThanOrEqual(size.depth - 1e-6)
      expect(measured.z, plot.id).toBeLessThanOrEqual(size.depth + 2 * RELIEF)
      // the same height, standing on the same ground
      expect(shell.max.y, plot.id).toBeCloseTo(size.height, 3)
      expect(shell.min.y, plot.id).toBeCloseTo(0, 1)
      // and nothing on it reaches past the building it stands in for
      const whole = wallBounds(dressing.building(plot, size, charter))
      expect(whole.expandByScalar(1e-6).containsBox(shell), plot.id).toBe(true)
    }
  })

  it('leaves off the signs, the stairs and the camera, which are only read from the pavement', () => {
    const station = bothOf(plotOf({ kind: 'station', name: 'Harbour Line', rect, entrance: doorstep }))
    expect(materialsOf(station.whole)).toContain(SIGN.material)
    expect(materialsOf(station.shell)).not.toContain(SIGN.material)
    // the stairwell a station digs into its doorstep goes with them
    expect(wallBounds(station.whole).min.y).toBeLessThan(-1)
    expect(wallBounds(station.shell).min.y).toBeCloseTo(0, 1)

    const guarded = inventedCharter({ word: 'villa', blade: 'VILLA', access: 'private', suits: ['blank', 'villa'] })
    const watched = bothOf(plotOf({ kind: guarded.word, rect, entrance: doorstep }, guarded), guarded)
    expect(trianglesOf(watched.shell)).toBeLessThan(trianglesOf(watched.whole))
    // the camera hangs off the front wall; the shell stops at the wall plane
    expect(wallBounds(watched.whole).min.z).toBeLessThan(-watched.size.depth / 2 - RELIEF)
    expect(wallBounds(watched.shell).min.z).toBeGreaterThanOrEqual(-watched.size.depth / 2 - RELIEF)
  })

  it('lights the same windows as the building it stands in for, flat', () => {
    const { whole, shell } = bothOf(plotOf({ kind: 'apartment', storeys: 4, rect, entrance: doorstep }))
    const near = on(whole, GLASS)
    const far = on(shell, FAR_GLASS)

    expect(materialsOf(shell)).not.toContain(GLASS)
    expect(near).toBeDefined()
    expect(far).toBeDefined()
    // the same panes carrying the same rooms: what changes is only what reads them
    for (const attribute of [...Object.values(ROOM_ATTRIBUTES), 'position']) {
      expect(far!.geometry.getAttribute(attribute).array, attribute).toEqual(near!.geometry.getAttribute(attribute).array)
    }
  })

  it('is one indexed mesh per material, so the far town is one draw each', () => {
    const { shell } = bothOf(plotOf({ kind: 'office', storeys: 6, rect: { x: 4, y: 4, w: 5, h: 4 }, entrance: { cell: { x: 5, y: 8 }, facing: 'south' } }))
    const meshes = meshesOf(shell)

    expect(new Set(materialsOf(shell)).size).toBe(meshes.length)
    for (const mesh of meshes) expect(mesh.geometry.getIndex(), (mesh.material as THREE.Material).name).not.toBeNull()
  })
})

describe('a tall plot\'s shell', () => {
  const rect = { x: 6, y: 6, w: 5, h: 4 }
  const doorstep = { cell: { x: rect.x + 2, y: rect.y - 1 }, facing: 'north' as const }
  const towers = SHIPPED_CHARTERS.map((charter) => {
    const plot = plotOf({ kind: charter.word, name: 'The Tall One', storeys: 20, rect, entrance: doorstep }, charter)
    return { plot, charter, size: sizeOf(plot, heightOf(20)) }
  })

  it('stands where the tower it stands in for does, to the metre it was given', () => {
    for (const { plot, charter, size } of towers) {
      const shell = wallBounds(dressing.shell(plot, size, charter))
      const measured = shell.getSize(new THREE.Vector3())

      expect(measured.x, plot.kind).toBeGreaterThanOrEqual(size.width - 1e-6)
      expect(measured.x, plot.kind).toBeLessThanOrEqual(size.width + 2 * RELIEF)
      expect(measured.z, plot.kind).toBeGreaterThanOrEqual(size.depth - 1e-6)
      expect(measured.z, plot.kind).toBeLessThanOrEqual(size.depth + 2 * RELIEF)
      expect(shell.max.y, plot.kind).toBeCloseTo(size.height, 3)
      expect(shell.min.y, plot.kind).toBeCloseTo(0, 1)
      expect(wallBounds(dressing.building(plot, size, charter)).expandByScalar(1e-6).containsBox(shell), plot.kind).toBe(true)
    }
  })

  it('lights the same rooms in the same panes as the tower it stands in for', () => {
    for (const { plot, charter, size } of towers) {
      const near = roomsOf(dressing.building(plot, size, charter), GLASS)
      const far = roomsOf(dressing.shell(plot, size, charter), FAR_GLASS)

      expect([...far.keys()].sort(), `${plot.kind}: the same rooms`).toEqual([...near.keys()].sort())
      for (const [key, pane] of near) {
        const same = far.get(key)!
        // the same glass, on the same wall, at the same height: what moves is
        // out of the reveal onto the face of it, because the wall over the
        // shopfront is one course with no opening cut in it
        const [was, now] = [pane.getSize(new THREE.Vector3()), same.getSize(new THREE.Vector3())]
        expect(Math.max(now.x, now.z), `${plot.kind}: room ${key} is as wide`).toBeCloseTo(Math.max(was.x, was.z), 6)
        expect(now.y, `${plot.kind}: room ${key} is as tall`).toBeCloseTo(was.y, 6)
        expect(pane.getCenter(new THREE.Vector3()).distanceTo(same.getCenter(new THREE.Vector3())), `${plot.kind}: room ${key} moved`).toBeLessThanOrEqual(0.25)
      }
    }
  })

  it('stops growing with its storeys, which is what a tower cost', () => {
    const plot = (storeys: number) => plotOf({ kind: 'office', name: 'Up And Up', storeys, rect, entrance: doorstep })
    const shellAt = (storeys: number) => trianglesOf(dressing.shell(plot(storeys), sizeOf(plot(storeys), heightOf(storeys)), charterOf(plot(storeys))))
    const buildingAt = (storeys: number) => trianglesOf(dressing.building(plot(storeys), sizeOf(plot(storeys), heightOf(storeys)), charterOf(plot(storeys))))

    const shell = (shellAt(40) - shellAt(20)) / 20
    const whole = (buildingAt(40) - buildingAt(20)) / 20
    expect(whole, 'a building is a storey of kit repeated').toBeGreaterThan(100)
    expect(shell, 'a shell is one course stretched over it').toBeLessThan(whole / 10)
    // so a forty storey tower's shell is a fraction of the tower
    expect(shellAt(40)).toBeLessThan(buildingAt(40) / 5)
  })
})

/** Every room drawn on that glass, as the box of the panes carrying it. */
function roomsOf(object: THREE.Object3D, glass: string): Map<string, THREE.Box3> {
  const rooms = new Map<string, THREE.Box3>()
  for (const mesh of meshesOf(object)) {
    if ((mesh.material as THREE.Material).name !== glass) continue
    const look = mesh.geometry.getAttribute(ROOM_ATTRIBUTES.look)
    const position = mesh.geometry.getAttribute('position')
    for (let vertex = 0; vertex < position.count; vertex++) {
      const key = look.getX(vertex).toFixed(6)
      const box = rooms.get(key) ?? new THREE.Box3()
      rooms.set(key, box.expandByPoint(new THREE.Vector3(position.getX(vertex), position.getY(vertex), position.getZ(vertex))))
    }
  }
  return rooms
}
