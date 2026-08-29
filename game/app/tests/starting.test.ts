// @vitest-environment jsdom
import { Bundle, type OpenedBundle } from '@gb/bundle'
import { PlayerState } from '@gb/play'
import { QuestLog, rewardFor, validateQuest } from '@gb/quest'
import { questView, World } from '@gb/world'
import { CastDressing } from '@gb/cast'
import { Greybox } from '@gb/scene'
import { Sidecar } from '@gb/sidecar'
import * as THREE from 'three'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULTS } from '../src/boot/brief.ts'
import { fixtureMaker } from './support/fixture-city.ts'
import { openDoors } from './support/insides.ts'
import { Game } from '../src/game.ts'
import type { SaveStore } from '../src/session.ts'
import type { Vec2 } from '../src/walk.ts'
import { Bench } from './support/bench.ts'
import { PaperCast } from './support/paper-cast.ts'

/**
 * The window the interface opens on a key. The counter is a second frame with
 * the same chrome, so the room it stands in is what tells the two apart.
 */
function windowOn(mount: HTMLElement): Element {
  return mount.querySelector('.gb-window-room:not(.gb-counter-room) .gb-window')!
}

/** The art pack with no art in it, and everything anybody's body was asked to do while somebody was talking to them. */
const paper = new PaperCast()
const moved = paper.moved

/** Nothing is listening on the sidecar, so every reply comes off the city's own data. */
const deaf = () => new Sidecar({ fetch: () => Promise.reject(new Error('nothing listening')) })

/** A save store in memory, the shape `localSaves` hands the game. */
function store(): SaveStore & { writes: number; kept: () => unknown } {
  let held: unknown
  return {
    writes: 0,
    read: () => held,
    write(value: unknown) {
      held = value
      this.writes += 1
    },
    clear: () => void (held = undefined),
    kept: () => held,
  }
}

/**
 * A town that boards in as many places as it is asked for: nowhere, one
 * entrance, or two a walk apart. What a building turns out to be is the
 * writing's, so a generated town answers any of the three and each is played on
 * a town that says outright which it is. The player opens their eyes two metres
 * off the first entrance, which is where a ride is offered or is not.
 */
async function boarding(count: number): Promise<OpenedBundle> {
  const world = World.create({ name: 'Ridebury', theme: 'plain', seed: 'ride', width: 40, height: 20 })
  for (const [index, x] of [2, 30].slice(0, count).entries()) {
    const made = world.addPlot({
      kind: 'station',
      name: `${['Copper', 'Anchor'][index]} Gate`,
      rect: { x, y: 2, w: 4, h: 4 },
      entrance: { cell: { x: x + 2, y: 6 }, facing: 'south' },
      storeys: 1,
      style: 'brick',
    })
    if (!made.ok) throw new Error(JSON.stringify(made.error))
  }
  const opened = await Bundle.open(await Bundle.pack(world, []))
  if (!opened.ok) throw new Error(`the town will not open: ${JSON.stringify(opened.error)}`)
  return opened.value
}

/** The city the panel makes, sealed. Reopened per game, so no two share a world. */
let sealed: unknown
beforeAll(async () => {
  const made = await fixtureMaker().build(
    { ...DEFAULTS, blocks: 2, seed: 'starting' },
    { signal: new AbortController().signal, step: () => {} },
  )
  if (!made.ok) throw new Error(made.message)
  sealed = made.value.document
}, 60_000)

async function city(): Promise<OpenedBundle> {
  const opened = await Bundle.open(JSON.parse(JSON.stringify(sealed)))
  if (!opened.ok) throw new Error(`the city the panel made will not open: ${opened.error.code}`)
  // everybody the generator writes is stationed, and a stationed person keeps
  // their post: the pavement is drawn from the people the city left loose, so
  // a town that is to have anybody out on it has to have some
  for (const [id, name, role] of [
    ['npc_9001', 'Kit Marlow', 'courier'],
    ['npc_9002', 'Sena Roque', 'wanderer'],
    ['npc_9003', 'Tam Ubeda', 'guard'],
  ] as const) {
    const loose = opened.value.world.addNpc({
      id,
      name,
      role,
      appearance: { base: 'male', variant: 1 },
      personality: 'Always moving.',
      knowledge: ['Every shortcut in town.'],
    })
    if (!loose.ok) throw new Error(JSON.stringify(loose.error))
  }
  return opened.value
}

let running: Game[] = []

afterEach(() => {
  for (const game of running) game.dispose()
  running = []
  moved.length = 0
  paper.spawned.length = 0
  document.body.innerHTML = ''
})

async function play(options: { save?: SaveStore } = {}): Promise<{ game: Game; bench: Bench }> {
  const mount = document.createElement('div')
  document.body.append(mount)
  let bench: Bench | undefined
  const game = await Game.start(mount, await city(), {
    dressing: new CastDressing(paper.cast),
    cast: paper.cast,
    sidecar: deaf(),
    stage: (into) => Promise.resolve((bench = new Bench(into))),
    ...(options.save ? { save: options.save } : {}),
  })
  running.push(game)
  return { game, bench: bench! }
}

describe('standing a game up', () => {
  it('builds one and hands the stage a frame loop', async () => {
    const { game, bench } = await play()

    expect(bench.showing).toBeDefined()
    expect(bench.frame).toBeDefined()
    game.frame(1 / 60)
    expect(bench.night).toBeGreaterThanOrEqual(0)
    expect(bench.night).toBeLessThanOrEqual(1)
  })

  it('moves the sun every frame and prefilters the sky only when the sky has moved', async () => {
    const { game, bench } = await playPlain()
    const sun = bench.scene.getObjectByName('land')!.getObjectByProperty('castShadow', true) as THREE.Object3D
    expect(sun).toBeDefined()
    // built for the hour before the first frame: one prefilter so far
    expect(bench.reflected).toBe(1)

    // two game hours at the longest step the frame loop takes, from 08:00
    let still = 0
    let carried = 0
    let last = sun.position.clone()
    for (let frame = 0; frame < 3000; frame++) {
      game.frame(0.1)
      if (sun.position.equals(last)) still += 1
      last = sun.position.clone()
      carried = Math.max(carried, Math.abs(bench.scene.environmentRotation.y))
    }
    // the sun is a smooth function of the fractional hour, so every frame moves it
    expect(still).toBe(0)
    // and the expensive part ran nine times over the two hours of climbing sky
    // it was pointed at, never per frame
    expect(bench.reflected).toBeLessThan(12)
    // the reflection is carried between: the map turns with the sun
    expect(carried).toBeGreaterThan(0.1)
    expect(carried).toBeLessThan(0.4)
  })

  it('builds one against a save store, which asks it for a save before it has finished building', async () => {
    const kept = store()
    const { game } = await play({ save: kept })

    // the first push to the interface writes a save through the changed hook,
    // and the constructor makes it: everything a save is written out of has to
    // be standing by then, or a fresh city with a store throws on its way up
    expect(kept.writes).toBeGreaterThan(0)

    game.keep()
    expect(kept.kept()).toBeDefined()
  })
})

/**
 * The keys held down right now, swapped for the ones this frame wants. A walk
 * is keys going down and coming up on the document, the way the player walks,
 * rather than a body placed where the test wants it.
 */
function keysHeld(): (codes: readonly string[]) => void {
  const held = new Set<string>()
  return (codes) => {
    for (const code of held) if (!codes.includes(code)) document.dispatchEvent(new KeyboardEvent('keyup', { code }))
    for (const code of codes) if (!held.has(code)) document.dispatchEvent(new KeyboardEvent('keydown', { code }))
    held.clear()
    for (const code of codes) held.add(code)
  }
}

/** Which keys carry the player towards a spot from where they are standing and looking. Nothing turns the camera. */
function towards(from: Vec2, heading: number, to: Vec2): string[] {
  const forward = { x: -Math.sin(heading), z: -Math.cos(heading) }
  const right = { x: -forward.z, z: forward.x }
  const ahead = (to.x - from.x) * forward.x + (to.z - from.z) * forward.z
  const side = (to.x - from.x) * right.x + (to.z - from.z) * right.z
  return [
    'ShiftLeft',
    ...(Math.abs(ahead) > 0.2 ? [ahead > 0 ? 'KeyW' : 'KeyS'] : []),
    ...(Math.abs(side) > 0.2 ? [side > 0 ? 'KeyD' : 'KeyA'] : []),
  ]
}

/**
 * Walk up to a spot in the street, the same way: a frame at a time on the keys
 * the game binds, until the player is standing on it.
 */
function walkTo(game: Game, to: Vec2, within = 1.5): void {
  const hold = keysHeld()
  for (let step = 0; step < 2000; step++) {
    const me = game.look().at as Vec2
    if (Math.hypot(me.x - to.x, me.z - to.z) <= within) {
      hold([])
      return
    }
    hold(towards(me, game.look().heading as number, to))
    game.frame(1 / 60)
  }
  hold([])
  throw new Error(`the walk to ${to.x}, ${to.z} never got there`)
}

/**
 * Walk up to whoever is nearest on the pavement, the way the player would: the
 * keys the game binds, a frame at a time, until the crosshair is on somebody.
 * Nobody is placed by hand, so this covers the chain from the crowd through the
 * targeting to the key. Told to avoid somebody, it walks to the next person.
 */
function walkUpToSomebody(game: Game, crowd: THREE.Object3D, avoid?: { body: THREE.Object3D; prompt: string }): string {
  const hold = keysHeld()

  for (let step = 0; step < 4000; step++) {
    const seen = game.look()
    const prompt = seen.target
    if (typeof prompt === 'string' && prompt.startsWith('Talk to') && prompt !== avoid?.prompt) {
      hold([])
      return prompt
    }

    const me = seen.at as Vec2
    const heading = seen.heading as number
    const forward = { x: -Math.sin(heading), z: -Math.cos(heading) }

    // head for a stride short of the nearest body out here, along the line the
    // player is already looking down, so they end up in front of the crosshair
    let nearest: THREE.Object3D | undefined
    let away = Infinity
    for (const person of crowd.children) {
      if (person === avoid?.body) continue
      const gap = Math.hypot(person.position.x - me.x, person.position.z - me.z)
      if (gap < away) [away, nearest] = [gap, person]
    }
    if (nearest) hold(towards(me, heading, { x: nearest.position.x - forward.x * 1.4, z: nearest.position.z - forward.z * 1.4 }))
    game.frame(1 / 60)
  }
  hold([])
  throw new Error('nobody on the pavement came within reach')
}

/** The same game with no people in it: the greybox answers for everything, so nothing of the cast is needed. */
async function playPlain(options: { save?: SaveStore; bundle?: OpenedBundle } = {}): Promise<{ game: Game; mount: HTMLElement; bench: Bench }> {
  const mount = document.createElement('div')
  document.body.append(mount)
  let bench: Bench | undefined
  const game = await Game.start(mount, options.bundle ?? (await city()), {
    dressing: new Greybox(),
    sidecar: deaf(),
    stage: (into) => Promise.resolve((bench = new Bench(into))),
    ...(options.save ? { save: options.save } : {}),
  })
  running.push(game)
  return { game, mount, bench: bench! }
}

describe('what the interface is handed', () => {
  it('pushes the compass outdoors and takes it away indoors, and names the place walked into on the plan', async () => {
    const bundle = await city()
    const { game, mount } = await playPlain({ bundle })
    game.frame(1 / 60)
    const strip = mount.querySelector<HTMLElement>('.gb-compass')!
    expect(strip.dataset.state).toBe('open')

    // the player opens their eyes a step off a door that opens, looking at it
    const door = game.look().target
    expect(door).toMatch(/^Go into /)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    game.frame(1 / 60)
    expect(game.look().place).toBe('interior')
    // asked to close the moment the door shuts behind them; only its pixels linger
    expect(strip.dataset.state).not.toBe('open')

    // walking through the door found the place: it is in the codex and written
    // on the plan, each read through the interface's own key, the way the
    // player reads them
    const name = String(door).slice('Go into '.length)
    const page = windowOn(mount)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM' }))
    game.frame(1 / 60)
    expect(page.getAttribute('data-state')).toBe('open')
    expect(page.textContent).toContain(name)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX' }))
    expect(page.textContent).toContain('Places')
    expect(page.textContent).toContain(name)
  })

  it('swaps the driving view on the view key, and the controls window says which one is on', async () => {
    const { game, mount } = await playPlain()
    game.frame(1 / 60)
    const page = windowOn(mount)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true }))
    game.frame(1 / 60)
    expect(page.getAttribute('data-state')).toBe('open')
    // driving is seen from behind the car until the player asks for the seat
    expect(page.textContent).toContain('now from behind the car')

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }))
    game.frame(1 / 60)
    expect(page.textContent).toContain('now from the seat')

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }))
    game.frame(1 / 60)
    expect(page.textContent).toContain('now from behind the car')
  })

  it('opens the codex with places and residents profile dossiers', async () => {
    const bundle = await city()
    const { game, mount } = await playPlain({ bundle })
    game.frame(1 / 60)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX' }))
    const page = windowOn(mount)
    expect(page.getAttribute('data-state')).toBe('open')
    expect(page.textContent).toContain('Codex')
  })

  it('hands the live lights to the buildings round the player as they walk', async () => {
    const bundle = await city()
    const { game, bench } = await playPlain({ bundle })
    const lamps = bench.showing!.getObjectByName('lights')!
    const at = () => game.look().at as { x: number; z: number }
    const lit = () => lamps.children.filter((lamp) => lamp.visible).map((lamp) => lamp.getWorldPosition(new THREE.Vector3()))
    const nearest = () => Math.min(...lit().map((lamp) => Math.hypot(lamp.x - at().x, lamp.z - at().z)))

    // every doorstep in town, because the greybox hangs one lamp over each: the
    // walk is aimed at the middle of them and the nearest one is what the
    // nearest light has to be standing on
    const size = bundle.world.cellSize
    const doors = bundle.world
      .plots()
      .flatMap((plot) => (plot.entrance ? [{ x: (plot.entrance.cell.x + 0.5) * size, z: (plot.entrance.cell.y + 0.5) * size }] : []))
    const middle = {
      x: doors.reduce((sum, door) => sum + door.x, 0) / doors.length,
      z: doors.reduce((sum, door) => sum + door.z, 0) / doors.length,
    }
    const nearestDoor = () => Math.min(...doors.map((door) => Math.hypot(door.x - at().x, door.z - at().z)))

    game.frame(1 / 60)
    const start = at()
    const atTheSpawn = lit().map((lamp) => `${lamp.x.toFixed(1)},${lamp.z.toFixed(1)}`)
    expect(atTheSpawn.length).toBeGreaterThan(0)

    // ten seconds along the pavement, headed into town rather than out of it.
    // The spawn is a step off the first door in town that opens, so which way
    // it faces and which edge of the grid it sits on move with the city: a walk
    // on a fixed key is as likely to leave the built area, where there is
    // nothing left to hand a light to. So the strafe that carries them towards
    // the middle of the doorsteps is the one that is held
    const heading = game.look().heading as number
    const forward = { x: -Math.sin(heading), z: -Math.cos(heading) }
    const right = { x: -forward.z, z: forward.x }
    const inwards = (middle.x - start.x) * right.x + (middle.z - start.z) * right.z > 0 ? 'KeyD' : 'KeyA'
    for (const code of [inwards, 'ShiftLeft']) document.dispatchEvent(new KeyboardEvent('keydown', { code }))
    for (let step = 0; step < 600; step++) game.frame(1 / 60)
    for (const code of [inwards, 'ShiftLeft']) document.dispatchEvent(new KeyboardEvent('keyup', { code }))
    expect(Math.hypot(at().x - start.x, at().z - start.z)).toBeGreaterThan(25)

    // the lights were handed on as they went: some stand where none stood at
    // the spawn, and the nearest of them is on the doorstep nearest the player
    // rather than back at the spawn, wherever the walk ended up
    const handedOn = lit().filter((lamp) => !atTheSpawn.includes(`${lamp.x.toFixed(1)},${lamp.z.toFixed(1)}`))
    expect(handedOn.length).toBeGreaterThan(0)
    expect(nearest()).toBeLessThan(nearestDoor() + 2)
  })

  it('rides between stations under a veil, and lands the player a step off the other doorstep', async () => {
    const bundle = await boarding(2)
    const { game, mount } = await playPlain({ bundle })
    game.frame(1 / 60)

    // every station in town is on the plan, read the way the player reads it
    const stations = bundle.world.stations()
    expect(stations.length).toBeGreaterThan(1)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM' }))
    game.frame(1 / 60)
    const page = windowOn(mount)
    for (const station of stations) expect(page.textContent).toContain(station.name)

    // the one furthest from where they are standing, so the ride is a ride
    const size = bundle.world.cellSize
    const doorstep = (station: (typeof stations)[number]) => ({
      x: (station.entrance.cell.x + 0.5) * size,
      z: (station.entrance.cell.y + 0.5) * size,
    })
    const here = game.look().at as Vec2
    const away = stations
      .map((station) => ({ station, gap: Math.hypot(doorstep(station).x - here.x, doorstep(station).z - here.z) }))
      .toSorted((a, b) => b.gap - a.gap)[0]!
    expect(away.gap).toBeGreaterThan(20)

    game.intent({ kind: 'travel', stationId: away.station.id })
    // the veil is up before anything has moved
    const veil = mount.querySelector<HTMLElement>('.gb-loader')!
    expect(veil.dataset.state).toBe('open')
    expect(veil.textContent).toContain(`To ${away.station.name}`)
    expect(game.look().at).toEqual(here)

    // the landing frame is the one the veil covers, and every frame the player
    // sees after it is a frame like any other
    const frames: number[] = []
    for (let frame = 0; frame < 30; frame++) {
      const began = performance.now()
      game.frame(1 / 60)
      frames.push(performance.now() - began)
    }
    const landed = game.look().at as Vec2
    const stop = doorstep(away.station)
    expect(Math.hypot(landed.x - stop.x, landed.z - stop.z)).toBeLessThan(2.5)
    expect(veil.dataset.state).not.toBe('open')
    expect(Math.max(...frames.slice(1))).toBeLessThan(100)
  })

  it('offers a ride only where there is one to take, and says which of the three the town is', async () => {
    const mapOf = (game: Game, mount: HTMLElement): string => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM' }))
      game.frame(1 / 60)
      return windowOn(mount).textContent ?? ''
    }
    const clear = (): void => {
      for (const held of running) held.dispose()
      running = []
      document.body.innerHTML = ''
    }

    // two entrances is a ride, and the crosshair says which one they board at
    const two = await playPlain({ bundle: await boarding(2) })
    two.game.frame(1 / 60)
    expect(two.game.look().target).toBe('Take the subway from Copper Gate')
    clear()

    // the only station in town boards nobody, so nothing is offered on it: a
    // prompt reading Take the subway on an entrance whose only train leaves
    // from where the player is standing is a journey they cannot make
    const alone = await boarding(1)
    const one = await playPlain({ bundle: alone })
    one.game.frame(1 / 60)
    expect(one.game.look().target).toBeUndefined()

    // and it carries nobody even asked outright
    const here = one.game.look().at
    one.game.intent({ kind: 'travel', stationId: alone.world.stations()[0]!.id })
    one.game.frame(1 / 60)
    one.game.frame(1 / 60)
    expect(one.game.look().at).toEqual(here)

    // the plan still marks it, and says which situation the player is in
    expect(mapOf(one.game, one.mount)).toMatch(/only station in town/i)
    clear()

    // and a town the writing gave no station at all says that instead
    const none = await playPlain({ bundle: await boarding(0) })
    none.game.frame(1 / 60)
    expect(none.game.look().target).toBeUndefined()
    expect(mapOf(none.game, none.mount)).toMatch(/no stations/i)
  }, 30_000)

  it('says what a save lost coming back into a city written again since, by name', async () => {
    // a city the model writes is a different city every time, and every city
    // calls itself world_0001: a save under the same key resumes reconciled
    const kept = store()
    const { game } = await playPlain({ save: kept })
    game.keep()
    for (const held of running) held.dispose()
    running = []
    document.body.innerHTML = ''

    const other = await fixtureMaker().build(
      { ...DEFAULTS, blocks: 1, seed: 'rewritten' },
      { signal: new AbortController().signal, step: () => {} },
    )
    if (!other.ok) throw new Error(other.message)
    const opened = await Bundle.open(JSON.parse(JSON.stringify(other.value.document)))
    if (!opened.ok) throw new Error(opened.error.code)
    const { mount } = await playPlain({ save: kept, bundle: opened.value })
    expect(mount.querySelector('.gb-notices')!.textContent).toMatch(/written again since your last visit/)
  }, 30_000)
})

describe('talking to somebody out on the pavement', () => {
  it('moves the body they are wearing out here, not one a room drew for them', async () => {
    const { game, bench } = await play()
    // the crowd takes a few seconds to get anybody out on the street at all
    for (let step = 0; step < 400; step++) game.frame(1 / 60)
    const crowd = bench.scene.getObjectByName('crowd')
    expect(crowd?.children.length).toBeGreaterThan(0)

    const prompt = walkUpToSomebody(game, crowd!)
    expect(prompt.startsWith('Talk to')).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    game.intent({ kind: 'say', text: 'what have you got for me?' })

    // somebody out walking is not also standing behind their own counter, so
    // the body that answers is the one on the pavement. Asking the room's
    // dressing first finds the copy it drew and moves that instead. Nothing is
    // listening, so what moves is her answer and not a line she never spoke
    await vi.waitFor(() => expect(moved.map((arms) => arms.clip)).toContain('Idle_No_Loop'))
    expect(moved.map((arms) => arms.clip)).not.toContain('speaking')
    expect(moved.every((arms) => arms.object.parent === crowd)).toBe(true)
  }, 30_000)

  it('talks to the second person as the second person, with nothing of the first carried over', async () => {
    const { game, bench } = await play()
    for (let step = 0; step < 400; step++) game.frame(1 / 60)
    const crowd = bench.scene.getObjectByName('crowd')!
    // the conversation itself, not the whole interface: a note announcing what
    // the last person did stands on screen for a few seconds after the panel
    // has moved on to somebody else, and it is theirs to name
    const panel = () => bench.canvas.parentElement!.querySelector('.gb-talk')!.textContent ?? ''

    const first = walkUpToSomebody(game, crowd)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    game.intent({ kind: 'say', text: 'what have you got for me?' })
    await vi.waitFor(() => expect(moved.length).toBeGreaterThan(0))
    const firstName = first.slice('Talk to '.length)
    const firstBody = moved[0]!.object
    expect(panel()).toContain(firstName)
    game.intent({ kind: 'talk-closed' })
    moved.length = 0
  paper.spawned.length = 0

    // the next person along: the conversation, the name on the panel and the
    // body that talks are all theirs, measured rather than assumed
    const second = walkUpToSomebody(game, crowd, { body: firstBody, prompt: first })
    const secondName = second.slice('Talk to '.length)
    expect(secondName).not.toBe(firstName)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    game.intent({ kind: 'say', text: 'what have you got for me?' })
    await vi.waitFor(() => expect(moved.length).toBeGreaterThan(0))
    expect(panel()).toContain(secondName)
    expect(panel()).not.toContain(firstName)
    expect(moved.every((arms) => arms.object !== firstBody)).toBe(true)
  }, 60_000)
})

describe('where the game says to go', () => {
  const corner = (mount: HTMLElement) => mount.querySelector<HTMLElement>('.gb-minimap')

  it('draws the corner view and moves it as the player walks', async () => {
    const { game, mount } = await playPlain()
    game.frame(1 / 60)

    // the corner is drawn from what the game pushes and from nothing else, so
    // a minimap on screen is a minimap this box windowed and handed over
    expect(corner(mount)).toBeTruthy()
    const first = corner(mount)!.innerHTML
    expect(first).not.toBe('')

    // a walk along the pavement moves what is in it
    for (const code of ['KeyD', 'ShiftLeft']) document.dispatchEvent(new KeyboardEvent('keydown', { code }))
    for (let step = 0; step < 300; step++) game.frame(1 / 60)
    for (const code of ['KeyD', 'ShiftLeft']) document.dispatchEvent(new KeyboardEvent('keyup', { code }))
    expect(corner(mount)!.innerHTML).not.toBe(first)
  }, 30_000)

  it('takes the corner view away indoors, where a room has its own metres', async () => {
    const { game, mount } = await playPlain()
    game.frame(1 / 60)
    expect(corner(mount)?.dataset.state).toBe('open')

    expect(game.look().target).toMatch(/^Go into /)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    game.frame(1 / 60)
    expect(game.look().place).toBe('interior')
    expect(corner(mount)?.dataset.state).not.toBe('open')
  }, 30_000)
})

/**
 * A street with two doors on it and a job that says to walk to the far one,
 * twice. The town is laid by hand so the walk between them is one straight run
 * across open ground, and the job is written by hand because a city's words are
 * the model's and this box has no stand-in for one. Both doors open: the first
 * is where the player opens their eyes and the second is somewhere to walk to.
 */
async function twoDoors(): Promise<{ bundle: OpenedBundle; door: Vec2; lines: readonly string[] }> {
  const world = World.create({ name: 'Fenwick', theme: 'plain', seed: 'walkup', width: 30, height: 20 })
  for (const [index, x] of [2, 12].entries()) {
    const made = world.addPlot({
      kind: 'shop',
      name: ['Kell Supply', 'Ferro Works'][index]!,
      rect: { x, y: 2, w: 4, h: 4 },
      entrance: { cell: { x: x + 2, y: 6 }, facing: 'south' },
      storeys: 1,
      style: 'brick',
    })
    if (!made.ok) throw new Error(JSON.stringify(made.error))
  }
  // rooms and people behind both, as data: a door with nothing behind it is
  // not somewhere a quest may send anybody
  openDoors(world, 2)

  const works = world.plots()[1]!
  const lines = ['Walk over to Ferro Works', 'Take another look at Ferro Works']
  const written = validateQuest(
    {
      format: 'game-box.quest',
      schemaVersion: 1,
      id: 'quest_0001',
      kind: 'main',
      title: 'Eyes on the works',
      summary: 'Somebody wants to know what goes on at the works.',
      giverNpcId: world.npcs()[0]!.id,
      difficulty: 'errand',
      startStepId: 'step_0001',
      reward: rewardFor('errand'),
      steps: [
        { id: 'step_0001', objective: lines[0], kind: 'goto', place: { plotId: works.id }, next: ['step_0002'] },
        { id: 'step_0002', objective: lines[1], kind: 'goto', place: { plotId: works.id }, next: ['step_0003'] },
        { id: 'step_0003', objective: 'Done', kind: 'complete' },
      ],
    },
    questView(world),
  )
  if (!written.ok) throw new Error(`the job will not hold up: ${JSON.stringify(written.error)}`)

  const opened = await Bundle.open(await Bundle.pack(world, [written.value]))
  if (!opened.ok) throw new Error(`the town will not open: ${JSON.stringify(opened.error)}`)
  const size = opened.value.world.cellSize
  const door = { x: (works.entrance.cell.x + 0.5) * size, z: (works.entrance.cell.y + 0.5) * size }
  return { bundle: opened.value, door, lines }
}

/** That town's job already taken, as a save: the board is the giver's and this test is not walking up to him. */
function jobTaken(bundle: OpenedBundle): SaveStore {
  const player = PlayerState.create(bundle.world.id)
  const log = QuestLog.create(bundle.quests, player)
  log.start(bundle.quests[0]!.id)
  const kept = store()
  kept.write(Bundle.save(bundle, player, log))
  return kept
}

describe('getting somewhere on foot', () => {
  it('credits a job that says to go there on the walk up, without going in, once per arrival', async () => {
    const { bundle, door, lines } = await twoDoors()
    const { game, mount } = await playPlain({ bundle, save: jobTaken(bundle) })
    const objectives = () => mount.querySelector('.gb-objectives')!.textContent ?? ''
    game.frame(1 / 60)

    // the job is on the board and the player is standing at the other door
    expect(objectives()).toContain(lines[0])
    const start = game.look().at as Vec2
    expect(Math.hypot(start.x - door.x, start.z - door.z)).toBeGreaterThan(10)

    walkTo(game, door)
    game.frame(1 / 60)
    // standing at it, never through it: the step is done and the next is open
    expect(game.look().place).toBe('city')
    expect(objectives()).not.toContain(lines[0])
    expect(objectives()).toContain(lines[1])

    // and standing there is one arrival however long they stand on it: the
    // second leg of the job is still waiting after five seconds of frames
    for (let frame = 0; frame < 300; frame++) game.frame(1 / 60)
    expect(objectives()).toContain(lines[1])

    // off down the street and back, which is a second arrival and finishes it
    walkTo(game, { x: door.x - 10, z: door.z })
    walkTo(game, door)
    game.frame(1 / 60)
    expect(game.look().place).toBe('city')
    expect(objectives()).not.toContain(lines[1])
  }, 60_000)
})
