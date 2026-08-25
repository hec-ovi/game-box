// @vitest-environment jsdom
import { Bundle, type OpenedBundle } from '@gb/bundle'
import { CastDressing } from '@gb/cast'
import { FurnishDressing, furnishKit } from '@gb/furnish'
import { Greybox } from '@gb/scene'
import { Sidecar } from '@gb/sidecar'
import { World } from '@gb/world'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Game } from '../src/game.ts'
import { guarded } from '../src/guarded.ts'
import type { RoomArt } from '../src/pack.ts'
import { Bench } from './support/bench.ts'
import { PaperCast } from './support/paper-cast.ts'

let running: Game[] = []

afterEach(() => {
  for (const game of running) game.dispose()
  running = []
  document.body.innerHTML = ''
})

function loaded<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

/**
 * A town of two doors with one person standing in each, and one more with
 * nowhere to stand who is therefore always the one the crowd sends out: nobody
 * is ever the last person out of a room, so Wren and Dov keep their posts and
 * the pavement is Kip's. The shop's counter is a stride inside its door, where
 * a player who walks in is looking straight at it.
 */
async function town(): Promise<OpenedBundle> {
  const world = World.create({ name: 'Fordwater', theme: 'plain', seed: 'attending', width: 30, height: 20 })
  const shop = loaded(
    world.addPlot({ kind: 'shop', name: 'Kell Supply', rect: { x: 1, y: 2, w: 10, h: 10 }, entrance: { cell: { x: 5, y: 12 }, facing: 'south' }, storeys: 1, style: 'brick' }),
  )
  const office = loaded(
    world.addPlot({ kind: 'office', name: 'Ferro Works', rect: { x: 14, y: 2, w: 6, h: 4 }, entrance: { cell: { x: 17, y: 6 }, facing: 'south' }, storeys: 1, style: 'brick' }),
  )
  loaded(
    world.addInterior({
      id: 'interior_0001',
      plotId: shop.id,
      kind: 'shop',
      size: { w: 20, h: 20 },
      rooms: [{ id: 'room_0001', kind: 'main', name: 'The shop floor', rect: { x: 0, y: 0, w: 20, h: 20 } }],
      doors: [{ id: 'door_0001', from: 'outside', to: 'room_0001', pos: { x: 10, y: 20 }, rot: 0 }],
      furniture: [],
      anchors: [{ id: 'anchor_0001', kind: 'serve', roomId: 'room_0001', pos: { x: 10, y: 17 }, rot: 180 }],
    }),
  )
  loaded(
    world.addInterior({
      id: 'interior_0002',
      plotId: office.id,
      kind: 'office',
      size: { w: 12, h: 8 },
      rooms: [{ id: 'room_0002', kind: 'main', name: 'The front office', rect: { x: 0, y: 0, w: 12, h: 8 } }],
      doors: [{ id: 'door_0002', from: 'outside', to: 'room_0002', pos: { x: 6, y: 8 }, rot: 0 }],
      furniture: [],
      anchors: [{ id: 'anchor_0002', kind: 'stand', roomId: 'room_0002', pos: { x: 6, y: 5 }, rot: 180 }],
    }),
  )
  loaded(
    world.addNpc({
      id: 'npc_0001',
      name: 'Wren Ashby',
      role: 'vendor',
      appearance: { base: 'female', variant: 2 },
      personality: 'Busy.',
      knowledge: ['The office shuts at six.'],
      station: { interiorId: 'interior_0001', anchorId: 'anchor_0001' },
    }),
  )
  loaded(
    world.addNpc({
      id: 'npc_0002',
      name: 'Dov Ferro',
      role: 'clerk',
      appearance: { base: 'male', variant: 1 },
      personality: 'Careful.',
      knowledge: ['Nobody comes in the back.'],
      station: { interiorId: 'interior_0002', anchorId: 'anchor_0002' },
    }),
  )
  loaded(
    world.addNpc({
      id: 'npc_0003',
      name: 'Kip Rowe',
      role: 'courier',
      appearance: { base: 'male', variant: 3 },
      personality: 'Always moving.',
      knowledge: ['The rain never stops.'],
    }),
  )

  const opened = await Bundle.open(await Bundle.pack(world, []))
  if (!opened.ok) throw new Error(`the town will not open: ${JSON.stringify(opened.error)}`)
  return opened.value
}

/** One interior kit for the whole file: a room's art is built off it every time a room is built. */
const kit = furnishKit()

/**
 * The game with the art pack's own chain under it, composed the way
 * `loadDressing` composes it: the city is dressed by one `CastDressing` and
 * every interior by its own, so a person standing at a post indoors is a body
 * the room's dressing handed out and the city's dressing never saw.
 */
async function play(): Promise<{ game: Game; bench: Bench; cast: PaperCast }> {
  const mount = document.createElement('div')
  document.body.append(mount)
  const cast = new PaperCast()
  const room: RoomArt = () => ({
    dressing: guarded(new CastDressing(cast.cast, new FurnishDressing(kit, new Greybox()))),
    decor: new THREE.Object3D(),
  })
  let bench: Bench | undefined
  const game = await Game.start(mount, await town(), {
    dressing: guarded(new CastDressing(cast.cast, new Greybox())),
    room,
    cast: cast.cast,
    sidecar: new Sidecar({ fetch: () => Promise.reject(new Error('nothing listening')) }),
    stage: (into) => Promise.resolve((bench = new Bench(into))),
  })
  running.push(game)
  return { game, bench: bench!, cast }
}

function press(code: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { code }))
}

function hold(codes: readonly string[]): void {
  for (const code of codes) document.dispatchEvent(new KeyboardEvent('keydown', { code }))
}

function drop(codes: readonly string[]): void {
  for (const code of codes) document.dispatchEvent(new KeyboardEvent('keyup', { code }))
}

/**
 * In through the shop door and up to the counter, the way the player goes: the
 * game opens a stride off a door that opens, the crosshair offers it, and the
 * key the game binds is what presses it.
 */
async function intoTheShop(): Promise<{ game: Game; bench: Bench; cast: PaperCast }> {
  const playing = await play()
  playing.game.frame(1 / 60)
  expect(playing.game.look().target).toBe('Go into Kell Supply')
  press('KeyE')
  playing.game.frame(1 / 60)
  expect(playing.game.look().place).toBe('interior')
  expect(playing.game.look().target).toBe('Talk to Wren Ashby')
  return playing
}

describe('talking to somebody at their post in a room', () => {
  it('brings them out of their stance to face the player, and sends them back when the talk ends', async () => {
    const { game, bench, cast } = await intoTheShop()

    // one body for her, and the room's own dressing is what handed it out
    const wren = cast.bodies('npc_0001')
    expect(wren).toHaveLength(1)
    const her = wren[0]!
    expect(her.attended).toEqual([])

    press('KeyE')
    game.frame(1 / 60)

    // she has the player's eye, at the height the player is looking from
    expect(her.attended).toHaveLength(1)
    expect(her.attended[0]!.toArray()).toEqual(bench.camera.position.toArray())
    expect(her.resumed).toBe(0)

    game.intent({ kind: 'talk-closed' })
    expect(her.resumed).toBe(1)
  })

  it('hands the point over again as the player walks, and sends them back when the player walks off', async () => {
    const { game, cast } = await intoTheShop()
    press('KeyE')
    game.frame(1 / 60)
    const her = cast.bodies('npc_0001')[0]!
    expect(her.attended).toHaveLength(1)

    // the panel takes the keyboard when it opens; the player clicks back into
    // the room to walk, which is what gives the keys back
    ;(document.activeElement as HTMLElement | null)?.blur()

    // across the shop floor, past the range that ends a conversation
    hold(['KeyD'])
    for (let step = 0; step < 1200 && her.resumed === 0; step++) game.frame(1 / 60)
    drop(['KeyD'])

    // walked at, she was given the new point more than once and fewer times
    // than there were frames, because each one is a turn to ease into
    expect(her.attended.length).toBeGreaterThan(1)
    expect(her.attended.length).toBeLessThan(50)
    expect(her.resumed).toBe(1)
  })

  it('talks with the hands of the body the room drew for them', async () => {
    const { game, cast } = await intoTheShop()
    press('KeyE')
    game.frame(1 / 60)
    const her = cast.bodies('npc_0001')[0]!

    game.intent({ kind: 'say', text: 'what have you got for me?' })
    await vi.waitFor(() => expect(cast.moved.map((arms) => arms.clip)).toContain('speaking'))
    expect(cast.moved.every((arms) => arms.object === her.object)).toBe(true)
  })
})
