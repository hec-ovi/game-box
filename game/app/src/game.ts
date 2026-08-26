import type { OpenedBundle } from '@gb/bundle'
import type { Cast } from '@gb/cast'
import { SceneCast } from '@gb/crowd'
import { CrowdRiders, Driving } from '@gb/drive'
import { Hud, type HudIntent, type Notice } from '@gb/hud'
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
import { Chase } from './chase.ts'
import { Chart } from './chart.ts'
import { Companions } from './companions.ts'
import { Compass } from './compass.ts'
import { Conditions } from './conditions.ts'
import { controlsFor } from './controls.ts'
import { Counters } from './counters.ts'
import { Escorts } from './escorts.ts'
import { Garage } from './garage.ts'
import { Gestures } from './gestures.ts'
import { Guide } from './guide.ts'
import { Intents } from './intents.ts'
import { Interaction } from './interaction.ts'
import { Locks } from './locks.ts'
import { Machines } from './machines.ts'
import { Members, type Bodies } from './members.ts'
import { Minimap } from './minimap.ts'
import type { RoomArt } from './pack.ts'
import { Player } from './player.ts'
import { createStage } from './renderer.ts'
import { Playthrough } from './playthrough.ts'
import { Reporting } from './reporting.ts'
import { CityArt } from './rooms.ts'
import { resumeNotice } from './resumed.ts'
import { Rewards } from './rewards.ts'
import { Screens } from './screens.ts'
import { Session, type SaveStore } from './session.ts'
import { atAnOpenDoor, atTheKerb } from './spawn.ts'
import { Sky } from './sky.ts'
import type { MakeStage, Stage } from './stage.ts'
import { Stashing } from './stashing.ts'
import { tellStory } from './story.ts'
import { Street } from './street.ts'
import { Talking } from './talking.ts'
import { Travel } from './travel.ts'
import { pick, Targeting, type Target } from './targets.ts'
import { View } from './view.ts'

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
  /**
   * A video of the player's own for the televisions, by address. Set and
   * reachable, it is what every set in town plays; anything else leaves them on
   * the schedule the town writes for itself. It never reaches a world file.
   */
  screens?: string
  /** What leaving the game means: the interface reports it, whoever started the game decides. */
  leave?: () => void
  /**
   * Where the frames are drawn. `createStage` unless the caller has no GPU to
   * give it: everything else the game is made of runs without one.
   */
  stage?: MakeStage
}

/** Real seconds between keeping the playthrough, so the clock survives a reload. */
const KEEP_EVERY = 20

/** How far out the console's `look` reports things, in metres: past arm's reach, so it answers "what is around me". */
const LOOK_RANGE = 40

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
  #escorts: Escorts
  #stashing: Stashing
  #locks: Locks
  #machines: Machines
  #counters: Counters
  #garage: Garage
  #rewards: Rewards
  #driving: Driving
  #chase: Chase
  #attending: Attending
  #talking: Talking
  #report: Reporting
  #playthrough: Playthrough
  #chart: Chart
  #travel: Travel
  #compass: Compass
  #minimap: Minimap
  #view: View
  #targeting: Targeting
  #art: CityArt
  #intents: Intents
  #interaction: Interaction
  #cast: Cast | undefined
  #screens: Screens | undefined
  #riderCast: SceneCast | undefined
  #session: Session | undefined
  #target: Target | undefined
  #sinceKept = 0
  #paused = false
  /** The prompt the interface is showing, so the same words are not pushed twice. */
  #prompted: string | null | undefined

  private constructor(input: {
    bundle: OpenedBundle
    stage: Stage
    hud: Hud
    player: PlayerState
    log: QuestLog
    sidecar: Sidecar
    dressing: Dressing
    leave: () => void
    room?: RoomArt
    session?: Session
    cast?: Cast
    kit?: KitDressing
    screens?: Screens
  }) {
    this.#world = input.bundle.world
    this.#log = input.log
    this.#player = input.player
    this.#stage = input.stage
    this.#hud = input.hud
    this.#cast = input.cast
    this.#screens = input.screens
    this.#session = input.session

    // the city is built with the art the pack loaded, and a room with the art
    // that interior asks for: `@gb/scene` builds both through the one seam
    this.#art = new CityArt(input.dressing)
    this.#city = buildCity(this.#world, this.#art.seam)
    // lamps are two draws for the whole city, and without them night is unreadable
    if (input.kit) this.#city.root.add(input.kit.streetlights(this.#world))
    this.#stage.show(this.#city.root)

    const clock = this.#player.clock
    this.#sky = new Sky(this.#world, this.#stage, { hour: clock.hour, weather: clock.weather, ...(input.kit ? { kit: input.kit } : {}) })
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

    this.#body = new Player(this.#stage.camera, this.#stage.canvas, this.#street.solid())
    this.#body.setGround(this.#street.floor())
    const start = atAnOpenDoor(this.#world, this.#city)
    this.#body.placeAt(start.x, start.z, start.heading)

    // the clock and the sky are the player's to turn, by key and by the
    // settings tab alike, so one hand on them serves both
    const conditions = new Conditions(clock)
    // and the screen: the corner view and full screen, which the tab reads off
    // what the game pushes back rather than off the button that was pressed
    this.#view = new View(() => this.#report.refresh())
    this.#report = new Reporting({
      world: this.#world,
      log: this.#log,
      player: this.#player,
      hud: this.#hud,
      conditions,
      view: this.#view,
      // a pin on somebody who is out walking goes where they are heading
      out: (npcId) => this.#street.whereabouts(npcId),
      // a job that paid out a house or a car: the city is told whose the place
      // is and the street is told where the car stands
      paid: (reward) => this.#rewards.paid(reward),
      changed: () => {
        this.keep()
        this.#compass.dirty()
        this.#minimap.dirty()
        this.#escorts.dirty()
        // the board moved: who is walking with the player is read off it
        this.#companions.sync()
      },
    })

    // the locks on the doors: what the file says, what the playthrough can get
    // past, and the edges `@gb/nav` cuts while they are shut
    this.#locks = new Locks({ world: this.#world, player: this.#player, nav, log: this.#log, report: this.#report })

    this.#buildings = new Buildings({
      world: this.#world,
      player: this.#player,
      locks: this.#locks,
      art: this.#art,
      ...(input.room ? { room: input.room } : {}),
      ...(input.screens ? { screens: input.screens } : {}),
      stage: this.#stage,
      body: this.#body,
      city: this.#city,
      sky: this.#sky,
      street: this.#street,
      announce: (text) => this.#report.note(text),
      arrived: (place) => {
        this.#report.report(this.#log.handle({ kind: 'arrived', place }))
        // and whoever is walking with the player came in with them
        this.#escorts.entered(place, this.#player.companions())
      },
      // and whoever is walking with the player comes in with them and goes
      // back out with them
      wentIn: (built, interior) => this.#companions.comeIn(interior.id, built.visitorCells, built.inward),
      cameOut: (at) => this.#companions.comeOut(at),
      away: () => [...this.#street.walkers().map((walker) => walker.id), ...this.#player.companions()],
      veil: (title) => this.#report.veil(title),
    })

    this.#companions = new Companions({
      world: this.#world,
      player: this.#player,
      street: this.#street,
      buildings: this.#buildings,
      riding: () => this.#driving.passengers(),
      note: (text) => this.#report.note(text),
    })

    // an escort is credited when the person walking with the player gets
    // there, by the one event `@gb/quest` takes for it
    this.#escorts = new Escorts({
      world: this.#world,
      steps: () => this.#log.objectives(),
      doorstep: (plotId) => this.#city.doorsteps.get(plotId),
      walking: () => this.#street.following(),
      arrived: (npcId, place) => this.#report.report(this.#log.handle({ kind: 'companion-arrived', npcId, place })),
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

    // the screens on the desks and the counters people keep: what the crosshair
    // offers, and what the interface is pushed when the player uses one
    this.#machines = new Machines({
      world: this.#world,
      player: this.#player,
      log: this.#log,
      hud: this.#hud,
      report: this.#report,
      buildings: this.#buildings,
    })
    this.#counters = new Counters({
      world: this.#world,
      player: this.#player,
      log: this.#log,
      hud: this.#hud,
      report: this.#report,
      buildings: this.#buildings,
      locks: this.#locks,
    })

    if (input.cast) {
      const walkers = new THREE.Group()
      walkers.name = 'crowd'
      this.#city.root.add(walkers)
      // a companion who came in through the door is drawn under the room they
      // are standing in, and nowhere at all while no such room is standing
      this.#riderCast = new SceneCast(input.cast, walkers, { root: (interiorId) => this.#buildings.room(interiorId)?.root })
      this.#street.populate(this.#riderCast)
    }

    // the car the player drives: the same art and the same pool the traffic
    // draws from, the same walls the player walks into, and the companions
    const people = this.#street.people
    this.#driving = new Driving({
      rider: this.#body,
      solid: this.#street.solid(),
      // what the view behind the car may not sit inside is the buildings
      // alone: pulled in for a pedestrian, it would tuck against every person
      // who walked up behind the car
      walls: this.#street.walls(),
      ground: this.#street.floor(),
      outdoors: () => this.#buildings.outdoors,
      ...(people && this.#riderCast ? { riders: new CrowdRiders({ crowd: people, cast: this.#riderCast }) } : {}),
    })
    this.#chase = new Chase({ camera: this.#stage.camera, driving: this.#driving, hud: this.#hud })
    // a car a job paid out stands at the kerb outside the player's own door,
    // on the same feed the town's cars are offered on, so getting into it is
    // getting into any other car
    this.#garage = new Garage({
      player: this.#player,
      driving: this.#driving,
      where: () => {
        const home = this.#world.home()
        const kerb = home ? atTheKerb(this.#world, this.#city, home.plotId) : undefined
        return kerb ?? this.#body.position
      },
    })
    this.#rewards = new Rewards({ world: this.#world, player: this.#player, locks: this.#locks, garage: this.#garage, report: this.#report })
    this.#street.setPlayerCar(this.#garage)

    // where anybody's body comes from: the pavement, the room the player is
    // standing in, which is dressed by its own art and hands out its own
    // bodies, and the city's own dressing. Asked in that order and asked
    // fresh, never kept
    const city = (input.dressing as { members?: Bodies }).members?.bind(input.dressing)
    const members = new Members(
      () => this.#riderCast?.members(),
      () => this.#buildings.bodiesHere(),
      () => city?.(),
    )

    // the crowd turns the people it is walking; the people at their posts in a
    // room are the art pack's bodies, and it brings them out of their stance
    // to face the player
    this.#attending = new Attending({
      street: this.#street,
      eye: this.#stage.camera.position,
      // whoever was being talked to has walked out of range or been retired
      // off the far end of the street: there is nobody left to talk to
      gone: () => this.#talking.end(),
      post: (npcId): Post | undefined => {
        const body = this.#buildings.inside?.people.get(npcId)
        if (!body) return undefined
        const member = members.of(npcId)
        return member ? { body, member } : { body }
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
      // the same lookup the person being talked to was found through, so the
      // hands that talk are the body they are actually wearing
      gestures: new Gestures(members),
      // naming their stock opens the counter they keep; a word, a key or a
      // door that changed hands is one the locks and the inventory read
      wares: (npcId) => this.#counters.open(npcId),
      granted: (grant) => this.#locks.handed(grant),
      over: () => this.#counters.closed(),
      report: this.#report,
    })

    // where the quests are sending the player: the map pins every live one,
    // the guide and the compass follow the tracked one, all off the city. Each
    // measures from where the player stands on the city, which indoors is the
    // door they came in by
    const steps = () => this.#report.following()
    const followed = () => this.#report.followed()
    const standing = () => ({ position: this.#buildings.cityPosition(), heading: this.#body.heading })
    // where fast travel boards, off the city's own stations: the plan offers
    // them, the crosshair opens the plan at one, and the ride is the game's
    this.#travel = new Travel({
      world: this.#world,
      hud: this.#hud,
      city: this.#city,
      body: this.#body,
      companions: this.#companions,
    })
    this.#chart = new Chart({
      world: this.#world,
      hud: this.#hud,
      you: standing,
      goals: () => this.#report.goals(),
      // and where there is work waiting: a player who holds no job has to be
      // able to read off the plan where to go and get one
      offers: () => this.#report.offers(),
      entered: () => this.#player.discovered().places,
      stations: this.#travel.marks,
      boarding: () => (this.#buildings.outdoors ? this.#travel.boarding(this.#body.position) : undefined),
      // and the places they own, so a player who has bought a home can find it
      homes: () => this.#player.owned(),
    })
    const guide = new Guide({ world: this.#world, nav, from: () => this.#buildings.cityPosition(), goals: followed, steps })
    this.#compass = new Compass({
      hud: this.#hud,
      guide,
      heading: () => this.#body.heading,
      standing: () => this.#body.position,
      outdoors: () => this.#buildings.outdoors,
    })
    // the streets round the player in the corner, windowed here because the
    // interface never reads the city: the same goals the plan pins, and the
    // doors of every place they have already walked into
    this.#minimap = new Minimap({
      world: this.#world,
      hud: this.#hud,
      heading: () => this.#body.heading,
      standing: () => this.#body.position,
      outdoors: () => this.#buildings.outdoors,
      goals: () => this.#report.goals(),
      entered: () => this.#player.discovered().places,
    })

    this.#targeting = new Targeting({
      world: this.#world,
      city: this.#city,
      buildings: this.#buildings,
      stashing: this.#stashing,
      street: this.#street,
      driving: this.#driving,
      locks: this.#locks,
      machines: this.#machines,
      travel: this.#travel,
    })

    this.#intents = new Intents({
      log: this.#log,
      hud: this.#hud,
      talking: this.#talking,
      report: this.#report,
      body: this.#body,
      chart: this.#chart,
      conditions,
      machines: this.#machines,
      counters: this.#counters,
      travel: this.#travel,
      view: this.#view,
      pause: (on) => this.pause(on),
      leave: input.leave,
      // a page with no pointer lock to give back has nothing to release
      releasePointer: () => document.exitPointerLock?.(),
    })

    this.#interaction = new Interaction({
      element: this.#stage.canvas,
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
      chase: this.#chase,
      locks: this.#locks,
      machines: this.#machines,
      chart: this.#chart,
      guide,
      conditions,
      report: this.#report,
      aimed: () => this.#target,
    })

    this.#hud.show({ controls: controlsFor(this.#driving.view) })
    // the town's story is what everybody in it knows, so the player arrives
    // told it: it is the codex's History heading from the first push
    tellStory(this.#world, this.#player)
    // the quest log hears the clock before any job can be taken: a timer
    // counts from the last reading it heard, and one that heard none fails on
    // its first
    this.#report.tick()
    this.#report.refresh()

    // the city is built the same way every time, so everything a playthrough
    // knows that the city does not is put back last, over the top of it: the
    // locks first, because a room the player has the key to is a room they may
    // be standing in, and the car they left out after it
    this.#locks.restore()
    this.#rewards.restore()
    this.#playthrough.resume()
    this.#garage.restore()
  }

  static async start(mount: HTMLElement, bundle: OpenedBundle, options: GameOptions): Promise<Game> {
    const stage = await (options.stage ?? createStage)(mount)
    const session = options.save ? new Session(bundle, options.save) : undefined
    const screens = options.screens ? new Screens(options.screens) : undefined
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
        leave: options.leave ?? (() => {}),
        ...(options.room ? { room: options.room } : {}),
        ...(session ? { session } : {}),
        ...(options.cast ? { cast: options.cast } : {}),
        ...(options.kit ? { kit: options.kit } : {}),
        ...(screens ? { screens } : {}),
      })
    } catch (cause) {
      // half a game is worse than none: a stage and an interface with nothing
      // behind them would sit on the page reading as a game that had started
      hud.destroy()
      stage.dispose()
      throw cause
    }

    // a save that came back into a city written again since it was made says
    // what it kept and what it lost, by name
    const rebuilt = restored ? resumeNotice(bundle, restored.report) : undefined
    if (rebuilt) hud.announce(rebuilt)

    if (options.cars) {
      await game.#street.openRoads(options.cars, game.#city.root, game.#body.position)
      const roads = game.#street.roads
      if (roads) {
        game.#garage.open(roads.bodies)
        game.#driving.open(game.#garage.over(roads.traffic), roads.bodies)
      }
    }
    // the player's own source may take a moment or never come up, so the city
    // is not held for it: every room built after it plays gets it, and the one
    // they are standing in when it does gets it there and then
    if (screens) void screens.open().then((playing) => void (playing && game && game.#buildings.dressScreens()))
    stage.start((seconds) => game!.frame(seconds))
    return game
  }

  /**
   * Stand the city still, and set it going again. Nothing steps while the
   * player is at the front door: no clock, no crowd, no traffic and nothing
   * streamed in or out, so a city nobody is looking at costs nothing to leave
   * standing. What was drawn last stays drawn.
   */
  pause(on: boolean): void {
    this.#paused = on
  }

  frame(seconds: number): boolean | void {
    if (this.#paused) {
      this.#chart.update(seconds)
      return false
    }
    // a ride lands under the veil, so the frame that dresses a neighbourhood
    // the city has never drawn is the one nobody sees
    this.#travel.update()
    const clock = this.#player.clock
    clock.advance(seconds)
    this.#report.tick()
    this.#keepTheClock(seconds)
    this.#sky.follow(seconds, clock, this.#buildings.outdoors, this.#city)
    this.#street.setTime(clock)
    // what the city draws round the player: the lights go to the nearest
    // emitters, the buildings that came near are dressed and the ones that
    // went far fall back to their shells, and a room nobody is near is let go.
    // Indoors that point is the door they came in by, so the street outside
    // stays dressed and lit and the room stays built
    const near = this.#buildings.cityPosition()
    this.#city.follow(near.x, near.z, seconds)

    this.#body.update(seconds)
    this.#driving.update(seconds)
    // the camera last, so driving is seen from behind the car: the seat has
    // just put the eye at the windscreen and the chase view moves it back
    this.#chase.follow()
    // the street only carries on while the player is out in it
    if (this.#buildings.outdoors) {
      this.#street.update(seconds, this.#body.position)
      this.#escorts.update()
    }
    // whoever is being talked to keeps facing the player, indoors and out, and
    // before the cast runs so the head turn lands on this frame's pose
    this.#attending.update(seconds)
    this.#cast?.update(seconds)

    this.#chart.update(seconds)
    this.#compass.update(seconds)
    this.#minimap.update(seconds)
    this.#target = pick(this.#body.position, this.#body.heading, this.#targeting.list(this.#body.position))
    this.#offer(this.#talking.active || !this.#target ? null : this.#target.label)
  }

  /**
   * What the key would act on, put in front of the player. The interface is
   * pushed only when the words change: it is the same line for as long as they
   * stand in front of the same door, and a patch a frame is a patch for nothing.
   */
  #offer(label: string | null): void {
    if (label === this.#prompted) return
    this.#prompted = label
    this.#hud.show({ prompt: label ? { key: 'E', text: label } : null })
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

  /** A word for the player from outside the game: a busy model, a city that moved. */
  announce(notice: Notice): void {
    this.#hud.announce(notice)
  }

  /**
   * Hand the keyboard and the pointer to something else on the page, and take
   * them back. The city carries on either way.
   */
  handOverKeys(away: boolean): void {
    this.#intents.handOver(away)
  }

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

  /** Write the playthrough down now, whatever it is doing. */
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
        .list(this.#body.position, LOOK_RANGE)
        .map((target) => ({ label: target.label, away: Math.hypot(target.at.x - this.#body.position.x, target.at.z - this.#body.position.z) }))
        .toSorted((a, b) => a.away - b.away)
        .slice(0, 3),
    }
  }

  /** Take the game off the page: every listener, every timer, the renderer. */
  dispose(): void {
    this.keep()
    this.#screens?.close()
    this.#interaction.dispose()
    this.#view.dispose()
    this.#body.dispose()
    this.#hud.destroy()
    this.#stage.dispose()
  }
}
