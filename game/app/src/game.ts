import type { OpenedBundle } from '@gb/bundle'
import type { Cast } from '@gb/cast'
import { Crowd, SceneCast } from '@gb/crowd'
import { Hud, type Carried, type HudIntent, type JournalQuest } from '@gb/hud'
import { CityNav } from '@gb/nav'
import { PlayerState } from '@gb/play'
import { QuestLog, type Change } from '@gb/quest'
import { buildCity, buildInterior, type CityBuild, type Dressing, type InteriorBuild } from '@gb/scene'
import { Sidecar } from '@gb/sidecar'
import { CarPack, Traffic } from '@gb/traffic'
import { Conversation } from '@gb/talk'
import type { Interior, World } from '@gb/world'
import * as THREE from 'three'
import { Player } from './player.ts'
import { createStage, type Stage } from './renderer.ts'
import { citySolid, interiorSolid } from './solids.ts'
import { pick, type Target } from './targets.ts'

type Place = { kind: 'city' } | { kind: 'interior'; interior: Interior; plotId: string }

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
    this.#body = new Player(this.#stage.camera, this.#stage.renderer.domElement, citySolid(this.#world))
    this.#body.placeAt(this.#city.spawn.x, this.#city.spawn.z, this.#city.spawn.heading)

    if (this.#cast) {
      const walkers = new THREE.Group()
      walkers.name = 'crowd'
      this.#city.root.add(walkers)
      this.#crowd = Crowd.create({
        world: this.#world,
        nav: CityNav.from(this.#world),
        cast: new SceneCast(this.#cast, walkers),
      })
    }

    document.addEventListener('keydown', this.#key)
    this.#refresh()
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
      const made = Traffic.fromWorld(this.#world, { bodies })
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

  /** What the player did in the interface. */
  intent(intent: HudIntent): void {
    if (intent.kind === 'say') void this.say(intent.text)
    if (intent.kind === 'typing') this.#body.setTyping(intent.typing)
    if (intent.kind === 'talk-closed') this.#endTalk()
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
    if (event.key === 'Escape' && this.#talking) {
      this.#endTalk()
      return
    }
    if (event.code !== 'KeyE' || this.#hud.typing || this.#talking || !this.#target) return
    this.#act(this.#target)
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
    this.#body.setSolid(interiorSolid(interior))
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
    this.#body.setSolid(citySolid(this.#world))
    if (doorstep) this.#body.placeAt(doorstep.x, doorstep.z)
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
