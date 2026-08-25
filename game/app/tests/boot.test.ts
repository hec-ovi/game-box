// @vitest-environment jsdom
import { Bundle, type OpenedBundle } from '@gb/bundle'
import { CityNav } from '@gb/nav'
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import type { Notice } from '@gb/hud'
import { Sidecar, type SidecarOptions } from '@gb/sidecar'
import { Conversation } from '@gb/talk'
import { screen, waitFor, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BLOCKS, DEFAULTS, STYLE, briefFromQuery, briefToQuery, clampBlocks, sameBrief, tidy, type CityBrief } from '../src/boot/brief.ts'
import { Boot, type LoadArt, type Start } from '../src/boot/boot.ts'
import { CityMaker } from '../src/boot/city-maker.ts'
import { download, exportName } from '../src/boot/export.ts'
import { Library, MemoryShelf, keyOf, type Shelved } from '../src/boot/library.ts'
import { Panel } from '../src/boot/panel.ts'
import { Conditions } from '../src/conditions.ts'
import { Greybox } from '@gb/scene'
import type { Catalogue } from '@gb/prefab'
import type { GameOptions } from '../src/game.ts'
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
const QUIET_HANDLERS = { generate: () => {}, open: () => {}, pick: () => {}, remove: () => {}, save: () => {}, cancel: () => {}, close: () => {} }

/** A sidecar nothing is listening on: every call fails at once and the offline writer covers. */
const DOWN: SidecarOptions = { fetch: () => Promise.reject(new Error('nothing listening')) }

describe('the panel is up before anything loads', () => {
  beforeEach(servePage)

  it('serves the whole form in the page itself, so first paint is the panel', () => {
    const fields = within(screen.getByRole('region', { name: 'Make a city' }))
    expect(fields.getByLabelText(/theme/i)).toBeTruthy()
    expect(fields.getByLabelText(/what the city is about/i).tagName).toBe('TEXTAREA')
    expect(fields.getByLabelText(/main quest/i)).toBeTruthy()
    expect(fields.getByLabelText(/side quests/i)).toBeTruthy()
    expect(fields.getByLabelText(/tone/i)).toBeTruthy()
    expect(fields.getByLabelText(/seed/i)).toBeTruthy()
    expect(fields.getByLabelText(/blocks/i)).toBeTruthy()
    expect(fields.getByRole('button', { name: /generate/i })).toBeTruthy()
    expect(fields.getByRole('button', { name: /export/i })).toBeTruthy()
    expect(fields.getByRole('status').textContent).toMatch(/loading/i)
    // the way out of the game lands here, so the shelf is on the same card
    expect(fields.getByRole('region', { name: 'Your cities' })).toBeTruthy()
  })

  it('paints the same defaults the generator would use, so the fields never lie', () => {
    expect(panel().brief).toEqual(DEFAULTS)
    const blocks = document.querySelector<HTMLInputElement>('[data-boot="blocks"]')!
    expect(blocks.min).toBe(String(BLOCKS.min))
    expect(blocks.max).toBe(String(BLOCKS.max))
  })

  it('offers the catalogue\'s own style choices and nothing outside them, and says why', () => {
    panel()
    const fields = within(screen.getByRole('region', { name: 'Make a city' }))
    // the world's closed lists, with a first choice that leaves it to the generator
    for (const axis of ['neon', 'density', 'wear'] as const) {
      const options = [...fields.getByLabelText(new RegExp(axis, 'i')).querySelectorAll('option')]
      expect(options.map((option) => option.value)).toEqual(['', ...STYLE[axis]])
    }
    // and a form that took a period and dropped it would be worse than one that says so
    expect(fields.getByText(/cannot be drawn/i)).toBeTruthy()
    // the ask is a question of no free text on style: nothing on the form takes a word
    expect(fields.queryByLabelText(/^style$/i)).toBeNull()
  })
})

describe('the panel', () => {
  beforeEach(servePage)

  it('hands what the player typed to Generate, blank fields left out', async () => {
    const user = userEvent.setup()
    const asked: CityBrief[] = []
    const front = panel()
    front.on({ ...QUIET_HANDLERS, generate: (brief) => void asked.push(brief) })
    front.waiting()

    await user.clear(screen.getByLabelText(/seed/i))
    await user.type(screen.getByLabelText(/seed/i), 'harbour')
    await user.clear(screen.getByLabelText(/blocks/i))
    await user.type(screen.getByLabelText(/blocks/i), '4')
    await user.type(screen.getByLabelText(/what the city is about/i), 'a town living off the smuggling run, with the customs house half bought')
    await user.type(screen.getByLabelText(/main quest/i), 'who owns the customs house')
    await user.type(screen.getByLabelText(/tone/i), '  grim  ')
    await user.selectOptions(screen.getByLabelText(/wear/i), 'run-down')
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(asked).toEqual([
      {
        theme: DEFAULTS.theme,
        seed: 'harbour',
        blocks: 4,
        model: false,
        brief: 'a town living off the smuggling run, with the customs house half bought',
        asks: { mainQuest: 'who owns the customs house', tone: 'grim', style: { wear: 'run-down' } },
      },
    ])
  })

  it('writes a brief back into every field, so a city off the shelf shows what it was asked for', () => {
    const front = panel()
    const brief: CityBrief = {
      theme: 'dusty mining town',
      seed: 'ore',
      blocks: 3,
      model: true,
      brief: 'the seam ran out',
      asks: { sideQuests: 'odd jobs for the miners', style: { neon: 'dark', density: 'sparse' } },
    }
    front.brief = brief
    expect(front.brief).toEqual(brief)
    expect(screen.getByLabelText<HTMLSelectElement>(/neon/i).value).toBe('dark')
    expect(screen.getByLabelText<HTMLSelectElement>(/wear/i).value).toBe('')
  })

  it('clamps a block count the generator could not survive, rather than sending it', async () => {
    const user = userEvent.setup()
    const asked: CityBrief[] = []
    const front = panel()
    front.on({ ...QUIET_HANDLERS, generate: (brief) => void asked.push(brief) })
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

  it('offers Export once there is a city, and a way back once one is being played, on a key the button prints', async () => {
    const front = panel()
    let closed = 0
    front.on({ ...QUIET_HANDLERS, close: () => void closed++ })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /export/i }).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /back to the city/i })).toBeNull()

    front.holding({ city: true, playing: false })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /export/i }).disabled).toBe(false)
    expect(screen.queryByRole('button', { name: /back to the city/i })).toBeNull()
    // nothing to go back to yet, so the key does nothing either
    screen.getByLabelText(/theme/i).focus()
    await userEvent.setup().keyboard('{Escape}')
    expect(closed).toBe(0)

    front.holding({ city: true, playing: true })
    expect(screen.getByRole('button', { name: /back to the city/i }).textContent).toMatch(/Esc/)
    await userEvent.setup().keyboard('{Escape}')
    expect(closed).toBe(1)
  })

  it('lists the shelf newest first with the last city marked, and reports Open and Remove by key', async () => {
    const front = panel()
    const picked: string[] = []
    const removed: string[] = []
    front.on({ ...QUIET_HANDLERS, pick: (key) => void picked.push(key), remove: (key) => void removed.push(key) })
    front.waiting()
    expect(screen.getByText(/nothing on the shelf/i).hidden).toBe(false)

    const shelved = (key: string, name: string, openedAt: number): Shelved => ({
      key,
      name,
      theme: 'quiet coastal town',
      seed: key,
      blocks: 2,
      model: false,
      hash: key,
      source: 'made',
      openedAt,
    })
    front.library([shelved('new', 'Grey Slip', 20), shelved('old', 'Kell Point', 10)])
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((row) => row.dataset.last)).toEqual(['true', 'false'])
    expect(screen.getByText(/nothing on the shelf/i).hidden).toBe(true)
    expect(within(rows[0]!).getByRole('button', { name: /open grey slip/i }).textContent).toBe('Continue')

    const user = userEvent.setup()
    await user.click(within(rows[1]!).getByRole('button', { name: /open kell point/i }))
    await user.click(within(rows[0]!).getByRole('button', { name: /remove grey slip/i }))
    expect(picked).toEqual(['old'])
    expect(removed).toEqual(['new'])
  })
})

describe('the address bar', () => {
  it('reads a city out of it and writes the same one back', () => {
    const brief = briefFromQuery(new URLSearchParams('?seed=harbour&theme=dusty%20mining%20town&blocks=3'))
    expect(brief).toEqual({ theme: 'dusty mining town', seed: 'harbour', blocks: 3, model: false })
    expect(briefFromQuery(new URLSearchParams(briefToQuery(brief!)))).toEqual(brief)
  })

  it('carries the sidecar through the rewrite, and drops a file once a brief names the city', () => {
    const asked = new URLSearchParams('?seed=harbour&theme=quiet%20coastal%20town&blocks=1&sidecar=http://127.0.0.1:9/&bundle=/city.json')
    const written = new URLSearchParams(briefToQuery(briefFromQuery(asked)!, asked))

    // the brief is not the only thing in the address bar, and a refresh that
    // dropped this would quietly reconnect to a different sidecar
    expect(written.get('sidecar')).toBe('http://127.0.0.1:9/')
    expect(written.get('seed')).toBe('harbour')
    expect(written.getAll('theme')).toEqual(['quiet coastal town'])
    // a file and a brief are two cities, and the address names the one on screen
    expect(written.get('bundle')).toBeNull()

    // a city out of a file leaves the brief off, so a refresh comes back to the shelf rather than the seed
    const fromFile = new URLSearchParams(briefToQuery(undefined, asked))
    expect(fromFile.has('seed')).toBe(false)
    expect(fromFile.get('sidecar')).toBe('http://127.0.0.1:9/')
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

  it('reads a blank field as no ask at all, and a style outside the catalogue as none', () => {
    // absence is what the generator handles well; an empty string is a line saying nothing
    const blank = tidy({ ...DEFAULTS, brief: '  ', asks: { mainQuest: '', tone: ' ', style: { neon: 'ultraviolet' as never } } })
    expect(blank).toEqual(DEFAULTS)
    expect('brief' in blank || 'asks' in blank).toBe(false)
    expect(sameBrief(blank, DEFAULTS)).toBe(true)
    expect(sameBrief({ ...DEFAULTS, brief: 'a town' }, DEFAULTS)).toBe(false)
  })
})

describe('the shelf', () => {
  async function city(seed: string) {
    const made = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 1, seed }, QUIET)
    if (!made.ok) throw new Error(made.message)
    return made.value
  }

  it('files a city under the brief it was made from, and a file under its own hash', async () => {
    let now = 1
    const library = new Library(new MemoryShelf(), () => now++)
    const one = await city('one')
    const other = await city('other')

    const made = await library.made({ ...DEFAULTS, blocks: 1, seed: 'one' }, one)
    expect(made.key).toBe(keyOf({ ...DEFAULTS, blocks: 1, seed: 'one' }))
    // one changed word is another city and another shelf
    expect(keyOf({ ...DEFAULTS, blocks: 1, seed: 'one', brief: 'a town' })).not.toBe(made.key)
    // a blank is the same ask as no field at all
    expect(keyOf({ ...DEFAULTS, blocks: 1, seed: 'one', brief: ' ' })).toBe(made.key)

    const opened = await library.opened(other)
    expect(opened.key).toBe(other.bundle.contentHash)
    expect(opened.source).toBe('opened')
    expect(await library.document(opened.key)).toBe(other.document)
  }, 30_000)

  it('keeps the newest first, moves a city back to the top when it is opened again, and takes one off', async () => {
    let now = 1
    const library = new Library(new MemoryShelf(), () => now++)
    const one = await city('one')
    const other = await city('other')
    const first = await library.made({ ...DEFAULTS, blocks: 1, seed: 'one' }, one)
    const second = await library.made({ ...DEFAULTS, blocks: 1, seed: 'other' }, other)
    expect((await library.entries()).map((entry) => entry.key)).toEqual([second.key, first.key])
    expect((await library.last())?.key).toBe(second.key)

    await library.touch(first)
    expect((await library.last())?.key).toBe(first.key)

    await library.remove(first.key)
    expect((await library.entries()).map((entry) => entry.key)).toEqual([second.key])
    expect(await library.document(first.key)).toBeUndefined()
  }, 30_000)
})

describe('generating a city in the browser', () => {
  const maker = new CityMaker(new Sidecar(DOWN))
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

  it('writes the form\'s answers into the world file, so a shared city says what it was asked for', async () => {
    const asked = brief({
      brief: 'a town living off the smuggling run',
      asks: { mainQuest: 'who owns the customs house', tone: 'grim', style: { wear: 'run-down' } },
    })
    const made = await maker.build(asked, QUIET)
    if (!made.ok) throw new Error(made.message)
    expect(made.value.bundle.world.brief()).toBe(asked.brief)
    expect(made.value.bundle.world.asks()).toEqual(asked.asks)
    // and a form left blank leaves nothing behind it
    const plain = await maker.build(brief(), QUIET)
    if (!plain.ok) throw new Error(plain.message)
    expect(plain.value.bundle.world.brief()).toBeUndefined()
    expect(plain.value.bundle.world.asks()).toBeUndefined()
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

  it('says what it is doing while it does it, stage by stage when the model is writing', async () => {
    const steps: string[] = []
    await maker.build(brief(), { signal: NEVER, step: (text) => void steps.push(text) })
    expect(steps.length).toBeGreaterThan(1)
    expect(steps.join(' ')).toMatch(/city/i)

    // with the model on, the scribe says how far it has got; with nothing
    // listening the offline writer covers every call, and the stages still run
    const stages: string[] = []
    const written = await maker.build(brief({ model: true }), { ...QUIET, progress: (event) => void stages.push(event.stage) })
    if (!written.ok) throw new Error(written.message)
    expect([...new Set(stages)]).toEqual(['history', 'city', 'places', 'quests'])
    // and every call the model did not answer is one fault to tell the player, never one per call
    expect(written.value.notes.filter((note) => note.kind === 'error')).toHaveLength(1)
    expect(written.value.notes[0]).toMatchObject({ kind: 'error', text: expect.stringMatching(/failed \d+ of its calls \(unreachable\)/) })
  }, 60_000)
})

describe('exporting a city', () => {
  it('writes out a document that opens again as a bundle', async () => {
    const made = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 1 }, QUIET)
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

  async function city(seed = 'town') {
    const made = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 1, seed }, QUIET)
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
    expect(back?.report.rebuilt).toBe(false)
  }, 30_000)

  it('comes back with the clock as the save left it: held stays held, at the rate it ran at', async () => {
    const bundle = await city()
    const player = PlayerState.create(bundle.world.id, 5)
    player.clock.setRate(60)
    // the player pressed P and then closed the tab. The pause is the clock's
    // own and comes back with it; the settings tab reads it off the clock and
    // the way in says so, and nothing here remembers a rate of its own
    expect(new Conditions(player.clock).hold()).toBe('Time held')
    new Session(bundle, store).keep(player, QuestLog.create(bundle.quests, player))

    const back = new Session(bundle, store).restore()!
    expect(back.player.clock.paused).toBe(true)
    expect(new Conditions(back.player.clock).hold()).toBe('Time running')
    expect(back.player.clock.rate).toBe(60)
  }, 30_000)

  it('starts fresh when there is nothing kept', async () => {
    expect(new Session(await city(), store).restore()).toBeUndefined()
  }, 30_000)

  it('carries a save into a later writing of the same city, and says it did', async () => {
    // a city the model writes is a different city every time, and every city
    // calls itself world_0001: so a save under this city's key resumes
    // reconciled, and the report is what the player is told
    const bundle = await city()
    const player = PlayerState.create(bundle.world.id, 5)
    player.earn(10)
    new Session(bundle, store).keep(player, QuestLog.create(bundle.quests, player))

    const later = await city('elsewhere')
    const back = new Session(later, store).restore()!
    expect(back.report.rebuilt).toBe(true)
    expect(back.player.money).toBe(15)
  }, 30_000)
})

describe('the front door end to end', () => {
  const started: string[] = []
  const built: OpenedBundle[] = []
  const options: GameOptions[] = []
  const announced: Notice[] = []
  const handed: boolean[] = []
  let fail = false
  let art: LoadArt = async () => ({ dressing: new Greybox() })

  /** A running game with no renderer in it, so the whole flow is testable. */
  const start: Start = async (_mount, bundle, given) => {
    if (fail) throw new Error('no GPU here')
    started.push(bundle.world.name)
    built.push(bundle)
    options.push(given)
    return { dispose: () => {}, handOverKeys: (away) => void handed.push(away), keep: () => {}, announce: (notice) => void announced.push(notice) }
  }

  function open(sidecar: SidecarOptions = DOWN, shelf = new MemoryShelf()): { boot: Boot; panel: Panel; shelf: MemoryShelf } {
    servePage()
    const panel = new Panel(document.querySelector<HTMLElement>('#boot')!)
    const library = new Library(shelf)
    return {
      boot: new Boot({ mount: document.querySelector('#game')!, panel, library, sidecar, start, art: (theme) => art(theme) }),
      panel,
      shelf,
    }
  }

  beforeEach(() => {
    started.length = 0
    built.length = 0
    options.length = 0
    announced.length = 0
    handed.length = 0
    fail = false
    art = async () => ({ dressing: new Greybox() })
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

  it('pins a city it generates to the art it was designed against', async () => {
    // the pack the panel loaded, standing in for the shipped one: what matters
    // here is that whatever the art answers with reaches the city before it is
    // sealed, because a file that names no catalogue is re-skinned by the next
    // reader whose pack has grown
    const identity = { pack: 'test-pack', version: '2.0.0', sha256: 'a'.repeat(64) }
    const catalogue = {
      identity,
      pack: identity.pack,
      design: () => ({ model: 'tower-a-narrow', mirror: false, rooms: 0 }),
    } as unknown as Catalogue
    art = async () => ({ dressing: new Greybox(), catalogue })

    const { boot } = open()
    await boot.start(new URLSearchParams('?seed=pinned&theme=quiet%20coastal%20town&blocks=1'))

    const world = built[0]!.world
    expect(built[0]!.requires).toEqual([identity])
    expect(world.catalogues()).toEqual([identity])
    const plots = world.plots()
    expect(plots.length).toBeGreaterThan(0)
    expect(plots.every((plot) => plot.design?.pack === identity.pack)).toBe(true)
  }, 30_000)

  it('generates an honestly unpinned city when the art will not load', async () => {
    // a city naming a catalogue with no plot pinned to it reads as pinned and
    // is not, so a pack that would not load pins nothing at all
    art = async () => ({ dressing: new Greybox() })

    const { boot } = open()
    await boot.start(new URLSearchParams('?seed=nopack&theme=quiet%20coastal%20town&blocks=1'))

    expect(built[0]!.requires).toEqual([])
    expect(built[0]!.world.catalogues()).toEqual([])
    expect(built[0]!.world.plots().some((plot) => plot.design)).toBe(false)
  }, 30_000)

  it('leaves the sidecar the player named in the address bar, so a refresh comes back to it', async () => {
    const { boot } = open()
    await boot.start(new URLSearchParams('?seed=frontdoor&theme=quiet%20coastal%20town&blocks=1&sidecar=http://127.0.0.1:9/'))

    expect(started).toHaveLength(1)
    const written = new URLSearchParams(location.search)
    expect(written.get('sidecar')).toBe('http://127.0.0.1:9/')
    expect(written.get('seed')).toBe('frontdoor')
  }, 30_000)

  it('comes back to the city on the shelf on a refresh, rather than writing it again', async () => {
    const shelf = new MemoryShelf()
    await open(DOWN, shelf).boot.start(new URLSearchParams('?seed=comeback&theme=quiet%20coastal%20town&blocks=1'))
    const first = started[0]!
    const [entry] = await shelf.list()
    expect(entry!.name).toBe(first)

    // the proof that the shelf is read and the brief is not built again: the
    // document under that key is swapped for another city's, and that is the
    // city that comes back, with the address bar naming the same brief
    const other = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 1, seed: 'swapped' }, QUIET)
    if (!other.ok) throw new Error(other.message)
    await shelf.put(entry!, other.value.document)
    started.length = 0
    await open(DOWN, shelf).boot.start(new URLSearchParams(''))
    expect(started).toEqual([other.value.bundle.world.name])

    // and the address bar still naming that brief is the same refresh
    started.length = 0
    await open(DOWN, shelf).boot.start(new URLSearchParams('?seed=comeback&theme=quiet%20coastal%20town&blocks=1'))
    expect(started).toEqual([other.value.bundle.world.name])
  }, 60_000)

  it('keeps every city on the shelf with the last one marked, opens any of them, and takes one off with its save', async () => {
    const shelf = new MemoryShelf()
    const { boot } = open(DOWN, shelf)
    await boot.start(new URLSearchParams('?seed=first&theme=quiet%20coastal%20town&blocks=1'))
    await boot.generate({ ...DEFAULTS, blocks: 1, seed: 'second' })
    expect(started).toHaveLength(2)

    // the playthrough is kept per city: the first city's store holds a save
    // and the second city's does not, whatever both cities call themselves
    options[0]!.save!.write({ marker: 'first' })
    expect(options[1]!.save!.read()).toBeUndefined()

    boot.showPanel()
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((row) => within(row).getByText(/./, { selector: '.gb-boot-shelved-name' }).textContent)).toEqual([started[1], started[0]])
    expect(rows[0]!.dataset.last).toBe('true')

    const user = userEvent.setup()
    await user.click(within(rows[1]!).getByRole('button', { name: /^open/i }))
    await waitFor(() => expect(started).toHaveLength(3))
    expect(started[2]).toBe(started[0])
    // opening it is coming back to it: the same save, and the top of the shelf
    expect(options[2]!.save!.read()).toEqual({ marker: 'first' })
    boot.showPanel()
    expect(screen.getAllByRole('listitem')[0]!.dataset.last).toBe('true')
    expect(screen.getAllByRole('listitem')[0]!.dataset.key).toBe(rows[1]!.dataset.key)

    await user.click(within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: /^remove/i }))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
    expect((await shelf.list()).map((entry) => entry.name)).toEqual([started[1]])
    expect(options[2]!.save!.read()).toBeUndefined()
  }, 60_000)

  it('opens a city out of a file when the address bar names one', async () => {
    const made = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 1, seed: 'fromfile' }, QUIET)
    if (!made.ok) throw new Error(made.message)
    const real = window.fetch
    window.fetch = (async () => new Response(JSON.stringify(made.value.document))) as typeof fetch

    const { boot, panel } = open()
    await boot.start(new URLSearchParams('?bundle=/city.json'))
    window.fetch = real

    expect(started).toEqual([made.value.bundle.world.name])
    expect(panel.open).toBe(false)
  }, 30_000)

  it('plays a city file the player picked, exactly as Export wrote it, and shelves it', async () => {
    const made = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 1, seed: 'shared' }, QUIET)
    if (!made.ok) throw new Error(made.message)

    // the bytes Export hands the browser, taken straight back in: a world
    // somebody was sent is opened by choosing it, with nothing in between
    const written: Blob[] = []
    URL.createObjectURL = (blob: Blob) => (written.push(blob), 'blob:city')
    URL.revokeObjectURL = () => {}
    const name = exportName(made.value.bundle.world)
    download(made.value.document, name)

    const { boot, panel, shelf } = open()
    await boot.start(new URLSearchParams(''))
    expect(panel.open).toBe(true)

    await userEvent.setup().upload(screen.getByLabelText(/city file/i), new File([written[0]!], name))

    await waitFor(() => expect(started).toEqual([made.value.bundle.world.name]), { timeout: 20_000 })
    expect(panel.open).toBe(false)
    expect((await shelf.list()).map((entry) => [entry.source, entry.key])).toEqual([['opened', made.value.bundle.contentHash]])
    // a file names no brief, so the address bar names none either
    expect(new URLSearchParams(location.search).has('seed')).toBe(false)
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

  it('covers the wait with the loader while the model writes, stage by stage, and takes it down for the game', async () => {
    // the first call the scribe makes is the history: what the loader shows at
    // that moment is what the player sees for the whole first stage
    const seen: string[] = []
    let stood = false
    const sidecar: SidecarOptions = {
      fetch: () => {
        const loader = document.querySelector('.gb-loader')
        if (loader) {
          seen.push(...[...loader.querySelectorAll('.gb-stage')].map((stage) => `${stage.getAttribute('aria-label')}:${stage.getAttribute('data-state')}`))
          stood = document.querySelector<HTMLElement>('#boot')!.dataset.aside === 'true'
        }
        return Promise.reject(new Error('nothing listening'))
      },
    }
    const { boot } = open(sidecar)
    await boot.start(new URLSearchParams('?seed=loader&theme=quiet%20coastal%20town&blocks=1&model=1'))

    expect(seen.slice(0, 4)).toEqual([
      'Writing the history:running',
      'Laying out the city:waiting',
      'Writing the places:waiting',
      'Writing the quests:waiting',
    ])
    // the panel stood aside for it, and offered the way to stop
    expect(stood).toBe(true)
    // the game has its own interface, so the loader is gone before it goes up
    expect(started).toHaveLength(1)
    expect(document.querySelector('.gb-loader')).toBeNull()
    expect(document.querySelector<HTMLElement>('#boot')!.dataset.aside).toBe('false')
    // and what the model did not write is said once, as a fault, on the game
    expect(announced.filter((notice) => notice.kind === 'error')).toHaveLength(1)
  }, 60_000)

  it('announces a busy model as a wait, never as a failure, and never retries it itself', async () => {
    // a rate limited sidecar: the client waits it out and asks again, and what
    // the player sees meanwhile is the wait counting down on whatever is up
    let calls = 0
    const waits: string[] = []
    const sidecar: SidecarOptions = {
      backoff: { attempts: 2, baseMs: 20, capMs: 100, jitter: 0 },
      fetch: () => {
        calls += 1
        const notice = document.querySelector('.gb-notice.gb-model-busy')
        if (notice) waits.push(notice.textContent ?? '')
        return Promise.resolve(new Response('{"error":{"code":"model-busy"}}', { status: 429 }))
      },
    }
    const { boot } = open(sidecar)
    await boot.start(new URLSearchParams('?seed=busy&theme=quiet%20coastal%20town&blocks=1&model=1'))

    expect(started).toHaveLength(1)
    // every call was sent twice, once and once after the wait, by the sidecar
    expect(calls % 2).toBe(0)
    expect(waits.length).toBeGreaterThan(0)
    expect(waits[0]).toMatch(/model is busy/i)
    // and once the game is up the same wait lands on it rather than on nothing:
    // a conversation goes through the same client, and the player is told
    const world = built[0]!.world
    const player = PlayerState.create(world.id)
    const opened = Conversation.open({ world, log: QuestLog.create([], player), player, sidecar: options[0]!.sidecar!, npcId: world.npcs()[0]!.id })
    if (!opened.ok) throw new Error('nobody to talk to')
    for await (const event of opened.value.conversation.say('hello')) void event
    expect(announced.filter((notice) => notice.kind === 'model-busy').length).toBeGreaterThan(0)
    expect(announced.filter((notice) => notice.kind === 'error')).toHaveLength(0)
  }, 60_000)

  it('is the way out of the game: the interface reports leaving, and the panel comes up with the shelf', async () => {
    const { boot, panel } = open()
    await boot.start(new URLSearchParams('?seed=exit&theme=quiet%20coastal%20town&blocks=1'))
    expect(panel.open).toBe(false)
    handed.length = 0

    options[0]!.leave!()
    expect(panel.open).toBe(true)
    expect(handed).toEqual([true])
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    // and Escape is the way back
    await userEvent.setup().keyboard('{Escape}')
    expect(panel.open).toBe(false)
    expect(handed).toEqual([true, false])
  }, 30_000)
})

describe('the people on the street', () => {
  /** A body with no art in it, so the crowd can walk somebody with no GPU. */
  const nobody = () => ({ placeAt: () => {}, faceTo: () => {}, play: () => {}, release: () => {} })

  it('are the city\'s own, so whoever the player passes can be named and talked to', async () => {
    const made = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 2 }, QUIET)
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
    const made = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 2 }, QUIET)
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
