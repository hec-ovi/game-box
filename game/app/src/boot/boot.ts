import type { OpenedBundle } from '@gb/bundle'
import type { Sidecar } from '@gb/sidecar'
import { typingSomewhere } from '../focus.ts'
import { Game, type GameOptions } from '../game.ts'
import { loadCars, loadDressing, type ArtPack } from '../pack.ts'
import { briefFromQuery, briefToQuery, DEFAULTS, type CityBrief } from './brief.ts'
import { CityMaker, type City, type Made } from './city-maker.ts'
import { download, exportName } from './export.ts'
import { localSaves, rememberBrief, rememberedBrief } from './kept.ts'
import { painted } from './painted.ts'
import { Panel } from './panel.ts'

/** A running game, as the boot layer needs it: something to hand the keys to. */
export interface Playing {
  dispose(): void
  handOverKeys(away: boolean): void
  keep(): void
}

/** How a city becomes a running game. `Game.start` unless a test says otherwise. */
export type Start = (mount: HTMLElement, bundle: OpenedBundle, options: GameOptions) => Promise<Playing>

/** Where the art comes from. `loadDressing` unless a test says otherwise. */
export type LoadArt = (theme: string) => Promise<ArtPack>

/**
 * The composition root: the panel, the city it asks for, and the game that
 * plays it. Nothing here decides anything about a city; it carries a brief to
 * the generator, the generated city to the renderer, and whatever went wrong
 * back to the panel as a sentence.
 */
export class Boot {
  #mount: HTMLElement
  #panel: Panel
  #maker: CityMaker
  #sidecar: Sidecar
  #start: Start
  #art: LoadArt
  #game: Playing | undefined
  #city: City | undefined
  #brief: CityBrief | undefined
  #asked = new URLSearchParams()
  #running: AbortController | undefined

  constructor(input: { mount: HTMLElement; panel: Panel; sidecar: Sidecar; start?: Start; art?: LoadArt }) {
    this.#mount = input.mount
    this.#panel = input.panel
    this.#sidecar = input.sidecar
    this.#start = input.start ?? Game.start
    this.#art = input.art ?? loadDressing
    this.#maker = new CityMaker(input.sidecar)

    this.#panel.on({
      generate: (brief) => void this.generate(brief),
      open: (file) => void this.openFile(file),
      save: () => this.export(),
      cancel: () => this.cancel(),
      close: () => this.hidePanel(),
    })
    addEventListener('keydown', this.#key)
    addEventListener('pagehide', () => this.#game?.keep())
  }

  /**
   * What the address bar asked for, or the city the player was last in. With
   * neither, the panel waits: a bare address is a form, not an eleven second
   * white screen.
   */
  async start(query: URLSearchParams): Promise<void> {
    this.#asked = query
    const asked = briefFromQuery(query)
    const before = rememberedBrief()
    this.#panel.brief = asked ?? before ?? DEFAULTS

    const file = query.get('bundle')
    if (file) {
      await this.#run(undefined, async (signal) => {
        await this.#step(`Opening ${file}`)
        return { made: await this.#maker.fetch(file, signal) }
      })
      return
    }

    const brief = asked ?? before
    if (!brief) return this.#panel.waiting()
    await this.generate(brief)
  }

  async generate(brief: CityBrief): Promise<void> {
    this.#panel.brief = brief
    await this.#run(brief, async (signal) => {
      // the art comes before the city, because the city is pinned to it: which
      // building of the pack each plot was designed against is written into the
      // world file, and the seal covers it
      await this.#step('Loading the art')
      const art = await this.#art(brief.theme)
      const made = await this.#maker.build(brief, {
        signal,
        step: this.#step,
        ...(art.catalogue ? { catalogue: art.catalogue } : {}),
      })
      return { made, art }
    })
  }

  /** Play a city file the player picked, exactly as Export wrote it. */
  async openFile(file: File): Promise<void> {
    await this.#run(undefined, async (signal) => {
      await this.#step(`Opening ${file.name}`)
      return { made: await this.#maker.read(file, signal) }
    })
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
  async #run(
    brief: CityBrief | undefined,
    make: (signal: AbortSignal) => Promise<{ made: Made; art?: ArtPack }>,
  ): Promise<void> {
    const signal = this.#signal()
    const { made, art } = await make(signal)
    if (signal.aborted) return this.#panel.waiting('Stopped.')
    if (!made.ok) return this.#panel.waiting(made.message, true)

    await this.#play(made.value, brief, signal, art)
  }

  #signal(): AbortSignal {
    this.#running?.abort()
    this.#running = new AbortController()
    return this.#running.signal
  }

  async #play(city: City, brief: CityBrief | undefined, signal: AbortSignal, loaded?: ArtPack): Promise<void> {
    if (!loaded) await this.#step('Loading the art')
    const [art, cars] = await Promise.all([loaded ?? this.#art(city.bundle.world.theme), loadCars()])
    if (signal.aborted) return this.#panel.waiting('Stopped.')

    // the city is made and sealed; it can be kept from here on whether or not
    // the renderer manages to draw it
    this.#city = city
    this.#brief = brief
    this.#panel.holding({ city: true, playing: false })

    await this.#step(`Building ${city.bundle.world.name}`)
    this.#game?.dispose()
    this.#game = undefined
    try {
      this.#game = await this.#start(this.#mount, city.bundle, {
        sidecar: this.#sidecar,
        dressing: art.dressing,
        save: localSaves(city.bundle.world.id),
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

    if (brief) {
      rememberBrief(brief)
      history.replaceState(null, '', briefToQuery(brief, this.#asked))
    }
    this.#panel.holding({ city: true, playing: true })
    this.#panel.waiting()
    this.#panel.hide()
    this.#game.handOverKeys(false)
  }

  #step = async (text: string): Promise<void> => {
    this.#panel.working(text)
    await painted()
  }

  /** One key opens the front door again, and puts it away. */
  #key = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyN' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    if (typingSomewhere()) return
    event.preventDefault()
    if (this.#panel.open) this.hidePanel()
    else this.showPanel()
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
