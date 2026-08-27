// @vitest-environment jsdom
import { Greybox } from '@gb/scene'
import { storeyHeight } from '@gb/scene'
import type { World } from '@gb/world'
import { screen, waitFor } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { Boot, type Show, type Start } from '../src/boot/boot.ts'
import { DEFAULTS } from '../src/boot/brief.ts'
import { patchesOf } from '../src/boot/blueprint/cells.ts'
import { planOf } from '../src/boot/blueprint/plan.ts'
import { shapeOf } from '../src/boot/blueprint/zones.ts'
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
    await boot.layOut({ ...DEFAULTS, seed: 'blueprint', blocks: 2 })
    const world = boot.laid!
    const plan = planOf(world)

    expect(plan.buildings).toHaveLength(world.plots().length)
    for (const [index, plot] of world.plots().entries()) {
      const built = plan.buildings[index]!
      expect(built.height).toBe(storeyHeight(plot.storeys))
      expect([built.w, built.d]).toEqual([plot.rect.w * world.cellSize, plot.rect.h * world.cellSize])
    }
    expect(plan.zones.map((zone) => zone.name)).toEqual(world.districts().map((district) => district.name))
    expect(plan.stations.map((station) => station.name)).toEqual(world.stations().map((plot) => plot.name))
    expect(plan.roadway.length).toBeGreaterThan(0)
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

  it('draws a part of town as the shape it is, not as the blocks it is made of', () => {
    // an L: two blocks along the top, one under the left of them
    const shape = shapeOf({
      id: 'district_0001',
      name: 'Ladderford',
      blocks: [
        { x: 0, y: 0, w: 2, h: 2 },
        { x: 2, y: 0, w: 2, h: 2 },
        { x: 0, y: 2, w: 2, h: 2 },
      ],
    })

    // six lines round the outside, and none through the middle where two
    // blocks meet
    expect(shape.border).toHaveLength(6)
    expect(shape.border).toContainEqual({ x1: 0, y1: 0, x2: 4, y2: 0 })
    expect(shape.border).toContainEqual({ x1: 0, y1: 0, x2: 0, y2: 4 })
    expect(shape.border.some((edge) => edge.x1 === 2 && edge.x2 === 2 && edge.y1 === 0)).toBe(false)
    // and its name goes inside it
    expect(shape.heart).toEqual({ x: 1, y: 1 })
  })
})
