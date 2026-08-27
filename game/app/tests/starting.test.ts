// @vitest-environment jsdom
import { Bundle, type OpenedBundle } from '@gb/bundle'
import { World } from '@gb/world'
import { CastDressing } from '@gb/cast'
import { Greybox } from '@gb/scene'
import { Sidecar } from '@gb/sidecar'
import * as THREE from 'three'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULTS } from '../src/boot/brief.ts'
import { CityMaker } from '../src/boot/city-maker.ts'
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
const offline = () => new Sidecar({ fetch: () => Promise.reject(new Error('nothing listening')) })

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
 * A town with two subway entrances a walk apart, so there is somewhere to ride
 * to. How many stations a generated town gets is a roll on its own, so the ride
 * is played on a town that says outright it has two.
 */
async function twoStations(): Promise<OpenedBundle> {
  const world = World.create({ name: 'Ridebury', theme: 'plain', seed: 'ride', width: 40, height: 20 })
  for (const [index, x] of [2, 30].entries()) {
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
  const made = await new CityMaker(new Sidecar()).build(
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
    sidecar: offline(),
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
 * Walk up to whoever is nearest on the pavement, the way the player would: the
 * keys the game binds, a frame at a time, until the crosshair is on somebody.
 * Nobody is placed by hand, so this covers the chain from the crowd through the
 * targeting to the key. Told to avoid somebody, it walks to the next person.
 */
function walkUpToSomebody(game: Game, crowd: THREE.Object3D, avoid?: { body: THREE.Object3D; prompt: string }): string {
  const held = new Set<string>()
  const hold = (codes: readonly string[]) => {
    for (const code of held) if (!codes.includes(code)) document.dispatchEvent(new KeyboardEvent('keyup', { code }))
    for (const code of codes) if (!held.has(code)) document.dispatchEvent(new KeyboardEvent('keydown', { code }))
    held.clear()
    for (const code of codes) held.add(code)
  }

  for (let step = 0; step < 4000; step++) {
    const seen = game.look()
    const prompt = seen.target
    if (typeof prompt === 'string' && prompt.startsWith('Talk to') && prompt !== avoid?.prompt) {
      hold([])
      return prompt
    }

    const me = seen.at as { x: number; z: number }
    const heading = seen.heading as number
    const forward = { x: -Math.sin(heading), z: -Math.cos(heading) }
    const right = { x: -forward.z, z: forward.x }

    // head for a stride short of the nearest body out here, along the line the
    // player is already looking down, so they end up in front of the crosshair
    let nearest: THREE.Object3D | undefined
    let away = Infinity
    for (const person of crowd.children) {
      if (person === avoid?.body) continue
      const gap = Math.hypot(person.position.x - me.x, person.position.z - me.z)
      if (gap < away) [away, nearest] = [gap, person]
    }
    if (nearest) {
      const dx = nearest.position.x - forward.x * 1.4 - me.x
      const dz = nearest.position.z - forward.z * 1.4 - me.z
      const ahead = dx * forward.x + dz * forward.z
      const side = dx * right.x + dz * right.z
      hold([
        'ShiftLeft',
        ...(Math.abs(ahead) > 0.2 ? [ahead > 0 ? 'KeyW' : 'KeyS'] : []),
        ...(Math.abs(side) > 0.2 ? [side > 0 ? 'KeyD' : 'KeyA'] : []),
      ])
    }
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
    sidecar: offline(),
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

  it('points a player who holds no job at the main line, and lists the work waiting in town', async () => {
    const { game, mount } = await playPlain()
    game.frame(1 / 60)

    // nothing is taken in a city nobody has played, so the corner says whose
    // door the story starts behind rather than telling the player to ask around
    const corner = mount.querySelector<HTMLElement>('.gb-objectives')!
    expect(corner.textContent).toContain('The main line starts with ')
    expect(corner.dataset.line).toBe('main')

    // and the strip points at that door, in the story's own colour
    const where = mount.querySelector<HTMLElement>('.gb-compass-where')!
    expect(where.hidden).toBe(false)
    expect(where.dataset.line).toBe('main')

    // the plan lists the work: the story under its own heading and the errands
    // somebody in town is holding under theirs, each saying where to find it
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM' }))
    game.frame(1 / 60)
    const work = mount.querySelector<HTMLElement>('.gb-map-work')!
    const side = [...work.querySelectorAll<HTMLElement>('.gb-map-section')].find((one) => one.textContent?.startsWith('Side jobs'))!
    const waiting = [...side.querySelectorAll('.gb-row')]
    expect(waiting.length).toBeGreaterThan(0)
    for (const row of waiting) expect(row.querySelector('.gb-row-line')!.textContent).not.toBe('')
    // the heading counts them, so a list nobody has scrolled says how much is in it
    expect(side.querySelector('.gb-map-section-count')!.textContent).toBe(String(waiting.length))
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
    const { game, bench } = await playPlain()
    const lamps = bench.showing!.getObjectByName('lights')!
    const at = () => game.look().at as { x: number; z: number }
    const lit = () => lamps.children.filter((lamp) => lamp.visible).map((lamp) => lamp.getWorldPosition(new THREE.Vector3()))
    const nearest = () => Math.min(...lit().map((lamp) => Math.hypot(lamp.x - at().x, lamp.z - at().z)))
    game.frame(1 / 60)
    const start = at()
    const atTheSpawn = lit().map((lamp) => `${lamp.x.toFixed(1)},${lamp.z.toFixed(1)}`)
    expect(atTheSpawn.length).toBeGreaterThan(0)

    // ten seconds along the pavement, the way the player leaves the spawn
    for (const code of ['KeyD', 'ShiftLeft']) document.dispatchEvent(new KeyboardEvent('keydown', { code }))
    for (let step = 0; step < 600; step++) game.frame(1 / 60)
    for (const code of ['KeyD', 'ShiftLeft']) document.dispatchEvent(new KeyboardEvent('keyup', { code }))
    expect(Math.hypot(at().x - start.x, at().z - start.z)).toBeGreaterThan(25)

    // the lights were handed on as they went: some stand where none stood at
    // the spawn, and the nearest is at the door beside them, not back at the spawn
    const handedOn = lit().filter((lamp) => !atTheSpawn.includes(`${lamp.x.toFixed(1)},${lamp.z.toFixed(1)}`))
    expect(handedOn.length).toBeGreaterThan(0)
    expect(nearest()).toBeLessThan(10)
  })

  it('rides between stations under a veil, and lands the player a step off the other doorstep', async () => {
    const bundle = await twoStations()
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

  it('says what a save lost coming back into a city written again since, by name', async () => {
    // a city the model writes is a different city every time, and every city
    // calls itself world_0001: a save under the same key resumes reconciled
    const kept = store()
    const { game } = await playPlain({ save: kept })
    game.keep()
    for (const held of running) held.dispose()
    running = []
    document.body.innerHTML = ''

    const other = await new CityMaker(new Sidecar()).build(
      { ...DEFAULTS, blocks: 1, seed: 'rewritten' },
      { signal: new AbortController().signal, step: () => {} },
    )
    if (!other.ok) throw new Error(other.message)
    const opened = await Bundle.open(JSON.parse(JSON.stringify(other.value.document)))
    if (!opened.ok) throw new Error(opened.error.code)
    const { mount } = await playPlain({ save: kept, bundle: opened.value })
    expect(mount.querySelector('.gb-notices')!.textContent).toMatch(/written again since your last visit/)
  }, 60_000)
})

describe('talking to somebody out on the pavement', () => {
  it('moves the hands of the body they are wearing out here, not one a room drew for them', async () => {
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
    // the body that talks with its hands is the one on the pavement. Asking the
    // room's dressing first finds the copy it drew and waves that instead
    await vi.waitFor(() => expect(moved.map((arms) => arms.clip)).toContain('speaking'))
    expect(moved.every((arms) => arms.object.parent === crowd)).toBe(true)
  }, 30_000)

  it('talks to the second person as the second person, with nothing of the first carried over', async () => {
    const { game, bench } = await play()
    for (let step = 0; step < 400; step++) game.frame(1 / 60)
    const crowd = bench.scene.getObjectByName('crowd')!
    const panel = () => bench.canvas.parentElement!.querySelector('.gb-hud')!.textContent ?? ''

    const first = walkUpToSomebody(game, crowd)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    game.intent({ kind: 'say', text: 'hello' })
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
    game.intent({ kind: 'say', text: 'hello' })
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
