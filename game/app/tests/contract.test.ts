// @vitest-environment node
import type { Driving } from '@gb/drive'
import type { Hud, HudPatch } from '@gb/hud'
import { CityNav } from '@gb/nav'
import { PlayerState } from '@gb/play'
import { QuestLog, rewardFor, validateQuest, type Objective } from '@gb/quest'
import { PropFootprint, type CityBuild } from '@gb/scene'
import { METRICS, World, type Interior } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { blocked, slide, step } from '../src/walk.ts'
import { alsoBlockedBy } from '../src/bodies.ts'
import { cityGround, citySolid, furnishedSolid } from '../src/solids.ts'
import { Attending, type Post } from '../src/attending.ts'
import type { Buildings } from '../src/buildings.ts'
import { Chart } from '../src/chart.ts'
import { Conditions } from '../src/conditions.ts'
import { Guide } from '../src/guide.ts'
import { DAY, darkness, lookAt, NIGHT } from '../src/night.ts'
import { marked, type Marked } from '../src/places.ts'
import { Reporting } from '../src/reporting.ts'
import { atAnOpenDoor } from '../src/spawn.ts'
import { Body, CROUCH_EYE, JUMP_SPEED } from '../src/stance.ts'
import { Sidecar } from '@gb/sidecar'
import { Conversation, type TalkMove } from '@gb/talk'
import type { Player } from '../src/player.ts'
import { Street } from '../src/street.ts'
import { Talking } from '../src/talking.ts'
import { Targeting } from '../src/targets.ts'
import { CLOSE_FOV, WIDE_FOV, Zoom } from '../src/zoom.ts'

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
  return { pushed, hud: { show: (patch: HudPatch) => void pushed.push(patch) } as unknown as Hud }
}

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

  function guide(from: { x: number; z: number }, goals: readonly Marked[]) {
    return new Guide({ world, nav, from: () => from, goals: () => goals })
  }

  it('gives the walk and the way the street runs, not the line through the water', () => {
    // the bar is twelve metres due north, and the only crossing is away east
    const said = guide({ x: 5, z: 21 }, marked(world, [heading(bar.id)])).say()
    expect(said).toMatch(/^The Copper Wheel: /)
    expect(said).toMatch(/head east/)
    expect(Number(/(\d+) m/.exec(said)![1])).toBeGreaterThan(60)
  })

  it('calls a place by the name the quest gave it', () => {
    expect(guide({ x: 5, z: 21 }, marked(world, [heading(bar.id, 'the bar')])).say()).toMatch(/^the bar: /)
  })

  it('says so when there is no way there on foot', () => {
    expect(guide({ x: 5, z: 21 }, marked(world, [heading(island.id)])).say()).toBe('Kell Supply: no way there on foot')
  })

  it('says you are there when you are standing on it', () => {
    expect(guide({ x: 5, z: 9 }, marked(world, [heading(bar.id)])).say()).toBe('The Copper Wheel: you are there')
  })

  it('says there is nothing to head for when no quest is being followed', () => {
    expect(guide({ x: 5, z: 21 }, []).say()).toBe('Nothing to head for: follow a quest first')
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

  /** A four step job: talk, walk, talk, done. */
  function sealed() {
    const doc = {
      format: 'game-box.quest',
      schemaVersion: 1,
      id: 'quest_0001',
      kind: 'side',
      title: 'The delivery',
      summary: 'Iris wants a word, then wants you at the bar.',
      giverNpcId: 'npc_0001',
      difficulty: 'small',
      startStepId: 'step_0001',
      reward: rewardFor('small'),
      steps: [
        { id: 'step_0001', objective: 'Talk to Iris', kind: 'talk', npcId: 'npc_0001', next: ['step_0002'] },
        { id: 'step_0002', objective: 'Get to the bar', kind: 'goto', place: { plotId: 'plot_0001' }, next: ['step_0003'] },
        { id: 'step_0003', objective: 'Tell Iris it is done', kind: 'talk', npcId: 'npc_0001', next: ['step_0004'] },
        { id: 'step_0004', objective: 'Finished', kind: 'complete' },
      ],
    }
    const anything = { hasNpc: () => true, hasPlot: () => true, hasInterior: () => true, hasItem: () => true, hasAnchor: () => true }
    const checked = validateQuest(doc, anything)
    if (!checked.ok) throw new Error(JSON.stringify(checked.error))
    return checked.value
  }

  function journal(): { steps: () => readonly { text: string; done: boolean }[]; log: QuestLog } {
    const { pushed, hud } = screenful()
    const player = PlayerState.create('world_0001')
    const log = QuestLog.create([quest], player)
    const report = new Reporting({ world: town(), log, player, hud })
    return {
      log,
      steps: () => {
        report.refresh()
        return pushed[pushed.length - 1]!.quests![0]!.steps
      },
    }
  }

  it('ticks nothing on a job just taken, however many steps are still ahead', () => {
    const { log, steps } = journal()
    log.start('quest_0001')

    const listed = steps()
    expect(listed.map((step) => step.text)).toEqual(['Talk to Iris', 'Get to the bar', 'Tell Iris it is done'])
    expect(listed.filter((step) => step.done)).toEqual([])
  })

  it('ticks a step once it is actually done, and leaves the ones ahead alone', () => {
    const { log, steps } = journal()
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: 'npc_0001' })

    expect(steps().map((step) => step.done)).toEqual([true, false, false])
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

  function targeting(driving: Partial<Driving>) {
    return new Targeting({ world, city, buildings: outside, street: empty, driving: driving as Driving })
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
    const anything = { hasNpc: () => true, hasPlot: () => true, hasInterior: () => true, hasItem: () => true, hasAnchor: () => true }
    const checked = validateQuest(doc, anything)
    if (!checked.ok) throw new Error(JSON.stringify(checked.error))
    return checked.value
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

  /** Everything the game pushes at the interface, and nothing else. */
  function panel() {
    const pushed: HudPatch[] = []
    const hud = { show: (patch: HudPatch) => void pushed.push(patch), announce: () => {} } as unknown as Hud
    return { pushed, hud }
  }

  function chatting() {
    const { world, npcId, itemId } = bar()
    const player = PlayerState.create(world.id)
    const log = QuestLog.create([errand], player)
    const { pushed, hud } = panel()
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
      report: new Reporting({ world, log, player, hud }),
    })
    // the game pushes `@gb/talk`'s own moves, which carry the action the
    // interface has no use for and this test reads
    const menu = () =>
      ([...pushed].reverse().find((patch) => patch.talk?.moves)?.talk?.moves ?? []) as readonly TalkMove[]
    const spoken = () => pushed.map((patch) => patch.talk?.replyChunk ?? '').join('')
    const noted = () => pushed.flatMap((patch) => (patch.talk?.acted ? [patch.talk.acted] : []))
    return { world, npcId, itemId, player, log, talking, pushed, menu, spoken, noted, reached: () => reached }
  }

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
    const { npcId, log, talking, menu, spoken, noted, reached } = chatting()
    await talking.start(npcId)
    const taken = menu()[0]!
    const before = reached()

    await talking.choose(taken.key)

    // the point of the menu: the move is taken without asking anything
    expect(reached()).toBe(before)

    expect(log.status('quest_0002')).toBe('active')
    expect(spoken().length).toBeGreaterThan(0)
    expect(noted()).toEqual(['gave you a job'])
    // and the move it just used is off the menu it publishes at the end
    expect(menu().map((move) => move.action)).not.toContain('give_quest')
  })

  it('carries the whole job through by clicking, and pays for it', async () => {
    const { npcId, itemId, player, log, talking, menu, noted } = chatting()
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
    expect(noted()).toEqual(['gave you a job', 'took what you were carrying'])
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
