// @vitest-environment jsdom
import { Bundle } from '@gb/bundle'
import { CityNav } from '@gb/nav'
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { Sidecar } from '@gb/sidecar'
import { screen, waitFor, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BLOCKS, DEFAULTS, briefFromQuery, briefToQuery, clampBlocks, tidy, type CityBrief } from '../src/boot/brief.ts'
import { Boot, type Start } from '../src/boot/boot.ts'
import { CityMaker } from '../src/boot/city-maker.ts'
import { download, exportName } from '../src/boot/export.ts'
import { Panel } from '../src/boot/panel.ts'
import { Session, type SaveStore } from '../src/session.ts'
import { Street } from '../src/street.ts'

/** Wherever this box is being run from: its own folder, or the workspace root. */
const PAGE = ['index.html', 'game/app/index.html'].map((path) => resolve(process.cwd(), path)).find(existsSync)!

/** The panel exactly as the page serves it, script tag and all removed. */
function servePage(): void {
  const page = readFileSync(PAGE, 'utf8')
  const body = /<body>([\s\S]*)<\/body>/.exec(page)![1]!
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '')
}

function panel(): Panel {
  return new Panel(document.querySelector<HTMLElement>('#boot')!)
}

const NEVER = new AbortController().signal
const QUIET = { signal: NEVER, step: () => {} }

describe('the panel is up before anything loads', () => {
  beforeEach(servePage)

  it('serves the whole form in the page itself, so first paint is the panel', () => {
    const fields = within(screen.getByRole('region', { name: 'Make a city' }))
    expect(fields.getByLabelText(/theme/i)).toBeTruthy()
    expect(fields.getByLabelText(/seed/i)).toBeTruthy()
    expect(fields.getByLabelText(/blocks/i)).toBeTruthy()
    expect(fields.getByRole('button', { name: /generate/i })).toBeTruthy()
    expect(fields.getByRole('button', { name: /export/i })).toBeTruthy()
    expect(fields.getByRole('status').textContent).toMatch(/loading/i)
  })

  it('paints the same defaults the generator would use, so the fields never lie', () => {
    expect(panel().brief).toEqual(DEFAULTS)
    const blocks = document.querySelector<HTMLInputElement>('[data-boot="blocks"]')!
    expect(blocks.min).toBe(String(BLOCKS.min))
    expect(blocks.max).toBe(String(BLOCKS.max))
  })
})

describe('the panel', () => {
  beforeEach(servePage)

  it('hands what the player typed to Generate', async () => {
    const user = userEvent.setup()
    const asked: CityBrief[] = []
    const front = panel()
    front.on({ generate: (brief) => asked.push(brief), open: () => {}, save: () => {}, cancel: () => {}, close: () => {} })
    front.waiting()

    await user.clear(screen.getByLabelText(/seed/i))
    await user.type(screen.getByLabelText(/seed/i), 'harbour')
    await user.clear(screen.getByLabelText(/blocks/i))
    await user.type(screen.getByLabelText(/blocks/i), '4')
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(asked).toEqual([{ theme: DEFAULTS.theme, seed: 'harbour', blocks: 4, model: false }])
  })

  it('clamps a block count the generator could not survive, rather than sending it', async () => {
    const user = userEvent.setup()
    const asked: CityBrief[] = []
    const front = panel()
    front.on({ generate: (brief) => asked.push(brief), open: () => {}, save: () => {}, cancel: () => {}, close: () => {} })
    front.waiting()

    await user.clear(screen.getByLabelText(/blocks/i))
    await user.type(screen.getByLabelText(/blocks/i), '400')
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(asked[0]!.blocks).toBe(BLOCKS.max)
  })

  it('gives a fresh seed nobody has played', async () => {
    const user = userEvent.setup()
    const front = panel()
    front.waiting()
    await user.click(screen.getByRole('button', { name: /fresh seed/i }))
    expect(front.brief.seed).not.toBe(DEFAULTS.seed)
    expect(front.brief.seed.length).toBeGreaterThan(6)
  })

  it('offers a way to stop while it is working, and none while it is not', () => {
    const front = panel()
    front.working('Laying out the city')
    expect(screen.getByRole('status').textContent).toBe('Laying out the city')
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /generate/i }).disabled).toBe(true)

    front.waiting('That will not build.', true)
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
    expect(screen.getByRole('status').dataset.trouble).toBe('true')
  })

  it('offers Export once there is a city, and a way back once one is being played', () => {
    const front = panel()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /export/i }).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /back to the city/i })).toBeNull()

    front.holding({ city: true, playing: false })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /export/i }).disabled).toBe(false)
    expect(screen.queryByRole('button', { name: /back to the city/i })).toBeNull()

    front.holding({ city: true, playing: true })
    expect(screen.getByRole('button', { name: /back to the city/i })).toBeTruthy()
  })
})

describe('the address bar', () => {
  it('reads a city out of it and writes the same one back', () => {
    const brief = briefFromQuery(new URLSearchParams('?seed=harbour&theme=dusty%20mining%20town&blocks=3'))
    expect(brief).toEqual({ theme: 'dusty mining town', seed: 'harbour', blocks: 3, model: false })
    expect(briefFromQuery(new URLSearchParams(briefToQuery(brief!)))).toEqual(brief)
  })

  it('carries whatever else was asked for through the rewrite', () => {
    const asked = new URLSearchParams('?seed=harbour&theme=quiet%20coastal%20town&blocks=1&sidecar=http://127.0.0.1:9/&bundle=/city.json')
    const written = new URLSearchParams(briefToQuery(briefFromQuery(asked)!, asked))

    // the brief is not the only thing in the address bar, and a refresh that
    // dropped these would quietly reconnect to a different sidecar
    expect(written.get('sidecar')).toBe('http://127.0.0.1:9/')
    expect(written.get('bundle')).toBe('/city.json')
    expect(written.get('seed')).toBe('harbour')
    expect(written.getAll('theme')).toEqual(['quiet coastal town'])
  })

  it('says nothing was asked for when nothing was', () => {
    expect(briefFromQuery(new URLSearchParams(''))).toBeUndefined()
    expect(briefFromQuery(new URLSearchParams('?bundle=/city.json'))).toBeUndefined()
  })

  it('keeps a typed brief inside what the generator will take', () => {
    expect(clampBlocks(0)).toBe(BLOCKS.min)
    expect(clampBlocks(999)).toBe(BLOCKS.max)
    expect(clampBlocks(Number.NaN)).toBe(DEFAULTS.blocks)
    expect(tidy({ theme: '  ', seed: '', blocks: 2, model: false })).toEqual(DEFAULTS)
    expect(tidy({ theme: 'x'.repeat(200), seed: 'a', blocks: 1, model: false }).theme).toHaveLength(60)
  })
})

describe('generating a city in the browser', () => {
  const maker = new CityMaker(new Sidecar())
  const brief = (over: Partial<CityBrief> = {}): CityBrief => ({ ...DEFAULTS, blocks: 1, ...over })

  it('gives the same city back for the same seed, and a different one for a different seed', async () => {
    const [once, twice, other] = await Promise.all([
      maker.build(brief(), QUIET),
      maker.build(brief(), QUIET),
      maker.build(brief({ seed: 'elsewhere' }), QUIET),
    ])
    if (!once.ok || !twice.ok || !other.ok) throw new Error('the city would not build')

    expect(once.value.bundle.contentHash).toBe(twice.value.bundle.contentHash)
    expect(once.value.bundle.contentHash).not.toBe(other.value.bundle.contentHash)
    expect(once.value.bundle.world.name).not.toBe(other.value.bundle.world.name)
  }, 30_000)

  it('refuses a city it cannot build with a sentence, rather than throwing', async () => {
    // past what the brief allows: the panel clamps this, a hand-written call does not
    const made = await maker.build(brief({ blocks: 400 }), QUIET)
    expect(made.ok).toBe(false)
    if (made.ok) return
    expect(made.message).toMatch(/generator will build/i)
    expect(made.message.length).toBeGreaterThan(20)
  })

  it('stops when the player stops it', async () => {
    const stop = new AbortController()
    stop.abort()
    const made = await maker.build(brief(), { signal: stop.signal, step: () => {} })
    expect(made).toEqual({ ok: false, message: 'Stopped.' })
  }, 30_000)

  it('says what it is doing while it does it', async () => {
    const steps: string[] = []
    await maker.build(brief(), { signal: NEVER, step: (text) => void steps.push(text) })
    expect(steps.length).toBeGreaterThan(1)
    expect(steps.join(' ')).toMatch(/city/i)
  }, 30_000)
})

describe('exporting a city', () => {
  it('writes out a document that opens again as a bundle', async () => {
    const made = await new CityMaker(new Sidecar()).build({ ...DEFAULTS, blocks: 1 }, QUIET)
    if (!made.ok) throw new Error(made.message)

    const written = JSON.parse(JSON.stringify(made.value.document))
    const reopened = await Bundle.open(written)
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    expect(reopened.value.contentHash).toBe(made.value.bundle.contentHash)
  }, 30_000)

  it('names the file after the city and the seed that made it', () => {
    expect(exportName({ name: 'Quiet Flats', seed: 'town' })).toBe('quiet-flats-town.gbworld.json')
  })

  it('hands the browser the city itself, under that name', async () => {
    const written: Blob[] = []
    const clicked: string[] = []
    URL.createObjectURL = (blob: Blob) => (written.push(blob), 'blob:city')
    URL.revokeObjectURL = () => {}
    // taken off again below: a click listener left on the document swallows
    // every click in every test after this one, this file's file input included
    const watch = (event: MouseEvent) => {
      clicked.push((event.target as HTMLAnchorElement).download)
      event.preventDefault()
    }
    document.addEventListener('click', watch)

    const city = { format: 'game-box.bundle', contentHash: 'abc' }
    download(city, 'quiet-flats-town.gbworld.json')
    document.removeEventListener('click', watch)

    expect(clicked).toEqual(['quiet-flats-town.gbworld.json'])
    expect(JSON.parse(await written[0]!.text())).toEqual(city)
    // the link was a means to an end and is not left lying on the page
    expect(document.querySelector('a[download]')).toBeNull()
  })
})

describe('coming back to a playthrough', () => {
  let kept: unknown
  const store: SaveStore = {
    read: () => kept,
    write: (value) => void (kept = value),
    clear: () => void (kept = undefined),
  }

  afterEach(() => {
    kept = undefined
  })

  async function city() {
    const made = await new CityMaker(new Sidecar()).build({ ...DEFAULTS, blocks: 1 }, QUIET)
    if (!made.ok) throw new Error(made.message)
    return made.value.bundle
  }

  it('picks the money and the pockets up where the refresh left them', async () => {
    const bundle = await city()
    const player = PlayerState.create(bundle.world.id, 5)
    player.earn(37)
    player.setFlag('met-the-clerk', true)
    const log = QuestLog.create(bundle.quests, player)

    new Session(bundle, store).keep(player, log)
    const back = new Session(bundle, store).restore()

    expect(back?.player.money).toBe(42)
    expect(back?.player.flag('met-the-clerk')).toBe(true)
  }, 30_000)

  it('starts fresh when there is nothing kept', async () => {
    expect(new Session(await city(), store).restore()).toBeUndefined()
  }, 30_000)

  it('will not drop a save from one city into another', async () => {
    const bundle = await city()
    const player = PlayerState.create(bundle.world.id, 5)
    new Session(bundle, store).keep(player, QuestLog.create(bundle.quests, player))

    const elsewhere = await new CityMaker(new Sidecar()).build({ ...DEFAULTS, blocks: 1, seed: 'elsewhere' }, QUIET)
    if (!elsewhere.ok) throw new Error(elsewhere.message)
    expect(new Session(elsewhere.value.bundle, store).restore()).toBeUndefined()
  }, 30_000)
})

describe('the front door end to end', () => {
  const started: string[] = []
  let fail = false

  /** A running game with no renderer in it, so the whole flow is testable. */
  const start: Start = async (_mount, bundle) => {
    if (fail) throw new Error('no GPU here')
    started.push(bundle.world.name)
    return { dispose: () => {}, handOverKeys: () => {}, keep: () => {} }
  }

  function open(): { boot: Boot; panel: Panel } {
    servePage()
    const panel = new Panel(document.querySelector<HTMLElement>('#boot')!)
    return { boot: new Boot({ mount: document.querySelector('#game')!, panel, sidecar: new Sidecar(), start }), panel }
  }

  beforeEach(() => {
    started.length = 0
    fail = false
    localStorage.clear()
  })

  it('waits for the player when the address bar asked for nothing', async () => {
    const { boot, panel } = open()
    await boot.start(new URLSearchParams(''))
    expect(started).toEqual([])
    expect(panel.open).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /generate/i }).disabled).toBe(false)
  })

  it('builds what the address bar asked for and gets out of the way', async () => {
    const { boot, panel } = open()
    await boot.start(new URLSearchParams('?seed=frontdoor&theme=quiet%20coastal%20town&blocks=1'))
    expect(started).toHaveLength(1)
    expect(panel.open).toBe(false)
  }, 30_000)

  it('leaves the sidecar the player named in the address bar, so a refresh comes back to it', async () => {
    const { boot } = open()
    await boot.start(new URLSearchParams('?seed=frontdoor&theme=quiet%20coastal%20town&blocks=1&sidecar=http://127.0.0.1:9/'))

    expect(started).toHaveLength(1)
    const written = new URLSearchParams(location.search)
    expect(written.get('sidecar')).toBe('http://127.0.0.1:9/')
    expect(written.get('seed')).toBe('frontdoor')
  }, 30_000)

  it('comes back to the same city on a refresh with nothing in the address bar', async () => {
    await open().boot.start(new URLSearchParams('?seed=comeback&theme=quiet%20coastal%20town&blocks=1'))
    const first = started[0]
    started.length = 0
    await open().boot.start(new URLSearchParams(''))
    expect(started).toEqual([first])
  }, 40_000)

  it('opens a city out of a file when the address bar names one', async () => {
    const made = await new CityMaker(new Sidecar()).build({ ...DEFAULTS, blocks: 1, seed: 'fromfile' }, QUIET)
    if (!made.ok) throw new Error(made.message)
    const real = window.fetch
    window.fetch = (async () => new Response(JSON.stringify(made.value.document))) as typeof fetch

    const { boot, panel } = open()
    await boot.start(new URLSearchParams('?bundle=/city.json'))
    window.fetch = real

    expect(started).toEqual([made.value.bundle.world.name])
    expect(panel.open).toBe(false)
  }, 30_000)

  it('plays a city file the player picked, exactly as Export wrote it', async () => {
    const made = await new CityMaker(new Sidecar()).build({ ...DEFAULTS, blocks: 1, seed: 'shared' }, QUIET)
    if (!made.ok) throw new Error(made.message)

    // the bytes Export hands the browser, taken straight back in: a world
    // somebody was sent is opened by choosing it, with nothing in between
    const written: Blob[] = []
    URL.createObjectURL = (blob: Blob) => (written.push(blob), 'blob:city')
    URL.revokeObjectURL = () => {}
    const name = exportName(made.value.bundle.world)
    download(made.value.document, name)

    const { boot, panel } = open()
    await boot.start(new URLSearchParams(''))
    expect(panel.open).toBe(true)

    await userEvent.setup().upload(screen.getByLabelText(/city file/i), new File([written[0]!], name))

    await waitFor(() => expect(started).toEqual([made.value.bundle.world.name]), { timeout: 20_000 })
    expect(panel.open).toBe(false)
  }, 40_000)

  it('says a picked file is not a city, rather than throwing at the player', async () => {
    const { boot, panel } = open()
    await boot.start(new URLSearchParams(''))

    const junk = new File(['{"format":"not-a-bundle"}'], 'holiday-photos.json', { type: 'application/json' })
    await userEvent.setup().upload(screen.getByLabelText(/city file/i), junk)

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/will not open/i), { timeout: 20_000 })
    expect(started).toEqual([])
    expect(panel.open).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /generate/i }).disabled).toBe(false)
  }, 30_000)

  it('says why a file will not open, rather than throwing at the player', async () => {
    const real = window.fetch
    window.fetch = (async () => new Response('{"format":"not-a-bundle"}')) as typeof fetch

    const { boot, panel } = open()
    await boot.start(new URLSearchParams('?bundle=/rubbish.json'))
    window.fetch = real

    expect(started).toEqual([])
    expect(panel.open).toBe(true)
    expect(screen.getByRole('status').textContent).toMatch(/will not open/i)
  })

  it('says so when the city is sound but will not draw, instead of sitting on a step', async () => {
    fail = true
    const { boot, panel } = open()
    await boot.start(new URLSearchParams('?seed=nogpu&theme=quiet%20coastal%20town&blocks=1'))
    expect(panel.open).toBe(true)
    expect(screen.getByRole('status').textContent).toMatch(/would not draw/i)
    expect(screen.getByRole('status').dataset.trouble).toBe('true')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /generate/i }).disabled).toBe(false)
    // the city itself is sound, so it can still be kept
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /export/i }).disabled).toBe(false)
  }, 30_000)
})

describe('the people on the street', () => {
  /** A body with no art in it, so the crowd can walk somebody with no GPU. */
  const nobody = () => ({ placeAt: () => {}, faceTo: () => {}, play: () => {}, release: () => {} })

  it('are the city\'s own, so whoever the player passes can be named and talked to', async () => {
    const made = await new CityMaker(new Sidecar()).build({ ...DEFAULTS, blocks: 2 }, QUIET)
    if (!made.ok) throw new Error(made.message)
    const world = made.value.bundle.world

    const size = world.cellSize
    let stand: { x: number; z: number } | undefined
    for (let y = 0; y < world.grid.height && !stand; y++) {
      for (let x = 0; x < world.grid.width; x++) {
        if (world.grid.at(x, y) === 'sidewalk') {
          stand = { x: (x + 0.5) * size, z: (y + 0.5) * size }
          break
        }
      }
    }
    if (!stand) throw new Error('a city with no pavement')

    // the landscape is the ground under the whole world, town and country alike
    let asked = 0
    const ground = { heightAt: () => (asked++, 0), walkableAt: () => true }

    const street = new Street({ world, nav: CityNav.from(world), ground, playerOutdoors: () => stand })
    street.populate({ spawn: nobody })
    for (let frame = 0; frame < 300; frame++) street.update(1 / 60, stand)

    const walkers = street.walkers()
    expect(walkers.length).toBeGreaterThan(0)
    for (const walker of walkers) expect(world.npc(walker.id)?.name).toBeTruthy()
    expect(asked).toBeGreaterThan(0)
  }, 40_000)

  it('leaves somebody at every post, so a building the player walks into is not empty', async () => {
    const made = await new CityMaker(new Sidecar()).build({ ...DEFAULTS, blocks: 2 }, QUIET)
    if (!made.ok) throw new Error(made.message)
    const world = made.value.bundle.world

    const street = new Street({ world, nav: CityNav.from(world), playerOutdoors: () => undefined })
    const out = new Set(street.residents().map((npc) => npc.id))

    // the whole town on the pavement is a town where every shop is deserted
    expect(out.size).toBeGreaterThan(0)
    expect(out.size).toBeLessThan(world.npcs().length)

    const rooms = new Set(world.npcs().flatMap((npc) => (npc.station ? [npc.station.interiorId] : [])))
    expect(rooms.size).toBeGreaterThan(0)
    for (const room of rooms) {
      const staying = world.npcs().filter((npc) => npc.station?.interiorId === room && !out.has(npc.id))
      expect(staying.length, `nobody left in ${room}`).toBeGreaterThan(0)
    }
  }, 40_000)
})
