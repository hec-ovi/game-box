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
import { BLOCKS, DEFAULTS, STOREYS, STYLE, briefFromQuery, briefToQuery, clampBlocks, sameBrief, tidy, type CityBrief } from '../src/boot/brief.ts'
import { Boot, type LoadArt, type Start } from '../src/boot/boot.ts'
import { CityMaker } from '../src/boot/city-maker.ts'
import { download, exportName } from '../src/boot/export.ts'
import { Library, MemoryShelf, keyOf, type Shelved } from '../src/boot/library.ts'
import { Packs } from '../src/boot/packs.ts'
import { Panel, type PanelHandlers } from '../src/boot/panel.ts'
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
const QUIET_HANDLERS: PanelHandlers = {
  generate: () => {},
  open: () => {},
  apply: () => {},
  grow: () => {},
  pick: () => {},
  remove: () => {},
  save: () => {},
  cancel: () => {},
  close: () => {},
  settings: () => {},
}

/** A sidecar nothing is listening on: every call fails at once and the offline writer covers. */
const DOWN: SidecarOptions = { fetch: () => Promise.reject(new Error('nothing listening')) }

describe('the panel is up before anything loads', () => {
  beforeEach(servePage)

  it('serves the whole landing HUD in the page itself, so first paint is the main menu', () => {
    const fields = within(screen.getByRole('region', { name: 'game-box' }))
    expect(fields.getByRole('button', { name: /create game/i })).toBeTruthy()
    expect(fields.getByText(/import city/i)).toBeTruthy()
    expect(fields.getByText(/settings/i)).toBeTruthy()
    expect(document.querySelector('[data-boot="library"]')).toBeTruthy()
    expect(document.querySelector<HTMLElement>('[data-boot="home"]')!.hidden).toBe(false)
    expect(document.querySelector<HTMLElement>('[data-boot="make"]')!.hidden).toBe(true)
  })

  it('paints the same defaults the generator would use, so the fields never lie', () => {
    expect(panel().brief).toEqual(DEFAULTS)
    const blocks = document.querySelector<HTMLInputElement>('[data-boot="blocks"]')!
    expect(blocks.min).toBe(String(BLOCKS.min))
    expect(blocks.max).toBe(String(BLOCKS.max))
    // and those are the generator's own numbers, read off its schema rather
    // than written down twice: a panel that clamps under what @gb/forge takes
    // is why every city made here came out a hamlet
    const schema = ['../forge/schema/brief.json', 'game/forge/schema/brief.json'].map((where) => resolve(process.cwd(), where)).find(existsSync)!
    const takes = JSON.parse(readFileSync(schema, 'utf8')).properties.blocksX
    expect([DEFAULTS.blocks, BLOCKS.min, BLOCKS.max]).toEqual([takes.default, takes.minimum, takes.maximum])
    expect(blocks.value).toBe(String(takes.default))

    // the same for the tallest building, which is what gives a city a skyline
    const storeys = document.querySelector<HTMLInputElement>('[data-boot="storeys"]')!
    const height = JSON.parse(readFileSync(schema, 'utf8')).properties.maxStoreys
    expect([STOREYS.fallback, STOREYS.min, STOREYS.max]).toEqual([height.default, height.minimum, height.maximum])
    expect(storeys.min).toBe(String(STOREYS.min))
    expect(storeys.max).toBe(String(STOREYS.max))
    expect(storeys.placeholder).toBe(String(height.default))
  })

  it('offers the catalogue\'s own style choices and nothing outside them, and says why', () => {
    panel()
    const fields = within(screen.getByRole('region', { name: 'game-box' }))
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
    await user.type(screen.getByLabelText(/tallest building/i), '30')
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
        storeys: 30,
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
      storeys: 8,
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

  it('carries the tallest building the player asked for through to the generator', async () => {
    const user = userEvent.setup()
    const front = panel()
    front.on(QUIET_HANDLERS)
    front.waiting()

    // left blank it is the generator's own ceiling, so a bare form is not a flat city
    expect(front.brief.storeys).toBeUndefined()

    // and a typo is held at the top of what a world file will carry rather than sent
    await user.type(screen.getByLabelText(/tallest building/i), '400')
    expect(front.brief.storeys).toBe(STOREYS.max)

    // and it reaches the generator: a ceiling of one builds a town of bungalows
    const made = new CityMaker(new Sidecar(DOWN))
    const city = await made.build({ ...DEFAULTS, seed: 'flat', blocks: 2, storeys: STOREYS.min }, QUIET)
    expect(city.ok).toBe(true)
    if (!city.ok) return
    const plots = city.value.bundle.world.plots()
    expect(plots.length).toBeGreaterThan(10)
    expect(new Set(plots.map((plot) => plot.storeys))).toEqual(new Set([STOREYS.min]))
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

  it("takes the player's own screen source and keeps it out of the brief", async () => {
    const user = userEvent.setup()
    const settings: { screens: string }[] = []
    const front = panel()
    front.on({ ...QUIET_HANDLERS, settings: (set) => void settings.push(set) })
    front.waiting()

    await user.type(screen.getByLabelText(/video on the screens/i), '  https://example.invalid/loop.mp4  ')
    await user.tab()

    // it is the player's, not the city's: it never reaches a brief and so can
    // never reach a world file
    expect(settings.at(-1)).toEqual({ screens: 'https://example.invalid/loop.mp4' })
    expect(JSON.stringify(front.brief)).not.toContain('example.invalid')
  })

  it('offers a pack onto the city that is open, and Grow beside Export, once there is one', () => {
    const front = panel()
    const applied: string[] = []
    let grew = 0
    front.on({ ...QUIET_HANDLERS, apply: (file) => void applied.push(file.name), grow: () => void grew++ })

    // nothing to add to until a city is open
    const field = screen.getByLabelText(/open a pack onto the city/i) as HTMLInputElement
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /grow and pack/i }).disabled).toBe(true)
    front.holding({ city: true, playing: true })
    expect(field.disabled).toBe(false)

    screen.getByRole('button', { name: /grow and pack/i }).click()
    expect(grew).toBe(1)

    const file = new File(['{}'], 'harbour.gbpack.json', { type: 'application/json' })
    Object.defineProperty(field, 'files', { value: [file], configurable: true })
    field.dispatchEvent(new Event('change'))
    expect(applied).toEqual(['harbour.gbpack.json'])
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

  it('lays the shelf out newest first with the last city marked, saying enough about each to know it again', async () => {
    const front = panel()
    const picked: string[] = []
    const removed: string[] = []
    front.on({ ...QUIET_HANDLERS, pick: (key) => void picked.push(key), remove: (key) => void removed.push(key) })
    front.face = 'home'
    front.waiting()
    expect(screen.getByText(/nothing on the shelf/i).hidden).toBe(false)

    const shelved = (key: string, name: string, openedAt: number): Shelved => ({
      key,
      name,
      theme: 'quiet coastal town',
      seed: key,
      blocks: 2,
      model: false,
      brief: `Everything ${name} is about`,
      hash: key,
      source: 'made',
      openedAt,
      madeAt: Date.now(),
    })
    front.library([
      { entry: shelved('new', 'Grey Slip', 20), played: true },
      { entry: shelved('old', 'Kell Point', 10), played: false },
    ])
    const boxes = screen.getAllByRole('listitem')
    expect(boxes.map((box) => box.dataset.last)).toEqual(['true', 'false'])
    expect(screen.getByText(/nothing on the shelf/i).hidden).toBe(true)
    expect(within(boxes[0]!).getByRole('button', { name: /open grey slip/i }).textContent).toBe('Continue')

    // enough on each box to know the city again: its name, what it is about,
    // how big it is and when it was written, and whether a game is waiting in it
    expect(boxes[0]!.textContent).toContain('Grey Slip')
    expect(boxes[0]!.textContent).toContain('Everything Grey Slip is about')
    expect(boxes[0]!.textContent).toMatch(/2 blocks/)
    expect(boxes[0]!.textContent).toMatch(/made now|seconds ago/)
    expect(boxes[0]!.textContent).toMatch(/playthrough in progress/i)
    expect(boxes[1]!.textContent).not.toMatch(/playthrough in progress/i)

    const user = userEvent.setup()
    await user.click(within(boxes[1]!).getByRole('button', { name: /open kell point/i }))
    await user.click(within(boxes[0]!).getByRole('button', { name: /remove grey slip/i }))
    await user.click(within(boxes[0]!).getByRole('button', { name: /confirm remove grey slip/i }))
    expect(picked).toEqual(['old'])
    expect(removed).toEqual(['new'])
  })

  it('is closed the moment it is asked to close, and only its pixels linger', () => {
    const front = panel()
    front.on(QUIET_HANDLERS)
    const root = document.querySelector<HTMLElement>('#boot')!

    front.hide()
    expect(front.open).toBe(false)
    // no clicks, no keyboard, and out of the accessible tree, all at once
    expect(root.dataset.leaving).toBe('true')
    expect(root.hasAttribute('inert')).toBe(true)
    expect(screen.queryByRole('button', { name: /generate/i })).toBeNull()

    front.show()
    expect(front.open).toBe(true)
    expect(root.hidden).toBe(false)
    expect(root.hasAttribute('inert')).toBe(false)
    expect(screen.getByRole('button', { name: /generate/i })).toBeTruthy()
  })

  it('swaps between the cities you have and the form that makes another, and only one is on the page', async () => {
    const front = panel()
    front.on(QUIET_HANDLERS)
    front.face = 'home'
    const fold = (name: string) => document.querySelector<HTMLElement>(`[data-boot="${name}"]`)!
    expect(screen.getByRole('region', { name: 'Your cities' })).toBeTruthy()
    expect(fold('make').hidden).toBe(true)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new city/i }))
    expect(front.face).toBe('make')
    expect(screen.getByLabelText(/theme/i)).toBeTruthy()
    // a face the panel is not showing is out of the page, accessibility tree included
    expect(screen.queryByRole('region', { name: 'Your cities' })).toBeNull()
    expect(fold('home').hidden).toBe(true)

    await user.click(screen.getByRole('button', { name: /your cities/i }))
    expect(front.face).toBe('home')
  })
})

/** A brief the model could really have written: every field long enough for the contract. */
const DRAFT = {
  theme: 'rain-soaked cargo port',
  brief: 'The port lives off the night freight, and the harbour office has been selling the same berth twice for a decade.',
  mainQuest: 'Find out who has been selling berth nine twice over, and what the harbour office was paid for it.',
  sideQuests: 'Fetching manifests, running cash between the berths, and standing watch for people who would rather not be seen.',
  tone: 'guarded, dry, tired',
}

/** A sidecar that answers one forced `write_brief` call with that draft. */
function writes(draft: Record<string, string>, sent: unknown[]): SidecarOptions {
  return {
    fetch: (_input, init) => {
      sent.push(JSON.parse(String(init?.body)))
      const body = {
        choices: [{ message: { tool_calls: [{ function: { name: 'write_brief', arguments: JSON.stringify(draft) } }] }, finish_reason: 'tool_calls' }],
      }
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))
    },
  }
}

describe('having the local model write a field of the brief', () => {
  beforeEach(servePage)

  /** The toggle lives on the last step, so this is the walk a player takes to reach it. */
  async function turnTheModelOn(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole('button', { name: /3\. build it/i }))
    await user.click(screen.getByLabelText(/local model/i))
    await user.click(screen.getByRole('button', { name: /1\. the city/i }))
  }

  it('fills the field it sits beside with what the model wrote, and leaves the others alone', async () => {
    const user = userEvent.setup()
    const sent: unknown[] = []
    const front = panel()
    front.sidecar = new Sidecar(writes(DRAFT, sent))
    front.on(QUIET_HANDLERS)
    front.waiting()
    await turnTheModelOn(user)

    await user.type(screen.getByLabelText(/^the main quest$/i), 'who owns the customs house')
    await user.click(screen.getByRole('button', { name: /write the premise/i }))

    await waitFor(() => expect(screen.getByLabelText<HTMLTextAreaElement>(/what the city is about/i).value).toBe(DRAFT.brief))
    // only the box the button sits beside is written: the theme the player left
    // and the quest they typed both stand
    expect(front.brief.theme).toBe(DEFAULTS.theme)
    expect(front.brief.asks?.mainQuest).toBe('who owns the customs house')
    expect(screen.getByRole('status').textContent).toMatch(/wrote what the city is about/i)

    // and it really was one forced call to the local model, carrying what was already typed
    expect(sent).toHaveLength(1)
    const call = sent[0] as { tools: { function: { name: string } }[]; messages: { content: string }[] }
    expect(call.tools.map((tool) => tool.function.name)).toEqual(['write_brief'])
    expect(call.messages.map((message) => message.content).join('\n')).toContain('who owns the customs house')
  })

  it('says it needs the local model when the model is off, and writes nothing', async () => {
    const user = userEvent.setup()
    const sent: unknown[] = []
    const front = panel()
    front.sidecar = new Sidecar(writes(DRAFT, sent))
    front.on(QUIET_HANDLERS)
    front.waiting()

    expect(front.brief.model).toBe(false)
    await user.click(screen.getByRole('button', { name: /write the theme/i }))

    expect(screen.getByRole('status').textContent).toMatch(/local model/i)
    expect(screen.getByRole('status').dataset.trouble).toBe('true')
    // nothing canned went into the field, and nothing went out to the sidecar
    expect(front.brief.theme).toBe(DEFAULTS.theme)
    expect(sent).toHaveLength(0)
  })

  it('says the model did not answer when it will not, rather than falling back on canned words', async () => {
    const user = userEvent.setup()
    const front = panel()
    front.sidecar = new Sidecar(DOWN)
    front.on(QUIET_HANDLERS)
    front.waiting()
    await turnTheModelOn(user)

    await user.click(screen.getByRole('button', { name: /write the theme/i }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/did not answer/i))
    expect(screen.getByRole('status').dataset.trouble).toBe('true')
    expect(front.brief.theme).toBe(DEFAULTS.theme)
  }, 30_000)
})

describe('what the form says it is about to build', () => {
  beforeEach(servePage)

  it('reads back the size and the doors the player asked for, and asks once before building', async () => {
    const user = userEvent.setup()
    const asked: CityBrief[] = []
    const front = panel()
    front.on({ ...QUIET_HANDLERS, generate: (brief) => void asked.push(brief) })
    front.waiting()

    await user.clear(screen.getByLabelText(/blocks/i))
    await user.type(screen.getByLabelText(/blocks/i), '8')
    await user.type(screen.getByLabelText(/doors that open/i), '5')
    await user.type(screen.getByLabelText(/tallest building/i), '12')

    // the readout beside the fields is the fields, not an estimate of anything
    const said = (key: string) => document.querySelector<HTMLElement>(`[data-said="${key}"]`)!.textContent
    expect([said('blocks'), said('doorsCount'), said('storeysCount')]).toEqual(['8 x 8', '5', '12'])

    await user.click(screen.getByRole('button', { name: /3\. build it/i }))
    await user.click(screen.getByRole('button', { name: /build the city/i }))

    const dialog = screen.getByRole('dialog', { name: /build this city/i })
    expect(dialog.textContent).toContain('8 by 8 block city')
    expect(dialog.textContent).toContain('5 of its doors open')
    expect(dialog.textContent).toContain('taller than 12 storeys')
    // and nothing it cannot know: no building count, no crowd, no traffic
    expect(dialog.textContent).not.toMatch(/\d+ buildings|\d+ npcs|\d+ (traffic )?(cars|vehicles)|district zones/i)

    await user.click(within(dialog).getByRole('button', { name: /^build it$/i }))
    expect(asked).toEqual([{ theme: DEFAULTS.theme, seed: DEFAULTS.seed, blocks: 8, places: 5, storeys: 12, model: false }])
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
    expect(tidy({ theme: '  ', seed: '', blocks: DEFAULTS.blocks, model: false })).toEqual(DEFAULTS)
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
  const paused: boolean[] = []
  let fail = false
  let art: LoadArt = async () => ({ dressing: new Greybox() })

  /** A running game with no renderer in it, so the whole flow is testable. */
  const start: Start = async (_mount, bundle, given) => {
    if (fail) throw new Error('no GPU here')
    started.push(bundle.world.name)
    built.push(bundle)
    options.push(given)
    return {
      dispose: () => {},
      handOverKeys: (away) => void handed.push(away),
      pause: (on) => void paused.push(on),
      keep: () => {},
      announce: (notice) => void announced.push(notice),
    }
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

  it('opens on the form when the shelf is empty, so a first run is not a grid with nothing in it', async () => {
    const { boot, panel } = open()
    await boot.start(new URLSearchParams(''))
    expect(started).toEqual([])
    expect(panel.open).toBe(true)
    expect(panel.face).toBe('make')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /generate/i }).disabled).toBe(false)
  })

  it('takes the city off the screen while the panel is over it, and puts it back on the way in', async () => {
    const { boot, panel } = open()
    await boot.start(new URLSearchParams('?seed=leaving&theme=quiet%20coastal%20town&blocks=1'))
    const mount = document.querySelector<HTMLElement>('#game')!
    expect([mount.hidden, panel.open]).toEqual([false, false])

    // the keys go and the city goes with them: a menu drawn over a town that is
    // still being walked is a game the player pays for and is not playing
    boot.showPanel()
    expect([mount.hidden, panel.open, handed.at(-1)]).toEqual([true, true, true])

    boot.hidePanel()
    expect([mount.hidden, panel.open, handed.at(-1)]).toEqual([false, false, false])
  }, 60_000)

  it('lands on the cities the player has when the address bar names none, and enters only on a pick', async () => {
    const shelf = new MemoryShelf()
    const { boot } = open(DOWN, shelf)
    await boot.start(new URLSearchParams('?seed=landing&theme=quiet%20coastal%20town&blocks=1'))
    await boot.generate({ ...DEFAULTS, blocks: 1, seed: 'landing-two' })
    const [first, second] = [started[0]!, started[1]!]
    // a playthrough was left in the first city and none in the second
    options[0]!.save!.write({ marker: 'played' })

    // a fresh page with nothing in the address bar: the front door, not a city
    started.length = 0
    const again = open(DOWN, shelf)
    await again.boot.start(new URLSearchParams(''))
    expect(started).toEqual([])
    expect(again.panel.open).toBe(true)
    expect(again.panel.face).toBe('home')

    // both cities are on it, newest first, and the one with a game in it says so
    const named = (box: HTMLElement) => within(box).getByText(/./, { selector: '.gb-boot-shelved-name' }).textContent
    const boxes = screen.getAllByRole('listitem')
    expect(boxes.map(named)).toEqual([second, first])
    expect(boxes[1]!.dataset.played).toBe('true')
    expect(boxes[0]!.dataset.played).toBe('false')

    // and the game starts on the pick, with the playthrough that city kept
    await userEvent.setup().click(within(boxes[1]!).getByRole('button', { name: /^open/i }))
    await waitFor(() => expect(started).toEqual([first]))
    expect(options.at(-1)!.save!.read()).toEqual({ marker: 'played' })
  }, 60_000)

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
    // city that comes back when the address bar names the same brief, which is
    // what a refresh of a city being played is
    const other = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 1, seed: 'swapped' }, QUIET)
    if (!other.ok) throw new Error(other.message)
    await shelf.put(entry!, other.value.document)
    started.length = 0
    await open(DOWN, shelf).boot.start(new URLSearchParams('?seed=comeback&theme=quiet%20coastal%20town&blocks=1'))
    expect(started).toEqual([other.value.bundle.world.name])

    // and picking it off the landing screen opens the same document
    started.length = 0
    const again = open(DOWN, shelf)
    await again.boot.start(new URLSearchParams(''))
    expect(started).toEqual([])
    await again.boot.pick(entry!.key)
    expect(started).toEqual([other.value.bundle.world.name])
  }, 60_000)

  it('grows the city on the shelf and hands back the pack for what went up', async () => {
    const shelf = new MemoryShelf()
    const { boot } = open(DOWN, shelf)
    await boot.start(new URLSearchParams('?seed=grow&theme=quiet%20coastal%20town&blocks=2'))
    const before = built[0]!.world.plots().length
    const [filed] = await shelf.list()

    await boot.grow()
    if (built.length < 2) throw new Error(`grow said: ${document.querySelector('[data-boot="status"]')?.textContent}`)

    // the city the player is standing in is the grown one, and it is the one on
    // the shelf: the same row, so the playthrough carries into it
    expect(built).toHaveLength(2)
    expect(built[1]!.world.plots().length).toBeGreaterThan(before)
    const rows = await shelf.list()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.key).toBe(filed!.key)
    expect(rows[0]!.hash).toBe(built[1]!.contentHash)
    // and they are told what went up
    expect(announced.some((note) => note.kind === 'note' && /^The pack added \d+ building/.test(note.text))).toBe(true)
  }, 60_000)

  it('opens a pack onto the city it was cut from, and refuses one cut from another', async () => {
    const brief = { ...DEFAULTS, blocks: 2, seed: 'applied' }
    const made = await new CityMaker(new Sidecar(DOWN)).build(brief, QUIET)
    if (!made.ok) throw new Error(made.message)
    const grown = await new Packs(new Sidecar(DOWN)).grow(made.value, QUIET)
    if (!grown.ok) throw new Error(grown.message)
    const elsewhere = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 2, seed: 'elsewhere' }, QUIET)
    if (!elsewhere.ok) throw new Error(elsewhere.message)
    const other = await new Packs(new Sidecar(DOWN)).grow(elsewhere.value, QUIET)
    if (!other.ok) throw new Error(other.message)

    const shelf = new MemoryShelf()
    const { boot } = open(DOWN, shelf)
    await boot.start(new URLSearchParams('?seed=applied&theme=quiet%20coastal%20town&blocks=2'))
    const before = built[0]!.world.plots().length

    // a pack names the city it was cut from by world id and content hash, so
    // one cut from another city goes nowhere and says so
    await boot.applyPack(new File([JSON.stringify(other.pack)], 'elsewhere.gbpack.json', { type: 'application/json' }))
    expect(built).toHaveLength(1)
    expect(document.querySelector('[data-boot="status"]')!.textContent).toMatch(/another city/i)

    await boot.applyPack(new File([JSON.stringify(grown.pack)], 'applied.gbpack.json', { type: 'application/json' }))
    expect(built).toHaveLength(2)
    expect(built[1]!.world.plots().length).toBeGreaterThan(before)
    expect(built[1]!.contentHash).toBe(grown.value.bundle.contentHash)
    expect(announced.some((note) => note.kind === 'note' && note.text.startsWith('The pack added'))).toBe(true)
  }, 90_000)

  it("keeps the player's own screen source out of every city they make", async () => {
    const source = 'https://example.invalid/loop.mp4'
    const shelf = new MemoryShelf()
    const { boot } = open(DOWN, shelf)
    boot.settings({ screens: source })
    await boot.start(new URLSearchParams('?seed=screens&theme=quiet%20coastal%20town&blocks=1'))

    // the game plays it
    expect(options[0]!.screens).toBe(source)
    // and the city carries nothing of it: a file sent to somebody else is that
    // city and no part of this player's own settings
    const [entry] = await shelf.list()
    expect(JSON.stringify(await shelf.document(entry!.key))).not.toContain('example.invalid')
    expect(JSON.stringify(built[0]!.world.toJSON())).not.toContain('example.invalid')
  }, 30_000)

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
    await user.click(within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: /confirm remove/i }))
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

    await userEvent.setup().upload(screen.getByLabelText(/city somebody sent you/i), new File([written[0]!], name))

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
    await userEvent.setup().upload(screen.getByLabelText(/city somebody sent you/i), junk)

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
    paused.length = 0

    options[0]!.leave!()
    expect(panel.open).toBe(true)
    expect(handed).toEqual([true])
    // and the city it came out of is standing still behind it, not running on
    expect(paused).toEqual([true])
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    // and Escape is the way back
    await userEvent.setup().keyboard('{Escape}')
    expect(panel.open).toBe(false)
    expect(handed).toEqual([true, false])
    expect(paused).toEqual([true, false])
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

    // the city stations everybody it writes, so the pavement is drawn from the
    // people it left loose: one courier with no post is one body out there
    const loose = world.addNpc({
      id: 'npc_9001',
      name: 'Kit Marlow',
      role: 'courier',
      appearance: { base: 'male', variant: 1 },
      personality: 'Always moving.',
      knowledge: ['Every shortcut in town.'],
    })
    if (!loose.ok) throw new Error(JSON.stringify(loose.error))

    const street = new Street({ world, nav: CityNav.from(world), ground, playerOutdoors: () => stand })
    street.populate({ spawn: nobody })
    for (let frame = 0; frame < 300; frame++) street.update(1 / 60, stand)

    const walkers = street.walkers()
    expect(walkers.length).toBeGreaterThan(0)
    for (const walker of walkers) expect(world.npc(walker.id)?.name).toBeTruthy()
    expect(asked).toBeGreaterThan(0)
  }, 40_000)

  it('leaves every post staffed, so a building the player walks into is not empty', async () => {
    const made = await new CityMaker(new Sidecar(DOWN)).build({ ...DEFAULTS, blocks: 2 }, QUIET)
    if (!made.ok) throw new Error(made.message)
    const world = made.value.bundle.world

    const street = new Street({ world, nav: CityNav.from(world), playerOutdoors: () => undefined })
    const out = new Set(street.residents().map((npc) => npc.id))

    // a body borrowed off a counter is a room the player walked in to see and
    // found empty, and a greeting about a shelf that is a street away
    const rooms = new Set(world.npcs().flatMap((npc) => (npc.station ? [npc.station.interiorId] : [])))
    expect(rooms.size).toBeGreaterThan(0)
    for (const room of rooms) {
      const stationed = world.npcs().filter((npc) => npc.station?.interiorId === room)
      const staying = stationed.filter((npc) => !out.has(npc.id))
      expect(staying.length, `somebody taken off a post in ${room}`).toBe(stationed.length)
    }
  }, 40_000)
})
