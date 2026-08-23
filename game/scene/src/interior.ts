import { METRICS, type AnchorKind, type Interior, type World } from '@gb/world'
import * as THREE from 'three'
import { blockersOf } from './blockers.ts'
import { DOOR_GAP } from './doorway.ts'
import type { Dressing } from './dressing.ts'
import { PropFootprint } from './footprint.ts'
import { Pickups } from './pickups.ts'
import { PropSurface } from './surface.ts'

const CEILING_HEIGHT = METRICS.building.groundFloorHeight

/** A step to the side of whoever is standing there, so a thing is not left inside them. */
const BESIDE = 0.45

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
  /** The furniture the player cannot walk through, as rectangles on the floor in these same coordinates. */
  readonly blockers: readonly PropFootprint[]
  /** Where the player appears when they come in, and where they leave from. */
  readonly entrance: THREE.Vector3
  /** The way into the room from that door, so entering faces the room. */
  readonly inward: THREE.Vector3
}

/**
 * One building's inside, in its own coordinates: the player is teleported into
 * it rather than the whole city carrying every room all the time.
 */
export function buildInterior(world: World, interior: Interior, dressing: Dressing): InteriorBuild {
  const root = new THREE.Group()
  root.name = interior.id

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(interior.size.w, interior.size.h), dressing.surface('floor'))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(interior.size.w / 2, 0, interior.size.h / 2)
  floor.name = 'floor'
  floor.receiveShadow = true
  root.add(floor)

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(interior.size.w, interior.size.h), dressing.surface('ceiling'))
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(interior.size.w / 2, CEILING_HEIGHT, interior.size.h / 2)
  ceiling.name = 'ceiling'
  root.add(ceiling)

  const openings = interior.doors.map((door) => new THREE.Vector2(door.pos.x, door.pos.y))
  for (const room of interior.rooms) {
    for (const wall of wallsAround(room.rect, openings, dressing)) root.add(wall)
  }

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
  for (const placement of world.placements()) {
    if (placement.at !== 'anchor' || placement.interiorId !== interior.id) continue
    const spot = anchors.get(placement.anchorId)
    const item = world.item(placement.itemId)
    if (!spot || !item) continue
    const object = dressing.pickup(item)
    pickups.put(item.id, object, standing(spot, hosts.get(placement.anchorId), object))
  }

  const door = interior.doors.find((d) => d.from === 'outside') ?? interior.doors[0]
  const entrance = new THREE.Vector3(door?.pos.x ?? interior.size.w / 2, 0, door?.pos.y ?? 0)
  const inward = new THREE.Vector3(interior.size.w / 2, 0, interior.size.h / 2).sub(entrance)
  inward.y = 0
  inward.normalize()

  return {
    root,
    anchors,
    props,
    people,
    pickups: pickups.all,
    blockers: blockersOf(interior, [...tops.values()].map((top) => top.footprint)),
    entrance,
    inward,
  }
}

/**
 * Where a thing left at an anchor stands: on the piece of furniture that anchor
 * belongs to, at the height that piece is drawn to, beside whoever is standing
 * there rather than inside them. An anchor with no furniture behind it leaves
 * the thing on the floor, which is the only surface there is.
 */
function standing(spot: THREE.Object3D, host: PropSurface | undefined, object: THREE.Object3D): THREE.Vector3 {
  const right = new THREE.Vector3(1, 0, 0).applyEuler(spot.rotation)
  const beside = { x: spot.position.x + right.x * BESIDE, z: spot.position.z + right.z * BESIDE }
  return host ? host.place(beside.x, beside.z, halfOf(object)) : new THREE.Vector3(beside.x, 0, beside.z)
}

/** How far the thing reaches either side of its own centre, so it can be kept on the surface. */
function halfOf(object: THREE.Object3D): { x: number; z: number } {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return { x: 0, z: 0 }
  const size = box.getSize(new THREE.Vector3())
  return { x: size.x / 2, z: size.z / 2 }
}

/** Four walls around a room, split wherever a door sits on them. */
function wallsAround(
  rect: { x: number; y: number; w: number; h: number },
  openings: readonly THREE.Vector2[],
  dressing: Dressing,
): THREE.Mesh[] {
  const thickness = METRICS.building.wallThickness
  const walls: THREE.Mesh[] = []
  const runs: Array<{ horizontal: boolean; at: number; from: number; to: number }> = [
    { horizontal: true, at: rect.y, from: rect.x, to: rect.x + rect.w },
    { horizontal: true, at: rect.y + rect.h, from: rect.x, to: rect.x + rect.w },
    { horizontal: false, at: rect.x, from: rect.y, to: rect.y + rect.h },
    { horizontal: false, at: rect.x + rect.w, from: rect.y, to: rect.y + rect.h },
  ]

  for (const run of runs) {
    for (const span of splitForDoors(run, openings)) {
      const length = span.to - span.from
      if (length <= 0.05) continue
      const geometry = run.horizontal
        ? new THREE.BoxGeometry(length, CEILING_HEIGHT, thickness)
        : new THREE.BoxGeometry(thickness, CEILING_HEIGHT, length)
      const wall = new THREE.Mesh(geometry, dressing.surface('wall'))
      const middle = (span.from + span.to) / 2
      wall.position.set(
        run.horizontal ? middle : run.at,
        CEILING_HEIGHT / 2,
        run.horizontal ? run.at : middle,
      )
      wall.castShadow = true
      wall.receiveShadow = true
      walls.push(wall)
    }
  }
  return walls
}

/** The pieces of one wall run that are left once the doorways are cut out. */
function splitForDoors(
  run: { horizontal: boolean; at: number; from: number; to: number },
  openings: readonly THREE.Vector2[],
): Array<{ from: number; to: number }> {
  const onThisWall = openings
    .filter((door) => Math.abs((run.horizontal ? door.y : door.x) - run.at) < 0.35)
    .map((door) => (run.horizontal ? door.x : door.y))
    .filter((along) => along > run.from - DOOR_GAP && along < run.to + DOOR_GAP)
    .sort((a, b) => a - b)

  const spans: Array<{ from: number; to: number }> = []
  let cursor = run.from
  for (const door of onThisWall) {
    spans.push({ from: cursor, to: Math.max(cursor, door - DOOR_GAP / 2) })
    cursor = Math.min(run.to, door + DOOR_GAP / 2)
  }
  spans.push({ from: cursor, to: run.to })
  return spans
}
