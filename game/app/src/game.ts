import type { OpenedBundle } from '@gb/bundle'
import type { Cast, CastMember } from '@gb/cast'
import { SceneCast } from '@gb/crowd'
import { CrowdRiders, Driving } from '@gb/drive'
import { Hud, type HudIntent } from '@gb/hud'
import { CityNav } from '@gb/nav'
import type { KitDressing } from '@gb/kitbash'
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { buildCity, type CityBuild, type Dressing } from '@gb/scene'
import { Sidecar } from '@gb/sidecar'
import type { World } from '@gb/world'
import * as THREE from 'three'
import { Attending, type Post } from './attending.ts'
import { Buildings } from './buildings.ts'
import { Chart } from './chart.ts'
import { Companions } from './companions.ts'
import { Conditions } from './conditions.ts'
import { CONTROLS } from './controls.ts'
import { Gestures } from './gestures.ts'
import { Guide } from './guide.ts'
import { Intents } from './intents.ts'
import { Interaction } from './interaction.ts'
import type { RoomArt } from './pack.ts'
import { marked } from './places.ts'
import { Player } from './player.ts'
import { createStage, type Stage } from './renderer.ts'
import { Playthrough } from './playthrough.ts'
import { Reporting } from './reporting.ts'
import { Session, type SaveStore } from './session.ts'
import { atAnOpenDoor } from './spawn.ts'
import { Sky } from './sky.ts'
import { Stashing } from './stashing.ts'
import { Street } from './street.ts'
import { Talking } from './talking.ts'
import { pick, Targeting, type Target } from './targets.ts'

export interface GameOptions {
  dressing: Dressing
  /** An interior's own floor, walls and wall bays. Without it, rooms stay flat. */
  room?: RoomArt
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
  #stashing: Stashing
  #driving: Driving
  #attending: Attending
  #talking: Talking
  #report: Reporting
  #playthrough: Playthrough
  #chart: Chart
  #targeting: Targeting
  #intents: Intents
  #interaction: Interaction
  #cast: Cast | undefined
  #riderCast: SceneCast | undefined
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
    room?: RoomArt
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

    const nav = CityNav.from(this.#world)
    this.#street = new Street({
      world: this.#world,
      nav,
      ...(this.#sky.ground ? { ground: this.#sky.ground } : {}),
      playerOutdoors: () => (this.#buildings.outdoors ? this.#body.position : undefined),
    })

    this.#body = new Player(this.#stage.camera, this.#stage.renderer.domElement, this.#street.solid())
    this.#body.setGround(this.#street.floor())
    const start = atAnOpenDoor(this.#world, this.#city)
    this.#body.placeAt(start.x, start.z, start.heading)

    this.#report = new Reporting({
      world: this.#world,
      log: this.#log,
      player: this.#player,
      hud: this.#hud,
      changed: () => this.keep(),
    })

    this.#buildings = new Buildings({
      world: this.#world,
      player: this.#player,
      dressing: input.dressing,
      ...(input.room ? { room: input.room } : {}),
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

    // built before anything can ask for a save, because the first thing that
    // does is this constructor's own last line: what a save says over the top
    // of the city is written by this and there is no save without it
    this.#playthrough = new Playthrough({
      world: this.#world,
      player: this.#player,
      log: this.#log,
      buildings: this.#buildings,
      body: this.#body,
      companions: this.#companions,
      report: this.#report,
    })

    // a job that says to leave something somewhere: the surface it names is a
    // spot in the room, so putting it down is the same key as taking it
    this.#stashing = new Stashing({
      world: this.#world,
      log: this.#log,
      player: this.#player,
      buildings: this.#buildings,
      report: this.#report,
    })

    if (input.cast) {
      const walkers = new THREE.Group()
      walkers.name = 'crowd'
      this.#city.root.add(walkers)
      this.#riderCast = new SceneCast(input.cast, walkers)
      this.#street.populate(this.#riderCast)
    }

    // the car the player drives: the same art and the same pool the traffic
    // draws from, the same walls the player walks into, and the companions
    const people = this.#street.people
    this.#driving = new Driving({
      rider: this.#body,
      solid: this.#street.solid(),
      ground: this.#street.floor(),
      outdoors: () => this.#buildings.outdoors,
      ...(people && this.#riderCast ? { riders: new CrowdRiders({ crowd: people, cast: this.#riderCast }) } : {}),
    })
    this.#street.setPlayerCar(this.#driving)

    // the crowd turns the people it is walking; the people at their posts in a
    // room are this box's own bodies, so it turns those itself
    const heads = (input.dressing as { members?: () => ReadonlyMap<string, CastMember> }).members?.()
    this.#attending = new Attending({
      street: this.#street,
      eye: this.#stage.camera.position,
      // whoever was being talked to has been retired off the far end of the
      // street, so there is nobody left to be in a conversation with
      gone: () => this.#talking.end(),
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
      // one lookup for both: `@gb/crowd` answers it in the same shape the room
      // does, and the crowd is asked first because somebody out walking is not
      // also standing behind their own counter. Asked fresh every time, never
      // kept: bodies are recycled, and a held one is a stranger's arms
      gestures: new Gestures(() => this.#riderCast?.members(), () => heads),
      report: this.#report,
    })

    // where the tracked quest is sending the player: the map pins it and the
    // guide walks to it, both off the one answer. Both measure from where the
    // player stands on the city, which indoors is the door they came in by
    const steps = () => this.#report.following()
    const goals = () => marked(this.#world, steps())
    const standing = () => ({ position: this.#buildings.cityPosition(), heading: this.#body.heading })
    this.#chart = new Chart({ world: this.#world, hud: this.#hud, you: standing, goals })

    this.#targeting = new Targeting({
      world: this.#world,
      city: this.#city,
      buildings: this.#buildings,
      stashing: this.#stashing,
      street: this.#street,
      driving: this.#driving,
    })

    this.#intents = new Intents({
      log: this.#log,
      hud: this.#hud,
      talking: this.#talking,
      report: this.#report,
      body: this.#body,
      chart: this.#chart,
      releasePointer: () => document.exitPointerLock(),
    })

    this.#interaction = new Interaction({
      element: this.#stage.renderer.domElement,
      world: this.#world,
      player: this.#player,
      log: this.#log,
      hud: this.#hud,
      body: this.#body,
      buildings: this.#buildings,
      stashing: this.#stashing,
      talking: this.#talking,
      companions: this.#companions,
      driving: this.#driving,
      guide: new Guide({ world: this.#world, nav, from: () => this.#buildings.cityPosition(), goals, steps }),
      conditions: new Conditions(this.#player.clock),
      report: this.#report,
      aimed: () => this.#target,
    })

    this.#hud.show({ controls: CONTROLS })
    this.#report.refresh()

    // the city is built the same way every time, so everything a playthrough
    // knows that the city does not is put back last, over the top of it
    this.#playthrough.resume()
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
        ...(options.room ? { room: options.room } : {}),
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

    if (options.cars) {
      await game.#street.openRoads(options.cars, game.#city.root, game.#body.position)
      const roads = game.#street.roads
      if (roads) game.#driving.open(roads.traffic, roads.bodies)
    }
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
    this.#driving.update(seconds)
    // the street only carries on while the player is out in it
    if (this.#buildings.outdoors) this.#street.update(seconds, this.#body.position)
    // whoever is being talked to keeps facing the player, indoors and out, and
    // before the cast runs so the head turn lands on this frame's pose
    this.#attending.update(seconds)
    this.#cast?.update(seconds)

    this.#chart.update(seconds)
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
    this.#intents.handle(intent)
  }

  /**
   * Hand the keyboard and the pointer to something else on the page, and take
   * them back. The city carries on either way.
   */
  handOverKeys(away: boolean): void {
    this.#intents.handOver(away)
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
    if (!this.#session) return
    this.#playthrough.write()
    this.#session.keep(this.#player, this.#log)
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
      driving: this.#driving.aboard,
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
