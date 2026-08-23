import type { Hud } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { Sidecar } from '@gb/sidecar'
import { Conversation, type ActionName, type TalkEvent, type TalkMove } from '@gb/talk'
import type { World } from '@gb/world'
import type { Attending } from './attending.ts'
import type { Player } from './player.ts'
import type { Reporting } from './reporting.ts'

/**
 * What the player reads once the speaker has actually done something. It is
 * announced rather than written into the conversation panel, because the panel
 * keeps every line it is given for as long as the conversation lasts, and "gave
 * you a job" sitting under the next reply reads as a second job.
 */
const DONE: Record<ActionName, string> = {
  give_quest: 'gave you a job',
  take_delivery: 'took what you were carrying',
  hand_over: 'handed something over',
  follow_player: 'is coming with you',
  stop_following: 'is staying here',
  end_talk: 'said goodbye',
}

/**
 * Talking to somebody: open the conversation, put the moves they will allow on
 * screen, stream the reply into the panel, and let the game have its keys back
 * when it ends. Every word and every action is decided in `@gb/talk`; this only
 * carries them to the screen and carries the player's answer back, whether they
 * typed it or clicked it.
 */
export class Talking {
  #world: World
  #log: QuestLog
  #player: PlayerState
  #sidecar: Sidecar
  #hud: Hud
  #body: Player
  #attending: Attending
  #report: Reporting
  #open: Conversation | undefined
  #speaker = 'Someone'

  constructor(input: {
    world: World
    log: QuestLog
    player: PlayerState
    sidecar: Sidecar
    hud: Hud
    body: Player
    attending: Attending
    report: Reporting
  }) {
    this.#world = input.world
    this.#log = input.log
    this.#player = input.player
    this.#sidecar = input.sidecar
    this.#hud = input.hud
    this.#body = input.body
    this.#attending = input.attending
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

    const conversation = opened.value.conversation
    this.#open = conversation
    this.#speaker = this.#world.npc(npcId)?.name ?? 'Someone'
    this.#attending.hold(npcId)
    this.#report.report({ ok: true, value: opened.value.changes })
    this.#hud.show({ talk: { speaker: this.#speaker, moves: this.#menu(conversation) } })
  }

  /** Send a line to whoever the player is talking to and play back the reply. */
  async say(text: string): Promise<void> {
    const conversation = this.#open
    if (!conversation) return
    await this.#turn(conversation, conversation.say(text))
  }

  /**
   * Take a move the player clicked instead of typing. It costs no model call:
   * `@gb/talk` checks it is still legal, speaks the line the quest data already
   * holds, and carries it out.
   */
  async choose(key: string): Promise<void> {
    const conversation = this.#open
    if (!conversation) return
    await this.#turn(conversation, conversation.choose(key))
  }

  end(): void {
    if (this.#open) this.#attending.release()
    this.#open = undefined
    this.#hud.show({ talk: null })
    this.#body.setTyping(false)
  }

  /** One turn, however the player gave it: the reply, then the next menu. */
  async #turn(conversation: Conversation, stream: AsyncGenerator<TalkEvent>): Promise<void> {
    this.#hud.show({ talk: { reply: '' } })
    for await (const event of stream) {
      // walking away has to be enough to stop a model that is still thinking.
      // Breaking out of the stream is what releases the call.
      if (this.#open !== conversation) break
      if (event.kind === 'said') this.#hud.show({ talk: { replyChunk: event.text } })
      if (event.kind === 'did') this.#report.note(`${this.#speaker} ${DONE[event.action]}`)
      if (event.kind === 'changed') this.#report.announce(event.change)
      if (event.kind === 'over') this.end()
    }
    this.#report.refresh()
    // Every turn ends by publishing the menu again, even an empty one: that is
    // what tells the interface the turn is over and its buttons are live.
    if (this.#open === conversation) this.#hud.show({ talk: { moves: this.#menu(conversation) } })
  }

  /**
   * What the player can do without saying a word. Walking away is left off: the
   * conversation already ends two ways they can see, the button that prints Esc
   * and the key itself, so a menu whose one entry is "Say goodbye" would be a
   * row of noise on every idle chat.
   */
  #menu(conversation: Conversation): readonly TalkMove[] {
    return conversation.moves().filter((move) => move.action !== 'end_talk')
  }
}
