import { MACHINE_PROGRAMS, PROP_SPECS, footprintOf, type Interior, type MachineProgram, type World } from '@gb/world'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { FURNISH_STYLES, PANELS, glassFrame, glassOf, isMachine, watchedBy } from '../src/index.ts'
import { clubTown, dressingIn, interiorsAcrossTowns, meshesOf } from './support.ts'

/**
 * The machines: four screens that show what they are running, a camera that
 * watches a room, and a gate of bars that opens.
 *
 * A screen's program is the file's, per machine, and the prop is one shared
 * buffer, so what is on the glass has to be printed by the room: these tests
 * read every machine of every town and measure that a print lands on that
 * machine's glass, inside it, a millimetre proud, and that a feed draws the
 * room its camera watches. The gate is measured shut and open.
 */

let interiors: Interior[]
let club: World

beforeAll(async () => {
  club = await clubTown()
  interiors = [...(await interiorsAcrossTowns()), ...club.interiors()]
})

/** A millimetre and a bit: `PROUD` plus float32. */
const OFF_GLASS = 0.0011

const UP = new THREE.Vector3(0, 1, 0)

/** The decor's vertices inside a machine's own box, in its glass frame: x across, y up, z off the face. */
function onGlass(decor: THREE.Mesh, piece: Interior['furniture'][number]): THREE.Vector3[] {
  if (!isMachine(piece.prop)) throw new Error(`${piece.prop} has no glass`)
  const place = new THREE.Matrix4().compose(
    new THREE.Vector3(piece.pos.x, piece.lift ?? 0, piece.pos.y),
    new THREE.Quaternion().setFromAxisAngle(UP, (-piece.rot * Math.PI) / 180),
    new THREE.Vector3(1, 1, 1),
  )
  const intoProp = place.clone().invert()
  const intoGlass = place.multiply(glassFrame(piece.prop, PROP_SPECS[piece.prop].height!)).invert()
  const { width, depth } = footprintOf(piece.prop)
  const height = PROP_SPECS[piece.prop].height!
  const found: THREE.Vector3[] = []
  const position = decor.geometry.getAttribute('position')
  const point = new THREE.Vector3()
  const local = new THREE.Vector3()
  for (let at = 0; at < position.count; at++) {
    point.fromBufferAttribute(position, at)
    local.copy(point).applyMatrix4(intoProp)
    // only what stands inside the machine's own box can be its print
    if (Math.abs(local.x) > width / 2 || Math.abs(local.z) > depth / 2 || local.y < 0 || local.y > height) continue
    found.push(point.clone().applyMatrix4(intoGlass))
  }
  return found
}

/** The same interior with one machine running another program. */
function running(interior: Interior, program: MachineProgram): Interior {
  const machine = interior.furniture.find((piece) => piece.machine)!
  return {
    ...interior,
    furniture: interior.furniture.map((piece) =>
      piece === machine ? { ...piece, machine: { ...piece.machine!, program } } : piece,
    ),
  }
}

describe('what a screen shows', () => {
  it('is printed on the glass of every machine in town, inside it and a millimetre proud', () => {
    let screens = 0
    for (const interior of interiors) {
      for (const style of FURNISH_STYLES) {
        const room = dressingIn(style).room(interior)
        const machines = interior.furniture.filter((piece) => piece.machine)
        expect(room.screens.map((screen) => screen.machineId), interior.id).toEqual(machines.map((piece) => piece.machine!.id))

        for (const piece of machines) {
          const glass = glassOf(PANELS[piece.prop as keyof typeof PANELS], PROP_SPECS[piece.prop].height!)
          const points = onGlass(room.decor, piece)
          expect(points.length, `${interior.id} ${piece.machine!.id} ${piece.machine!.program}`).toBeGreaterThan(8)
          for (const point of points) {
            expect(Math.abs(point.x), `${piece.machine!.id} across`).toBeLessThanOrEqual(glass.width / 2 + 1e-5)
            expect(point.y, `${piece.machine!.id} low`).toBeGreaterThanOrEqual(-1e-5)
            expect(point.y, `${piece.machine!.id} high`).toBeLessThanOrEqual(glass.height + 1e-5)
            expect(point.z, `${piece.machine!.id} proud`).toBeLessThanOrEqual(1e-5)
            expect(point.z, `${piece.machine!.id} off the glass`).toBeGreaterThanOrEqual(-OFF_GLASS)
          }
          screens++
        }
      }
    }
    expect(screens).toBeGreaterThan(20)
  })

  it('draws every program the vocabulary has, and a different picture for each', () => {
    const interior = interiors.find((interior) => interior.furniture.some((piece) => piece.machine))!
    const machine = interior.furniture.find((piece) => piece.machine)!
    const pictures = new Map<string, MachineProgram>()
    for (const program of MACHINE_PROGRAMS) {
      const room = dressingIn('corpo').room(running(interior, program))
      expect(room.screens.find((screen) => screen.machineId === machine.machine!.id)?.program).toBe(program)
      const shape = onGlass(room.decor, machine)
        .map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)
        .sort()
        .join(' ')
      expect(pictures.get(shape), `${program} prints the same as ${pictures.get(shape)}`).toBeUndefined()
      pictures.set(shape, program)
    }
  })

  it('draws a camera feed as the room its camera watches', () => {
    const watched = interiors.filter((interior) => interior.furniture.some((piece) => piece.watches))
    expect(watched.length).toBeGreaterThan(1)
    for (const interior of watched) {
      const camera = interior.furniture.find((piece) => piece.watches)!
      const schematic = watchedBy(interior)!
      expect(schematic.roomId).toBe(camera.watches)
      expect(schematic.pieces).toHaveLength(interior.furniture.filter((piece) => piece.roomId === camera.watches).length - 1)
      expect(schematic.camera).toEqual(camera.pos)
    }
    // and one with nothing to watch shows no signal rather than nothing
    const blind = interiors.find((interior) => interior.furniture.some((piece) => piece.machine) && !watchedBy(interior))!
    const room = dressingIn('home').room(running(blind, 'camera-feed'))
    expect(onGlass(room.decor, blind.furniture.find((piece) => piece.machine)!).length).toBeGreaterThan(8)
  })
})

describe('the camera', () => {
  it('hangs from its plate with its lens pitched down into the room and a red diode over it', () => {
    for (const style of FURNISH_STYLES) {
      const mesh = dressingIn(style).prop('camera') as THREE.Mesh
      const position = mesh.geometry.getAttribute('position')
      const glow = mesh.geometry.getAttribute('glow')
      let lowest = new THREE.Vector3(0, Infinity, 0)
      let red = 0
      for (let at = 0; at < position.count; at++) {
        const point = new THREE.Vector3().fromBufferAttribute(position, at)
        if (point.y < lowest.y) lowest = point
        if (glow.getX(at) > 1 && glow.getY(at) < 0.3) red++
      }
      // the lowest point is the far end of the housing, out in front of the plate at the back
      expect(lowest.z, style).toBeLessThan(-0.05)
      expect(red, `${style} diode`).toBeGreaterThan(0)
    }
  })
})

describe('the gate of bars', () => {
  /** Whether any vertex stands in the opening between the posts, below the head. */
  function fillsOpening(mesh: THREE.Mesh): boolean {
    const position = mesh.geometry.getAttribute('position')
    for (let at = 0; at < position.count; at++) {
      if (Math.abs(position.getX(at)) < 0.4 && position.getY(at) > 0.2 && position.getY(at) < 1.9) return true
    }
    return false
  }

  it('stands across its door in the town that locks a cellar, shut, and slides open into the wall', () => {
    const gates = [...club.interiors()].flatMap((interior) => interior.furniture.filter((piece) => piece.doorId))
    expect(gates.length).toBeGreaterThan(0)
    for (const gate of gates) {
      const interior = [...club.interiors()].find((interior) => interior.furniture.includes(gate))!
      const door = interior.doors.find((door) => door.id === gate.doorId)!
      expect(gate.pos).toEqual(door.pos)
    }

    for (const style of FURNISH_STYLES) {
      const dressing = dressingIn(style)
      const shut = dressing.prop('bars-door') as THREE.Mesh
      const open = dressing.opened('bars-door') as THREE.Mesh
      expect(fillsOpening(shut), `${style} shut`).toBe(true)
      expect(fillsOpening(open), `${style} open`).toBe(false)
      // the leaf has gone sideways into the wall's own thickness, not into the room
      const bounds = new THREE.Box3().setFromObject(open)
      expect(Math.abs(bounds.min.z), style).toBeLessThanOrEqual(footprintOf('bars-door').depth / 2 + 1e-4)
      expect(Math.abs(bounds.max.z), style).toBeLessThanOrEqual(footprintOf('bars-door').depth / 2 + 1e-4)
      expect(open.material, style).toBe(shut.material)
      expect(meshesOf(open), style).toHaveLength(1)
      expect(dressing.opened('chair'), style).toBeUndefined()
    }
  })
})
