import { METRICS, type Interior } from '@gb/world'
import * as THREE from 'three'
import { DOOR_GAP } from './doorway.ts'
import type { Dressing } from './dressing.ts'
import { metreUvs } from './metre-uv.ts'

/** How high a room's ceiling is: the ground floor's. */
export const CEILING_HEIGHT = METRICS.building.groundFloorHeight

/**
 * The shell of a room: its floor, its ceiling and a wall on every edge of
 * every room in it with the doorways cut out. Every surface is told how many
 * metres it covers and carries UVs in metres, so a dressing tiles at real size
 * with no rule of its own.
 */
export function shellOf(interior: Interior, dressing: Dressing): THREE.Mesh[] {
  const { w, h } = interior.size
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dressing.surface('floor', { u: w, v: h }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(w / 2, 0, h / 2)
  floor.name = 'floor'
  floor.receiveShadow = true
  metreUvs(floor)

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dressing.surface('ceiling', { u: w, v: h }))
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(w / 2, CEILING_HEIGHT, h / 2)
  ceiling.name = 'ceiling'
  metreUvs(ceiling)

  const openings = interior.doors.map((door) => new THREE.Vector2(door.pos.x, door.pos.y))
  const walls = interior.rooms.flatMap((room) => wallsAround(room.rect, openings, dressing))
  return [floor, ceiling, ...walls]
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
      const wall = new THREE.Mesh(geometry, dressing.surface('wall', { u: length, v: CEILING_HEIGHT }))
      const middle = (span.from + span.to) / 2
      wall.position.set(
        run.horizontal ? middle : run.at,
        CEILING_HEIGHT / 2,
        run.horizontal ? run.at : middle,
      )
      wall.castShadow = true
      wall.receiveShadow = true
      metreUvs(wall)
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
