import type { OpenedBundle } from '@gb/bundle'
import type { Notice } from '@gb/hud'
import { Sidecar, type SidecarOptions } from '@gb/sidecar'
import { Game, type GameOptions } from '../game.ts'
import { loadCars, loadDressing, type ArtPack } from '../pack.ts'
import { briefFromQuery, briefToQuery, DEFAULTS, sameBrief, type CityBrief } from './brief.ts'
import { CityMaker, type City, type Made } from './city-maker.ts'
import { download, exportName, packName } from './export.ts'
import { keepHasShelf, keepSettings, localSaves, localSettings, type Settings } from './kept.ts'
import { briefOf, type Library, type Shelved } from './library.ts'
import { Loader } from './loader.ts'
import { Notices } from './notices.ts'
import { Packs } from './packs.ts'
import { painted } from './painted.ts'
import { Panel } from './panel.ts'

/** A running game, as the boot layer needs it: something to hand the keys to and to say things on. */
export interface Playing {
  dispose(): void
  handOverKeys(away: boolean): void
  /** Stand the city still while the player is at the front door, and set it going again. */
  pause?(on: boolean): void
  keep(): void
  announce(notice: Notice): void
}

/** How a city becomes a running game. `Game.start` unless a test says otherwise. */
export type Start = (mount: HTMLElement, bundle: OpenedBundle, options: GameOptions) => Promise<Playing>

/** Where the art comes from. `loadDressing` unless a test says otherwise. */
export type LoadArt = (theme: string) => Promise<ArtPack>

/** How a city was made: the sealed city, the art it was pinned to, and filing it on the shelf. */
interface Making {
  made: Made
  art?: ArtPack
  file(city: City): Promise<Shelved>
}

/**
 * The composition root: the panel, the city it asks for, the shelf it is kept
 * on, and the game that plays it. Nothing here decides anything about a city;
 * it carries a brief to the generator, the generated city to the renderer, and
 * whatever went wrong back to the panel as a sentence.
 */
export class Boot {
  #mount: HTMLElement
  #panel: Panel
  #library: Library
  #maker: CityMaker
  #packs: Packs
  #loader: Loader
  #notices = new Notices()
  #sidecar: Sidecar
  #start: Start
  #art: LoadArt
  #game: Playing | undefined
  #city: City | undefined
  #shelved: Shelved | undefined
  #loaded: ArtPack | undefined
  #settings: Settings = localSettings()
  #asked = new URLSearchParams()
  #running: AbortController | undefined

  constructor(input: {
    mount: HTMLElement
    panel: Panel
    library: Library
    sidecar?: SidecarOptions
    start?: Start
    art?: LoadArt
  }) {
    this.#mount = input.mount
    this.#panel = input.panel
    this.#library = input.library
    // one client for the whole page, so a busy model is announced on whatever
    // interface is up when the sidecar starts waiting it out
    this.#sidecar = new Sidecar({ ...input.sidecar, onBusy: (wait) => this.#notices.busy(wait) })
    this.#start = input.start ?? Game.start
    this.#art = input.art ?? loadDressing
    this.#maker = new CityMaker(this.#sidecar)
    this.#packs = new Packs(this.#sidecar)
    this.#loader = new Loader(input.mount)

    this.#panel.settings = this.#settings
    this.#panel.on({
      generate: (brief) => void this.generate(brief),
      open: (file) => void this.openFile(file),
      apply: (file) => void this.applyPack(file),
      grow: () => void this.grow(),
      pick: (key) => void this.pick(key),
      exportCity: (key) => void this.exportCity(key),
      remove: (key) => void this.remove(key),
      save: () => this.export(),
      cancel: () => this.cancel(),
      close: () => this.hidePanel(),
      settings: (settings) => this.settings(settings),
    })
    addEventListener('pagehide', () => this.#game?.keep())
  }

  /**
   * What the address bar named, or the front door. A city named in the address
   * bar is opened straight away, because that is how a city is shared: by file,
   * or by the seed and theme that build it, and asking for the one already on
   * the shelf comes back to it rather than writing it again.
   *
   * Named nothing, the player lands on their own cities and picks one. Nothing
   * is generated and nothing is entered on its own: a bare address that dropped
   * somebody into a town they did not choose is the game choosing for them. An
   * empty shelf lands on the form instead, because a grid with nothing in it is
   * a dead end on a first run.
   */
  async start(query: URLSearchParams): Promise<void> {
    this.#asked = query
    const asked = briefFromQuery(query)
    const last = await this.#library.last()
    keepHasShelf(Boolean(last))
    await this.#shelve()
    this.#panel.brief = asked ?? (last ? briefOf(last) : DEFAULTS)

    const file = query.get('bundle')
    if (file) {
      await this.#run(async (signal) => {
        await this.#step(`Opening ${file}`)
        return { made: await this.#maker.fetch(file, signal), file: (city) => this.#library.opened(city) }
      })
      return
    }

    if (asked) {
      if (last && sameBrief(asked, briefOf(last))) return this.pick(last.key)
      this.#panel.face = 'make'
      return this.generate(asked)
    }

    this.#panel.face = last ? 'home' : 'make'
    this.#panel.waiting()
  }

  async generate(brief: CityBrief): Promise<void> {
    this.#panel.face = 'make'
    this.#panel.brief = brief
    await this.#run(async (signal) => {
      // the art comes before the city, because the city is pinned to it: which
      // building of the pack each plot was designed against is written into the
      // world file, and the seal covers it
      await this.#step('Loading the art')
      const art = await this.#art(brief.theme)
      if (brief.model) {
        this.#loader.begin(`Writing a city: ${brief.theme}`)
        this.#panel.aside(true)
        this.#notices.aim(this.#loader)
      }
      const made = await this.#maker.build(brief, {
        signal,
        step: this.#step,
        progress: (event) => this.#loader.progress(event),
        ...(art.catalogue ? { catalogue: art.catalogue } : {}),
      })
      return { made, art, file: (city) => this.#library.made(brief, city) }
    })
  }

  /** Play a city file the player picked, exactly as Export wrote it. */
  async openFile(file: File): Promise<void> {
    this.#panel.face = 'make'
    await this.#run(async (signal) => {
      await this.#step(`Opening ${file.name}`)
      return { made: await this.#maker.read(file, signal), file: (city) => this.#library.opened(city) }
    })
  }

  /** Play a city off the shelf: the document as it was kept, and the save that goes with it. */
  async pick(key: string): Promise<void> {
    const entry = (await this.#library.entries()).find((shelved) => shelved.key === key)
    if (!entry) return
    this.#loader.begin(`Loading ${entry.name}`)
    this.#panel.aside(true)
    await this.#run(async (signal) => {
      await this.#step(`Opening ${entry.name}`)
      const document = await this.#library.document(key)
      const made: Made =
        document === undefined
          ? { ok: false, message: `${entry.name} is not on the shelf any more.` }
          : await this.#maker.reopen(document, signal)
      return {
        made,
        file: async () => {
          await this.#library.touch(entry)
          return entry
        },
      }
    })
  }

  /**
   * A pack somebody built onto this city, applied to it. The city that gives is
   * filed under the key it was already on, so the playthrough carries over: it
   * is the same city with more of it, and `@gb/bundle` reconciles what a save
   * says over a city that has moved.
   */
  async applyPack(file: File): Promise<void> {
    const city = this.#city
    const shelved = this.#shelved
    if (!city || !shelved) return this.#panel.waiting('Open a city first, then a pack for it.', true)
    await this.#run(async (signal) => {
      await this.#step(`Opening ${file.name}`)
      return { made: await this.#packs.apply(city, file, { signal, step: this.#step }), file: (grown) => this.#library.grew(shelved, grown) }
    })
  }

  /**
   * Build onto this city and hand back the pack for what went up: the same two
   * steps `gb extend` and `gb pack` take, and the pack is applied straight back
   * so what the player walks into is what anybody else opening that pack gets.
   */
  async grow(): Promise<void> {
    const city = this.#city
    const shelved = this.#shelved
    if (!city || !shelved) return this.#panel.waiting('Open a city first, then grow it.', true)
    const model = this.#panel.brief.model
    await this.#run(async (signal) => {
      await this.#step(`Building onto ${city.bundle.world.name}`)
      if (model) {
        this.#loader.begin(`Building onto ${city.bundle.world.name}`)
        this.#panel.aside(true)
        this.#notices.aim(this.#loader)
      }
      const grown = await this.#packs.grow(city, {
        signal,
        step: this.#step,
        model,
        progress: (event) => this.#loader.progress(event),
        ...(this.#loaded?.catalogue ? { catalogue: this.#loaded.catalogue } : {}),
      })
      // the pack is the file, and the grown city is what the player walks into
      if (grown.ok) download(grown.pack, packName(grown.value.bundle.world))
      return { made: grown, ...(this.#loaded ? { art: this.#loaded } : {}), file: (grew) => this.#library.grew(shelved, grew) }
    })
  }

  /** What the player set that belongs to them rather than to any city. */
  settings(settings: Settings): void {
    this.#settings = settings
    keepSettings(settings)
  }

  /** Take a city off the shelf, and its playthrough with it. */
  async remove(key: string): Promise<void> {
    await this.#library.remove(key)
    localSaves(key).clear()
    await this.#shelve()
  }

  /** Write any city off the shelf out as a standalone file. */
  async exportCity(key: string): Promise<void> {
    const document_ = await this.#library.document(key)
    if (!document_) return
    const list = await this.#library.entries()
    const entry = list.find((item) => item.key === key)
    const name = entry ? exportName({ name: entry.name, seed: entry.seed }) : `${key}.gbworld.json`
    download(document_, name)
    this.#panel.waiting(`Saved ${name}`)
  }

  /** Write the city out as the file it already is inside. */
  export(): void {
    if (!this.#city) return
    const name = exportName(this.#city.bundle.world)
    download(this.#city.document, name)
    this.#panel.waiting(`Saved ${name}`)
  }

  cancel(): void {
    this.#running?.abort()
  }

  /**
   * The way out of the game: the front door, on the player's own cities, with
   * the city off the screen behind it. The game is kept rather than disposed,
   * because Continue is meant to be instant and a dispose would build the town
   * again; opening a different city disposes the one that was up, which is
   * where a game actually ends.
   */
  showPanel(): void {
    this.#game?.handOverKeys(true)
    this.#game?.pause?.(true)
    this.#onScreen(false)
    this.#panel.face = 'home'
    this.#panel.show()
  }

  hidePanel(): void {
    if (!this.#game) return
    this.#panel.hide()
    this.#onScreen(true)
    this.#loader.begin(`Resuming ${this.#city?.bundle.world.name ?? 'City'}`)
    setTimeout(() => {
      try {
        this.#loader.end()
      } catch {
        // Disposed in tests
      }
    }, 220)
    this.#game.pause?.(false)
    this.#game.handOverKeys(false)
  }

  /**
   * The city on the screen, or off it. Everything the game draws hangs on the
   * mount, its own interface included, so the mount is what goes: the player
   * reading the panel is not also looking at the town behind it.
   */
  #onScreen(on: boolean): void {
    this.#mount.hidden = !on
  }

  /**
   * One generation at a time: asking for another stops the one in flight. A
   * city written here arrives with the art it was pinned to, so it is played
   * with the same pack rather than a second load of it.
   */
  async #run(make: (signal: AbortSignal) => Promise<Making>): Promise<void> {
    // the loader and the city are both drawn on the mount, so whatever the
    // panel did to it on the way out is undone before either goes up
    this.#onScreen(true)
    const signal = this.#signal()
    try {
      const making = await make(signal)
      if (signal.aborted) return this.#panel.waiting('Stopped.')
      if (!making.made.ok) return this.#panel.waiting(making.made.message, true)

      const entry = await making.file(making.made.value)
      this.#shelved = entry
      await this.#shelve()
      await this.#play(making.made.value, entry, signal, making.art)
    } finally {
      this.#loader.end()
      this.#panel.aside(false)
      this.#notices.aim(this.#game)
    }
  }

  #signal(): AbortSignal {
    this.#running?.abort()
    this.#running = new AbortController()
    return this.#running.signal
  }

  async #play(city: City, entry: Shelved, signal: AbortSignal, loaded?: ArtPack): Promise<void> {
    if (!loaded) await this.#step('Loading the art')
    const [art, cars] = await Promise.all([loaded ?? this.#art(city.bundle.world.theme), loadCars()])
    if (signal.aborted) return this.#panel.waiting('Stopped.')
    this.#loaded = art

    // the city is made and sealed; it can be kept from here on whether or not
    // the renderer manages to draw it
    this.#city = city
    this.#panel.holding({ city: true, playing: false })

    await this.#step(`Building ${city.bundle.world.name}`)
    this.#game?.dispose()
    this.#game = undefined
    this.#notices.aim(undefined)
    try {
      this.#game = await this.#start(this.#mount, city.bundle, {
        sidecar: this.#sidecar,
        dressing: art.dressing,
        save: localSaves(entry.key),
        leave: () => this.showPanel(),
        ...(art.room ? { room: art.room } : {}),
        ...(art.cast ? { cast: art.cast } : {}),
        ...(art.kit ? { kit: art.kit } : {}),
        ...(cars ? { cars } : {}),
        ...(this.#settings.screens ? { screens: this.#settings.screens } : {}),
      })
    } catch (cause) {
      // the city is sound, so this is the renderer or the art: say so and leave
      // the panel usable rather than sitting on a step that will never finish
      console.error(cause)
      return this.#panel.waiting(`${city.bundle.world.name} would not draw: ${String(cause)}`, true)
    }

    history.replaceState(null, '', briefToQuery(entry.source === 'made' ? briefOf(entry) : undefined, this.#asked))
    this.#notices.aim(this.#game)
    for (const note of city.notes) this.#game.announce(note)
    this.#panel.holding({ city: true, playing: true })
    this.#panel.waiting()
    this.#panel.hide()
    this.#game.handOverKeys(false)
  }

  /**
   * The shelf onto the landing screen, each city with whether a playthrough is
   * waiting in it. The saves are this layer's, keyed the same way the shelf is,
   * so the library never has to know they exist.
   */
  async #shelve(): Promise<void> {
    const entries = await this.#library.entries()
    this.#panel.library(entries.map((entry) => ({ entry, played: localSaves(entry.key).read() !== undefined })))
  }

  #step = async (text: string): Promise<void> => {
    this.#panel.working(text)
    await painted()
  }

  /** The running game, for the dev console. */
  get game(): Playing | undefined {
    return this.#game
  }

  /** The city on screen, for the dev console to ask about. */
  get world(): OpenedBundle['world'] | undefined {
    return this.#city?.bundle.world
  }
}
