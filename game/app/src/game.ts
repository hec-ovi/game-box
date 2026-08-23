import type { OpenedBundle } from '@gb/bundle'
import type { Cast } from '@gb/cast'
import { SceneCast } from '@gb/crowd'
import { Hud, type HudIntent } from '@gb/hud'
import type { KitDressing } from '@gb/kitbash'
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { buildCity, type CityBuild, type Dressing } from '@gb/scene'
import { Sidecar } from '@gb/sidecar'
import type { World } from '@gb/world'
import * as THREE from 'three'
import { Attending, type Facing, type Post } from './attending.ts'
import { Buildings } from './buildings.ts'
import { Companions } from './companions.ts'
import { CONTROLS } from './controls.ts'
import { Interaction } from './interaction.ts'
import { Player } from './player.ts'
import { createStage, type Stage } from './renderer.ts'
import { Reporting } from './reporting.ts'
import { Session, type SaveStore } from './session.ts'
import { Sky } from './sky.ts'
import { Street } from './street.ts'
import { Talking } from './talking.ts'
import { pick, Targeting, type Target } from './targets.ts'

export interface GameOptions {
  dressing: Dressing
  cast?: Cast
  kit?: KitDressing
  cars?: ArrayBuffer
  sidecar?: Sidecar
  /** Where the playthrough is kept, so a refresh picks it up where it left off. */
  save?: SaveStore
}

/** Real seconds between keeping the playthrough, so the clock survives a reload. */
const KEEP_EVERY = 20

/**
 * The game itself: a city you walk around, buildings you go into, people you
 * talk to, things you carry from one to another. Everything it knows how to do
 * belongs to a box; this holds them together and draws the frames.
 */
export class Game {
  #world: World
  #log: QuestLog
  #player: PlayerState
  #stage: Stage
  #hud: Hud
  #body: Player
  #city: CityBuild
  #sky: Sky
  #street: Street
  #buildings: Buildings
  #companions: Companions
  #attending: Attending
  #talking: Talking
  #report: Reporting
  #targeting: Targeting
  #interaction: Interaction
  #cast: Cast | undefined
  #session: Session | undefined
  #target: Target | undefined
  #sinceKept = 0

  private constructor(input: {
    bundle: OpenedBundle
    stage: Stage
    hud: Hud
    player: PlayerState
    log: QuestLog
    sidecar: Sidecar
    dressing: Dressing
    session?: Session
    cast?: Cast
    kit?: KitDressing
  }) {
    this.#world = input.bundle.world
    this.#log = input.log
    this.#player = input.player
    this.#stage = input.stage
    this.#hud = input.hud
    this.#cast = input.cast
    this.#session = input.session

    this.#city = buildCity(this.#world, input.dressing)
    // lamps are two draws for the whole city, and without them night is unreadable
    if (input.kit) this.#city.root.add(input.kit.streetlights(this.#world))
    this.#stage.show(this.#city.root)

    this.#sky = new Sky(this.#world, this.#stage, { hour: this.#player.clock.hour, ...(input.kit ? { kit: input.kit } : {}) })
    // the city's ring of blocks was standing in for hills; now there are hills
    if (this.#sky.standing) {
      const blocks = this.#city.root.getObjectByName('mountains')
      if (blocks) blocks.visible = false
    }

    this.#street = new Street({
      world: this.#world,
      ...(this.#sky.ground ? { ground: this.#sky.ground } : {}),
      playerOutdoors: () => (this.#buildings.outdoors ? this.#body.position : undefined),
    })

    this.#body = new Player(this.#stage.camera, this.#stage.renderer.domElement, this.#street.solid())
    this.#body.setGround(this.#street.floor())
    this.#body.placeAt(this.#city.spawn.x, this.#city.spawn.z, this.#city.spawn.heading)

    this.#report = new Reporting({
      world: this.#world,
      log: this.#log,
      player: this.#player,
      hud: this.#hud,
      changed: () => this.#session?.keep(this.#player, this.#log),
    })

    this.#buildings = new Buildings({
      world: this.#world,
      dressing: input.dressing,
      stage: this.#stage,
      body: this.#body,
      city: this.#city,
      sky: this.#sky,
      street: this.#street,
      announce: (text) => this.#report.note(text),
      arrived: (place) => this.#report.report(this.#log.handle({ kind: 'arrived', place })),
      cameOut: (at) => this.#companions.regroup(at),
      away: () => [...this.#street.walkers().map((walker) => walker.id), ...this.#player.companions()],
    })

    this.#companions = new Companions({
      world: this.#world,
      player: this.#player,
      street: this.#street,
      buildings: this.#buildings,
      note: (text) => this.#report.note(text),
    })

    // the crowd turns the people it is walking; the people at their posts in a
    // room are this box's own bodies, so it turns those itself
    const heads = (input.dressing as { members?: () => ReadonlyMap<string, Facing> }).members?.()
    this.#attending = new Attending({
      street: this.#street,
      eye: this.#stage.camera.position,
      post: (npcId): Post | undefined => {
        const body = this.#buildings.inside?.people.get(npcId)
        if (!body) return undefined
        const head = heads?.get(npcId)
        return head ? { body, head } : { body }
      },
    })

    this.#talking = new Talking({
      world: this.#world,
      log: this.#log,
      player: this.#player,
      sidecar: input.sidecar,
      hud: this.#hud,
      body: this.#body,
      attending: this.#attending,
      report: this.#report,
    })

    this.#targeting = new Targeting({
      world: this.#world,
      city: this.#city,
      buildings: this.#buildings,
      street: this.#street,
    })

    this.#interaction = new Interaction({
      element: this.#stage.renderer.domElement,
      world: this.#world,
      player: this.#player,
      log: this.#log,
      hud: this.#hud,
      body: this.#body,
      buildings: this.#buildings,
      talking: this.#talking,
      companions: this.#companions,
      report: this.#report,
      aimed: () => this.#target,
    })

    if (input.cast) {
      const walkers = new THREE.Group()
      walkers.name = 'crowd'
      this.#city.root.add(walkers)
      this.#street.populate(new SceneCast(input.cast, walkers))
    }

    this.#hud.show({ controls: CONTROLS })
    this.#report.refresh()
  }

  static async start(mount: HTMLElement, bundle: OpenedBundle, options: GameOptions): Promise<Game> {
    const stage = await createStage(mount)
    const session = options.save ? new Session(bundle, options.save) : undefined
    const restored = session?.restore()
    const player = restored?.player ?? PlayerState.create(bundle.world.id, 5)
    const log = restored?.log ?? QuestLog.create(bundle.quests, player)

    let game: Game | undefined
    const hud = new Hud(mount, { onIntent: (intent) => game?.intent(intent) })
    try {
      game = new Game({
        bundle,
        stage,
        hud,
        player,
        log,
        sidecar: options.sidecar ?? new Sidecar(),
        dressing: options.dressing,
        ...(session ? { session } : {}),
        ...(options.cast ? { cast: options.cast } : {}),
        ...(options.kit ? { kit: options.kit } : {}),
      })
    } catch (cause) {
      // half a game is worse than none: a stage and an interface with nothing
      // behind them would sit on the page reading as a game that had started
      hud.destroy()
      stage.dispose()
      throw cause
    }

    if (options.cars) await game.#street.openRoads(options.cars, game.#city.root, game.#body.position)
    stage.start((seconds) => game!.frame(seconds))
    return game
  }

  frame(seconds: number): void {
    const clock = this.#player.clock
    clock.advance(seconds)
    this.#log.handle({ kind: 'clock', seconds: clock.totalSeconds })
    this.#keepTheClock(seconds)
    this.#sky.follow(seconds, clock, this.#buildings.outdoors, this.#city)
    this.#street.setTime(clock)

    this.#body.update(seconds)
    // the street only carries on while the player is out in it
    if (this.#buildings.outdoors) this.#street.update(seconds, this.#body.position)
    // whoever is being talked to keeps facing the player, indoors and out, and
    // before the cast runs so the head turn lands on this frame's pose
    this.#attending.update(seconds)
    this.#cast?.update(seconds)

    this.#target = pick(this.#body.position, this.#body.heading, this.#targeting.list())
    const prompt = this.#talking.active || !this.#target ? null : { key: 'E', text: this.#target.label }
    this.#hud.show({ prompt })
  }

  /**
   * Advance and draw one frame. A hidden tab suspends the frame loop, so a test
   * or a console can drive the game by hand.
   */
  tick(seconds = 1 / 60): void {
    this.frame(seconds)
    this.#stage.draw()
  }

  /** What the player did in the interface. */
  intent(intent: HudIntent): void {
    if (intent.kind === 'say') void this.#talking.say(intent.text)
    if (intent.kind === 'typing') this.#body.setTyping(intent.typing)
    if (intent.kind === 'talk-closed') this.#talking.end()
    // the interface holds no state of its own, so the quest it was told to
    // follow is echoed straight back to it
    if (intent.kind === 'track') this.#hud.show({ trackedQuestId: intent.questId })
    // giving up on a job: `@gb/hud` shows the control once it has somewhere to
    // send it, and this is where it lands
    const kind: string = intent.kind
    if (kind === 'abandon') this.abandon((intent as unknown as { questId: string }).questId)
    // a window the player has to click needs the pointer back; walking carries on
    if (intent.kind === 'window' && intent.window !== null) document.exitPointerLock()
  }

  /**
   * Hand the keyboard and the pointer to something else on the page, and take
   * them back. The city carries on either way.
   */
  handOverKeys(away: boolean): void {
    this.#body.setTyping(away)
  }

  /** Give up on a job. The quest log decides what that costs. */
  abandon(questId: string): void {
    this.#report.report(this.#log.abandon(questId))
  }

  /** Write the playthrough down now, whatever it is doing. */
  /**
   * The clock runs whether or not anything happens, so a playthrough saved only
   * when the player does something comes back at the hour they arrived. Kept on
   * a timer as well, rarely enough that writing it costs nothing.
   */
  #keepTheClock(seconds: number): void {
    this.#sinceKept += seconds
    if (this.#sinceKept < KEEP_EVERY) return
    this.#sinceKept = 0
    this.keep()
  }

  keep(): void {
    this.#session?.keep(this.#player, this.#log)
  }

  /** The scene as it stands, for the dev console to poke at. */
  scene(): THREE.Scene {
    return this.#stage.scene
  }

  /** Where the player is and what they could act on. For the dev console. */
  look(): Record<string, unknown> {
    return {
      place: this.#buildings.place.kind,
      at: this.#body.position,
      heading: this.#body.heading,
      target: this.#target?.label,
      walkers: this.#street.walkerCount,
      cars: this.#street.carCount,
      nearest: this.#targeting
        .list()
        .map((target) => ({ label: target.label, away: Math.hypot(target.at.x - this.#body.position.x, target.at.z - this.#body.position.z) }))
        .toSorted((a, b) => a.away - b.away)
        .slice(0, 3),
    }
  }

  /** Take the game off the page: every listener, every timer, the renderer. */
  dispose(): void {
    this.keep()
    this.#interaction.dispose()
    this.#body.dispose()
    this.#hud.destroy()
    this.#stage.dispose()
  }
}
