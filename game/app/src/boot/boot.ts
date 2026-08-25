import type { OpenedBundle } from '@gb/bundle'
import type { Notice } from '@gb/hud'
import { Sidecar, type SidecarOptions } from '@gb/sidecar'
import { Game, type GameOptions } from '../game.ts'
import { loadCars, loadDressing, type ArtPack } from '../pack.ts'
import { briefFromQuery, briefToQuery, DEFAULTS, sameBrief, type CityBrief } from './brief.ts'
import { CityMaker, type City, type Made } from './city-maker.ts'
import { download, exportName } from './export.ts'
import { localSaves } from './kept.ts'
import { briefOf, type Library, type Shelved } from './library.ts'
import { Loader } from './loader.ts'
import { Notices } from './notices.ts'
import { painted } from './painted.ts'
import { Panel } from './panel.ts'

/** A running game, as the boot layer needs it: something to hand the keys to and to say things on. */
export interface Playing {
  dispose(): void
  handOverKeys(away: boolean): void
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
  #loader: Loader
  #notices = new Notices()
  #sidecar: Sidecar
  #start: Start
  #art: LoadArt
  #game: Playing | undefined
  #city: City | undefined
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
    this.#loader = new Loader(input.mount)

    this.#panel.on({
      generate: (brief) => void this.generate(brief),
      open: (file) => void this.openFile(file),
      pick: (key) => void this.pick(key),
      remove: (key) => void this.remove(key),
      save: () => this.export(),
      cancel: () => this.cancel(),
      close: () => this.hidePanel(),
    })
    addEventListener('pagehide', () => this.#game?.keep())
  }

  /**
   * What the address bar asked for, or the city the player was last in. With
   * neither, the panel waits: a bare address is a form, not an eleven second
   * white screen. A refresh comes back to the same city, model or not, because
   * the city is on the shelf rather than written again.
   */
  async start(query: URLSearchParams): Promise<void> {
    this.#asked = query
    const asked = briefFromQuery(query)
    const last = await this.#library.last()
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

    if (asked && !(last && sameBrief(asked, briefOf(last)))) return this.generate(asked)
    if (last) return this.pick(last.key)
    this.#panel.waiting()
  }

  async generate(brief: CityBrief): Promise<void> {
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
    await this.#run(async (signal) => {
      await this.#step(`Opening ${file.name}`)
      return { made: await this.#maker.read(file, signal), file: (city) => this.#library.opened(city) }
    })
  }

  /** Play a city off the shelf: the document as it was kept, and the save that goes with it. */
  async pick(key: string): Promise<void> {
    const entry = (await this.#library.entries()).find((shelved) => shelved.key === key)
    if (!entry) return
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

  /** Take a city off the shelf, and its playthrough with it. */
  async remove(key: string): Promise<void> {
    await this.#library.remove(key)
    localSaves(key).clear()
    await this.#shelve()
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

  /** The way out of the game: the panel, with the shelf on it. */
  showPanel(): void {
    this.#game?.handOverKeys(true)
    this.#panel.show()
  }

  hidePanel(): void {
    if (!this.#game) return
    this.#panel.hide()
    this.#game.handOverKeys(false)
  }

  /**
   * One generation at a time: asking for another stops the one in flight. A
   * city written here arrives with the art it was pinned to, so it is played
   * with the same pack rather than a second load of it.
   */
  async #run(make: (signal: AbortSignal) => Promise<Making>): Promise<void> {
    const signal = this.#signal()
    let making: Making
    try {
      making = await make(signal)
    } finally {
      this.#loader.end()
      this.#panel.aside(false)
      this.#notices.aim(this.#game)
    }
    if (signal.aborted) return this.#panel.waiting('Stopped.')
    if (!making.made.ok) return this.#panel.waiting(making.made.message, true)

    const entry = await making.file(making.made.value)
    await this.#shelve()
    await this.#play(making.made.value, entry, signal, making.art)
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

  async #shelve(): Promise<void> {
    this.#panel.library(await this.#library.entries())
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
