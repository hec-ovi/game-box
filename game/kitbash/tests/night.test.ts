import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FAKE_INTERIOR, GLASS, KitDressing, nightLook, placeholderKit, ROOM_ATTRIBUTES } from '../src/index.ts'
import { charterOf, fingerprint, meshesOf, plotOf, sizeOf } from './support.ts'

const kit = placeholderKit()
const dressing = new KitDressing(kit)

const office = () => plotOf({ kind: 'office', storeys: 4, rect: { x: 4, y: 4, w: 4, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' } })
const glassOf = (building: THREE.Object3D): THREE.Mesh =>
  meshesOf(building).find((mesh) => (mesh.material as THREE.Material).name === GLASS)!

describe('windows', () => {
  it('gives every pane a room to look into, and no draw of its own', () => {
    const plot = office()
    const building = dressing.building(plot, sizeOf(plot, 14), charterOf(plot))
    const glass = glassOf(building)
    const position = glass.geometry.getAttribute('position')
    const offset = glass.geometry.getAttribute(ROOM_ATTRIBUTES.offset)
    const size = glass.geometry.getAttribute(ROOM_ATTRIBUTES.size)
    const look = glass.geometry.getAttribute(ROOM_ATTRIBUTES.look)

    // every vertex of the glass mesh carries its room, and the mesh is still one draw
    expect(offset.count).toBe(position.count)
    expect(size.count).toBe(offset.count)
    expect(look.count).toBe(offset.count)
    expect(meshesOf(building).filter((mesh) => (mesh.material as THREE.Material).name === GLASS)).toHaveLength(1)

    for (let at = 0; at < size.count; at++) {
      expect(size.getX(at), 'a room is at least a module wide').toBeGreaterThanOrEqual(1.9)
      expect(size.getY(at), 'a room is tall enough to stand in').toBeGreaterThan(1.5)
      expect(look.getX(at), 'the key it lights up at is a share, 0 to 1').toBeGreaterThanOrEqual(0)
      expect(look.getX(at)).toBeLessThan(1)
      // the pane carries where it sits in its room, so the wall it is behind
      // comes back from the vertex: inside the storeys of the building
      const roomY = position.getY(at) - offset.getY(at)
      expect(roomY).toBeGreaterThan(0)
      expect(roomY).toBeLessThan(14)
    }
  })

  it('drops the flat plane the kit paints behind its glass', () => {
    const plot = office()
    const names = meshesOf(dressing.building(plot, sizeOf(plot, 14), charterOf(plot))).map((mesh) => (mesh.material as THREE.Material).name)

    expect(names).toContain(GLASS)
    expect(names, 'the pane draws a real room now').not.toContain(FAKE_INTERIOR)
  })

  it('lights the same windows from the same plot every time', () => {
    const plot = office()
    const size = sizeOf(plot, 14)
    // the fingerprint folds in the room attributes, so a window that would
    // light up at a different hour changes it
    expect(fingerprint(dressing.building(plot, size, charterOf(plot)))).toBe(fingerprint(dressing.building(plot, size, charterOf(plot))))
    // and a different place is a different set of rooms
    const other = plotOf({ kind: 'office', storeys: 4, style: 'grand', rect: { x: 4, y: 4, w: 4, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' } })
    expect(fingerprint(dressing.building(other, size, charterOf(other)))).not.toBe(fingerprint(dressing.building(plot, size, charterOf(plot))))
  })
})

describe('the hour of the day', () => {
  it('is dark at night, light by day, and reads the same every time it is asked', () => {
    expect(nightLook(13).level).toBe(0)
    expect(nightLook(2).level).toBe(1)
    expect(nightLook(21.5)).toEqual(nightLook(21.5))
    // wraps, so a clock past midnight and one before it agree
    expect(nightLook(25)).toEqual(nightLook(1))
    expect(nightLook(-1)).toEqual(nightLook(23))
  })

  it('empties the windows between the evening and the small hours', () => {
    expect(nightLook(21).lit).toBeGreaterThan(nightLook(2).lit)
    expect(nightLook(2).lit).toBeGreaterThan(0)
    expect(nightLook(13).lit).toBeLessThan(nightLook(21).lit)
  })

  it('moves the whole city with two numbers', () => {
    dressing.setTime(21)
    const evening = { level: kit.night.level.value, lit: kit.night.lit.value }
    dressing.setTime(3)
    expect(kit.night.lit.value).toBeLessThan(evening.lit)
    expect(kit.night.hours).toBe(3)

    dressing.setTime(21)
    expect({ level: kit.night.level.value, lit: kit.night.lit.value }).toEqual(evening)

    // a clock that hands over nonsense leaves the city where it was
    dressing.setTime(Number.NaN)
    expect(kit.night.hours).toBe(21)
  })
})
