// @vitest-environment node
import type { Driving } from '@gb/drive'
import type { Hud, HudPatch, Notice } from '@gb/hud'
import { CLIPS, GESTURES, type CastMember } from '@gb/cast'
import { CityNav } from '@gb/nav'
import { PlayerState } from '@gb/play'
import { QuestLog, rewardFor, validateQuest, type Objective } from '@gb/quest'
import { buildCity, Greybox, PropFootprint, type CityBuild, type Dressing } from '@gb/scene'
import { METRICS, World, type Interior } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { blocked, slide, step } from '../src/walk.ts'
import { alsoBlockedBy } from '../src/bodies.ts'
import { cityGround, citySolid, furnishedSolid } from '../src/solids.ts'
import { Attending, type Post } from '../src/attending.ts'
import { Buildings } from '../src/buildings.ts'
import { Chart } from '../src/chart.ts'
import { guarded } from '../src/guarded.ts'
import { Travel } from '../src/travel.ts'
import { Compass } from '../src/compass.ts'
import { Conditions } from '../src/conditions.ts'
import { Escorts } from '../src/escorts.ts'
import { Gestures } from '../src/gestures.ts'
import { Members } from '../src/members.ts'
import { Guide } from '../src/guide.ts'
import { Intents } from '../src/intents.ts'
import { DAY, darkness, INDOORS, lookOf, NIGHT } from '../src/night.ts'
import { marked, offered, type Marked } from '../src/places.ts'
import { Companions } from '../src/companions.ts'
import { Playthrough } from '../src/playthrough.ts'
import { Reporting } from '../src/reporting.ts'
import { atAnOpenDoor } from '../src/spawn.ts'
import { Stashing } from '../src/stashing.ts'
import { Body, CROUCH_EYE, JUMP_SPEED } from '../src/stance.ts'
import { Sidecar } from '@gb/sidecar'
import { Conversation, type TalkMove } from '@gb/talk'
import type { Player } from '../src/player.ts'
import { Street } from '../src/street.ts'
import { Talking } from '../src/talking.ts'
import { pick, Targeting } from '../src/targets.ts'
import type { Stage } from '../src/stage.ts'
import type { Sky } from '../src/sky.ts'
import type { Vec2 } from '../src/walk.ts'
import { CLOSE_FOV, WIDE_FOV, Zoom } from '../src/zoom.ts'
import type { Counters } from '../src/counters.ts'
import type { Locks } from '../src/locks.ts'
import type { Machines } from '../src/machines.ts'
import { Minimap } from '../src/minimap.ts'
import { CityArt } from '../src/rooms.ts'
import { carryOver } from '../src/seam.ts'
import { anyWorld, doorwaysOnly, fittings, lockUp } from './support/parts.ts'

/** A quest doc, run past the same door the game runs one past, on a world that has everything. */
function checked(doc: unknown) {
  const validated = validateQuest(doc, anyWorld)
  if (!validated.ok) throw new Error(JSON.stringify(validated.error))
  return validated.value
}

/** Everything from x = 4 east is wall. */
const wall = (x: number) => x >= 4

describe('walking', () => {
  it('goes the way the body is facing', () => {
    const north = step({ forward: 1, strafe: 0, running: false }, 0, 1)
    expect(north.z).toBeLessThan(0)
    expect(north.x).toBeCloseTo(0, 6)

    const east = step({ forward: 1, strafe: 0, running: false }, -Math.PI / 2, 1)
    expect(east.x).toBeGreaterThan(0)
    expect(east.z).toBeCloseTo(0, 6)
  })

  it('runs faster than it walks, and stands still when nothing is held', () => {
    const walked = step({ forward: 1, strafe: 0, running: false }, 0, 1)
    const ran = step({ forward: 1, strafe: 0, running: true }, 0, 1)
    expect(Math.abs(ran.z)).toBeGreaterThan(Math.abs(walked.z))
    expect(step({ forward: 0, strafe: 0, running: false }, 0, 1)).toEqual({ x: 0, z: 0 })
  })

  it('slides along a wall instead of stopping dead against it', () => {
    const moved = slide({ x: 3, z: 3 }, { x: 1, z: -1 }, wall)
    expect(moved.x).toBe(3)
    expect(moved.z).toBe(2)
  })

  it('counts a body as blocked when any of its sides is in something solid', () => {
    // the body has width: its centre is clear of the wall at 3.5, its side is not at 3.7
    expect(blocked(3.5, 0, wall)).toBe(false)
    expect(blocked(3.7, 0, wall)).toBe(true)
    expect(blocked(4.2, 0, wall)).toBe(true)
  })
})

describe('zoom', () => {
  it('eases in when the button is held and back out when it is let go', () => {
    const zoom = new Zoom()
    expect(zoom.fov).toBe(WIDE_FOV)

    zoom.close = true
    expect(zoom.update(1 / 60)).toBe(true)
    expect(zoom.fov).toBeLessThan(WIDE_FOV)
    expect(zoom.fov).toBeGreaterThan(CLOSE_FOV)

    for (let i = 0; i < 60; i++) zoom.update(1 / 60)
    expect(zoom.fov).toBe(CLOSE_FOV)
    expect(zoom.update(1 / 60)).toBe(false)

    zoom.close = false
    for (let i = 0; i < 60; i++) zoom.update(1 / 60)
    expect(zoom.fov).toBe(WIDE_FOV)
  })

  it('slows the mouse by as much as it narrowed the view', () => {
    const zoom = new Zoom()
    expect(zoom.lookScale).toBeCloseTo(1, 6)

    zoom.close = true
    for (let i = 0; i < 60; i++) zoom.update(1 / 60)
    expect(zoom.lookScale).toBeLessThan(0.85)
    expect(zoom.lookScale).toBeGreaterThan(0.6)
  })
})

describe('standing, crouching, jumping', () => {
  const settle = (body: Body, ground = 0, frames = 60) => {
    for (let i = 0; i < frames; i++) body.update(1 / 60, ground)
  }

  it('stands at eye height on flat ground', () => {
    const body = new Body()
    settle(body)
    expect(body.eye).toBeCloseTo(METRICS.player.eyeHeight, 5)
    expect(body.airborne).toBe(false)
    expect(body.speedScale).toBe(1)
  })

  it('crouches lower and slower, and stands back up', () => {
    const body = new Body()
    body.crouching = true
    settle(body)
    expect(body.eye).toBeCloseTo(CROUCH_EYE, 5)
    expect(body.speedScale).toBeLessThan(1)

    body.crouching = false
    settle(body)
    expect(body.eye).toBeCloseTo(METRICS.player.eyeHeight, 5)
  })

  it('comes down faster than it went up, so the jump has weight', () => {
    const body = new Body()
    settle(body)
    body.jump()

    let rising = 0
    let falling = 0
    let last = body.eye
    for (let i = 0; i < 200 && (body.airborne || i === 0); i++) {
      body.update(1 / 60, 0)
      if (body.eye > last) rising++
      else if (body.airborne) falling++
      last = body.eye
    }
    expect(rising).toBeGreaterThan(0)
    expect(falling).toBeGreaterThan(0)
    expect(falling).toBeLessThan(rising)
  })

  it('jumps up and comes back down to the ground it left', () => {
    const body = new Body()
    settle(body)
    body.jump()
    expect(body.airborne).toBe(true)

    let highest = body.eye
    for (let i = 0; i < 120; i++) {
      body.update(1 / 60, 0)
      highest = Math.max(highest, body.eye)
    }
    expect(highest).toBeGreaterThan(METRICS.player.eyeHeight + 0.8)
    expect(highest).toBeLessThan(METRICS.player.eyeHeight + 1.3)
    expect(body.eye).toBeCloseTo(METRICS.player.eyeHeight, 5)
    expect(body.airborne).toBe(false)
  })

  it('will not jump while crouched, or twice in the air', () => {
    const body = new Body()
    body.crouching = true
    settle(body)
    body.jump()
    expect(body.airborne).toBe(false)

    body.crouching = false
    settle(body)
    body.jump()
    body.update(1 / 60, 0)
    const rising = body.eye
    body.jump()
    body.update(1 / 60, 0)
    // the second press did not add to the first
    expect(body.eye - rising).toBeLessThan(JUMP_SPEED / 60)
  })

  it('steps up onto a kerb rather than through it', () => {
    const body = new Body()
    settle(body)
    const kerb = METRICS.street.curbHeight

    body.update(1 / 60, kerb)
    // it rises towards the step rather than snapping onto it
    expect(body.eye).toBeGreaterThan(METRICS.player.eyeHeight)
    expect(body.eye).toBeLessThan(METRICS.player.eyeHeight + kerb)

    settle(body, kerb)
    expect(body.eye).toBeCloseTo(METRICS.player.eyeHeight + kerb, 5)
  })
})

describe('bumping into people and cars', () => {
  const open: (x: number, z: number) => boolean = () => false

  it('stops the player walking through somebody', () => {
    const solid = alsoBlockedBy(open, () => [{ x: 10, z: 10 }])
    expect(solid(10, 10)).toBe(true)
    expect(solid(10.3, 10)).toBe(true)
    expect(solid(11, 10)).toBe(false)
  })

  it('lets the player slide past somebody rather than sticking to them', () => {
    const solid = alsoBlockedBy(open, () => [{ x: 10, z: 10 }])
    // walking straight at them, diagonally: the blocked axis stops, the other carries on
    const moved = slide({ x: 9.2, z: 10 }, { x: 0.4, z: 0.4 }, solid)
    expect(moved.x).toBe(9.2)
    expect(moved.z).toBeCloseTo(10.4, 5)
  })

  it('treats a car as the long thing it is, not as a circle', () => {
    // pointing down -Z, so it is long north to south and narrow east to west
    const solid = alsoBlockedBy(open, () => [], () => [{ x: 0, z: 0, heading: 0 }])
    expect(solid(0, 2)).toBe(true)
    expect(solid(0, 2.4)).toBe(false)
    expect(solid(1.2, 0)).toBe(false)
    expect(solid(0.8, 0)).toBe(true)
  })

  it('turns with the car', () => {
    // the same car turned a quarter turn is long east to west instead
    const solid = alsoBlockedBy(open, () => [], () => [{ x: 0, z: 0, heading: Math.PI / 2 }])
    expect(solid(2, 0)).toBe(true)
    expect(solid(0, 2)).toBe(false)
  })

  it('still respects the walls underneath', () => {
    const solid = alsoBlockedBy((x) => x > 5, () => [])
    expect(solid(6, 0)).toBe(true)
    expect(solid(4, 0)).toBe(false)
  })

  it('asks fresh every time, because everybody is moving', () => {
    let people = [{ x: 0, z: 0 }]
    const solid = alsoBlockedBy(open, () => people)
    expect(solid(0, 0)).toBe(true)
    people = []
    expect(solid(0, 0)).toBe(false)
  })
})

describe('leaving town', () => {
  const town = {
    cellSize: 2,
    grid: {
      at: (x: number, y: number) => {
        if (x < 0 || y < 0 || x > 3 || y > 3) return undefined
        return x === 1 && y === 1 ? ('building' as const) : ('street' as const)
      },
    },
  } as unknown as Parameters<typeof citySolid>[0]

  /** A hill outside town, with a cliff on one side of it. */
  const land = {
    heightAt: (x: number) => (x > 8 ? (x - 8) * 0.5 : 0),
    walkableAt: (x: number) => x < 30,
  }

  it('walls the world at the grid edge when there is no land', () => {
    const solid = citySolid(town)
    expect(solid(1, 1)).toBe(false)
    expect(solid(20, 1)).toBe(true)
  })

  it('lets the player walk out onto open country when there is', () => {
    const solid = citySolid(town, land)
    expect(solid(20, 1)).toBe(false)
    // and stops them where the land itself is not walkable
    expect(solid(40, 1)).toBe(true)
  })

  it('still stops them walking into a building', () => {
    expect(citySolid(town, land)(3, 3)).toBe(true)
  })

  it('stands them on the land outside and on the kerb inside', () => {
    const ground = cityGround(town, land)
    expect(ground(20, 1)).toBeCloseTo(6, 5)
    expect(ground(1, 1)).toBe(0)
  })
})

describe('furniture indoors', () => {
  // one room filling a 10x8 shell, no interior partitions to get in the way
  const room = { w: 10, h: 8 }
  const interior = {
    id: 'int_0001',
    size: room,
    rooms: [{ id: 'room_0001', kind: 'main', rect: { x: 0, y: 0, w: room.w, h: room.h } }],
    doors: [],
    furniture: [],
    anchors: [],
  } as unknown as Interior

  /** A table 1.2 m across and 0.8 m deep, standing in the middle of the floor. */
  function table(x: number, z: number, rot = 0): PropFootprint {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.8))
    mesh.geometry.translate(0, 0.375, 0)
    mesh.position.set(x, 0, z)
    mesh.rotation.y = rot
    mesh.updateMatrixWorld(true)
    return new PropFootprint('prop_0001', 'table', mesh)
  }

  it('stops the player walking through a table', () => {
    const solid = furnishedSolid(interior, [table(5, 4)])
    expect(solid(5, 4)).toBe(true)
    expect(solid(2, 2)).toBe(false)
  })

  it('still keeps the player inside the shell', () => {
    const bare = furnishedSolid(interior, [])
    const furnished = furnishedSolid(interior, [table(5, 4)])
    for (const at of [furnished, bare]) {
      expect(at(-0.5, 4)).toBe(true)
      expect(at(5, room.h + 0.5)).toBe(true)
    }
  })

  it('blocks along the way the table is turned, not the way the room is', () => {
    // the long side runs across x unturned, so a quarter turn swaps which axis is wide
    const straight = furnishedSolid(interior, [table(5, 4)])
    const turned = furnishedSolid(interior, [table(5, 4, Math.PI / 2)])
    expect(straight(5.5, 4)).toBe(true)
    expect(straight(5, 4.5)).toBe(false)
    expect(turned(5.5, 4)).toBe(false)
    expect(turned(5, 4.5)).toBe(true)
  })
})

describe('the night grade', () => {
  it('develops full daylight as day and the dark as night, and a room the same at every hour', () => {
    expect(lookOf(0)).toEqual(DAY)
    expect(lookOf(1)).toEqual(NIGHT)
    expect(lookOf(2)).toEqual(NIGHT)
    expect(INDOORS.exposure).toBeGreaterThan(DAY.exposure)
  })

  it('crosses over through dusk instead of switching, and never goes past either end', () => {
    // with no sky to read, the dark comes up round the whole hour the sun sets
    let before = darkness(14)
    expect(before).toBe(0)
    for (let hour = 14.5; hour <= 21; hour += 0.5) {
      const now = darkness(hour)
      expect(now).toBeGreaterThanOrEqual(before)
      expect(now).toBeLessThanOrEqual(1)
      before = now
    }
    expect(before).toBe(1)
    expect(darkness(12)).toBe(0)
    expect(darkness(0)).toBe(1)
  })

  it('holds daylight for a reading it cannot make, rather than grading the frame to nothing', () => {
    expect(lookOf(Number.NaN)).toEqual(DAY)
    expect(darkness(Number.NaN)).toBe(0)
  })
})

describe('turning to whoever is talking to you', () => {
  const EYE = 1.7
  const STEP = 1 / 60

  /** The crowd, as this box sees it: a hold that records what was asked of it. */
  function street(known: string) {
    const faced: { x: number; y: number; z: number }[] = []
    let live = true
    const hold = {
      face: (x: number, y: number, z: number) => void faced.push({ x, y, z }),
      release: () => void (live = false),
      get held() {
        return live
      },
    }
    return { faced, hold, talkRadius: 5, attend: (npcId: string) => (npcId === known ? hold : undefined) }
  }

  /** Somebody at their post: a body facing north and, when the art pack dressed them, a person who can leave their stance. */
  function post(at: { x: number; z: number }, dressed = false) {
    const body = new THREE.Object3D()
    body.position.set(at.x, 0, at.z)
    const attended: THREE.Vector3[] = []
    let resumed = 0
    const member = { attend: (point: THREE.Vector3) => void attended.push(point.clone()), resume: () => void resumed++ }
    return {
      post: (dressed ? { body, member } : { body }) satisfies Post,
      body,
      attended,
      get resumed() {
        return resumed
      },
    }
  }

  /** How far a point is off the front of a body, in radians. */
  function offTheFront(body: THREE.Object3D, at: THREE.Vector3): number {
    const dx = at.x - body.position.x
    const dz = at.z - body.position.z
    const away = Math.hypot(dx, dz)
    const dot = (dx / away) * -Math.sin(body.rotation.y) + (dz / away) * -Math.cos(body.rotation.y)
    return Math.acos(Math.min(Math.max(dot, -1), 1))
  }

  it('holds a walker still for as long as the conversation, and lets them go when it ends', () => {
    const crowd = street('npc_walker')
    const eye = new THREE.Vector3(4, EYE, 2)
    const attending = new Attending({ street: crowd, eye, post: () => undefined })

    attending.hold('npc_walker')
    attending.update(STEP)
    eye.set(5, EYE, 2)
    attending.update(STEP)

    // the point moves with the player, so they are watched rather than left facing where they stood
    expect(crowd.faced).toEqual([
      { x: 4, y: EYE, z: 2 },
      { x: 5, y: EYE, z: 2 },
    ])
    expect(crowd.hold.held).toBe(true)

    attending.release()
    expect(crowd.hold.held).toBe(false)
    attending.update(STEP)
    expect(crowd.faced.length).toBe(2)
  })

  it('ends the conversation when whoever is held has been let go by the crowd', () => {
    const crowd = street('npc_walker')
    let ended = 0
    const attending = new Attending({ street: crowd, eye: new THREE.Vector3(4, EYE, 2), post: () => undefined, gone: () => void ended++ })
    attending.hold('npc_walker')
    attending.update(STEP)
    expect(ended).toBe(0)

    // the crowd's one signal: the player walked off, or the walker was retired
    crowd.hold.release()
    attending.update(STEP)
    expect(ended).toBe(1)
  })

  it('brings somebody at their post out of their stance to face the player, and sends them back after', () => {
    const crowd = street('nobody')
    const eye = new THREE.Vector3(0, EYE, -3)
    const standing = post({ x: 0, z: 0 }, true)
    const attending = new Attending({ street: crowd, eye, post: () => standing.post })

    attending.hold('npc_clerk')
    expect(standing.attended).toEqual([new THREE.Vector3(0, EYE, -3)])
    // the object is the art pack's to turn inside: where the room put them stays put
    for (let frame = 0; frame < 60; frame++) attending.update(STEP)
    expect(standing.body.rotation.y).toBe(0)
    expect(standing.attended).toHaveLength(1)

    // the point follows the player, handed over as they move rather than every frame
    eye.set(1, EYE, -3)
    attending.update(STEP)
    expect(standing.attended).toHaveLength(2)
    expect(standing.attended[1]).toEqual(new THREE.Vector3(1, EYE, -3))

    attending.release()
    expect(standing.resumed).toBe(1)
    attending.update(STEP)
    expect(standing.attended).toHaveLength(2)
  })

  it('ends a conversation at a post when the player walks off, by the same range as on the pavement', () => {
    const crowd = street('nobody')
    const eye = new THREE.Vector3(0, EYE, -2)
    const standing = post({ x: 0, z: 0 }, true)
    let ended = 0
    const attending = new Attending({ street: crowd, eye, post: () => standing.post, gone: () => void ended++ })

    attending.hold('npc_clerk')
    for (let frame = 0; frame < 30; frame++) attending.update(STEP)
    expect(ended).toBe(0)

    eye.set(0, EYE, -crowd.talkRadius - 0.5)
    attending.update(STEP)
    expect(ended).toBe(1)
  })

  it('turns a body the greybox drew only as far as its head cannot reach, and puts it back after', () => {
    const crowd = street('nobody')
    const eye = new THREE.Vector3()
    const standing = post({ x: 0, z: 0 })
    const attending = new Attending({ street: crowd, eye, post: () => standing.post })

    // straight in front of them: their head is enough, and their shoulders stay square to the counter
    eye.set(0, EYE, -3)
    attending.hold('npc_clerk')
    for (let frame = 0; frame < 120; frame++) attending.update(STEP)
    expect(standing.body.rotation.y).toBeCloseTo(0, 6)

    // off to one side: the body comes round exactly as far as leaves them able to look
    eye.set(3, EYE, 0)
    attending.update(STEP)
    // one frame of a turn is a turn started, not a turn finished
    expect(Math.abs(standing.body.rotation.y)).toBeGreaterThan(0)
    expect(Math.abs(standing.body.rotation.y)).toBeLessThan(0.1)
    for (let frame = 0; frame < 120; frame++) attending.update(STEP)
    const turned = standing.body.rotation.y
    expect(turned).toBeLessThan(0)
    expect(offTheFront(standing.body, eye)).toBeCloseTo(1.25, 3)

    attending.release()
    // they do not stand there facing where the player was: they come back to their post
    for (let frame = 0; frame < 120; frame++) attending.update(STEP)
    expect(standing.body.rotation.y).toBe(0)
  })
})

/**
 * A town with one way across it: open ground north and south, a run of water
 * between them, and the only crossing at the east edge. Two buildings: one you
 * can walk to the long way round, and one on an island nobody reaches.
 */
function town(): World {
  const world = World.create({ name: 'Fordwater', theme: 'plain', seed: 'contract', width: 24, height: 14 })
  world.paint({ x: 0, y: 6, w: 22, h: 1 }, 'water')

  const reachable = world.addPlot({
    kind: 'bar',
    name: 'The Copper Wheel',
    rect: { x: 1, y: 2, w: 3, h: 2 },
    entrance: { cell: { x: 2, y: 4 }, facing: 'south' },
    storeys: 2,
    style: 'brick',
  })
  const island = world.addPlot({
    kind: 'shop',
    name: 'Kell Supply',
    rect: { x: 18, y: 1, w: 2, h: 2 },
    entrance: { cell: { x: 18, y: 3 }, facing: 'south' },
    storeys: 1,
    style: 'brick',
  })
  if (!reachable.ok || !island.ok) throw new Error('the town would not build')
  // a moat round the shop's door, so the shop has a door and no way to it
  world.paint({ x: 17, y: 3, w: 1, h: 2 }, 'water')
  world.paint({ x: 19, y: 3, w: 1, h: 2 }, 'water')
  world.paint({ x: 18, y: 4, w: 1, h: 1 }, 'water')
  return world
}

/** An objective pointing at a building, the shape `@gb/quest` publishes. */
function heading(plotId: string, label?: string): Objective {
  return {
    questId: 'quest_0001',
    questTitle: 'The delivery',
    stepId: 'step_0002',
    text: 'Get to the bar before it shuts',
    ...(label ? { markerLabel: label } : {}),
    place: { plotId },
  }
}

/** The interface, as this box sees it: a hud that records what it was pushed. */
function screenful() {
  const pushed: HudPatch[] = []
  const announced: Notice[] = []
  const hud = {
    show: (patch: HudPatch) => void pushed.push(patch),
    announce: (notice: Notice) => void announced.push(notice),
  } as unknown as Hud
  return { pushed, announced, hud }
}

/**
 * A bar with a counter along the north wall: two people behind it and a panel of
 * stained glass lying beside the nearest of them, 0.45 m to that person's own
 * right. They keep the anchor at x=9.65 facing south, so their right is west
 * and the glass lands at x=9.20.
 */
function anchorage(): { world: World; plotId: string; doorstep: Vec2 } {
  const world = World.create({ name: 'Anchorage', theme: 'plain', seed: 'reach', width: 24, height: 14 })
  const plot = world.addPlot({
    kind: 'bar',
    name: 'The Bright Anchor',
    rect: { x: 1, y: 2, w: 8, h: 4 },
    entrance: { cell: { x: 5, y: 6 }, facing: 'south' },
    storeys: 1,
    style: 'brick',
  })
  if (!plot.ok) throw new Error(JSON.stringify(plot.error))

  const inside = world.addInterior({
    id: 'interior_0001',
    plotId: plot.value.id,
    kind: 'bar',
    size: { w: 14, h: 8 },
    rooms: [{ id: 'room_0001', kind: 'main', name: 'The bar', rect: { x: 0, y: 0, w: 14, h: 8 } }],
    doors: [{ id: 'door_0001', from: 'outside', to: 'room_0001', pos: { x: 7, y: 8 }, rot: 0, locked: false }],
    furniture: [],
    anchors: [
      { id: 'anchor_0001', kind: 'serve', roomId: 'room_0001', pos: { x: 9.65, y: 3 }, rot: 180 },
      { id: 'anchor_0002', kind: 'serve', roomId: 'room_0001', pos: { x: 11.5, y: 3 }, rot: 180 },
    ],
  })
  if (!inside.ok) throw new Error(JSON.stringify(inside.error))

  for (const [id, name, anchorId] of [
    ['npc_0001', 'Wren Ashby', 'anchor_0001'],
    ['npc_0002', 'Mab Tolliver', 'anchor_0002'],
  ] as const) {
    const added = world.addNpc({
      id,
      name,
      role: 'bartender',
      appearance: { base: 'female', variant: 2 },
      personality: 'Busy.',
      knowledge: ['The bar shuts at two.'],
      station: { interiorId: 'interior_0001', anchorId },
    })
    if (!added.ok) throw new Error(JSON.stringify(added.error))
  }

  // the glass lies on the counter beside the first of them
  const glass = world.addItem(
    { id: 'item_0001', name: 'Stained glass', description: 'A panel of coloured glass.', archetype: 'painting', value: 40, bulk: 'two-handed' },
    { at: 'anchor', itemId: 'item_0001', interiorId: 'interior_0001', anchorId: 'anchor_0001' },
  )
  if (!glass.ok) throw new Error(JSON.stringify(glass.error))
  return { world, plotId: plot.value.id, doorstep: { x: 11, z: 13 } }
}

/** The bar, opened: a real `Buildings` with the renderer and the street stubbed out. */
function walkIn(away: () => string[]): { buildings: Buildings; targeting: Targeting; world: World; player: PlayerState } {
  const { world, plotId, doorstep } = anchorage()
  const art = new CityArt(new Greybox())
  const city = doorwaysOnly(world, new Map([[plotId, doorstep]]), art)
  const street = { solid: () => () => false, floor: () => () => 0, walkers: () => [] } as unknown as Street
  const player = PlayerState.create(world.id)
  const log = QuestLog.create([], player)
  const { hud } = screenful()
  const report = new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock) })
  const locks = lockUp({ world, player, log, report })
  const buildings = new Buildings({
    world,
    player,
    locks,
    art,
    stage: { show: () => {}, indoors: () => {} } as unknown as Stage,
    body: { setSolid: () => {}, setGround: () => {}, placeAt: () => {}, position: { x: 5, z: 21 } } as unknown as Player,
    city,
    sky: { visible: true } as unknown as Sky,
    street,
    announce: () => {},
    arrived: () => {},
    cameOut: () => {},
    away,
  })
  buildings.enter(plotId)
  const driving = { aboard: false, target: () => undefined } as unknown as Driving
  const stashing = new Stashing({ world, log, player, buildings, report })
  const { machines, counters } = fittings({ world, player, log, hud, report, buildings, locks })
  const targeting = new Targeting({ world, city, buildings, stashing, street, driving, locks, machines })
  return { buildings, targeting, world, player }
}

describe('what is in reach inside a room', () => {
  // right in front of the counter, looking north at it: the person is dead
  // ahead and the glass is the 0.45 m to their side that the counter puts it
  const at = { x: 9.65, z: 4.2 }
  const north = 0

  it('offers the person and the thing beside them when both are actually in the room', () => {
    const { targeting } = walkIn(() => [])
    const listed = targeting.list(at)
    expect(listed.map((target) => target.label).toSorted()).toEqual([
      'Step outside',
      'Take the stained glass',
      'Talk to Mab Tolliver',
      'Talk to Wren Ashby',
    ])
    // aimed at the counter, the person standing on it wins, which is right
    expect(pick(at, north, listed)?.label).toBe('Talk to Wren Ashby')
  })

  it('leaves out somebody who is out walking the street, so the thing beside them can be taken', () => {
    const { targeting } = walkIn(() => ['npc_0001'])
    const listed = targeting.list(at)

    expect(listed.map((target) => target.label)).not.toContain('Talk to Wren Ashby')
    // the other one is still behind the counter and still offered
    expect(listed.map((target) => target.label)).toContain('Talk to Mab Tolliver')

    // and the glass is now the thing in reach, from the one spot that could
    // never select it while a body nobody can see was standing on it
    const glass = listed.find((target) => target.kind === 'take')!
    expect(Math.round(glass.at.x * 100) / 100).toBe(9.2)
    expect(pick(at, north, listed)?.label).toBe('Take the stained glass')
  })

  it('notes the place as found on the way in, for the codex', () => {
    const { player } = walkIn(() => [])
    expect(player.discovered().places).toEqual(['interior_0001'])
  })

  it('does not stop the player walking through somebody who is not in the room', () => {
    const { buildings } = walkIn(() => ['npc_0001'])
    expect(buildings.peopleHere().map((person) => person.id)).toEqual(['npc_0002'])

    // and asking somebody along takes them off their post the same way
    buildings.showPerson('npc_0002', false)
    expect(buildings.peopleHere()).toEqual([])
  })

  it('measures the way to a quest from the door of the building the player is in', () => {
    const { buildings } = walkIn(() => [])
    // inside, the player stands at their own metres across the room's floor,
    // which is nowhere near where the city thinks the building is
    expect(buildings.cityPosition()).toEqual({ x: 11, z: 13 })
    buildings.leave()
    expect(buildings.cityPosition()).toEqual({ x: 5, z: 21 })
  })
})

describe('coming back to where the playthrough left off', () => {
  /** Whatever came back off the save, or the reason it would not load. */
  function came<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
    if (!result.ok) throw new Error(JSON.stringify(result.error))
    return result.value
  }

  /** One errand from the bartender, so there is a job that can be followed. */
  const errand = checked({
    format: 'game-box.quest',
    schemaVersion: 1,
    id: 'quest_0001',
    kind: 'main',
    title: 'A word with Wren',
    summary: 'She wants a word.',
    giverNpcId: 'npc_0001',
    difficulty: 'small',
    startStepId: 'step_0001',
    reward: rewardFor('small'),
    steps: [
      { id: 'step_0001', objective: 'Talk to Wren', kind: 'talk', npcId: 'npc_0001', next: ['step_0002'] },
      { id: 'step_0002', objective: 'Done', kind: 'complete' },
    ],
  })

  /**
   * The city, opened. Handed what a previous visit wrote down, it is that visit
   * coming back: the city is built from its own file the same way it always is,
   * and the save is put back over the top of it.
   */
  function open(kept?: { player: unknown; quests: unknown }) {
    const { world, plotId, doorstep } = anchorage()
    const player = kept ? came(PlayerState.load(kept.player, world.id)) : PlayerState.create(world.id)
    const log = kept ? came(QuestLog.load(kept.quests, [errand], player)) : QuestLog.create([errand], player)

    const followed: { id: string; at?: Vec2; door?: string }[] = []
    const stood: { x: number; z: number; heading: number | undefined }[] = []
    const street = {
      solid: () => () => false,
      floor: () => () => 0,
      walkers: () => [],
      walkable: true,
      follow: (npc: { id: string }, from: { at?: Vec2; door?: string }) => void followed.push({ id: npc.id, ...from }),
      following: () => [],
      stopFollowing: () => {},
    } as unknown as Street
    const body = {
      setSolid: () => {},
      setGround: () => {},
      position: { x: 5, z: 21 },
      heading: 0,
      placeAt: (x: number, z: number, heading?: number) => void stood.push({ x, z, heading }),
    } as unknown as Player
    const art = new CityArt(new Greybox())
    const city = doorwaysOnly(world, new Map([[plotId, doorstep]]), art)
    const { pushed, hud } = screenful()
    const report = new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock) })
    const buildings = new Buildings({
      world,
      player,
      locks: lockUp({ world, player, log, report }),
      art,
      stage: { show: () => {}, indoors: () => {} } as unknown as Stage,
      body,
      city,
      sky: { visible: true } as unknown as Sky,
      street,
      announce: () => {},
      arrived: () => {},
      cameOut: () => {},
      away: () => [],
    })
    const companions = new Companions({ world, player, street, buildings, riding: () => [], note: () => {} })
    const playthrough = new Playthrough({ world, player, log, buildings, body, companions, report })
    const resumed = kept ? playthrough.resume() : false
    return {
      resumed,
      stood,
      followed,
      buildings,
      player,
      log,
      pushed,
      playthrough,
      plotId,
      /** What this visit wrote down, as the store would hold it. */
      written: () => {
        playthrough.write()
        return JSON.parse(JSON.stringify({ player: player.toJSON(), quests: log.toJSON() })) as {
          player: unknown
          quests: unknown
        }
      },
    }
  }

  /** Play a little, close the tab, and open the same city again. */
  function reopen(play: (visit: ReturnType<typeof open>) => void) {
    const first = open()
    play(first)
    return open(first.written())
  }

  it('opens the door they were behind and stands them where they were standing in it', () => {
    const back = reopen((visit) => void visit.buildings.enter(visit.plotId))

    expect(back.resumed).toBe(true)
    // a room is measured in its own metres from its own corner, so the three
    // numbers only mean anything once the player is back through that door
    expect(back.buildings.place.kind).toBe('interior')
    expect(back.stood.at(-1)).toEqual({ x: 5, z: 21, heading: 0 })
  })

  it('writes the room down with the metres, so the two are never read apart', () => {
    const visit = open()
    expect(visit.written().player).toMatchObject({ where: { x: 5, z: 21, heading: 0 } })
    expect(visit.player.where?.interiorId).toBeUndefined()

    visit.buildings.enter(visit.plotId)
    visit.written()
    expect(visit.player.where?.interiorId).toBe('interior_0001')
  })

  it('starts a new playthrough wherever the city starts it', () => {
    const fresh = open()
    expect(fresh.resumed).toBe(false)
    expect(fresh.stood).toEqual([])
  })

  it('brings whoever was walking with them back beside them, not to their post across town', () => {
    const back = reopen((visit) => {
      visit.player.addCompanion('npc_0001')
      visit.buildings.enter(visit.plotId)
    })

    // the doorstep, because a companion waits by the door of a building the
    // player is inside. Left at their post they either walk the whole city to
    // catch up or snap to the player on the first frame
    expect(back.followed).toEqual([{ id: 'npc_0001', at: { x: 11, z: 13 } }])
    expect(back.player.clock.paused).toBe(false)
    // and they are not also standing at their anchor in the room
    expect(back.buildings.peopleHere().map((person) => person.id)).toEqual(['npc_0002'])
  })

  it('follows the job it was following, and lets go of one nobody is holding', () => {
    const held = reopen((visit) => {
      visit.log.start('quest_0001')
      visit.player.setTracked('quest_0001')
    })
    expect(held.pushed.at(-1)?.trackedQuestId).toBe('quest_0001')

    // a tracked id is a name @gb/play never resolves, so a job given up before
    // the reload would point the map and the panel at a quest nobody holds
    const gone = reopen((visit) => void visit.player.setTracked('quest_0404'))
    expect(gone.pushed.some((patch) => patch.trackedQuestId === null)).toBe(true)
    expect(gone.player.tracked).toBeUndefined()
  })

  it('puts a thing back where the city file had it when the save names a shelf this city has not got', () => {
    const back = reopen((visit) => {
      visit.player.take('item_0001')
      visit.player.place('item_0001', { interiorId: 'interior_0001', anchorId: 'anchor_0404' })
    })

    // the spot is two names to @gb/play and it never looks either up, so the
    // one box that knows the city has to settle it: forgotten, the thing is
    // drawn where the file put it rather than nowhere at all
    expect(back.player.placedAt('item_0001')).toBeUndefined()
    back.buildings.enter('plot_0001')
    expect(back.buildings.inside?.pickups.get('item_0001')?.parent).toBeTruthy()
  })
})

describe('the map the player opens', () => {
  const world = town()
  const at = { x: 5, z: 21 }

  function chart(hud: Hud, goals: readonly Marked[] = [], heading = 0) {
    return new Chart({ world, hud, you: () => ({ position: at, heading }), goals: () => goals, entered: () => [] })
  }

  it('draws the plan of the city and stands the player on it, pointing the way they look', () => {
    const { pushed, hud } = screenful()
    // looking east, which is a quarter turn clockwise from north on a north-up plan
    chart(hud, [], -Math.PI / 2).draw()

    const map = pushed[0]!.map!
    expect(map.width).toBe(24)
    expect(map.height).toBe(14)
    expect(map.plots.map((plot) => plot.id)).toEqual(world.plots().map((plot) => plot.id))
    expect(map.plots[0]!.rect).toEqual({ x: 1, y: 2, w: 3, h: 2 })
    // every plot carries its name for the hover and its charter's standing for its fill,
    // and none of them is written on the plan: a plan with every building named on it
    // is unreadable, and most of them are nothing to the player
    expect(map.plots.every((plot) => plot.label !== undefined)).toBe(true)
    expect(map.plots.some((plot) => plot.named)).toBe(false)
    expect(map.plots.map((plot) => plot.prominence)).toEqual(['notable', 'background'])

    const you = map.marks!.find((mark) => mark.kind === 'you')!
    expect(you.x).toBeCloseTo(2.5, 6)
    expect(you.y).toBeCloseTo(10.5, 6)
    expect(you.facing).toBeCloseTo(Math.PI / 2, 6)
  })

  it('pins where the quest is sending them, and names that building alone', () => {
    const { pushed, hud } = screenful()
    const bar = world.plots()[0]!
    chart(hud, marked(world, [heading(bar.id)], () => 'main')).draw()

    const map = pushed[0]!.map!
    const goal = map.marks!.find((mark) => mark.kind === 'goal')!
    // the doorstep, in cells: the pin is on the door rather than on the roof
    expect(goal).toMatchObject({ x: 2.5, y: 4.5, label: 'The Copper Wheel', line: 'main' })
    expect(map.plots.filter((plot) => plot.named).map((plot) => plot.id)).toEqual([bar.id])
  })

  it('names the places the player has walked into, and the landmarks, whatever the quests say', () => {
    const { world: bar, plotId } = anchorage()
    const { pushed, hud } = screenful()
    new Chart({ world: bar, hud, you: () => ({ position: at, heading: 0 }), goals: () => [], entered: () => ['interior_0001'] }).draw()
    expect(pushed[0]!.map!.plots.filter((plot) => plot.named).map((plot) => plot.id)).toEqual([plotId])

    // a chapel or a station is on the plan for being what it is
    const town = World.create({ name: 'Spire', theme: 'plain', seed: 'landmark', width: 24, height: 14 })
    const chapel = town.addPlot({
      kind: 'chapel',
      name: 'St Wren',
      rect: { x: 1, y: 2, w: 3, h: 3 },
      entrance: { cell: { x: 2, y: 5 }, facing: 'south' },
      storeys: 1,
      style: 'brick',
    })
    if (!chapel.ok) throw new Error(JSON.stringify(chapel.error))
    const drawn = screenful()
    new Chart({ world: town, hud: drawn.hud, you: () => ({ position: at, heading: 0 }), goals: () => [], entered: () => [] }).draw()
    expect(drawn.pushed[0]!.map!.plots.map((plot) => [plot.named, plot.prominence])).toEqual([[true, 'landmark']])
  })

  it('pins the building a thing is lying in, for a step that names only the thing', () => {
    const { world: bar, plotId } = anchorage()
    const fetchIt: Objective = {
      questId: 'quest_0001',
      questTitle: 'The delivery',
      stepId: 'step_0001',
      text: 'Find the stained glass',
      itemId: 'item_0001',
    }
    // the glass is on a counter inside, and a room has its own metres, so this
    // has to go thing to room to building or there is nothing to draw
    expect(bar.positionOf('item_0001')).toBeUndefined()
    expect(marked(bar, [fetchIt], () => 'side')).toEqual([{ label: 'The Bright Anchor', x: 11, z: 13, plotId, line: 'side' }])

    // and any of an interchangeable pool answers, so three of five is one pin
    const orTheOther: Objective = { ...fetchIt, itemId: 'item_0404', alternates: ['item_0001'] }
    expect(marked(bar, [orTheOther], () => 'side')).toHaveLength(1)
  })

  it('pins a place once, however many steps of the quest send the player to it', () => {
    const bar = world.plots()[0]!
    expect(marked(world, [heading(bar.id), { ...heading(bar.id), stepId: 'step_0003' }], () => 'side')).toHaveLength(1)
  })

  it('measures nothing while the map is shut, and draws the moment it opens', () => {
    const { pushed, hud } = screenful()
    const drawn = chart(hud)

    for (let frame = 0; frame < 120; frame++) drawn.update(1 / 60)
    expect(pushed).toEqual([])

    drawn.open = true
    drawn.update(1 / 60)
    expect(pushed).toHaveLength(1)
  })
})

describe('the way to the quest you are following', () => {
  const world = town()
  const nav = CityNav.from(world)
  const bar = world.plots()[0]!
  const island = world.plots()[1]!

  function guide(from: { x: number; z: number }, steps: readonly Objective[]) {
    return new Guide({ world, nav, from: () => from, goals: () => marked(world, steps, () => 'side'), steps: () => steps })
  }

  it('gives the walk and the way the street runs, not the line through the water', () => {
    // the bar is twelve metres due north, and the only crossing is away east
    const said = guide({ x: 5, z: 21 }, [heading(bar.id)]).say()
    expect(said).toMatch(/^The Copper Wheel: /)
    expect(said).toMatch(/head east/)
    expect(Number(/(\d+) m/.exec(said)![1])).toBeGreaterThan(60)
  })

  it('calls a place by the name the quest gave it', () => {
    expect(guide({ x: 5, z: 21 }, [heading(bar.id, 'the bar')]).say()).toMatch(/^the bar: /)
  })

  it('says so when there is no way there on foot', () => {
    expect(guide({ x: 5, z: 21 }, [heading(island.id)]).say()).toBe('Kell Supply: no way there on foot')
  })

  it('says you are there when you are standing on it', () => {
    expect(guide({ x: 5, z: 9 }, [heading(bar.id)]).say()).toBe('The Copper Wheel: you are there')
  })

  it('says there is nothing to head for when no quest is being followed', () => {
    expect(guide({ x: 5, z: 21 }, []).say()).toBe('Nothing to head for: follow a quest first')
  })

  it('says a step points nowhere rather than telling a player who is following one to go and find a job', () => {
    // a choice or a merge is a step the player can see and nowhere to walk to
    const nowhere: Objective = { questId: 'quest_0001', questTitle: 'The delivery', stepId: 'step_0009', text: 'Make up your mind' }
    expect(guide({ x: 5, z: 21 }, [nowhere]).say()).toBe('Make up your mind: not a place you can walk to')
  })
})

describe('the hour and the weather', () => {
  const clock = () => PlayerState.create('world_0001').clock

  it('jumps to the next time of day, and never turns the clock back', () => {
    const hours = clock()
    const conditions = new Conditions(hours)

    // a new playthrough opens at 08:00
    expect(conditions.nextTime()).toBe('12:00, the middle of the day')
    expect(hours.hour).toBe(12)
    conditions.nextTime()
    expect(hours.hour).toBe(16)
    conditions.nextTime()
    expect(hours.hour).toBe(21)

    const before = hours.totalSeconds
    const day = hours.day
    conditions.nextTime()
    // the hour the sun is about to rise in, so the sky is already lightening
    expect(hours.hour).toBe(7)
    expect(hours.phase).toBe('dawn')
    // dawn is tomorrow's, so a quest on a timer runs down rather than back up
    expect(hours.day).toBe(day + 1)
    expect(hours.totalSeconds).toBeGreaterThan(before)
  })

  it('turns the weather over and round again', () => {
    const hours = clock()
    const conditions = new Conditions(hours)
    expect(hours.weather).toBe('clear')

    const seen = [conditions.nextWeather(), conditions.nextWeather(), conditions.nextWeather()]
    expect(seen.every((said) => typeof said === 'string')).toBe(true)
    expect(hours.weather).toBe('clear')
  })

  it('holds the hour where it is, and lets it run on at the rate it was running at', () => {
    const hours = clock()
    const conditions = new Conditions(hours)
    hours.setRate(60)

    expect(conditions.hold()).toBe('Time held')
    expect(hours.paused).toBe(true)
    hours.advance(10)
    expect(hours.hour).toBe(8)
    expect(conditions.view()).toMatchObject({ hour: 8, minute: 0, locked: true, weather: 'clear' })

    expect(conditions.hold()).toBe('Time running')
    expect(hours.paused).toBe(false)
    expect(hours.rate).toBe(60)
  })

  it('takes the settings tab at its word: the clock held, the sky named, a sky it cannot draw refused', () => {
    const hours = clock()
    const conditions = new Conditions(hours)
    expect(conditions.lock(true)).toBe('Time held')
    expect(conditions.lock(true)).toBe('Time held')
    expect(hours.paused).toBe(true)
    expect(conditions.lock(false)).toBe('Time running')

    expect(conditions.setWeather('rain')).toBe('Rain sets in')
    expect(hours.weather).toBe('rain')
    expect(conditions.setWeather('hail')).toBeUndefined()
    expect(hours.weather).toBe('rain')
    expect(conditions.view().weathers).toEqual(['clear', 'overcast', 'rain'])
  })

  it('lands a jump to sundown with the sun still up', () => {
    const hours = clock()
    const conditions = new Conditions(hours)
    conditions.nextTime()
    conditions.nextTime()
    expect(hours.phase).toBe('dusk')
    expect(hours.isDark).toBe(false)
  })
})

describe('what the interface is pushed', () => {
  function pushing() {
    const { pushed, hud } = screenful()
    const { world } = anchorage()
    const player = PlayerState.create(world.id, 7)
    const log = QuestLog.create([], player)
    const report = new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock) })
    return { pushed, world, player, report }
  }

  it('pushes the clock and the sky with everything else, so the settings tab reads right from the first push', () => {
    const { pushed, report } = pushing()
    report.refresh()
    expect(pushed.at(-1)).toMatchObject({ money: 7, settings: { hour: 8, minute: 0, locked: false, weather: 'clear' } })
  })

  it('pushes the codex as places, people and history in words, the facts learned in text and the rest as still to learn', () => {
    const { pushed, player, report } = pushing()
    player.discover({ place: 'interior_0001' })
    player.discover({ npc: 'npc_0002' })
    player.warm('npc_0002')
    // what the player was told carries its heading before a colon, the way
    // the town's story is told; a line with none is drawn as heard
    player.told('Everybody knows: the freight comes through at night')
    player.told('the harbour master keeps two ledgers')
    report.refresh()

    expect(pushed.at(-1)!.codex).toEqual({
      places: [{ id: 'interior_0001', name: 'The Bright Anchor', text: 'A bar.' }],
      people: [{ id: 'npc_0002', name: 'Mab Tolliver', role: 'bartender', disposition: 'warm', facts: [] }],
      history: [
        { id: '0', title: 'Everybody knows', text: 'the freight comes through at night' },
        { id: '1', title: 'Heard', text: 'the harbour master keeps two ledgers' },
      ],
    })
  })

  it('pushes the journal and the clock again once a game minute, and not every frame', () => {
    const { pushed, player, report } = pushing()
    report.tick()
    expect(pushed).toHaveLength(1)
    player.clock.advance(1)
    report.tick()
    expect(pushed).toHaveLength(1)
    // a game minute is two and a half real seconds at the default rate
    player.clock.advance(2)
    report.tick()
    expect(pushed).toHaveLength(2)
    expect(pushed.at(-1)).toMatchObject({ settings: { hour: 8, minute: 1 }, quests: [] })
  })
})

describe('the compass', () => {
  function strip(input: { outdoors?: boolean; goal?: ReturnType<Guide['resolve']> } = {}) {
    const { pushed, hud } = screenful()
    let heading = 0
    let outdoors = input.outdoors ?? true
    const compass = new Compass({
      hud,
      guide: { resolve: () => input.goal } as unknown as Guide,
      heading: () => heading,
      standing: () => ({ x: 0, z: 0 }),
      outdoors: () => outdoors,
    })
    return { pushed, compass, turn: (to: number) => void (heading = to), goIn: () => void (outdoors = false) }
  }

  it('pushes which way the player faces, clockwise from north, and only when it moves', () => {
    const { pushed, compass, turn } = strip()
    compass.update(1 / 60)
    expect(pushed).toEqual([{ compass: { facing: 0 } }])
    compass.update(1 / 60)
    expect(pushed).toHaveLength(1)
    // looking east is a quarter turn clockwise on a north-up plan
    turn(-Math.PI / 2)
    compass.update(1 / 60)
    expect(pushed.at(-1)!.compass!.facing).toBeCloseTo(Math.PI / 2, 6)
  })

  it('carries the tracked goal as the guide measured it, and marks the story apart from an errand', () => {
    const goal = { label: 'The Copper Wheel', bearing: 1, distance: 140, line: 'main' as const }
    const { pushed, compass } = strip({ goal })
    compass.update(1 / 60)
    expect(pushed.at(-1)!.compass).toEqual({ facing: 0, goal })
  })

  it('takes the strip away indoors, where the route is measured from the door', () => {
    const { pushed, compass, goIn } = strip()
    compass.update(1 / 60)
    goIn()
    compass.update(1 / 60)
    compass.update(1 / 60)
    expect(pushed.map((patch) => patch.compass)).toEqual([{ facing: 0 }, null])
  })
})

describe('the journal', () => {
  const quest = sealed()

  /**
   * A job with a secret in it, the shape the generator's tip-off recipe writes:
   * Iris tells you where to look, which is the only thing that puts the safe on
   * the page at all, and the work she actually pays for is two of the crates.
   */
  function sealed() {
    const doc = {
      format: 'game-box.quest',
      schemaVersion: 1,
      id: 'quest_0001',
      kind: 'side',
      title: 'The delivery',
      summary: 'Iris wants a word, then wants two of the crates.',
      giverNpcId: 'npc_0001',
      difficulty: 'small',
      startStepId: 'step_0001',
      reward: rewardFor('small'),
      steps: [
        {
          id: 'step_0001',
          objective: 'Talk to Iris',
          kind: 'talk',
          npcId: 'npc_0001',
          next: ['step_0002', 'step_0003'],
          effects: [{ kind: 'reveal', stepId: 'step_0002' }],
        },
        { id: 'step_0002', objective: 'Look behind the bar', kind: 'goto', place: { plotId: 'plot_0001' }, hidden: true, optional: true },
        { id: 'step_0003', objective: 'Find two crates', kind: 'collect', itemId: 'item_0001', alternates: ['item_0002'], count: 2, next: ['step_0004'] },
        { id: 'step_0004', objective: 'Finished', kind: 'complete' },
      ],
    }
    return checked(doc)
  }

  function journal() {
    const { pushed, hud } = screenful()
    const player = PlayerState.create('world_0001')
    const log = QuestLog.create([quest], player)
    const report = new Reporting({ world: town(), log, player, hud, conditions: new Conditions(player.clock) })
    const page = () => {
      report.refresh()
      return pushed[pushed.length - 1]!.quests![0]!
    }
    const collect = (itemId: string) => {
      player.take(itemId)
      log.handle({ kind: 'acquired', itemId })
    }
    return { log, player, page, collect }
  }

  it('keeps a secret off the page until something reveals it', () => {
    const { log, page } = journal()
    log.start('quest_0001')

    // the safe is on the quest from the moment it is taken. Listing it then is
    // the journal giving away its own secret before anybody has said a word
    expect(page().steps.map((step) => step.text)).toEqual(['Talk to Iris', 'Find two crates'])

    log.handle({ kind: 'talked', npcId: 'npc_0001' })
    expect(page().steps.map((step) => step.text)).toContain('Look behind the bar')
  })

  it('says where every step stands, not just whether it is finished', () => {
    const { log, page } = journal()
    log.start('quest_0001')
    expect(page().steps.map((step) => step.state)).toEqual(['open', 'upcoming'])

    log.handle({ kind: 'talked', npcId: 'npc_0001' })
    // done behind, open now, and still ahead: three states, and the two that
    // are not done do not read the same
    expect(page().steps.map((step) => [step.stepId, step.state])).toEqual([
      ['step_0001', 'done'],
      ['step_0002', 'open'],
      ['step_0003', 'open'],
    ])
  })

  it('hands the engine\'s page over as it stands, so nothing on it is dropped on the way', () => {
    const { log, page, collect } = journal()
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: 'npc_0001' })
    collect('item_0001')

    // hand-building the tab is what lost `state`, `optional`, `count` and the
    // secrets. There is no mapper: whatever the engine writes on a page is what
    // the interface is handed, including anything it learns to write later
    expect([page()]).toEqual(log.journal())
    expect(page().steps.find((step) => step.stepId === 'step_0003')).toMatchObject({ count: { done: 1, needed: 2 } })
  })

  it('keeps a branch nobody took on the page rather than reading it as work still open', () => {
    const { log, page, collect } = journal()
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: 'npc_0001' })
    collect('item_0001')
    collect('item_0002')
    expect(log.status('quest_0001')).toBe('complete')

    // the safe was never opened and never will be. Left off the page the split
    // reads as if it never happened; left on without a state it reads as a job
    expect(page().steps.find((step) => step.stepId === 'step_0002')!.state).toBe('dropped')
    expect(page().steps.filter((step) => step.state === 'open')).toEqual([])
  })
})

describe('what the player did in the interface', () => {
  /**
   * A job with a fork in it: hear her out, then decide whose it is. Each road
   * has its own errand, and only one of them is ever walked.
   */
  const forked = (() => {
    const doc = {
      format: 'game-box.quest',
      schemaVersion: 1,
      id: 'quest_0001',
      kind: 'main',
      title: 'Whose ledger',
      summary: 'Two people want the same book.',
      giverNpcId: 'npc_0001',
      difficulty: 'small',
      startStepId: 'step_0001',
      reward: rewardFor('small'),
      steps: [
        { id: 'step_0001', objective: 'Hear Mara out', kind: 'talk', npcId: 'npc_0001', next: ['step_0002'] },
        {
          id: 'step_0002',
          objective: 'Decide whose it is',
          kind: 'choice',
          prompt: 'Hollis is offering more than Mara did. Whose is it?',
          options: [
            { id: 'keep-word', label: 'Keep your word to Mara', next: 'step_0003' },
            { id: 'sell-out', label: 'Sell it to Hollis', next: 'step_0004' },
          ],
        },
        { id: 'step_0003', objective: 'Take it back to Mara', kind: 'goto', place: { plotId: 'plot_0001' }, next: ['step_0005'] },
        { id: 'step_0004', objective: 'Take it to Hollis', kind: 'goto', place: { plotId: 'plot_0002' }, next: ['step_0005'] },
        { id: 'step_0005', objective: 'Done', kind: 'complete' },
      ],
    }
    return checked(doc)
  })()

  /** The interface reporting what the player did, wired to the boxes that own it. */
  function reported() {
    const { pushed, hud } = screenful()
    const player = PlayerState.create('world_0001')
    const log = QuestLog.create([forked], player)
    const conditions = new Conditions(player.clock)
    const report = new Reporting({ world: town(), log, player, hud, conditions })
    let released = 0
    let left = 0
    let handed: (boolean | undefined)[] = []
    const intents = new Intents({
      log,
      hud,
      report,
      talking: { say: async () => {}, choose: async () => {}, end: () => {} } as unknown as Talking,
      body: { setTyping: (away: boolean) => void handed.push(away) } as unknown as Player,
      chart: { open: false } as unknown as Chart,
      conditions,
      machines: {} as Machines,
      counters: {} as Counters,
      travel: {} as Travel,
      leave: () => void left++,
      releasePointer: () => void released++,
    })
    const page = () => pushed[pushed.length - 1]!.quests
    // the way a job actually starts: somebody offers it and what changed is
    // reported, which is what puts the page on screen in the first place
    const start = () => report.report(log.start('quest_0001'))
    return { log, player, intents, page, start, pushed, released: () => released, left: () => left, handed }
  }

  it('takes the road the player picked and closes the one they did not', () => {
    const { log, intents, page, start } = reported()
    start()
    log.handle({ kind: 'talked', npcId: 'npc_0001' })

    const asking = log.objectives().find((objective) => objective.choice)!
    expect(asking.choice!.options.map((option) => option.key)).toEqual(['keep-word', 'sell-out'])

    intents.handle({ kind: 'decide', questId: asking.questId, stepId: asking.stepId, optionId: 'sell-out' })

    const steps = new Map(page()![0]!.steps.map((step) => [step.stepId, step.state]))
    expect(steps.get('step_0002')).toBe('done')
    expect(steps.get('step_0004')).toBe('open')
    // the road not taken is on the page and can never be work again
    expect(steps.get('step_0003')).toBe('dropped')
  })

  it('gives a job up on the one report, because the interface already asked twice', () => {
    const { log, intents, page, start } = reported()
    start()
    expect(page()).toHaveLength(1)

    intents.handle({ kind: 'abandon', questId: 'quest_0001' })

    expect(log.status('quest_0001')).toBe('unstarted')
    // the hud takes nothing off the board itself: the list goes back without it
    expect(page()).toEqual([])
  })

  it('shuts the window when something on the page takes the keys, so Escape goes to what is in front', () => {
    const { intents, pushed, handed } = reported()
    intents.handle({ kind: 'window', window: 'quests' })
    pushed.length = 0

    intents.handOver(true)
    // the boot panel is over the top of everything. A window left open behind
    // it takes Escape and Tab, and the player is pressing them at the panel
    expect(pushed.map((patch) => patch.window)).toEqual([null])
    expect(handed).toEqual([true])

    pushed.length = 0
    intents.handOver(false)
    // and nothing is reopened on the way back: the player closed it
    expect(pushed).toEqual([])
    expect(handed).toEqual([true, false])
  })

  it('turns the settings into the same calls the keys make, and pushes the tab what the clock says back', () => {
    const { player, intents, pushed } = reported()
    intents.handle({ kind: 'lock-time', locked: true })
    expect(player.clock.paused).toBe(true)
    expect(pushed.at(-1)!.settings).toMatchObject({ locked: true, hour: 8 })

    intents.handle({ kind: 'skip-time' })
    expect(pushed.at(-1)!.settings).toMatchObject({ hour: 12 })

    intents.handle({ kind: 'weather', weather: 'rain' })
    expect(player.clock.weather).toBe('rain')
    expect(pushed.at(-1)!.settings).toMatchObject({ weather: 'rain', weathers: ['clear', 'overcast', 'rain'] })
  })

  it('leaves the game the way whoever started it says, and decides nothing itself', () => {
    const { intents, left } = reported()
    intents.handle({ kind: 'exit' })
    expect(left()).toBe(1)
  })

  it('hands the pointer back for a window the player has to click, and takes it again when it shuts', () => {
    const { intents, released } = reported()
    intents.handle({ kind: 'window', window: 'quests' })
    expect(released()).toBe(1)

    intents.handle({ kind: 'window', window: null })
    expect(released()).toBe(1)
  })
})

describe('which quest the map and the guide are following', () => {
  /** Two one-errand jobs from two different people, so finishing one leaves one. */
  function errands() {
    const quests = ['npc_0001', 'npc_0002'].map((npcId, index) => {
      const id = `quest_000${index + 1}`
      const doc = {
        format: 'game-box.quest',
        schemaVersion: 1,
        id,
        kind: 'side',
        title: `Job ${index + 1}`,
        summary: 'A word, and it is done.',
        giverNpcId: npcId,
        difficulty: 'small',
        startStepId: 'step_0001',
        reward: rewardFor('small'),
        steps: [
          { id: 'step_0001', objective: `Have a word about job ${index + 1}`, kind: 'talk', npcId, next: ['step_0002'] },
          { id: 'step_0002', objective: 'Done', kind: 'complete' },
        ],
      }
      return checked(doc)
    })
    const player = PlayerState.create('world_0001')
    const log = QuestLog.create(quests, player)
    const report = new Reporting({ world: town(), log, player, hud: screenful().hud, conditions: new Conditions(player.clock) })
    log.start('quest_0001')
    log.start('quest_0002')
    return { log, report }
  }

  it('follows the one the player chose', () => {
    const { report } = errands()
    report.track('quest_0002')
    expect(report.following().map((objective) => objective.questId)).toEqual(['quest_0002'])
  })

  it('falls back to a live job once the one it was following is handed in', () => {
    const { log, report } = errands()
    report.track('quest_0001')
    log.handle({ kind: 'talked', npcId: 'npc_0001' })
    expect(log.status('quest_0001')).toBe('complete')

    // otherwise the map loses its pins and the guide says to go and find a job,
    // with a job open and its step on the panel
    expect(report.following().map((objective) => objective.questId)).toEqual(['quest_0002'])
  })
})

describe('what is in reach out in the street', () => {
  const open = { id: 'plot_0001', name: 'The Copper Wheel', interiorId: 'interior_0001', rect: { x: 1, y: 2, w: 3, h: 2 } }
  const shut = { id: 'plot_0002', name: 'Kell Supply', rect: { x: 6, y: 2, w: 3, h: 2 } }

  const world = { plots: () => [open, shut], npc: () => undefined } as unknown as World
  const city = { doorsteps: new Map([[open.id, { x: 5, z: 9 }], [shut.id, { x: 15, z: 9 }]]) } as unknown as CityBuild
  const outside = { outdoors: true } as unknown as Buildings
  const empty = { walkers: () => [] } as unknown as Street

  /** Standing on the open building's doorstep, with both doorsteps inside the reach asked for. */
  const doorstep = { x: 5, z: 9 }
  const bothInReach = 20

  /** A car sitting in the road, the way `@gb/drive` offers one. */
  const wheel = { kind: 'drive' as const, id: 'car_3', label: 'Get in the taxi', at: { x: 8, z: 20 } }

  // out in the street there is nothing to put anything down on
  const nowhereToLeaveIt = { spots: () => [] } as unknown as Stashing

  // out in the street a door of the city is the only lock, and neither a screen
  // nor a counter is in reach of anybody standing on the pavement
  const nothingInside = { here: () => [] }

  function targeting(driving: Partial<Driving>) {
    return new Targeting({
      world,
      city,
      buildings: outside,
      stashing: nowhereToLeaveIt,
      street: empty,
      driving: driving as Driving,
      locks: {} as Locks,
      machines: nothingInside as unknown as Machines,
    })
  }

  it('offers a door only for a building that opens', () => {
    const listed = targeting({ aboard: false, target: () => undefined }).list(doorstep, bothInReach)
    expect(listed).toEqual([{ kind: 'enter', id: open.id, label: 'Go into The Copper Wheel', at: { x: 5, z: 9 } }])
  })

  it('offers the car standing in the road, and only the way out once the player is in it', () => {
    const onFoot = targeting({ aboard: false, target: () => wheel }).list(doorstep, bothInReach)
    expect(onFoot.map((target) => target.kind)).toEqual(['enter', 'drive'])

    const driving = targeting({ aboard: true, target: () => ({ ...wheel, label: 'Get out' }) }).list(doorstep, bothInReach)
    expect(driving.map((target) => target.label)).toEqual(['Get out'])
  })
})

describe('how many cars a town is worth', () => {
  /** One road across the town, at whatever class and lane count it is laid at. */
  function oneRoad(kind: 'street' | 'avenue', lanes: number): Street {
    const world = World.create({ name: 'Fordwater', theme: 'plain', seed: 'cars', width: 60, height: 8 })
    world.addRoad(
      [
        { id: 'node_0001', cell: { x: 2, y: 4 } },
        { id: 'node_0002', cell: { x: 57, y: 4 } },
      ],
      [{ id: 'road_0001', from: 'node_0001', to: 'node_0002', kind, lanes }],
    )
    return new Street({ world, nav: {} as CityNav, playerOutdoors: () => undefined })
  }

  it('gives a four lane avenue twice the cars of the street it replaced', () => {
    // the flat number this replaces was picked when every road was one lane
    // each way, so widening a road used to spread the same cars thinner
    const street = oneRoad('street', 2).carsWorthOf()
    const avenue = oneRoad('avenue', 4).carsWorthOf()

    expect(street).toBeGreaterThan(0)
    expect(avenue).toBe(street * 2)
  })

  it('counts the lanes and not the size of the town', () => {
    const wide = new Street({
      world: World.create({ name: 'Fordwater', theme: 'plain', seed: 'cars', width: 200, height: 200 }),
      nav: {} as CityNav,
      playerOutdoors: () => undefined,
    })
    // a big empty map with no roads on it is worth no cars at all
    expect(wide.carsWorthOf()).toBe(0)
  })
})

describe('the car the player parked', () => {
  const world = town()
  const parked = { x: 20, z: 21, heading: 0, speed: 0 }

  function street() {
    const laid = new Street({ world, nav: CityNav.from(world), playerOutdoors: () => undefined })
    laid.setPlayerCar({ car: parked, rolling: () => [parked], inTheRoad: () => [{ x: parked.x, z: parked.z, radius: 1 }] })
    return laid
  }

  it('is solid to walk into, the same way the traffic is', () => {
    const solid = street().solid()
    expect(solid(parked.x, parked.z)).toBe(true)
    expect(solid(parked.x + 4, parked.z)).toBe(false)
  })

  it('is something the traffic brakes for, so an abandoned car is not driven through', () => {
    const found = street().obstacles().near(parked, 6)
    expect(found).toEqual([{ x: parked.x, z: parked.z, radius: 1 }])
    expect(street().obstacles().near({ x: parked.x + 40, z: parked.z }, 6)).toEqual([])
  })
})

describe('who a driver has to stop for', () => {
  const world = town()

  it('gives a person no width of their own, so the road uses the one a person is', () => {
    const laid = new Street({ world, nav: CityNav.from(world), playerOutdoors: () => ({ x: 10, z: 10 }) })

    // the body-collision capsule is a third of a metre and this is not it: at
    // that width a car passes half a metre from somebody's middle without
    // slowing, which is close enough to clip a shoulder
    expect(laid.obstacles().near({ x: 10, z: 10 }, 6)).toEqual([{ x: 10, z: 10 }])
  })

  it('answers into the same array every frame without leaving anybody in it', () => {
    let standing = { x: 10, z: 10 }
    const laid = new Street({ world, nav: CityNav.from(world), playerOutdoors: () => standing })
    laid.setPlayerCar({ car: undefined, rolling: () => [], inTheRoad: () => [{ x: 11, z: 10, radius: 1 }] })
    const obstacles = laid.obstacles()

    const first = obstacles.near({ x: 10, z: 10 }, 6)
    expect(first).toHaveLength(2)
    const person = first[0]!

    // read once per update and nothing kept between calls, so the bodies are a
    // pool: a town of walkers costs no allocation to report
    standing = { x: 12, z: 13 }
    const again = obstacles.near({ x: 12, z: 13 }, 6)
    expect(again).toBe(first)
    expect(again[0]).toBe(person)
    expect(again[0]).toEqual({ x: 12, z: 13 })

    // and a crowd that thins out leaves nobody standing in last frame's answer
    standing = { x: 40, z: 40 }
    expect(obstacles.near({ x: 12, z: 13 }, 6)).toEqual([{ x: 11, z: 10, radius: 1 }])
  })
})

describe('where the player starts', () => {
  const shut = { id: 'plot_0001', name: 'Kell Supply', rect: { x: 1, y: 1, w: 2, h: 2 } }
  const open = { id: 'plot_0002', name: 'The Copper Wheel', interiorId: 'interior_0001', rect: { x: 6, y: 1, w: 2, h: 2 } }
  const doorsteps = new Map([[shut.id, { x: 4, z: 7 }], [open.id, { x: 14, z: 7 }]])
  const pavement = (kinds: string) => ({ plots: () => [shut, open], cellSize: 2, grid: { at: () => kinds } }) as unknown as World

  it('stands a step off a door that opens, looking at it, whatever came first on the street', () => {
    const start = atAnOpenDoor(pavement('sidewalk'), { doorsteps, spawn: { x: 0, z: 0, heading: 0 } } as unknown as CityBuild)

    // the open building's doorstep, a couple of metres back down the pavement, facing north into it
    expect(start.x).toBe(14)
    expect(start.z).toBe(9)
    expect(start.heading).toBeCloseTo(0, 6)
  })

  it('stays on the doorstep rather than stepping back into the road', () => {
    const start = atAnOpenDoor(pavement('street'), { doorsteps, spawn: { x: 0, z: 0, heading: 0 } } as unknown as CityBuild)
    expect(start).toMatchObject({ x: 14, z: 7 })
  })

  it('falls back to the city\'s own spawn when nothing in town opens', () => {
    const elsewhere = { x: 3, z: 4, heading: 1 }
    const shutOnly = { plots: () => [shut], cellSize: 2 } as unknown as World
    expect(atAnOpenDoor(shutOnly, { doorsteps: new Map(), spawn: elsewhere } as unknown as CityBuild)).toEqual(elsewhere)
  })
})

describe('a conversation you can click through', () => {
  /** Offered, agreed to, delivered and paid for, all of it clickable. */
  const errand = (() => {
    const doc = {
      format: 'game-box.quest',
      schemaVersion: 1,
      id: 'quest_0002',
      kind: 'side',
      title: 'The Ledger',
      summary: 'Iris wants her ledger back off the shelf.',
      giverNpcId: 'npc_0001',
      difficulty: 'small',
      startStepId: 'step_0001',
      reward: rewardFor('small'),
      steps: [
        { id: 'step_0001', objective: 'Hear Iris out', kind: 'talk', npcId: 'npc_0001', next: ['step_0002'] },
        { id: 'step_0002', objective: 'Find the ledger', kind: 'collect', itemId: 'item_0001', next: ['step_0003'] },
        { id: 'step_0003', objective: 'Take it to Iris', kind: 'deliver', toNpcId: 'npc_0001', itemId: 'item_0001', next: ['step_0004'] },
        { id: 'step_0004', objective: 'Done', kind: 'complete' },
      ],
    }
    return checked(doc)
  })()

  /** A town with somebody in it and a ledger on a shelf. */
  function bar() {
    const world = town()
    const npc = world.addNpc({
      id: 'npc_0001',
      name: 'Iris Vane',
      role: 'bartender',
      appearance: { base: 'female', variant: 3 },
      personality: 'Dry, and busy.',
      knowledge: ['The bar shuts at two.'],
      background: [
        { fact: 'The bartender at The Copper Wheel.', unlockedBy: 'met' },
        { fact: 'Owes the harbour master more than the bar takes in a month.', unlockedBy: 'talked' },
      ],
    })
    const item = world.addItem(
      { id: 'item_0001', name: 'the ledger', description: 'A cloth-bound book of debts.', archetype: 'ledger', value: 5, bulk: 'pocket' },
      { at: 'ground', itemId: 'item_0001', cell: { x: 6, y: 2 } },
    )
    if (!npc.ok) throw new Error(JSON.stringify(npc.error))
    if (!item.ok) throw new Error(JSON.stringify(item.error))
    return { world, npcId: 'npc_0001', itemId: 'item_0001' }
  }

  /** Somebody the art pack has drawn, who records what their body was asked to do. */
  function body(doing: string): { member: CastMember; moved: string[] } {
    const moved: string[] = []
    const member = {
      playing: doing,
      speak: (on: boolean) => void moved.push(on ? 'speaking' : 'quiet'),
      pulse: () => void moved.push('pulse'),
      gesture: (clip: string) => void moved.push(clip),
      stopGesture: () => void moved.push('stop'),
    } as unknown as CastMember
    return { member, moved }
  }

  /**
   * A model that answers the turn call with this turn and nothing else: the
   * action call gets prose, which `@gb/talk` settles off the player's words.
   */
  function speaks(turn: { does: string; says: string }): typeof fetch {
    return (_url, init) => {
      const asked = JSON.parse(String(init?.body)) as { tools?: { function: { name: string } }[] }
      const tool = asked.tools?.[0]?.function.name
      const message =
        tool === 'take_turn'
          ? { role: 'assistant', tool_calls: [{ id: 'call_1', type: 'function', function: { name: tool, arguments: JSON.stringify(turn) } }] }
          : { role: 'assistant', content: 'nothing' }
      const reply = { id: 'r', object: 'chat.completion', created: 1, model: 'test', choices: [{ index: 0, message, finish_reason: 'stop' }] }
      return Promise.resolve(new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } }))
    }
  }

  function chatting(model?: { does: string; says: string }) {
    const { world, npcId, itemId } = bar()
    const player = PlayerState.create(world.id)
    const log = QuestLog.create([errand], player)
    const { pushed, announced, hud } = screenful()
    const arms = body(CLIPS.idle)
    let reached = 0
    const talking = new Talking({
      world,
      log,
      player,
      // nothing is listening on the sidecar unless a model was handed in, so
      // neither track can reach one and every line is the city's own
      sidecar: new Sidecar({
        fetch: (url, init) => {
          reached += 1
          return model ? speaks(model)(url, init) : Promise.reject(new Error('nothing listening'))
        },
      }),
      hud,
      body: { setTyping: () => {} } as unknown as Player,
      attending: { hold: () => {}, release: () => {} } as unknown as Attending,
      gestures: new Gestures(new Members(() => new Map([[npcId, arms.member]]))),
      report: new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock) }),
    })
    // the game pushes `@gb/talk`'s own moves, which carry the action the
    // interface has no use for and this test reads
    const menu = () =>
      ([...pushed].reverse().find((patch) => patch.talk?.moves)?.talk?.moves ?? []) as readonly TalkMove[]
    const spoken = () => pushed.map((patch) => patch.talk?.replyChunk ?? '').join('')
    // what the speaker does is stage direction on the turn in front of the
    // player: it replaces on the next turn and `null` takes it off, so it
    // cannot pile up inside one conversation the way an appended line would
    const does = () => pushed.flatMap((patch) => (patch.talk?.does !== undefined ? [patch.talk.does] : []))
    const codex = () => [...pushed].reverse().find((patch) => patch.codex)?.codex
    return { world, npcId, itemId, player, log, talking, pushed, announced, menu, spoken, does, codex, moved: arms.moved, reached: () => reached }
  }

  it('opens with the speaker already talking, before the player has said anything', async () => {
    const { npcId, talking, pushed, reached } = chatting()
    await talking.start(npcId)

    // the panel appears the moment the key is pressed; nineteen seconds of an
    // empty box while a model thinks is worse than the line the box already has.
    // It goes up as the transcript, the opening line being its last turn
    const opened = pushed.find((patch) => patch.talk?.speaker !== undefined)!.talk!
    expect(opened.speaker).toBe('Iris Vane')
    expect(opened.turns).toHaveLength(1)
    expect(opened.turns![0]!.who).toBe('them')
    expect(opened.turns![0]!.says.length).toBeGreaterThan(0)
    expect(opened.moves!.length).toBeGreaterThan(0)
    expect(reached()).toBe(0)
  })

  it('puts one opening turn on the panel however often the player walks up', async () => {
    const { npcId, talking, pushed } = chatting()
    for (let visit = 0; visit < 3; visit++) {
      pushed.length = 0
      await talking.start(npcId)
      talking.end()
    }
    // `@gb/talk` greets afresh on every opening and keeps each greeting in the
    // transcript, so three walk-ups leave three hellos in it. What nobody
    // answered is not history: the panel draws the one they are being given
    const third = pushed.find((patch) => patch.talk?.speaker !== undefined)!.talk!
    expect(third.turns!.map((turn) => turn.who)).toEqual(['them'])
  })

  it('carries on where the two of them left off, so walking back up is not meeting a stranger', async () => {
    const { npcId, talking, pushed } = chatting()
    await talking.start(npcId)
    await talking.say('and what do I get for it?')
    talking.end()

    pushed.length = 0
    await talking.start(npcId)
    const again = pushed.find((patch) => patch.talk?.speaker !== undefined)!.talk!
    // her greeting, what the player said, her answer, and a new greeting on top
    expect(again.turns!.map((turn) => turn.who)).toEqual(['them', 'you', 'them', 'them'])
    expect(again.turns![1]!.says).toBe('and what do I get for it?')
  })

  it('reopens the transcript with what they did as well as what they said', async () => {
    const { npcId, talking, pushed, does } = chatting({ does: 'taps the counter', says: 'Well? Out with it.' })
    await talking.start(npcId)
    await talking.say('hello')
    expect(does()).toContain('taps the counter')
    talking.end()

    // the stage direction of a past turn is on the transcript the panel is
    // handed, so it is not lost between two openings of the same person
    pushed.length = 0
    await talking.start(npcId)
    const again = pushed.find((patch) => patch.talk?.speaker !== undefined)!.talk!
    expect(again.turns).toContainEqual({ who: 'them', says: 'Well? Out with it.', does: 'taps the counter' })
    expect(again.turns!.filter((turn) => turn.does)).toHaveLength(1)
  })

  it('puts them in the codex on meeting, with the fact that seeing them earns', async () => {
    const { npcId, talking, codex } = chatting()
    expect(codex()).toBeUndefined()
    await talking.start(npcId)

    const person = codex()!.people.find((met) => met.id === npcId)!
    expect(person).toMatchObject({ name: 'Iris Vane', role: 'bartender', disposition: 'neutral' })
    // meeting somebody is the first thing their background gives up; the rest
    // is on the page as still to learn, never blank
    expect(person.facts[0]).toEqual({ id: '0', text: 'The bartender at The Copper Wheel.' })
    expect(person.facts.slice(1).every((fact) => !('text' in fact))).toBe(true)
  })

  it('offers what the NPC will allow, and leaves walking away to the controls that already do it', async () => {
    const { npcId, world, player, log, talking, menu } = chatting()
    await talking.start(npcId)

    expect(menu().map((move) => move.action)).toEqual(['give_quest'])
    expect(menu()[0]!.label).not.toMatch(/quest_|npc_|item_/)

    // the conversation itself does offer a goodbye; the panel already has two
    const raw = Conversation.open({ world, log, player, sidecar: new Sidecar(), npcId })
    expect(raw.ok && raw.value.conversation.moves().map((move) => move.action)).toContain('end_talk')
  })

  it('takes the job on a click, with a line spoken and no model asked for it', async () => {
    const { npcId, log, talking, menu, spoken, does, reached } = chatting()
    await talking.start(npcId)
    const taken = menu()[0]!
    const before = reached()

    await talking.choose(taken.key)

    // the point of the menu: the move is taken without asking anything
    expect(reached()).toBe(before)

    expect(log.status('quest_0002')).toBe('active')
    expect(spoken().length).toBeGreaterThan(0)
    // what she did is stage direction on this turn, in the panel the player is
    // reading: the words came with no direction of their own, so the deed is it
    expect(does()).toEqual([null, 'gives you a job'])
    // and the move it just used is off the menu it publishes at the end
    expect(menu().map((move) => move.action)).not.toContain('give_quest')
  })

  it('carries the whole job through by clicking, and pays for it', async () => {
    const { npcId, itemId, player, log, talking, menu, does } = chatting()
    await talking.start(npcId)
    await talking.choose(menu()[0]!.key)

    // the player finds the ledger and comes back
    player.take(itemId)
    log.handle({ kind: 'acquired', itemId })
    talking.end()
    await talking.start(npcId)

    const handing = menu().find((move) => move.action === 'take_delivery')!
    expect(handing).toBeDefined()
    await talking.choose(handing.key)

    expect(log.status('quest_0002')).toBe('complete')
    expect(player.money).toBeGreaterThan(0)
    // a second panel, so the first turn's line is not still standing under it
    expect(does().at(-1)).toBe('takes what you were carrying')
  })

  it('opens a line, beats to it and closes it, so a speaker visibly talks', async () => {
    const { npcId, talking, moved } = chatting()
    await talking.start(npcId)

    // the opening line is a string, not a stream: nothing is being said out
    // loud yet, so there is nothing for their body to be doing
    expect(moved).toEqual([])

    // a turn their reply is neither a yes nor a no to: the line opens, beats to
    // the piece that arrived, and closes
    await talking.say('and what do I get for it?')
    expect(moved).toEqual(['speaking', 'pulse', 'quiet', 'stop'])

    // opened once per turn, however many pieces the line arrives in
    await talking.say('and what do I get for it?')
    expect(moved.slice(4)).toEqual(['speaking', 'pulse', 'quiet', 'stop'])
  })

  it('nods when they go along with what was put to them, and shakes its head when they will not', async () => {
    const { npcId, talking, menu, moved } = chatting()
    await talking.start(npcId)

    // carrying a move out is a yes, so handing the job over is them agreeing.
    // The nod goes over the open line, not instead of it
    await talking.choose(menu()[0]!.key)
    expect(moved).toEqual(['speaking', 'pulse', 'Idle_Yes_Loop', 'quiet', 'stop'])

    // and asked for something she has not got, she says so and means it
    await talking.say('what have you got for me?')
    expect(moved.slice(5)).toEqual(['speaking', 'pulse', 'Idle_No_Loop', 'quiet', 'stop'])
    expect(GESTURES).toEqual(expect.arrayContaining(['Idle_Yes_Loop', 'Idle_No_Loop']))
  })

  it('finds a passer-by on the pavement before anybody standing in a room, and asks again every time', async () => {
    const pavement = body(CLIPS.idle)
    const counter = body(CLIPS.idle)
    let outside: ReadonlyMap<string, CastMember> = new Map([['npc_0001', pavement.member]])
    const inside = new Map([['npc_0001', counter.member]])
    const gestures = new Gestures(new Members(() => outside, () => inside))

    // somebody out walking is not also standing behind their own counter
    gestures.start('npc_0001')
    expect(pavement.moved).toEqual(['speaking'])
    expect(counter.moved).toEqual([])

    // and the crowd hands a retired walker's body to the next person out, so a
    // member kept from the start of the turn puts the line on a stranger
    const stranger = body(CLIPS.idle)
    outside = new Map([['npc_0001', stranger.member]])
    gestures.stop()
    expect(stranger.moved).toEqual(['quiet', 'stop'])
    expect(pavement.moved).toEqual(['speaking'])
  })

  it('credits a step that names a subject when the subject is raised, through the conversation alone', async () => {
    // a job whose next step is to ask her about something: the objective
    // carries the topic, `@gb/talk` puts it on the menu and credits the step
    // when the move is taken, and nothing here sends a `talked` of its own
    const asking = checked({
      ...errand,
      id: 'quest_0003',
      title: 'The missing shipment',
      steps: [
        { id: 'step_0001', objective: 'Hear Iris out', kind: 'talk', npcId: 'npc_0001', next: ['step_0002'] },
        { id: 'step_0002', objective: 'Ask about the shipment', kind: 'talk', npcId: 'npc_0001', topic: 'the missing shipment', next: ['step_0003'] },
        { id: 'step_0003', objective: 'Done', kind: 'complete' },
      ],
    })
    const { world, npcId } = bar()
    const player = PlayerState.create(world.id)
    const log = QuestLog.create([asking], player)
    const { pushed, hud } = screenful()
    const talking = new Talking({
      world,
      log,
      player,
      sidecar: new Sidecar({ fetch: () => Promise.reject(new Error('nothing listening')) }),
      hud,
      body: { setTyping: () => {} } as unknown as Player,
      attending: { hold: () => {}, release: () => {} } as unknown as Attending,
      report: new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock) }),
    })
    const menu = () => ([...pushed].reverse().find((patch) => patch.talk?.moves)?.talk?.moves ?? []) as readonly TalkMove[]
    await talking.start(npcId)
    await talking.choose(menu().find((move) => move.action === 'give_quest')!.key)
    expect(log.objectives().map((objective) => objective.topic)).toEqual(['the missing shipment'])

    // being stood in front of her is not asking: the step waits for the subject
    await talking.say('nice weather')
    expect(log.status('quest_0003')).toBe('active')
    expect(log.objectives()).toHaveLength(1)

    const ask = menu().find((move) => move.action === 'ask_about')!
    expect(ask.label).toMatch(/shipment/i)
    await talking.choose(ask.key)
    expect(log.status('quest_0003')).toBe('complete')
  })

  it('still takes a typed line, which does go looking for a model, and ends on a menu', async () => {
    const { npcId, talking, pushed, spoken, reached } = chatting()
    await talking.start(npcId)
    pushed.length = 0
    const before = reached()

    await talking.say('what have you got for me?')

    expect(reached()).toBeGreaterThan(before)
    expect(spoken().length).toBeGreaterThan(0)
    expect(pushed.at(-1)!.talk!.moves).toBeDefined()
  })
})

describe('what a pedestrian keeps out of', () => {
  const world = town()

  it('reports the player\'s car as the box it is, coming at the speed the wheel says, into the same array every frame', () => {
    const laid = new Street({ world, nav: CityNav.from(world), playerOutdoors: () => undefined })
    const driven = { x: 20, z: 21, heading: 0.4, speed: 12 }
    laid.setPlayerCar({ car: driven, rolling: () => [], inTheRoad: () => [] })
    const hazards = laid.hazards()

    // the speed goes in along the heading, so a walker at a kerb reads the
    // car the player is driving at them as coming rather than as parked
    const first = hazards.near(20, 21, 6)
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({
      x: 20,
      z: 21,
      radius: METRICS.vehicle.carLength / 2,
      footprint: { length: METRICS.vehicle.carLength, width: METRICS.vehicle.carWidth, heading: 0.4 },
    })
    expect(first[0]!.vx).toBeCloseTo(Math.sin(0.4) * 12)
    expect(first[0]!.vz).toBeCloseTo(Math.cos(0.4) * 12)
    // parked, it stands still to the crowd
    driven.speed = 0
    expect(hazards.near(20, 21, 6)[0]).toMatchObject({ vx: 0, vz: 0 })
    // read once a frame and nothing kept, so the cars are a pool
    expect(hazards.near(20, 21, 6)).toBe(first)
    // and out of reach is out of the answer, not left standing in it
    expect(hazards.near(60, 21, 6)).toEqual([])
    expect(first).toHaveLength(0)
  })
})

describe('who goes out walking', () => {
  it('leaves everybody the city stationed at their post, and puts the loose on the pavement', () => {
    const { world } = anchorage()
    const nav = CityNav.from(world)
    // both of them are behind the counter the city put them behind: the player
    // who walks into the bar finds the bar staffed, and neither of them tells
    // anybody about that counter from the middle of a road
    expect(new Street({ world, nav, playerOutdoors: () => undefined }).residents()).toEqual([])

    // somebody the city stationed nowhere is out there, because there is
    // nowhere else to look for them
    const loose = world.addNpc({
      id: 'npc_0003',
      name: 'Kit Marlow',
      role: 'courier',
      appearance: { base: 'male', variant: 1 },
      personality: 'Always moving.',
      knowledge: ['Every shortcut in town.'],
    })
    if (!loose.ok) throw new Error(JSON.stringify(loose.error))
    expect(new Street({ world, nav, playerOutdoors: () => undefined }).residents().map((npc) => npc.id)).toEqual(['npc_0003'])
  })
})

describe('where a pin goes for somebody who is out', () => {
  const { world, plotId } = anchorage()
  const talkTo: Objective = { questId: 'quest_0001', questTitle: 'A word', stepId: 'step_0001', text: 'Find Wren', npcId: 'npc_0001' }

  it('points at the door they are walking to, at the ground they stand on, or at their post', () => {
    // heading somewhere: the pin is that building's door, so the route walks to it
    expect(marked(world, [talkTo], () => 'side', () => ({ plotId }))).toEqual([{ label: 'Wren Ashby', x: 11, z: 13, plotId, line: 'side' }])
    // out with nowhere in particular to go: where they are
    expect(marked(world, [talkTo], () => 'side', () => ({ x: 30, z: 40 }))).toEqual([{ label: 'Wren Ashby', x: 30, z: 40, line: 'side' }])
    // at their post: the door of the place they keep, so the plan writes that
    // building's name on itself and a route can walk to it
    expect(marked(world, [talkTo], () => 'side')).toEqual([
      { label: 'Wren Ashby', x: world.positionOf('npc_0001')!.x, z: world.positionOf('npc_0001')!.z, plotId, line: 'side' },
    ])
  })
})

describe('where there is work to pick up', () => {
  const job = checked({
    format: 'game-box.quest',
    schemaVersion: 1,
    id: 'quest_0001',
    kind: 'main',
    title: 'A word with Wren',
    summary: 'She wants a word.',
    giverNpcId: 'npc_0001',
    difficulty: 'small',
    startStepId: 'step_0001',
    reward: rewardFor('small'),
    steps: [
      { id: 'step_0001', objective: 'Fetch the glass', kind: 'collect', itemId: 'item_0001', next: ['step_0002'] },
      { id: 'step_0002', objective: 'Done', kind: 'complete' },
    ],
  })

  it('marks the door of whoever is holding a job, and stops once it is taken', () => {
    const { world, plotId } = anchorage()
    const player = PlayerState.create(world.id)
    const log = QuestLog.create([job], player)

    // a player who holds nothing has no pins at all, so the only thing that can
    // say where to start is who is still holding work
    expect(marked(world, log.objectives(), () => 'main')).toEqual([])
    expect(offered(world, log)).toEqual([{ label: 'Wren Ashby', x: 11, z: 13, plotId, line: 'main' }])

    // taken, and it is a job on the board rather than one to pick up
    expect(log.start('quest_0001').ok).toBe(true)
    expect(offered(world, log)).toEqual([])
  })
})

describe('who walks with the player', () => {
  function street(walkers: { id: string; x: number; z: number }[] = []) {
    const followed: { id: string; at?: Vec2; door?: string }[] = []
    const stopped: string[] = []
    const following: string[] = []
    const laid = {
      walkable: true,
      walkers: () => walkers,
      following: () => following.map((id) => ({ id, x: 0, z: 0 })),
      follow: (npc: { id: string }, from: { at?: Vec2; door?: string }) => {
        followed.push({ id: npc.id, ...from })
        following.push(npc.id)
      },
      stopFollowing: (id: string) => {
        stopped.push(id)
        following.splice(following.indexOf(id), 1)
      },
    } as unknown as Street
    return { laid, followed, stopped }
  }

  function walking(walkers: { id: string; x: number; z: number }[] = []) {
    const { world, plotId } = anchorage()
    const player = PlayerState.create(world.id)
    const { laid, followed, stopped } = street(walkers)
    const shown: [string, boolean][] = []
    const buildings = { showPerson: (id: string, visible: boolean) => void shown.push([id, visible]) } as unknown as Buildings
    const companions = new Companions({ world, player, street: laid, buildings, riding: () => [], note: () => {} })
    return { player, plotId, companions, followed, stopped, shown }
  }

  it('sets somebody stationed indoors off from the door of their building when they agree to come along', () => {
    const { player, plotId, companions, followed, shown } = walking()
    // the conversation put them on the list; the body is this box's to send
    player.addCompanion('npc_0001')
    companions.sync()
    expect(followed).toEqual([{ id: 'npc_0001', door: plotId }])
    expect(shown).toEqual([['npc_0001', false]])
    // and once is enough
    companions.sync()
    expect(followed).toHaveLength(1)
  })

  it('sets somebody on the pavement off from where they are standing', () => {
    const { player, companions, followed } = walking([{ id: 'npc_0002', x: 30, z: 40 }])
    player.addCompanion('npc_0002')
    companions.sync()
    expect(followed).toEqual([{ id: 'npc_0002', at: { x: 30, z: 40 } }])
  })

  it('sends somebody back to their post when the list no longer holds them, and the click does both', () => {
    const { player, plotId, companions, followed, stopped, shown } = walking()
    companions.toggle('npc_0001')
    expect(player.isCompanion('npc_0001')).toBe(true)
    expect(followed).toEqual([{ id: 'npc_0001', door: plotId }])

    player.removeCompanion('npc_0001')
    companions.sync()
    expect(stopped).toEqual(['npc_0001'])
    expect(shown.at(-1)).toEqual(['npc_0001', true])
  })
})

describe('walking somebody somewhere', () => {
  const walkHome = checked({
    format: 'game-box.quest',
    schemaVersion: 1,
    id: 'quest_0005',
    kind: 'side',
    title: 'See Wren home',
    summary: 'Wren wants walking to the bar.',
    giverNpcId: 'npc_0001',
    difficulty: 'small',
    startStepId: 'step_0001',
    reward: rewardFor('small'),
    steps: [
      { id: 'step_0001', objective: 'Hear Wren out', kind: 'talk', npcId: 'npc_0001', effects: [{ kind: 'companion-join', npcId: 'npc_0001' }], next: ['step_0002'] },
      { id: 'step_0002', objective: 'Walk Wren to the bar', kind: 'escort', npcId: 'npc_0001', place: { plotId: 'plot_0001' }, next: ['step_0003'] },
      { id: 'step_0003', objective: 'Done', kind: 'complete' },
    ],
  })

  function escorting() {
    const { world, plotId, doorstep } = anchorage()
    const player = PlayerState.create(world.id)
    const log = QuestLog.create([walkHome], player)
    log.start('quest_0005')
    log.handle({ kind: 'talked', npcId: 'npc_0001' })
    expect(player.isCompanion('npc_0001')).toBe(true)
    let body: { id: string; x: number; z: number; interiorId?: string } = { id: 'npc_0001', x: 40, z: 40 }
    const sent: { npcId: string; place: unknown }[] = []
    const escorts = new Escorts({
      world,
      steps: () => log.objectives(),
      doorstep: (id) => (id === plotId ? doorstep : undefined),
      walking: () => [body],
      arrived: (npcId, place) => {
        sent.push({ npcId, place })
        log.handle({ kind: 'companion-arrived', npcId, place })
      },
    })
    return {
      log,
      player,
      escorts,
      sent,
      move: (x: number, z: number) => void (body = { id: 'npc_0001', x, z }),
      inside: (x: number, z: number) => void (body = { id: 'npc_0001', x, z, interiorId: 'interior_0001' }),
    }
  }

  it('credits the escort when their body reaches the door, and not when they only agreed', () => {
    const { log, escorts, sent, move } = escorting()
    escorts.update()
    expect(sent).toEqual([])
    expect(log.status('quest_0005')).toBe('active')

    move(11.5, 14)
    escorts.update()
    expect(sent).toEqual([{ npcId: 'npc_0001', place: { plotId: 'plot_0001' } }])
    expect(log.status('quest_0005')).toBe('complete')
  })

  it('reports an arrival once until they have walked off again, and takes them in through the door with the player', () => {
    const { escorts, sent, move } = escorting()
    move(11, 13)
    escorts.update()
    escorts.update()
    expect(sent).toHaveLength(1)
    move(40, 40)
    escorts.update()
    move(11, 13)
    escorts.update()
    expect(sent).toHaveLength(2)

    // going in with the player is arriving at the building as well
    const again = escorting()
    again.escorts.entered({ plotId: 'plot_0001' }, ['npc_0001'])
    expect(again.sent).toEqual([{ npcId: 'npc_0001', place: { plotId: 'plot_0001' } }])
    // and somebody not walking with them did not come in
    const alone = escorting()
    alone.escorts.entered({ plotId: 'plot_0001' }, [])
    expect(alone.sent).toEqual([])
  })

  it('does not measure somebody standing indoors against a doorstep out in the city', () => {
    const { escorts, sent, inside } = escorting()
    // a companion who came in through the door stands in the room's own metres
    // from its own corner, and those numbers are nowhere near the city's
    inside(11, 13)
    escorts.update()
    expect(sent).toEqual([])
  })
})

describe('the clock and the quest log', () => {
  const hurry = checked({
    format: 'game-box.quest',
    schemaVersion: 1,
    id: 'quest_0006',
    kind: 'side',
    title: 'Before the bar shuts',
    summary: 'Quick.',
    giverNpcId: 'npc_0001',
    difficulty: 'small',
    startStepId: 'step_0001',
    reward: rewardFor('small'),
    failWhen: [{ kind: 'time-limit', seconds: 60 }],
    steps: [
      { id: 'step_0001', objective: 'Talk to Mab', kind: 'talk', npcId: 'npc_0002', next: ['step_0002'] },
      { id: 'step_0002', objective: 'Done', kind: 'complete' },
    ],
  })

  function timed() {
    const { pushed, announced, hud } = screenful()
    const { world } = anchorage()
    const player = PlayerState.create(world.id)
    const log = QuestLog.create([hurry], player)
    const report = new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock) })
    return { pushed, announced, player, log, report }
  }

  it('tells the log the time before a job is taken, so the timer counts from then and not from nothing', () => {
    const { player, log, report } = timed()
    report.tick()
    log.start('quest_0006')
    player.clock.advance(1)
    report.tick()
    expect(log.status('quest_0006')).toBe('active')
    expect(log.journal()[0]?.timer).toEqual({ remaining: 36, total: 60 })
  })

  it('pushes the page every game second while a timer runs, and announces the failure with the failed page on the list', () => {
    const { pushed, announced, player, log, report } = timed()
    report.tick()
    log.start('quest_0006')
    report.refresh()
    const before = pushed.length
    // a game second is a twenty-fourth of a real one at the default rate
    player.clock.advance(1 / 24)
    report.tick()
    expect(pushed.length).toBe(before + 1)
    expect(pushed.at(-1)!.quests![0]!.timer!.remaining).toBe(59)

    player.clock.advance(3)
    report.tick()
    expect(announced.at(-1)).toEqual({ kind: 'quest-failed', title: 'Before the bar shuts' })
    expect(pushed.at(-1)!.quests![0]).toMatchObject({ questId: 'quest_0006', status: 'failed', failReason: 'time-limit' })
  })
})

describe('what a stage direction does to the body', () => {
  function arms() {
    const moved: string[] = []
    const member = { playing: CLIPS.idle, gesture: (clip: string) => void moved.push(clip), stopGesture: () => {} } as unknown as CastMember
    return { moved, gestures: new Gestures(new Members(() => new Map([['npc_0001', member]]))) }
  }

  it('plays a nod or a shake of the head when the words say so, and nothing for anything else', () => {
    const { moved, gestures } = arms()
    gestures.direct('npc_0001', 'nods slowly, wiping the counter')
    gestures.direct('npc_0001', 'shakes her head')
    gestures.direct('npc_0001', 'taps a rhythm on the desk with a heavy brass paperweight')
    // the model writes prose and never names a clip
    gestures.direct('npc_0001', 'Idle_Torch_Loop')
    expect(moved).toEqual(['Idle_Yes_Loop', 'Idle_No_Loop'])
    expect(GESTURES).toEqual(expect.arrayContaining(moved))
  })
})

describe('fast travel', () => {
  /** Two subway entrances at either end of one pavement, and the city built round them. */
  function line() {
    const world = World.create({ name: 'Fordwater', theme: 'plain', seed: 'transit', width: 40, height: 12 })
    world.paint({ x: 0, y: 3, w: 40, h: 2 }, 'sidewalk')
    const plots = [
      { name: "Mirek's Terminal", rect: { x: 2, y: 1, w: 3, h: 2 }, cell: { x: 3, y: 3 } },
      { name: 'Cobb Brothers', rect: { x: 30, y: 1, w: 3, h: 2 }, cell: { x: 31, y: 3 } },
    ].map((plot) => {
      const added = world.addPlot({
        kind: 'station',
        name: plot.name,
        rect: plot.rect,
        entrance: { cell: plot.cell, facing: 'south' },
        storeys: 1,
        style: 'brick',
      })
      if (!added.ok) throw new Error(JSON.stringify(added.error))
      return added.value
    })
    return { world, city: buildCity(world, new Greybox()), plots }
  }

  function riding(at: Vec2 = { x: 7, z: 7 }) {
    const { world, city, plots } = line()
    const { pushed, hud } = screenful()
    const stood: { x: number; z: number; heading: number | undefined }[] = []
    const regrouped: Vec2[] = []
    const body = {
      get position() {
        return stood.at(-1) ?? at
      },
      placeAt: (x: number, z: number, heading?: number) => void stood.push({ x, z, heading }),
    } as unknown as Player
    const companions = { regroup: (spot: Vec2) => void regrouped.push(spot) } as unknown as Companions
    return { world, city, plots, pushed, hud, stood, regrouped, travel: new Travel({ world, hud, city, body, companions }) }
  }

  it('draws every station on the plan and marks the one the player is standing at', () => {
    const { world, city, plots, pushed, hud, travel } = riding()
    // the player is at the first entrance; the plan is the game's own chart
    const chart = new Chart({
      world,
      hud,
      you: () => ({ position: city.doorsteps.get(plots[0]!.id)!, heading: 0 }),
      goals: () => [],
      entered: () => [],
      stations: travel.marks,
      boarding: () => travel.boarding(city.doorsteps.get(plots[0]!.id)!),
    })
    chart.draw()

    const map = pushed.at(-1)!.map!
    expect(map.stations).toEqual([
      { id: plots[0]!.id, name: "Mirek's Terminal", x: 3, y: 3 },
      { id: plots[1]!.id, name: 'Cobb Brothers', x: 31, y: 3 },
    ])
    expect(map.boarding).toBe(plots[0]!.id)
  })

  it('offers the entrance to the crosshair, so a station is walked up to rather than found on a menu', () => {
    const { world, city, plots, travel } = riding()
    const targeting = new Targeting({
      world,
      city,
      buildings: { outdoors: true } as unknown as Buildings,
      stashing: { spots: () => [] } as unknown as Stashing,
      street: { walkers: () => [] } as unknown as Street,
      driving: { aboard: false, target: () => undefined } as unknown as Driving,
      locks: {} as Locks,
      machines: { here: () => [] } as unknown as Machines,
      travel,
    })
    const doorstep = city.doorsteps.get(plots[0]!.id)!
    const standing = { x: doorstep.x, z: doorstep.z + 2 }
    const aimed = pick(standing, 0, targeting.list(standing))
    expect(aimed).toMatchObject({ kind: 'station', id: plots[0]!.id, label: "Take the subway from Mirek's Terminal" })
  })

  it('rides under the veil: the player and everybody with them land a step off the other doorstep', () => {
    const { city, plots, pushed, stood, regrouped, travel } = riding()
    travel.board(plots[1]!.id)

    // the veil is the loader with a title and no stages, and it is up before
    // anything moves: the frame that dresses a neighbourhood nobody has been in
    // is the one it covers
    expect(pushed.at(-1)!.loading).toEqual({ title: 'To Cobb Brothers', stages: [] })
    expect(stood).toEqual([])

    travel.update()
    const doorstep = city.doorsteps.get(plots[1]!.id)!
    // a step off the doorstep, onto the pavement, looking back at the entrance
    expect(stood).toHaveLength(1)
    expect(Math.hypot(stood[0]!.x - doorstep.x, stood[0]!.z - doorstep.z)).toBeCloseTo(2, 6)
    // and whoever was walking with them got on the same train
    expect(regrouped).toEqual([{ x: stood[0]!.x, z: stood[0]!.z }])
    // still veiled: the city catches up on this frame
    expect(pushed.at(-1)!.loading).toEqual({ title: 'To Cobb Brothers', stages: [] })

    travel.update()
    expect(pushed.at(-1)!.loading).toBeNull()
  })

  it('will not sell a ticket to the station the player is already standing at', () => {
    const { plots, pushed, stood, travel } = riding()
    const before = pushed.length
    travel.board(plots[0]!.id)
    travel.update()
    expect(pushed.length).toBe(before)
    expect(stood).toEqual([])
  })
})

describe('the city round the player', () => {
  /** The bar, with `@gb/scene`'s own city under it rather than a stub, so the rooms are its to keep. */
  function street() {
    const { world, plotId } = anchorage()
    const art = new CityArt(new Greybox())
    const city = buildCity(world, art.seam)
    const player = PlayerState.create(world.id)
    const log = QuestLog.create([], player)
    const { hud } = screenful()
    const report = new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock) })
    const buildings = new Buildings({
      world,
      player,
      locks: lockUp({ world, player, log, report }),
      art,
      stage: { show: () => {}, indoors: () => {} } as unknown as Stage,
      body: { setSolid: () => {}, setGround: () => {}, placeAt: () => {}, position: { x: 5, z: 21 } } as unknown as Player,
      city,
      sky: { visible: true } as unknown as Sky,
      street: { solid: () => () => false, floor: () => () => 0, walkers: () => [] } as unknown as Street,
      announce: () => {},
      arrived: () => {},
      cameOut: () => {},
      away: () => [],
    })
    return { world, city, player, buildings, plotId }
  }

  it('lets a room go once the player is a long way off, and builds it back as the playthrough left it', () => {
    const { city, player, buildings, plotId } = street()

    buildings.enter(plotId)
    expect([...city.interiors]).toEqual(['interior_0001'])
    // the glass off the counter, into the player's hands
    buildings.lift('item_0001')
    player.take('item_0001')
    expect(buildings.inside!.pickups.get('item_0001')!.parent).toBeNull()
    buildings.leave()

    // and away across town, which is where the room goes
    city.follow(400, 400)
    expect([...city.interiors]).toEqual([])

    // back through the same door: the room is the file's room again, and what
    // the player is carrying is not drawn on the shelf it came off
    buildings.enter(plotId)
    expect([...city.interiors]).toEqual(['interior_0001'])
    expect(buildings.inside!.pickups.get('item_0001')!.parent).toBeNull()
  })

  it('keeps the far look and the light a building throws through the art chain', () => {
    const { world } = anchorage()
    const plain = new Greybox()
    // what a kit answers: the whole building near the player, its shell far off,
    // and what it throws onto the street
    const kit: Dressing = {
      building: (plot, size, charter) => plain.building(plot, size, charter),
      shell: (plot, size, charter) => plain.building(plot, size, charter),
      lights: (plot, size) => plain.lights(plot, size),
      prop: (prop) => plain.prop(prop),
      character: (npc, doing) => plain.character(npc, doing),
      pickup: (item) => plain.pickup(item),
      ground: (kind) => plain.ground(kind),
      surface: (part) => plain.surface(part),
    }
    const guarding = guarded(kit)
    expect(guarding.shell).toBeDefined()
    expect(guarding.lights).toBeDefined()

    const city = buildCity(world, new CityArt(guarding).seam)
    // a dressing that answers for the light gets lights: dropped anywhere in
    // the chain, the whole town is unlit and every building is dressed whole
    expect(city.lights.emitters.length).toBeGreaterThan(0)
    expect(city.root.children.some((child) => child.name.startsWith('city:'))).toBe(true)
  })
})

describe('what a wrapper in front of a dressing carries', () => {
  /** A dressing with an answer of its own that the seam has never heard of. */
  class Extra extends Greybox {
    counted = 0
    tally(): number {
      this.counted += 1
      return this.counted
    }
  }

  it('carries every answer it does not speak for itself, whatever that answer turns out to be', () => {
    const behind = new Extra()
    const front = guarded(behind) as unknown as { tally?: () => number; ground: Greybox['ground'] }

    // the guard names six answers and guards four more; everything else the
    // dressing behind speaks for comes through bound to it, so a capability
    // added to a seam is not lost on the way in with nothing to say so
    expect(front.tally).toBeDefined()
    expect(front.tally!()).toBe(1)
    expect(behind.counted).toBe(1)

    // and the same through the seam a room's art is aimed through
    const seam = new CityArt(front as unknown as Dressing).seam as unknown as { tally?: () => number }
    expect(seam.tally!()).toBe(2)
  })

  it('leaves an answer the front speaks for itself alone', () => {
    const behind = new Extra()
    const marker = new THREE.MeshBasicMaterial()
    const front = carryOver<Dressing>({ ...bare(behind), ground: () => marker }, behind, ['shell'])

    // the front's own ground stands, and the far look it deliberately takes off
    // another dressing is not filled in behind its back
    expect(front.ground('street')).toBe(marker)
    expect(front.shell).toBeUndefined()
  })
})

/** The six a dressing must answer, forwarded, so a test can wrap one without writing them out. */
function bare(dressing: Dressing): Dressing {
  return {
    building: (plot, size, charter) => dressing.building(plot, size, charter),
    prop: (prop) => dressing.prop(prop),
    character: (npc, doing) => dressing.character(npc, doing),
    pickup: (item) => dressing.pickup(item),
    ground: (kind) => dressing.ground(kind),
    surface: (part, size) => dressing.surface(part, size),
  }
}

describe('the corner view and the screen', () => {
  /** A town two hundred cells across with a building beside the player and one right across it. */
  function spread() {
    const world = World.create({ name: 'Longreach', theme: 'plain', seed: 'corner', width: 200, height: 200 })
    const near = world.addPlot({ kind: 'shop', name: 'Near Stores', rect: { x: 48, y: 48, w: 4, h: 4 }, entrance: { cell: { x: 50, y: 52 }, facing: 'south' }, storeys: 1, style: 'brick' })
    const far = world.addPlot({ kind: 'shop', name: 'Far Stores', rect: { x: 180, y: 180, w: 4, h: 4 }, entrance: { cell: { x: 182, y: 184 }, facing: 'south' }, storeys: 1, style: 'brick' })
    if (!near.ok || !far.ok) throw new Error('the town would not take its plots')
    return { world, near: near.value.id, far: far.value.id }
  }

  function corner(world: World, options: { goals?: readonly Marked[]; entered?: readonly string[] } = {}) {
    const { pushed, hud } = screenful()
    let heading = 0
    let at: Vec2 = { x: 100, z: 100 }
    let outdoors = true
    const minimap = new Minimap({
      world,
      hud,
      heading: () => heading,
      standing: () => at,
      outdoors: () => outdoors,
      goals: () => options.goals ?? [],
      entered: () => options.entered ?? [],
    })
    return {
      minimap,
      pushed,
      last: () => pushed.filter((patch) => 'minimap' in patch).at(-1)?.minimap,
      walkTo: (next: Vec2) => void (at = next),
      turnTo: (yaw: number) => void (heading = yaw),
      goInside: () => void (outdoors = false),
    }
  }

  it('pushes the streets round the player, windowed, and takes it away indoors', () => {
    const { world, near } = spread()
    const view = corner(world, { goals: [{ label: 'The job', x: 120, z: 120, line: 'main' }], entered: [] })

    view.minimap.update(1)
    const drawn = view.last()!
    // where they stand and which way they face, in the map's own cells
    expect(drawn.x).toBeCloseTo(50, 6)
    expect(drawn.y).toBeCloseTo(50, 6)
    expect(drawn.facing).toBeCloseTo(0, 6)
    // the building beside them is on it and the one across town is not: the
    // hud never reads the city, so what is not windowed here is never drawn
    expect(drawn.plots.map((plot) => plot.id)).toEqual([near])
    expect(drawn.radius).toBeGreaterThan(0)
    // and where they are headed, wearing the same mark the plan pins
    expect(drawn.marks).toEqual([{ x: 60, y: 60, label: 'The job', kind: 'goal', line: 'main' }])

    // a room has its own metres, so the streets outside are taken off
    view.goInside()
    view.minimap.update(1)
    expect(view.last()).toBeNull()
  })

  it('follows the player as they walk and as they turn on the spot', () => {
    const { world } = spread()
    const view = corner(world)
    view.minimap.update(1)
    const before = view.last()!

    view.turnTo(-Math.PI / 2)
    view.minimap.update(1 / 60)
    expect(view.last()!.facing).toBeCloseTo(Math.PI / 2, 6)

    view.walkTo({ x: 140, z: 100 })
    view.minimap.update(1 / 60)
    expect(view.last()!.x).toBeCloseTo(70, 6)
    expect(view.last()!.x).not.toBeCloseTo(before.x, 6)
  })

  it('marks the doors of the places the player has already walked into', () => {
    const { world, near } = spread()
    const inside = world.plot(near)!.interiorId
    const view = corner(world, { entered: inside ? [inside] : [] })
    view.minimap.update(1)
    expect(view.last()!.doors).toEqual(inside ? [{ id: near, name: 'Near Stores', x: 50.5, y: 52.5 }] : [])
  })
})

describe('the two lines of work on the plan and in the corner', () => {
  /** Two objectives from two quests, the story and an errand, each pointing at its own building. */
  function bothLines(world: World): Marked[] {
    const [bar, shop] = world.plots()
    return marked(
      world,
      [
        { questId: 'quest_0001', questTitle: 'The story', stepId: 'step_0001', text: 'Go to the bar', place: { plotId: bar!.id } },
        { questId: 'quest_0002', questTitle: 'An errand', stepId: 'step_0001', text: 'Go to the shop', place: { plotId: shop!.id } },
      ],
      (questId) => (questId === 'quest_0001' ? 'main' : 'side'),
    )
  }

  it('pins every live quest on both, the story apart from the errand', () => {
    const world = town()
    const goals = bothLines(world)
    expect(goals.map((goal) => goal.line)).toEqual(['main', 'side'])

    const plan = screenful()
    new Chart({ world, hud: plan.hud, you: () => ({ position: { x: 5, z: 21 }, heading: 0 }), goals: () => goals, entered: () => [] }).draw()
    const pinned = plan.pushed.at(-1)!.map!.marks!.filter((mark) => mark.kind === 'goal')
    expect(pinned.map((mark) => mark.line)).toEqual(['main', 'side'])
    expect(pinned.map((mark) => mark.label)).toEqual(['The Copper Wheel', 'Kell Supply'])

    // the corner wears the same marks, so a place on the plan and the same
    // place in the corner are one place. A goal with no line reads as an
    // errand, so the story carries its own
    const near = screenful()
    new Minimap({
      world,
      hud: near.hud,
      heading: () => 0,
      standing: () => ({ x: 5, z: 21 }),
      outdoors: () => true,
      goals: () => goals,
      entered: () => [],
    }).update(1)
    expect(near.pushed.at(-1)!.minimap!.marks).toEqual(pinned)
  })

  it('writes the name of every place with work waiting on the plan', () => {
    const world = town()
    const [bar] = world.plots()
    const offers: Marked[] = [{ label: 'Wren Ashby', x: 0, z: 0, plotId: bar!.id, line: 'main' }]

    const plan = screenful()
    new Chart({ world, hud: plan.hud, you: () => ({ position: { x: 5, z: 21 }, heading: 0 }), goals: () => [], offers: () => offers, entered: () => [] }).draw()
    const map = plan.pushed.at(-1)!.map!

    // a player holding no job has no pins at all, so the one thing that says
    // where to start is the name of the place somebody is holding work in
    expect(map.marks!.every((mark) => mark.kind === 'you')).toBe(true)
    expect(map.plots!.filter((plot) => plot.named).map((plot) => plot.label)).toContain('The Copper Wheel')
  })
})
