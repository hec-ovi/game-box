// @vitest-environment jsdom
import { Bundle, type OpenedBundle } from '@gb/bundle'
import { Cast, CastDressing, CLIPS, type CastMember } from '@gb/cast'
import { Greybox } from '@gb/scene'
import { Sidecar } from '@gb/sidecar'
import * as THREE from 'three'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULTS } from '../src/boot/brief.ts'
import { CityMaker } from '../src/boot/city-maker.ts'
import { Game } from '../src/game.ts'
import type { SaveStore } from '../src/session.ts'
import type { Stage } from '../src/stage.ts'

/**
 * The stage with the GPU taken out: a real camera, a real scene and a real
 * canvas, and nothing drawn. Everything else the game is made of runs without
 * one, so the game built against this is the game the browser builds.
 */
class Bench implements Stage {
  readonly canvas: HTMLCanvasElement
  readonly camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 500)
  readonly scene = new THREE.Scene()
  showing: THREE.Object3D | undefined
  night = -1
  reflected = 0
  frame: ((seconds: number) => void) | undefined

  constructor(mount: HTMLElement) {
    this.canvas = document.createElement('canvas')
    mount.append(this.canvas)
  }

  plainDaylight(): void {}
  reflect(): void {
    this.reflected += 1
  }
  indoors(): void {}
  grade(night: number): void {
    this.night = night
  }
  show(root: THREE.Object3D): void {
    if (this.showing) this.scene.remove(this.showing)
    this.showing = root
    this.scene.add(root)
  }
  start(frame: (seconds: number) => void): void {
    this.frame = frame
  }
  draw(): void {}
  dispose(): void {
    this.canvas.remove()
  }
}

/** Everything anybody's arms were asked to do, and whose body did it. */
const moved: { object: THREE.Object3D; clip: string }[] = []

/** A body, the shape the art pack hands one over in, with nothing inside it. */
function body(npcId: string): CastMember {
  const object = new THREE.Object3D()
  let playing: string | undefined
  let gesturing: string | undefined
  return {
    npcId,
    object,
    outfit: 'plain',
    play: (clip: string) => void (playing = clip),
    get playing() {
      return playing
    },
    gesture: (clip: string) => {
      gesturing = clip
      moved.push({ object, clip })
    },
    stopGesture: () => void (gesturing = undefined),
    get gesturing() {
      return gesturing
    },
    holding: undefined,
    pace: () => {},
    attend: () => {},
    resume: () => {},
    attending: false,
    lookAt: () => {},
    lookAway: () => {},
  }
}

/** The art pack with no art in it: it still hands out a body per person. */
const wardrobe = { spawn: (npc: { id: string }) => body(npc.id), update: () => {} } as unknown as Cast

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
  return opened.value
}

let running: Game[] = []

afterEach(() => {
  for (const game of running) game.dispose()
  running = []
  moved.length = 0
  document.body.innerHTML = ''
})

async function play(options: { save?: SaveStore } = {}): Promise<{ game: Game; bench: Bench }> {
  const mount = document.createElement('div')
  document.body.append(mount)
  let bench: Bench | undefined
  const game = await Game.start(mount, await city(), {
    dressing: new CastDressing(wardrobe),
    cast: wardrobe,
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

  it('moves the sun every frame and prefilters the sky only when the hour turns', async () => {
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
    // and the expensive part ran twice, at 09:00 and at 10:00, never per frame
    expect(bench.reflected).toBe(3)
    // the reflection is carried between: the map turns with the sun, up to an hour's worth
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

    // walking through the door found the place: it is in the codex and written on the plan
    const name = String(door).slice('Go into '.length)
    game.intent({ kind: 'window', window: 'map' })
    game.frame(1 / 60)
    const plan = mount.querySelector('.gb-hud')!.textContent ?? ''
    expect(plan).toContain(name)
    game.intent({ kind: 'window', window: 'codex' })
    expect(mount.querySelector('.gb-hud')!.textContent).toContain(name)
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
    await vi.waitFor(() => expect(moved.map((arms) => arms.clip)).toContain(CLIPS.talk))
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
