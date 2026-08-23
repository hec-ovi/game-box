import type { Hud } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { Dressing } from '@gb/scene'
import type { Sidecar } from '@gb/sidecar'
import { Conversation } from '@gb/talk'
import type { World } from '@gb/world'
import type * as THREE from 'three'
import type { Player } from './player.ts'
import type { Reporting } from './reporting.ts'

/** Somebody the art pack can turn to face whoever is speaking. */
interface Facing {
  lookAt(point: THREE.Vector3): void
  lookAway(): void
}

/**
 * Talking to somebody: open the conversation, stream the reply into the panel,
 * and let the game have its keys back when it ends. Every word and every action
 * is decided in `@gb/talk`; this only carries them to the screen.
 */
export class Talking {
  #world: World
  #log: QuestLog
  #player: PlayerState
  #sidecar: Sidecar
  #hud: Hud
  #body: Player
  #dressing: Dressing
  #camera: THREE.Camera
  #report: Reporting
  #open: Conversation | undefined

  constructor(input: {
    world: World
    log: QuestLog
    player: PlayerState
    sidecar: Sidecar
    hud: Hud
    body: Player
    dressing: Dressing
    camera: THREE.Camera
    report: Reporting
  }) {
    this.#world = input.world
    this.#log = input.log
    this.#player = input.player
    this.#sidecar = input.sidecar
    this.#hud = input.hud
    this.#body = input.body
    this.#dressing = input.dressing
    this.#camera = input.camera
    this.#report = input.report
  }

  get active(): boolean {
    return this.#open !== undefined
  }

  async start(npcId: string): Promise<void> {
    const opened = Conversation.open({
      world: this.#world,
      log: this.#log,
      player: this.#player,
      sidecar: this.#sidecar,
      npcId,
    })
    if (!opened.ok) return

    this.#open = opened.value.conversation
    this.#face(npcId, true)
    this.#report.report({ ok: true, value: opened.value.changes })
    this.#hud.show({ talk: { speaker: this.#world.npc(npcId)?.name ?? 'Someone' } })
  }

  /** Send a line to whoever the player is talking to and play back the reply. */
  async say(text: string): Promise<void> {
    const conversation = this.#open
    if (!conversation) return

    this.#hud.show({ talk: { reply: '' } })
    for await (const event of conversation.say(text)) {
      // walking away has to be enough to stop a model that is still thinking.
      // Breaking out of the stream is what releases the call.
      if (this.#open !== conversation) break
      if (event.kind === 'said') this.#hud.show({ talk: { replyChunk: event.text } })
      if (event.kind === 'did') this.#hud.show({ talk: { acted: event.action.replace(/_/g, ' ') } })
      if (event.kind === 'changed') this.#report.announce(event.change)
      if (event.kind === 'over') this.end()
    }
    this.#report.refresh()
  }

  end(): void {
    if (this.#open) this.#face(this.#open.npcId, false)
    this.#open = undefined
    this.#hud.show({ talk: null })
    this.#body.setTyping(false)
  }

  /** Somebody being spoken to turns their head to whoever is speaking. */
  #face(npcId: string, towards: boolean): void {
    const members = (this.#dressing as { members?: () => ReadonlyMap<string, Facing> }).members?.()
    const member = members?.get(npcId)
    if (!member) return
    if (towards) member.lookAt(this.#camera.position)
    else member.lookAway()
  }
}
