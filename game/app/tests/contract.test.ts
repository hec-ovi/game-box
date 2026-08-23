// @vitest-environment node
import type { Driving } from '@gb/drive'
import type { Hud, HudPatch, Notice } from '@gb/hud'
import { Cast, CLIPS, GESTURES, type CastMember } from '@gb/cast'
import { CityNav } from '@gb/nav'
import { PlayerState } from '@gb/play'
import { QuestLog, rewardFor, validateQuest, type Objective } from '@gb/quest'
import { Greybox, PropFootprint, type CityBuild } from '@gb/scene'
import { METRICS, World, type Interior } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { blocked, slide, step } from '../src/walk.ts'
import { alsoBlockedBy } from '../src/bodies.ts'
import { cityGround, citySolid, furnishedSolid } from '../src/solids.ts'
import { Attending, type Post } from '../src/attending.ts'
import { Buildings } from '../src/buildings.ts'
import { Chart } from '../src/chart.ts'
import { Conditions } from '../src/conditions.ts'
import { Gestures } from '../src/gestures.ts'
import { Guide } from '../src/guide.ts'
import { Intents } from '../src/intents.ts'
import { DAY, darkness, lookAt, NIGHT } from '../src/night.ts'
import { marked, type Marked } from '../src/places.ts'
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
import type { Stage } from '../src/renderer.ts'
import type { Sky } from '../src/sky.ts'
import type { Vec2 } from '../src/walk.ts'
import { CLOSE_FOV, WIDE_FOV, Zoom } from '../src/zoom.ts'

/** A quest doc, run past the same door the game runs one past, on a world that has everything. */
function checked(doc: unknown) {
  const anything = { hasNpc: () => true, hasPlot: () => true, hasInterior: () => true, hasItem: () => true, hasAnchor: () => true }
  const validated = validateQuest(doc, anything)
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
  it('develops the middle of the day as day and the middle of the night as night', () => {
    expect(lookAt(12)).toEqual(DAY)
    expect(lookAt(0)).toEqual(NIGHT)
    expect(lookAt(23)).toEqual(NIGHT)
  })

  it('crosses over through dusk instead of switching, and never goes past either end', () => {
    let before = darkness(15)
    expect(before).toBe(0)
    for (let hour = 15.5; hour <= 21; hour += 0.5) {
      const now = darkness(hour)
      expect(now).toBeGreaterThanOrEqual(before)
      expect(now).toBeLessThanOrEqual(1)
      before = now
    }
    expect(before).toBe(1)
  })

  it('holds daylight for an hour it cannot read, rather than grading the frame to nothing', () => {
    expect(lookAt(Number.NaN)).toEqual(DAY)
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
    return { faced, hold, attend: (npcId: string) => (npcId === known ? hold : undefined) }
  }

  /** Somebody at their post: a body facing north and a head that records where it was pointed. */
  function post(at: { x: number; z: number }, home = 0) {
    const body = new THREE.Object3D()
    body.position.set(at.x, 0, at.z)
    body.rotation.y = home
    const looks: THREE.Vector3[] = []
    let away = 0
    const head = { lookAt: (point: THREE.Vector3) => void looks.push(point.clone()), lookAway: () => void away++ }
    return {
      post: { body, head } satisfies Post,
      body,
      looks,
      get away() {
        return away
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

  it('turns somebody at their post only as far as their head cannot reach, and puts them back after', () => {
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
    for (let frame = 0; frame < 120; frame++) attending.update(STEP)
    const turned = standing.body.rotation.y
    expect(turned).toBeLessThan(0)
    expect(offTheFront(standing.body, eye)).toBeCloseTo(1.25, 3)

    attending.release()
    expect(standing.away).toBe(1)
    // they do not stand there facing where the player was: they come back to their post
    for (let frame = 0; frame < 120; frame++) attending.update(STEP)
    expect(standing.body.rotation.y).toBe(0)
    expect(turned).not.toBe(0)
  })

  it('never swivels a head further than a head turns, and turns rather than snapping', () => {
    const crowd = street('nobody')
    const eye = new THREE.Vector3(0, EYE, 3)
    const standing = post({ x: 0, z: 0 })
    const attending = new Attending({ street: crowd, eye, post: () => standing.post })

    attending.hold('npc_clerk')
    attending.update(STEP)
    // one frame of a half turn is a turn started, not a turn finished
    expect(Math.abs(standing.body.rotation.y)).toBeGreaterThan(0)
    expect(Math.abs(standing.body.rotation.y)).toBeLessThan(0.1)

    let widest = 0
    for (let frame = 0; frame < 120; frame++) {
      attending.update(STEP)
      widest = Math.max(widest, offTheFront(standing.body, standing.looks[standing.looks.length - 1]!))
    }
    expect(widest).toBeLessThanOrEqual(1.25 + 1e-9)
    expect(widest).toBeGreaterThan(1.25 - 1e-9)
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
function walkIn(away: () => string[]): { buildings: Buildings; targeting: Targeting; world: World } {
  const { world, plotId, doorstep } = anchorage()
  const city = { doorsteps: new Map([[plotId, doorstep]]) } as unknown as CityBuild
  const street = { solid: () => () => false, floor: () => () => 0, walkers: () => [] } as unknown as Street
  const player = PlayerState.create(world.id)
  const buildings = new Buildings({
    world,
    player,
    dressing: new Greybox(),
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
  const log = QuestLog.create([], player)
  const stashing = new Stashing({ world, log, player, buildings, report: new Reporting({ world, log, player, hud: screenful().hud }) })
  return { buildings, targeting: new Targeting({ world, city, buildings, stashing, street, driving }), world }
}

describe('what is in reach inside a room', () => {
  // right in front of the counter, looking north at it: the person is dead
  // ahead and the glass is the 0.45 m to their side that the counter puts it
  const at = { x: 9.65, z: 4.2 }
  const north = 0

  it('offers the person and the thing beside them when both are actually in the room', () => {
    const { targeting } = walkIn(() => [])
    const listed = targeting.list()
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
    const listed = targeting.list()

    expect(listed.map((target) => target.label)).not.toContain('Talk to Wren Ashby')
    // the other one is still behind the counter and still offered
    expect(listed.map((target) => target.label)).toContain('Talk to Mab Tolliver')

    // and the glass is now the thing in reach, from the one spot that could
    // never select it while a body nobody can see was standing on it
    const glass = listed.find((target) => target.kind === 'take')!
    expect(Math.round(glass.at.x * 100) / 100).toBe(9.2)
    expect(pick(at, north, listed)?.label).toBe('Take the stained glass')
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

    const followed: { id: string; at: Vec2 }[] = []
    const stood: { x: number; z: number; heading: number | undefined }[] = []
    const street = {
      solid: () => () => false,
      floor: () => () => 0,
      walkers: () => [],
      walkable: true,
      follow: (npc: { id: string }, at: Vec2) => void followed.push({ id: npc.id, at }),
      stopFollowing: () => {},
    } as unknown as Street
    const body = {
      setSolid: () => {},
      setGround: () => {},
      position: { x: 5, z: 21 },
      heading: 0,
      placeAt: (x: number, z: number, heading?: number) => void stood.push({ x, z, heading }),
    } as unknown as Player
    const city = { doorsteps: new Map([[plotId, doorstep]]) } as unknown as CityBuild
    const buildings = new Buildings({
      world,
      player,
      dressing: new Greybox(),
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
    const { pushed, hud } = screenful()
    const report = new Reporting({ world, log, player, hud })
    const companions = new Companions({ world, player, street, buildings, note: () => {} })
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
    return new Chart({ world, hud, you: () => ({ position: at, heading }), goals: () => goals })
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
    // a plan with every building named on it is unreadable, and most of them are nothing to the player
    expect(map.plots.some((plot) => plot.label !== undefined)).toBe(false)

    const you = map.marks!.find((mark) => mark.kind === 'you')!
    expect(you.x).toBeCloseTo(2.5, 6)
    expect(you.y).toBeCloseTo(10.5, 6)
    expect(you.facing).toBeCloseTo(Math.PI / 2, 6)
  })

  it('pins where the quest is sending them, and names that building alone', () => {
    const { pushed, hud } = screenful()
    const bar = world.plots()[0]!
    chart(hud, marked(world, [heading(bar.id)])).draw()

    const map = pushed[0]!.map!
    const goal = map.marks!.find((mark) => mark.kind === 'goal')!
    // the doorstep, in cells: the pin is on the door rather than on the roof
    expect(goal).toMatchObject({ x: 2.5, y: 4.5, label: 'The Copper Wheel' })
    expect(map.plots.filter((plot) => plot.label !== undefined)).toEqual([{ id: bar.id, rect: bar.rect, label: 'The Copper Wheel' }])
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
    expect(marked(bar, [fetchIt])).toEqual([{ label: 'The Bright Anchor', x: 11, z: 13, plotId }])

    // and any of an interchangeable pool answers, so three of five is one pin
    const orTheOther: Objective = { ...fetchIt, itemId: 'item_0404', alternates: ['item_0001'] }
    expect(marked(bar, [orTheOther])).toHaveLength(1)
  })

  it('pins a place once, however many steps of the quest send the player to it', () => {
    const bar = world.plots()[0]!
    expect(marked(world, [heading(bar.id), { ...heading(bar.id), stepId: 'step_0003' }])).toHaveLength(1)
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
    return new Guide({ world, nav, from: () => from, goals: () => marked(world, steps), steps: () => steps })
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
    expect(hours.hour).toBe(18)

    const before = hours.totalSeconds
    const day = hours.day
    conditions.nextTime()
    expect(hours.hour).toBe(0)
    // midnight is tomorrow's, so a quest on a timer runs down rather than back up
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
    expect(hours.rate).toBe(0)
    hours.advance(10)
    expect(hours.hour).toBe(8)

    expect(conditions.hold()).toBe('Time running')
    expect(hours.rate).toBe(60)
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
    const report = new Reporting({ world: town(), log, player, hud })
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
    const report = new Reporting({ world: town(), log, player, hud })
    let released = 0
    let handed: (boolean | undefined)[] = []
    const intents = new Intents({
      log,
      hud,
      report,
      talking: { say: async () => {}, choose: async () => {}, end: () => {} } as unknown as Talking,
      body: { setTyping: (away: boolean) => void handed.push(away) } as unknown as Player,
      chart: { open: false } as unknown as Chart,
      releasePointer: () => void released++,
    })
    const page = () => pushed[pushed.length - 1]!.quests
    // the way a job actually starts: somebody offers it and what changed is
    // reported, which is what puts the page on screen in the first place
    const start = () => report.report(log.start('quest_0001'))
    return { log, intents, page, start, pushed, released: () => released, handed }
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
    const report = new Reporting({ world: town(), log, player, hud: screenful().hud })
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

  /** A car sitting in the road, the way `@gb/drive` offers one. */
  const wheel = { kind: 'drive' as const, id: 'car_3', label: 'Get in the taxi', at: { x: 8, z: 20 } }

  // out in the street there is nothing to put anything down on
  const nowhereToLeaveIt = { spots: () => [] } as unknown as Stashing

  function targeting(driving: Partial<Driving>) {
    return new Targeting({ world, city, buildings: outside, stashing: nowhereToLeaveIt, street: empty, driving: driving as Driving })
  }

  it('offers a door only for a building that opens', () => {
    const listed = targeting({ aboard: false, target: () => undefined }).list()
    expect(listed).toEqual([{ kind: 'enter', id: open.id, label: 'Go into The Copper Wheel', at: { x: 5, z: 9 } }])
  })

  it('offers the car standing in the road, and only the way out once the player is in it', () => {
    const onFoot = targeting({ aboard: false, target: () => wheel }).list()
    expect(onFoot.map((target) => target.kind)).toEqual(['enter', 'drive'])

    const driving = targeting({ aboard: true, target: () => ({ ...wheel, label: 'Get out' }) }).list()
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
  const parked = { x: 20, z: 21, heading: 0 }

  function street() {
    const laid = new Street({ world, nav: CityNav.from(world), playerOutdoors: () => undefined })
    laid.setPlayerCar({ rolling: () => [parked], inTheRoad: () => [{ x: parked.x, z: parked.z, radius: 1 }] })
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
    })
    const item = world.addItem(
      { id: 'item_0001', name: 'the ledger', description: 'A cloth-bound book of debts.', archetype: 'ledger', value: 5, bulk: 'pocket' },
      { at: 'ground', itemId: 'item_0001', cell: { x: 6, y: 2 } },
    )
    if (!npc.ok) throw new Error(JSON.stringify(npc.error))
    if (!item.ok) throw new Error(JSON.stringify(item.error))
    return { world, npcId: 'npc_0001', itemId: 'item_0001' }
  }

  /** Somebody the art pack has drawn, who records what their arms were asked to do. */
  function body(doing: string): { member: CastMember; moved: string[] } {
    const moved: string[] = []
    const member = {
      playing: doing,
      gesture: (clip: string) => void moved.push(clip),
      stopGesture: () => void moved.push('stop'),
    } as unknown as CastMember
    return { member, moved }
  }

  function chatting() {
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
      // nothing is listening on the sidecar, so neither track can reach a model
      sidecar: new Sidecar({
        fetch: () => {
          reached += 1
          return Promise.reject(new Error('nothing listening'))
        },
      }),
      hud,
      body: { setTyping: () => {} } as unknown as Player,
      attending: { hold: () => {}, release: () => {} } as unknown as Attending,
      gestures: new Gestures(() => new Map([[npcId, arms.member]])),
      report: new Reporting({ world, log, player, hud }),
    })
    // the game pushes `@gb/talk`'s own moves, which carry the action the
    // interface has no use for and this test reads
    const menu = () =>
      ([...pushed].reverse().find((patch) => patch.talk?.moves)?.talk?.moves ?? []) as readonly TalkMove[]
    const spoken = () => pushed.map((patch) => patch.talk?.replyChunk ?? '').join('')
    // what the speaker did is one line about the turn in front of the player:
    // it replaces on the next turn and `null` takes it off, so it cannot pile
    // up inside one conversation the way an appended line would
    const acted = () => pushed.flatMap((patch) => (patch.talk?.acted !== undefined ? [patch.talk.acted] : []))
    return { world, npcId, itemId, player, log, talking, pushed, announced, menu, spoken, acted, moved: arms.moved, reached: () => reached }
  }

  it('opens with the speaker already talking, before the player has said anything', async () => {
    const { npcId, talking, pushed, reached } = chatting()
    await talking.start(npcId)

    // the panel appears the moment the key is pressed; nineteen seconds of an
    // empty box while a model thinks is worse than the line the box already has
    const opened = pushed.find((patch) => patch.talk?.speaker !== undefined)!.talk!
    expect(opened.speaker).toBe('Iris Vane')
    expect(opened.reply!.length).toBeGreaterThan(0)
    expect(opened.moves!.length).toBeGreaterThan(0)
    expect(reached()).toBe(0)
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
    const { npcId, log, talking, menu, spoken, acted, reached } = chatting()
    await talking.start(npcId)
    const taken = menu()[0]!
    const before = reached()

    await talking.choose(taken.key)

    // the point of the menu: the move is taken without asking anything
    expect(reached()).toBe(before)

    expect(log.status('quest_0002')).toBe('active')
    expect(spoken().length).toBeGreaterThan(0)
    // what she did is the line for this turn, in the panel the player is
    // reading, and the turn opened by clearing whatever the last one left
    expect(acted()).toEqual([null, 'Iris Vane gave you a job'])
    // and the move it just used is off the menu it publishes at the end
    expect(menu().map((move) => move.action)).not.toContain('give_quest')
  })

  it('carries the whole job through by clicking, and pays for it', async () => {
    const { npcId, itemId, player, log, talking, menu, acted } = chatting()
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
    expect(acted().at(-1)).toBe('Iris Vane took what you were carrying')
  })

  it('moves their hands while they are speaking and puts them down after', async () => {
    const { npcId, talking, menu, moved } = chatting()
    await talking.start(npcId)

    // the opening line is a string, not a stream: nothing is being said out
    // loud yet, so there is nothing for their arms to be doing
    expect(moved).toEqual([])

    await talking.choose(menu()[0]!.key)
    expect(moved).toEqual([CLIPS.talk, 'stop'])
    expect(GESTURES).toContain(moved[0])

    // and once for the turn, however many pieces the line arrives in
    await talking.say('and what do I get for it?')
    expect(moved).toEqual([CLIPS.talk, 'stop', CLIPS.talk, 'stop'])
  })

  it('finds a passer-by on the pavement before anybody standing in a room, and asks again every time', async () => {
    const pavement = body(CLIPS.idle)
    const counter = body(CLIPS.idle)
    let outside: ReadonlyMap<string, CastMember> = new Map([['npc_0001', pavement.member]])
    const inside = new Map([['npc_0001', counter.member]])
    const gestures = new Gestures(() => outside, () => inside)

    // somebody out walking is not also standing behind their own counter
    gestures.start('npc_0001')
    expect(pavement.moved).toEqual([CLIPS.talk])
    expect(counter.moved).toEqual([])

    // and the crowd hands a retired walker's body to the next person out, so a
    // member kept from the start of the turn puts the hands on a stranger
    const stranger = body(CLIPS.idle)
    outside = new Map([['npc_0001', stranger.member]])
    gestures.stop()
    expect(stranger.moved).toEqual(['stop'])
    expect(pavement.moved).toEqual([CLIPS.talk])
  })

  it('lays the seated talk over somebody who is sitting down', async () => {
    const sitting = body(Cast.doingAt('sit'))
    new Gestures(() => new Map([['npc_0001', sitting.member]])).start('npc_0001')

    // a standing talk added to a sitting pose is a person waving from a chair
    // they are not really in: the gesture is laid over the base clip, not instead
    expect(sitting.moved).toEqual([CLIPS.talkSeated])
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
