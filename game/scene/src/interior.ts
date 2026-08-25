import type { AnchorKind, Interior, World } from '@gb/world'
import * as THREE from 'three'
import { blockersOf } from './blockers.ts'
import type { Dressing } from './dressing.ts'
import { ceilingFill } from './fill.ts'
import { PropFootprint } from './footprint.ts'
import { Leaving } from './leaving.ts'
import { Pickups } from './pickups.ts'
import { shellOf } from './shell.ts'
import { PropSurface } from './surface.ts'
import { visitorCellsOf, type VisitorCell } from './visitors.ts'

/**
 * A stored heading as a three.js yaw. The world writes compass degrees, 0
 * north and 90 east, which runs clockwise seen from above; a turn about +Y
 * runs the other way. Without the sign, north and south still land and east
 * and west swap, which sits a bartender with their back to the bar.
 */
function yawOf(heading: number): number {
  return THREE.MathUtils.degToRad(-heading)
}

export interface InteriorBuild {
  readonly root: THREE.Group
  /** Where each anchor is and which way it faces: drop an NPC here and they belong. */
  readonly anchors: ReadonlyMap<string, THREE.Object3D>
  /** Furniture by prop id, for looking at and interacting with. */
  readonly props: ReadonlyMap<string, THREE.Object3D>
  /** The people stationed in here, by npc id, standing on their anchor. */
  readonly people: ReadonlyMap<string, THREE.Object3D>
  /** What is lying about in here, by item id. */
  readonly pickups: ReadonlyMap<string, THREE.Object3D>
  /**
   * Leaves a thing at one of this room's anchors, the same way the room was
   * built: on the piece of furniture the anchor belongs to, at the height it is
   * drawn to. Answers its handle, which is what takes it back out of the room.
   * An anchor this room has not got answers nothing and draws nothing.
   */
  readonly leave: (itemId: string, anchorId: string) => THREE.Object3D | undefined
  /** The furniture the player cannot walk through, as rectangles on the floor in these same coordinates. */
  readonly blockers: readonly PropFootprint[]
  /** Where a visitor may stand, nearest the street door first: clear of the furniture, the doors, the people and the staff's aisle. */
  readonly visitorCells: readonly VisitorCell[]
  /** Where the player appears when they come in, and where they leave from. */
  readonly entrance: THREE.Vector3
  /** The way into the room from that door, so entering faces the room. */
  readonly inward: THREE.Vector3
  /** Lets go of the geometry this box made for the room: its shell and its pickup batches. The dressing's own objects are left alone. */
  readonly dispose: () => void
}

/**
 * One building's inside, in its own coordinates: the player is teleported into
 * it rather than the whole city carrying every room all the time.
 */
export function buildInterior(world: World, interior: Interior, dressing: Dressing): InteriorBuild {
  const root = new THREE.Group()
  root.name = interior.id

  const shell = shellOf(interior, dressing)
  for (const surface of shell) root.add(surface)
  const fill = ceilingFill(root)

  const props = new Map<string, THREE.Object3D>()
  const tops = new Map<string, PropSurface>()
  for (const piece of interior.furniture) {
    const object = dressing.prop(piece.prop)
    // a till stands on the counter it was placed on: the world carries that
    // top's height and the object is lifted to it. It is a transform and
    // nothing else, so the piece keeps the geometry and the material the
    // dressing handed over and costs no draw of its own
    object.position.set(piece.pos.x, piece.lift ?? 0, piece.pos.y)
    object.rotation.y = yawOf(piece.rot)
    object.name = piece.id
    root.add(object)
    props.set(piece.id, object)

    tops.set(piece.id, new PropSurface(new PropFootprint(piece.id, piece.prop, object), object))
  }

  const anchors = new Map<string, THREE.Object3D>()
  const hosts = new Map<string, PropSurface>()
  for (const anchor of interior.anchors) {
    const spot = new THREE.Object3D()
    spot.position.set(anchor.pos.x, 0, anchor.pos.y)
    spot.rotation.y = yawOf(anchor.rot)
    spot.name = anchor.id
    spot.userData.kind = anchor.kind
    root.add(spot)
    anchors.set(anchor.id, spot)

    // what a thing left at this anchor is left on
    const top = anchor.propId ? tops.get(anchor.propId) : undefined
    if (top) hosts.set(anchor.id, top)
  }

  const people = new Map<string, THREE.Object3D>()
  for (const npc of world.npcs()) {
    const spot = npc.station?.interiorId === interior.id ? anchors.get(npc.station.anchorId) : undefined
    if (!spot) continue
    const body = dressing.character(npc, spot.userData.kind as AnchorKind)
    body.position.copy(spot.position)
    body.rotation.copy(spot.rotation)
    body.userData.npcId = npc.id
    root.add(body)
    people.set(npc.id, body)
  }

  const pickups = new Pickups(root)
  const leaving = new Leaving(world, dressing, pickups, anchors, hosts)
  for (const placement of world.placements()) {
    if (placement.at !== 'anchor' || placement.interiorId !== interior.id) continue
    leaving.leave(placement.itemId, placement.anchorId)
  }

  const door = interior.doors.find((d) => d.from === 'outside') ?? interior.doors[0]
  const entrance = new THREE.Vector3(door?.pos.x ?? interior.size.w / 2, 0, door?.pos.y ?? 0)
  const inward = new THREE.Vector3(interior.size.w / 2, 0, interior.size.h / 2).sub(entrance)
  inward.y = 0
  inward.normalize()

  const footprints = new Map([...tops].map(([id, top]) => [id, top.footprint]))
  const blockers = blockersOf(interior, footprints.values())

  return {
    root,
    anchors,
    props,
    people,
    pickups: pickups.all,
    leave: (itemId, anchorId) => leaving.leave(itemId, anchorId),
    blockers,
    visitorCells: visitorCellsOf(interior, blockers, footprints),
    entrance,
    inward,
    dispose: () => {
      for (const surface of shell) surface.geometry.dispose()
      fill.dispose()
      pickups.dispose()
      root.clear()
    },
  }
}
