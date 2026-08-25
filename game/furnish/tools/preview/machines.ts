import type { Interior } from '@gb/world'
import * as THREE from 'three'
import { FurnishDressing, type FurnishLibrary, type FurnishStyle } from '../../src/index.ts'
import { buildRoom } from './room.ts'

/**
 * The machines, the camera and the gate in one dark room, with a dance floor
 * under two dancers and the booth on the wall nearest them.
 *
 * It answers what a table of vertices cannot: does a ledger read as a ledger
 * at arm's length, does a feed read as the room it watches, is a gate a gate.
 * The room is a small hand-written interior document, dressed the way the
 * game dresses one: the props at their positions, the room's own decor over
 * them, so every print lands where the room put its machine.
 */
const SIZE = { w: 8, h: 6 }

/** One small place with one of everything the second wave added. */
function stage(): Interior {
  const room = 'room_0001'
  return {
    id: 'interior_0001',
    plotId: 'plot_0001',
    kind: 'disco',
    finish: 'worn',
    size: SIZE,
    rooms: [{ id: room, kind: 'main', name: 'Dance floor', use: 'taproom', rect: { x: 0, y: 0, w: SIZE.w, h: SIZE.h } }],
    doors: [
      { id: 'door_0001', from: 'outside', to: room, pos: { x: 4, y: SIZE.h }, rot: 180, locked: false },
      { id: 'door_0002', from: room, to: room, pos: { x: 1.2, y: 0 }, rot: 0, locked: true },
    ],
    furniture: [
      { id: 'prop_0001', prop: 'desk', roomId: room, pos: { x: 5.5, y: 1.2 }, rot: 180 },
      { id: 'prop_0002', prop: 'terminal', roomId: room, pos: { x: 5.85, y: 1.05 }, rot: 180, lift: 0.75, on: 'prop_0001', machine: { id: 'machine_0001', locked: true, password: 'ember-51', program: 'ledger' } },
      { id: 'prop_0003', prop: 'counter', roomId: room, pos: { x: 2.4, y: 1.2 }, rot: 180 },
      { id: 'prop_0004', prop: 'laptop', roomId: room, pos: { x: 1.9, y: 1.05 }, rot: 180, lift: 1, on: 'prop_0003', machine: { id: 'machine_0002', locked: true, password: 'sable-79', program: 'mail' } },
      { id: 'prop_0005', prop: 'monitor', roomId: room, pos: { x: 2.9, y: 1.05 }, rot: 180, lift: 1, on: 'prop_0003', machine: { id: 'machine_0003', locked: false, program: 'snake' } },
      { id: 'prop_0006', prop: 'tablet', roomId: room, pos: { x: 5.05, y: 1.05 }, rot: 180, lift: 0.75, on: 'prop_0001', machine: { id: 'machine_0004', locked: true, password: 'quartz-21', program: 'camera-feed' } },
      { id: 'prop_0007', prop: 'camera', roomId: room, pos: { x: 7.5, y: 0.2 }, rot: 180, lift: 2.9, watches: room },
      { id: 'prop_0008', prop: 'bars-door', roomId: room, pos: { x: 1.2, y: 0 }, rot: 0, doorId: 'door_0002' },
      { id: 'prop_0009', prop: 'bar-stool', roomId: room, pos: { x: 6.8, y: 4.6 }, rot: 0 },
    ],
    anchors: [
      { id: 'anchor_0001', kind: 'dance', roomId: room, pos: { x: 5.6, y: 3.4 }, rot: 0 },
      { id: 'anchor_0002', kind: 'dance', roomId: room, pos: { x: 6.4, y: 2.7 }, rot: 270 },
    ],
  }
}

const UP = new THREE.Vector3(0, 1, 0)

export function buildMachines(kit: FurnishLibrary, style: FurnishStyle, probe: boolean, open: boolean): THREE.Group {
  const interior = stage()
  const dressing = new FurnishDressing(kit, undefined, style)
  const room = dressing.room(interior)
  const root = buildRoom(room.dressing, room.style, probe)
  // the preview room is centred on the origin; the interior document runs from its own corner
  const into = new THREE.Group()
  into.position.set(-SIZE.w / 2, 0, -SIZE.h / 2)
  root.add(into)
  into.add(room.decor)

  for (const piece of interior.furniture) {
    const object = (open && piece.doorId ? room.dressing.opened(piece.prop) : undefined) ?? room.dressing.prop(piece.prop)
    object.position.set(piece.pos.x, piece.lift ?? 0, piece.pos.y)
    object.quaternion.setFromAxisAngle(UP, (-piece.rot * Math.PI) / 180)
    object.name = `${piece.prop}:${piece.machine?.program ?? ''}`
    into.add(object)
  }
  return root
}
