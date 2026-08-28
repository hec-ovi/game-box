// @vitest-environment jsdom
import { Greybox } from '@gb/scene'
import { storeyHeight } from '@gb/scene'
import type { World } from '@gb/world'
import { screen, waitFor } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { patchesOf } from '../src/blueprint/cells.ts'
import { Orbit } from '../src/blueprint/orbit.ts'
import { planOf } from '../src/blueprint/plan.ts'
import { Overlay } from '../src/boot/blueprint/overlay.ts'
import { Boot, type Show, type Start } from '../src/boot/boot.ts'
import { DEFAULTS } from '../src/boot/brief.ts'
import { Library, MemoryShelf } from '../src/boot/library.ts'
import { Panel } from '../src/boot/panel.ts'
import type { SidecarOptions } from '@gb/sidecar'

/** Wherever this box is being run from: its own folder, or the workspace root. */
const PAGE = ['index.html', 'game/app/index.html'].map((path) => resolve(process.cwd(), path)).find(existsSync)!

/** The panel exactly as the page serves it, script tag and all removed. */
function servePage(): void {
  const page = readFileSync(PAGE, 'utf8')
  const body = /<body>([\s\S]*)<\/body>/.exec(page)![1]!
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '')
}

/** A sidecar nothing is listening on, so no model is ever asked anything. */
const DOWN: SidecarOptions = { fetch: () => Promise.reject(new Error('nothing listening')) }

/** What the blueprint was opened on, without a renderer in the room. */
interface Looked {
  world: World
  mount: HTMLElement
  leave: () => void
  disposed: number
}

const looked: Looked[] = []
const started: string[] = []
const shelf = { current: new MemoryShelf() }

const start: Start = async (_mount, bundle) => {
  started.push(bundle.world.name)
  return { dispose: () => {}, handOverKeys: () => {}, keep: () => {}, announce: () => {} }
}

const blueprint: Show = async (input) => {
  const seen: Looked = { ...input, disposed: 0 }
  looked.push(seen)
  return { dispose: () => void (seen.disposed += 1) }
}

function front(): { boot: Boot; panel: Panel } {
  servePage()
  const panel = new Panel(document.querySelector<HTMLElement>('#boot')!)
  const boot = new Boot({
    mount: document.querySelector('#game')!,
    panel,
    library: new Library(shelf.current),
    sidecar: DOWN,
    start,
    art: async () => ({ dressing: new Greybox() }),
    blueprint,
  })
  return { boot, panel }
}

const preview = (): HTMLButtonElement => screen.getByRole<HTMLButtonElement>('button', { name: 'Preview blueprint' })
const stage = (): HTMLElement => document.querySelector<HTMLElement>('[data-boot="stage"]')!

/** Step one of the form, with a two block city laid out and the blueprint ready to open. */
async function laidOut(): Promise<{ boot: Boot; panel: Panel; user: ReturnType<typeof userEvent.setup> }> {
  const user = userEvent.setup()
  const { boot, panel } = front()
  await boot.start(new URLSearchParams(''))
  panel.face = 'make'
  await user.clear(screen.getByLabelText(/blocks/i))
  await user.type(screen.getByLabelText(/blocks/i), '2')
  await user.clear(screen.getByLabelText(/urban theme/i))
  await user.type(screen.getByLabelText(/urban theme/i), 'flooded refinery')
  await user.click(screen.getByRole('button', { name: 'Generate the city' }))
  await waitFor(() => expect(preview().disabled).toBe(false), { timeout: 20_000 })
  return { boot, panel, user }
}

describe('looking at the architecture before anything is written into it', () => {
  beforeEach(() => {
    looked.length = 0
    started.length = 0
    shelf.current = new MemoryShelf()
    localStorage.clear()
  })

  it('has nothing to open until a city has been laid out', async () => {
    const user = userEvent.setup()
    const { boot, panel } = front()
    await boot.start(new URLSearchParams(''))
    panel.face = 'make'

    expect(preview().disabled).toBe(true)
    await user.click(preview())

    expect(looked).toEqual([])
    expect(stage().hidden).toBe(true)
  })

  it('opens the architecture that was laid out, in front of the form', async () => {
    const { user } = await laidOut()

    await user.click(preview())
    await waitFor(() => expect(looked).toHaveLength(1))

    // the town it is looking at is the one the layout laid out, and it has
    // nobody in it and nothing to walk into
    const laid = looked[0]!.world
    expect(laid.plots().length).toBeGreaterThan(0)
    expect([laid.interiors().length, laid.npcs().length, laid.items().length]).toEqual([0, 0, 0])

    // it is drawn inside the panel, so it is under the panel's own palette
    expect(document.querySelector('#boot')!.contains(looked[0]!.mount)).toBe(true)
    expect([stage().hidden, document.querySelector<HTMLElement>('#boot')!.dataset.stage]).toEqual([false, 'true'])
  }, 30_000)

  it('builds nothing, shelves nothing and starts no game', async () => {
    const { user } = await laidOut()

    await user.click(preview())
    await waitFor(() => expect(looked).toHaveLength(1))

    expect(started).toEqual([])
    expect(await shelf.current.list()).toEqual([])
    expect(localStorage.length).toBe(0)
  }, 30_000)

  it('goes back to the form with the brief exactly as it was', async () => {
    const { user } = await laidOut()
    await user.click(preview())
    await waitFor(() => expect(looked).toHaveLength(1))

    looked[0]!.leave()

    expect([looked[0]!.disposed, stage().hidden, stage().childElementCount]).toEqual([1, true, 0])
    expect(document.querySelector<HTMLElement>('#boot')!.dataset.stage).toBe('false')
    expect(screen.getByLabelText<HTMLInputElement>(/urban theme/i).value).toBe('flooded refinery')
    expect(screen.getByLabelText<HTMLInputElement>(/blocks/i).value).toBe('2')
    // and the tile is live again, so it can be opened a second time
    await waitFor(() => expect(preview().disabled).toBe(false))
  }, 30_000)

  it('says the view is not connected rather than reporting one that never opened', async () => {
    const user = userEvent.setup()
    servePage()
    const panel = new Panel(document.querySelector<HTMLElement>('#boot')!)
    panel.on({
      generate: () => {},
      draft: () => {},
      open: () => {},
      apply: () => {},
      grow: () => {},
      pick: () => {},
      remove: () => {},
      save: () => {},
      cancel: () => {},
      close: () => {},
      settings: () => {},
      plan: async () => ({ ok: true, message: 'Laid out.', laid: { zones: 2 } }),
    })
    panel.waiting()

    await user.click(screen.getByRole('button', { name: 'Generate the city' }))
    await waitFor(() => expect(preview().disabled).toBe(false))
    await user.click(preview())

    const note = preview().closest('[data-notes]')!.querySelector('[data-note]')!
    await waitFor(() => expect(note.textContent).toMatch(/not connected/i))
    expect(stage().hidden).toBe(true)
  })
})

describe('what the blueprint draws', () => {
  beforeEach(() => {
    shelf.current = new MemoryShelf()
    localStorage.clear()
  })

  it('carries every building at the height the game builds it, the streets and the stations', async () => {
    const { boot } = front()
    await boot.layOut({ ...DEFAULTS, seed: 'blueprint', blocks: 8 })
    const world = boot.laid!
    const plan = planOf(world)

    expect(plan.buildings).toHaveLength(world.plots().length)
    for (const [index, plot] of world.plots().entries()) {
      const built = plan.buildings[index]!
      expect(built.height).toBe(storeyHeight(plot.storeys))
      expect([built.w, built.d]).toEqual([plot.rect.w * world.cellSize, plot.rect.h * world.cellSize])
    }
    expect(plan.zones.map((zone) => zone.name)).toEqual(world.districts().map((district) => district.name))
    expect(plan.stations.map((station) => station.id)).toEqual(world.stations().map((plot) => plot.id))
    expect(plan.stations.length).toBeGreaterThan(0)
    expect(plan.roadway.length).toBeGreaterThan(0)
  }, 30_000)

  it('writes bare labels over it, because every name in a city is written and none is written yet', async () => {
    const { boot } = front()
    await boot.layOut({ ...DEFAULTS, seed: 'blueprint', blocks: 8 })
    const plan = planOf(boot.laid!)
    const overlay = new Overlay({ plan, handlers: { leave: () => {}, fit: () => {}, read: () => {} } })

    // the heading says what is on screen rather than naming a town nobody has named
    expect(overlay.root.querySelector('.gb-bp-title')!.textContent).toBe('City')

    // the parts of town read as the plan's own labels, which is what they are
    // called until the model writes over them
    const rows = [...overlay.root.querySelectorAll('.gb-bp-zone-name')].map((row) => row.textContent)
    expect(rows).toEqual(plan.zones.map((zone) => zone.name))
    expect(rows.every((row) => /^Zone \d+$/.test(row ?? ''))).toBe(true)

    // and a station is marked as a station: there is no sign over any door yet
    const marks = [...overlay.root.querySelectorAll('.gb-bp-name-station')].map((mark) => mark.textContent)
    expect(marks).toHaveLength(plan.stations.length)
    expect(new Set(marks)).toEqual(new Set(['Station']))
  }, 30_000)

  it('loses no street to the merge that makes the roadway a few hundred rectangles', async () => {
    const { boot } = front()
    await boot.layOut({ ...DEFAULTS, seed: 'merging', blocks: 2 })
    const grid = boot.laid!.grid

    let cells = 0
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) if (grid.at(x, y) === 'street') cells += 1
    }
    const merged = patchesOf(grid, 'street')

    expect(merged.length).toBeLessThan(cells)
    expect(merged.reduce((sum, rect) => sum + rect.w * rect.h, 0)).toBe(cells)
  }, 30_000)

  it('carries a part of town out to the middle of its own streets, so its blocks are one region', async () => {
    const { boot } = front()
    await boot.layOut({ ...DEFAULTS, seed: 'zoning', blocks: 4 })
    const plan = planOf(boot.laid!)
    const zone = plan.zones[0]
    if (!zone) return

    // the blocks of one part of town have a street between every pair of them,
    // so a shape derived off the blocks alone is a heap of outlined blocks
    const blocks = boot.laid!.plots().filter((plot) => plot.district === zone.id).length
    expect(blocks).toBeGreaterThan(0)
    const covered = zone.pads.reduce((sum, pad) => sum + pad.w * pad.d, 0)
    const bare = boot
      .laid!.districts()
      .find((district) => district.id === zone.id)!
      .blocks.reduce((sum, block) => sum + block.w * block.h, 0)
    expect(covered).toBeGreaterThan(bare * boot.laid!.cellSize ** 2)
  }, 30_000)
})

describe('the camera you look at a city with', () => {
  const GROUND = { x: 0, z: 0, w: 400, d: 400 }

  function framed(): Orbit {
    const orbit = new Orbit()
    orbit.frame(GROUND, 46, 1.5, { x: 0.9, y: 0.9 })
    return orbit
  }

  it('moves the ground the way the pointer moves, on both axes', () => {
    // dragging right carries the city right, which is the camera going left:
    // whatever was under the pointer stays under it
    const across = framed()
    const middle = across.target
    across.pan(100, 0, 800, 46)
    // looking from the south east, screen right is west and north of the middle
    expect(across.target.x).toBeLessThan(middle.x)
    expect(across.target.z).toBeGreaterThan(middle.z)

    // and dragging down carries it down, which is the camera going further in
    const down = framed()
    down.pan(0, 100, 800, 46)
    expect(down.target.x).toBeLessThan(middle.x)
    expect(down.target.z).toBeLessThan(middle.z)

    // the opposite drag is the opposite move, so nothing is one way only
    const back = framed()
    back.pan(-100, -100, 800, 46)
    expect(back.target.x).toBeGreaterThan(middle.x)
    expect(back.target.z).toBeGreaterThan(middle.z)
  })

  it('frames the whole town, comes in on one spot, and says how far in it is', () => {
    const orbit = framed()
    expect(orbit.zoom).toBeCloseTo(1, 5)

    orbit.look({ x: 120, z: 90 })
    expect([orbit.target.x, orbit.target.z]).toEqual([120, 90])
    expect(orbit.zoom).toBeGreaterThan(1)

    orbit.frame(GROUND, 46, 1.5, { x: 0.9, y: 0.9 })
    expect([orbit.target.x, orbit.target.z]).toEqual([200, 200])
    expect(orbit.zoom).toBeCloseTo(1, 5)
  })
})
