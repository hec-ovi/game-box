// @vitest-environment jsdom
import { Bundle, type OpenedBundle } from '@gb/bundle'
import { Cast, CastDressing, CLIPS, type CastMember } from '@gb/cast'
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
  hours = -1
  frame: ((seconds: number) => void) | undefined

  constructor(mount: HTMLElement) {
    this.canvas = document.createElement('canvas')
    mount.append(this.canvas)
  }

  plainDaylight(): void {}
  reflect(): void {}
  indoors(): void {}
  grade(hours: number): void {
    this.hours = hours
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
    expect(bench.hours).toBeGreaterThanOrEqual(0)
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
 * targeting to the key.
 */
function walkUpToSomebody(game: Game, crowd: THREE.Object3D): string {
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
    if (typeof prompt === 'string' && prompt.startsWith('Talk to')) {
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
})
