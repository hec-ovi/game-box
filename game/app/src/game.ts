import type { OpenedBundle } from '@gb/bundle'
import type { Cast } from '@gb/cast'
import { Crowd, SceneCast } from '@gb/crowd'
import { Hud, type Carried, type HudIntent, type JournalQuest } from '@gb/hud'
import { buildLand, type Land } from '@gb/land'
import { CityNav } from '@gb/nav'
import { PlayerState } from '@gb/play'
import { QuestLog, type Change } from '@gb/quest'
import { buildCity, buildInterior, type CityBuild, type Dressing, type InteriorBuild } from '@gb/scene'
import { Sidecar } from '@gb/sidecar'
import { CarPack, Traffic } from '@gb/traffic'
import { Conversation } from '@gb/talk'
import { METRICS, type Interior, type World } from '@gb/world'
import * as THREE from 'three'
import { alsoBlockedBy, PERSON_CLEAR } from './bodies.ts'
import { Player } from './player.ts'
import { createStage, type Stage } from './renderer.ts'
import { cityGround, citySolid, interiorSolid } from './solids.ts'
import { spikeGlb } from './spike-glb.ts'
import { pick, type Target } from './targets.ts'

type Place = { kind: 'city' } | { kind: 'interior'; interior: Interior; plotId: string }

/** What the game binds, for the interface to list where the player can read it. */
const CONTROLS = [
  { keys: ['W', 'A', 'S', 'D'], text: 'Walk', group: 'Move' },
  { keys: ['Shift'], text: 'Run', group: 'Move' },
  { keys: ['C'], text: 'Crouch', group: 'Move' },
  { keys: ['Space'], text: 'Jump', group: 'Move' },
  { keys: ['Mouse'], text: 'Look around', group: 'Move' },
  { keys: ['Right mouse'], text: 'Look closer', group: 'Move' },
  { keys: ['E'], text: 'Go in, talk to someone, take a thing', group: 'World' },
] as const

/**
 * The game itself: a city you walk around, buildings you go into, people you
 * talk to, things you carry from one to another. Everything it knows how to do
 * belongs to a box; this wires them to a screen.
 */
export class Game {
  #world: World
  #log: QuestLog
  #player: PlayerState
  #sidecar: Sidecar
  #stage: Stage
  #hud: Hud
  #body: Player
  #city: CityBuild
  #interiors = new Map<string, InteriorBuild>()
  #place: Place = { kind: 'city' }
  #talking: Conversation | undefined
  #target: Target | undefined
  #dressing: Dressing
  #cast: Cast | undefined
  #crowd: Crowd | undefined
  #traffic: Traffic | undefined
  #land: Land | undefined
  #weather: string | undefined
  #cars: CarPack | undefined

  private constructor(input: {
    bundle: OpenedBundle
    stage: Stage
    hud: Hud
    player: PlayerState
    log: QuestLog
    sidecar: Sidecar
    dressing: Dressing
    cast?: Cast
  }) {
    this.#world = input.bundle.world
    this.#log = input.log
    this.#player = input.player
    this.#sidecar = input.sidecar
    this.#stage = input.stage
    this.#hud = input.hud
    this.#dressing = input.dressing
    this.#cast = input.cast

    this.#city = buildCity(this.#world, this.#dressing)
    this.#stage.show(this.#city.root)
    this.#openTheHorizon()
    spikeGlb(this.#city.root, this.#city.spawn, new URLSearchParams(location.search).get('glb'))

    this.#body = new Player(this.#stage.camera, this.#stage.renderer.domElement, this.#outdoors())
    this.#body.setGround(cityGround(this.#world, this.#land))
    this.#body.placeAt(this.#city.spawn.x, this.#city.spawn.z, this.#city.spawn.heading)

    if (this.#cast) {
      const walkers = new THREE.Group()
      walkers.name = 'crowd'
      this.#city.root.add(walkers)
      this.#crowd = Crowd.create({
        world: this.#world,
        nav: CityNav.from(this.#world),
        cast: new SceneCast(this.#cast, walkers),
        hazards: this.#trafficOnTheRoad(),
      })
    }

    document.addEventListener('keydown', this.#key)
    this.#stage.renderer.domElement.addEventListener('mousedown', this.#click)
    this.#hud.show({ controls: CONTROLS })
    this.#refresh()
  }

  /**
   * What a pedestrian has to look out for before stepping off the kerb. A car
   * that has already stopped is not coming, which is what keeps a car and a
   * pedestrian from deferring to each other forever.
   */
  #trafficOnTheRoad() {
    return {
      near: (x: number, z: number, radius: number) => {
        const reach = radius * radius
        return (this.#traffic?.cars() ?? [])
          .filter((car) => (car.x - x) ** 2 + (car.z - z) ** 2 <= reach)
          .map((car) => ({
            x: car.x,
            z: car.z,
            vx: -Math.sin(car.heading) * car.speed,
            vz: -Math.cos(car.heading) * car.speed,
            radius: METRICS.vehicle.carLength / 2,
          }))
      },
    }
  }

  /**
   * Who a driver has to stop for: the people on the pavement and the road, and
   * the player, who is the one most likely to step out without looking.
   */
  #peopleOnTheRoad() {
    return {
      near: (centre: { x: number; z: number }, radius: number) => {
        const found: Array<{ x: number; z: number; radius: number }> = []
        const reach = radius * radius
        const consider = (x: number, z: number) => {
          const dx = x - centre.x
          const dz = z - centre.z
          if (dx * dx + dz * dz <= reach) found.push({ x, z, radius: PERSON_CLEAR })
        }
        for (const walker of this.#crowd?.walkers() ?? []) consider(walker.x, walker.z)
        for (const companion of this.#crowd?.following() ?? []) consider(companion.x, companion.z)
        if (this.#place.kind === 'city') consider(this.#body.position.x, this.#body.position.z)
        return found
      },
    }
  }

  /** The street: its walls, and whoever is walking or driving on it. */
  #outdoors() {
    return alsoBlockedBy(
      citySolid(this.#world, this.#land),
      () => this.#crowd?.walkers() ?? [],
      () => this.#traffic?.cars() ?? [],
    )
  }

  /** Companions waited outside; put them back beside the door the player came out of. */
  #regroup(at: { x: number; z: number }): void {
    if (!this.#crowd) return
    for (const npcId of this.#player.companions()) {
      const npc = this.#world.npc(npcId)
      if (!npc) continue
      this.#crowd.stopFollowing(npcId)
      this.#crowd.follow({ npc, at })
    }
  }

  /** The people standing about in the room the player is in. */
  #peopleInHere(): readonly { x: number; z: number }[] {
    if (this.#place.kind !== 'interior') return []
    const built = this.#interiors.get(this.#place.interior.id)
    return [...(built?.people.values() ?? [])].map((body) => ({ x: body.position.x, z: body.position.z }))
  }

  /**
   * Sky, hills, water and trees around the town. The landscape brings its own
   * light, so the plain daylight only comes out if there is no landscape.
   */
  #openTheHorizon(): void {
    const built = buildLand(this.#world)
    if (!built.ok) {
      console.warn(`no landscape (${built.error.code}); plain daylight instead`)
      this.#stage.plainDaylight()
      return
    }

    this.#land = built.value
    this.#stage.scene.add(this.#land.root)
    this.#stage.scene.fog = this.#land.fog
    this.#stage.camera.far = this.#land.cameraFar
    this.#stage.camera.updateProjectionMatrix()
    // the city's ring of blocks was standing in for hills; now there are hills
    const blocks = this.#city.root.getObjectByName('mountains')
    if (blocks) blocks.visible = false
  }

  /**
   * Put cars on the roads. Separate from the constructor because the models
   * have to be parsed, and a city with no cars is still a city.
   */
  async openRoads(cars: ArrayBuffer): Promise<void> {
    const parked = new THREE.Group()
    parked.name = 'traffic'
    this.#city.root.add(parked)

    try {
      const bodies = await CarPack.parse(cars, parked)
      const made = Traffic.fromWorld(this.#world, { bodies, obstacles: this.#peopleOnTheRoad() })
      if (!made.ok) {
        console.warn(`no traffic (${made.error.code}); the roads stay empty`)
        return
      }
      made.value.populate(this.#body.position)
      this.#traffic = made.value
      this.#cars = bodies
    } catch (cause) {
      console.warn(`no cars (${String(cause)}); the roads stay empty`)
    }
  }

  static async start(
    mount: HTMLElement,
    bundle: OpenedBundle,
    options: { sidecar?: Sidecar; dressing: Dressing; cast?: Cast; cars?: ArrayBuffer },
  ): Promise<Game> {
    const stage = await createStage(mount)
    const player = PlayerState.create(bundle.world.id, 5)
    const log = QuestLog.create(bundle.quests, player)

    let game: Game | undefined
    const hud = new Hud(mount, { onIntent: (intent) => game?.intent(intent) })
    game = new Game({
      bundle,
      stage,
      hud,
      player,
      log,
      sidecar: options.sidecar ?? new Sidecar(),
      dressing: options.dressing,
      ...(options.cast ? { cast: options.cast } : {}),
    })

    if (options.cars) await game.openRoads(options.cars)
    stage.start((seconds) => game!.frame(seconds))
    return game
  }

  /**
   * Advance and draw one frame. A hidden tab suspends the frame loop, so a test
   * or a console can drive the game by hand.
   */
  tick(seconds = 1 / 60): void {
    this.frame(seconds)
    this.#stage.draw()
  }

  /** The scene as it stands, for the dev console to poke at. */
  scene(): THREE.Scene {
    return this.#stage.scene
  }

  /** Where the player is and what they could act on. For the dev console. */
  look(): Record<string, unknown> {
    return {
      place: this.#place.kind,
      at: this.#body.position,
      heading: this.#body.heading,
      target: this.#target?.label,
      walkers: this.#crowd?.count ?? 0,
      cars: this.#traffic?.count ?? 0,
      nearest: this.#targets()
        .map((t) => ({ label: t.label, away: Math.hypot(t.at.x - this.#body.position.x, t.at.z - this.#body.position.z) }))
        .toSorted((a, b) => a.away - b.away)
        .slice(0, 3),
    }
  }

  frame(seconds: number): void {
    this.#tickClock(seconds)
    this.#body.update(seconds)
    this.#cast?.update(seconds)
    // the street only carries on while the player is out in it
    if (this.#place.kind === 'city') {
      this.#crowd?.update(seconds, this.#body.position)
      this.#traffic?.update(seconds, this.#body.position)
      this.#cars?.update()
    }

    this.#target = pick(this.#body.position, this.#body.heading, this.#targets())
    const prompt = this.#talking || !this.#target ? null : { key: 'E', text: this.#target.label }
    this.#hud.show({ prompt })
  }

  /**
   * Time passes, the sky follows it, and quests on a timer hear about it. The
   * clock is game time, so a paused game cannot run a quest out.
   */
  #tickClock(seconds: number): void {
    const clock = this.#player.clock
    clock.advance(seconds)
    this.#log.handle({ kind: 'clock', seconds: clock.totalSeconds })

    if (!this.#land || this.#place.kind !== 'city') return
    this.#land.setTime(clock.hour + clock.minute / 60)
    if (clock.weather !== this.#weather) {
      this.#weather = clock.weather
      this.#land.setWeather(clock.weather)
    }
    this.#land.update(seconds, this.#stage.camera.position)
  }

  /** What the player did in the interface. */
  intent(intent: HudIntent): void {
    if (intent.kind === 'say') void this.say(intent.text)
    if (intent.kind === 'typing') this.#body.setTyping(intent.typing)
    if (intent.kind === 'talk-closed') this.#endTalk()
    // a window the player has to click needs the pointer back; walking carries on
    if ((intent.kind === 'journal' || intent.kind === 'help') && intent.open) document.exitPointerLock()
  }

  /** What the player can act on where they are standing. */
  #targets(): Target[] {
    if (this.#place.kind === 'city') {
      return this.#world.plots().flatMap((plot) => {
        const doorstep = this.#city.doorsteps.get(plot.id)
        if (!doorstep || !plot.interiorId) return []
        return [{ kind: 'enter' as const, id: plot.id, label: `Go into ${plot.name}`, at: { x: doorstep.x, z: doorstep.z } }]
      })
    }

    const built = this.#interiors.get(this.#place.interior.id)!
    const targets: Target[] = [
      { kind: 'leave', id: this.#place.plotId, label: 'Step outside', at: { x: built.entrance.x, z: built.entrance.z } },
    ]
    for (const [npcId, body] of built.people) {
      const npc = this.#world.npc(npcId)
      if (npc) targets.push({ kind: 'talk', id: npcId, label: `Talk to ${npc.name}`, at: { x: body.position.x, z: body.position.z } })
    }
    for (const [itemId, object] of built.pickups) {
      const item = this.#world.item(itemId)
      if (item && object.parent) {
        targets.push({ kind: 'take', id: itemId, label: `Take the ${item.name.toLowerCase()}`, at: { x: object.position.x, z: object.position.z } })
      }
    }
    return targets
  }

  #key = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyE' || this.#hud.typing || this.#talking || !this.#target) return
    this.#act(this.#target)
  }

  /** Clicking somebody asks them along, or tells them to stay. */
  #click = (event: MouseEvent): void => {
    if (event.button !== 0 || document.pointerLockElement === null) return
    if (this.#talking || this.#target?.kind !== 'talk') return
    this.#toggleCompanion(this.#target.id)
  }

  #toggleCompanion(npcId: string): void {
    const npc = this.#world.npc(npcId)
    if (!npc || !this.#crowd) return

    if (this.#player.isCompanion(npcId)) {
      this.#player.removeCompanion(npcId)
      this.#crowd.stopFollowing(npcId)
      this.#showIndoors(npcId, true)
      this.#hud.announce({ kind: 'note', text: `${npc.name} stays here` })
      return
    }

    this.#player.addCompanion(npcId)
    this.#crowd.follow({ npc, at: this.#body.position })
    // they have left their post to come with you
    this.#showIndoors(npcId, false)
    this.#hud.announce({ kind: 'note', text: `${npc.name} comes with you` })
  }

  /** An NPC who is walking with the player is not also standing at their anchor. */
  #showIndoors(npcId: string, visible: boolean): void {
    for (const built of this.#interiors.values()) {
      const body = built.people.get(npcId)
      if (body) body.visible = visible
    }
  }

  #act(target: Target): void {
    switch (target.kind) {
      case 'enter':
        this.#enter(target.id)
        break
      case 'leave':
        this.#leave()
        break
      case 'talk':
        void this.#startTalk(target.id)
        break
      case 'take':
        this.#take(target.id)
        break
    }
  }

  #enter(plotId: string): void {
    const plot = this.#world.plot(plotId)
    const interior = plot?.interiorId ? this.#world.interior(plot.interiorId) : undefined
    if (!interior) return

    let built = this.#interiors.get(interior.id)
    if (!built) {
      built = buildInterior(this.#world, interior, this.#dressing)
      this.#interiors.set(interior.id, built)
    }

    this.#place = { kind: 'interior', interior, plotId }
    this.#stage.show(built.root)
    this.#stage.indoors(true)
    if (this.#land) this.#land.root.visible = false
    this.#body.setSolid(alsoBlockedBy(interiorSolid(interior), () => this.#peopleInHere()))
    this.#body.setGround(() => 0)
    const step = 1.2
    this.#body.placeAt(
      built.entrance.x + built.inward.x * step,
      built.entrance.z + built.inward.z * step,
      Math.atan2(-built.inward.x, -built.inward.z),
    )
    this.#hud.announce({ kind: 'note', text: plot!.name })
    this.#report(this.#log.handle({ kind: 'arrived', place: { plotId } }))
    this.#report(this.#log.handle({ kind: 'arrived', place: { interiorId: interior.id } }))
  }

  #leave(): void {
    if (this.#place.kind !== 'interior') return
    const doorstep = this.#city.doorsteps.get(this.#place.plotId)
    this.#place = { kind: 'city' }
    this.#stage.show(this.#city.root)
    this.#stage.indoors(false)
    if (this.#land) this.#land.root.visible = true
    this.#body.setSolid(this.#outdoors())
    this.#body.setGround(cityGround(this.#world, this.#land))
    if (doorstep) {
      this.#body.placeAt(doorstep.x, doorstep.z)
      this.#regroup({ x: doorstep.x, z: doorstep.z })
    }
  }

  #take(itemId: string): void {
    const item = this.#world.item(itemId)
    if (!item || this.#place.kind !== 'interior') return

    const built = this.#interiors.get(this.#place.interior.id)!
    built.pickups.get(itemId)?.removeFromParent()

    const stolen = item.ownerNpcId !== undefined
    this.#player.take(itemId, { stolen })
    this.#hud.announce({ kind: 'item-taken', item: item.name })
    this.#report(this.#log.handle({ kind: 'acquired', itemId, stolen }))
  }

  async #startTalk(npcId: string): Promise<void> {
    const opened = Conversation.open({
      world: this.#world,
      log: this.#log,
      player: this.#player,
      sidecar: this.#sidecar,
      npcId,
    })
    if (!opened.ok) return

    this.#talking = opened.value.conversation
    this.#faceMe(npcId, true)
    this.#report({ ok: true, value: opened.value.changes })
    this.#hud.show({ talk: { speaker: this.#world.npc(npcId)?.name ?? 'Someone' } })
  }

  /** Send a line to whoever the player is talking to and play back the reply. */
  async say(text: string): Promise<void> {
    const conversation = this.#talking
    if (!conversation) return

    this.#hud.show({ talk: { reply: '' } })
    for await (const event of conversation.say(text)) {
      if (event.kind === 'said') this.#hud.show({ talk: { replyChunk: event.text } })
      if (event.kind === 'did') this.#hud.show({ talk: { acted: event.action.replace(/_/g, ' ') } })
      if (event.kind === 'changed') this.#announce(event.change)
      if (event.kind === 'over') this.#endTalk()
    }
    this.#refresh()
  }

  #endTalk(): void {
    if (this.#talking) this.#faceMe(this.#talking.npcId, false)
    this.#talking = undefined
    this.#hud.show({ talk: null })
    this.#body.setTyping(false)
  }

  /** Somebody being spoken to turns their head to whoever is speaking. */
  #faceMe(npcId: string, towards: boolean): void {
    const members = (this.#dressing as { members?: () => ReadonlyMap<string, { lookAt(p: THREE.Vector3): void; lookAway(): void }> }).members?.()
    const member = members?.get(npcId)
    if (!member) return
    if (towards) member.lookAt(this.#stage.camera.position)
    else member.lookAway()
  }

  #report(result: { ok: true; value: readonly Change[] } | { ok: false; error: unknown }): void {
    if (!result.ok) return
    for (const change of result.value) this.#announce(change)
    this.#refresh()
  }

  #announce(change: Change): void {
    const title = (id: string) => this.#log.quests().find((q) => q.id === id)?.title ?? 'a job'
    if (change.kind === 'quest-started') this.#hud.announce({ kind: 'quest-started', title: title(change.questId) })
    if (change.kind === 'quest-complete') {
      this.#hud.announce({ kind: 'quest-complete', title: title(change.questId), reward: { money: change.reward.money } })
    }
    if (change.kind === 'quest-failed') this.#hud.announce({ kind: 'quest-failed', title: title(change.questId) })
    this.#refresh()
  }

  #refresh(): void {
    const carrying: Carried[] = this.#player.inventory().map((id) => ({
      id,
      name: this.#world.item(id)?.name ?? id,
      quest: this.#log.isQuestItem(id),
    }))
    this.#hud.show({ objectives: this.#log.objectives(), money: this.#player.money, carrying, journal: this.#journal() })
  }

  /** Every quest under way, with the steps behind and ahead of the player. */
  #journal(): JournalQuest[] {
    const open = new Set(this.#log.objectives().map((objective) => objective.stepId))
    return this.#log
      .quests()
      .filter((quest) => this.#log.status(quest.id) === 'active')
      .map((quest) => ({
        questId: quest.id,
        title: quest.title,
        steps: quest.steps
          .filter((step) => step.kind !== 'complete' && step.kind !== 'fail' && step.kind !== 'join')
          .map((step) => ({ stepId: step.id, text: step.objective, done: !open.has(step.id) })),
      }))
  }
}
