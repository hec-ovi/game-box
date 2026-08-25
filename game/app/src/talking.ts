import type { Hud, TalkTurn } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { Sidecar } from '@gb/sidecar'
import { Conversation, Sessions, type ActionName, type TalkEvent, type TalkMove, type Turn } from '@gb/talk'
import type { World } from '@gb/world'
import type { Attending } from './attending.ts'
import type { Gestures } from './gestures.ts'
import type { Player } from './player.ts'
import type { Reporting } from './reporting.ts'

/**
 * What the speaker did, as stage direction on their turn, for a turn whose
 * words came with no direction of their own: a move picked with no model
 * running says what it says and does nothing on the body, and the line the
 * player reads is what actually happened.
 */
const DONE: Record<ActionName, string> = {
  give_quest: 'gives you a job',
  ask_about: 'tells you what they know',
  take_delivery: 'takes what you were carrying',
  hand_over: 'hands something over',
  follow_player: 'comes with you',
  stop_following: 'stays here',
  end_talk: 'says goodbye',
}

/**
 * Talking to somebody: open the conversation, put the transcript and the moves
 * they will allow on screen, stream the reply into the panel with what they do
 * apart from what they say, and let the game have its keys back when it ends.
 * Every word and every action is decided in `@gb/talk`; this only carries them
 * to the screen and carries the player's answer back, whether they typed it
 * or clicked it. One `Sessions` for the playthrough, so walking back up to
 * somebody carries on where the two of them left off.
 */
export class Talking {
  #world: World
  #log: QuestLog
  #player: PlayerState
  #sidecar: Sidecar
  #hud: Hud
  #body: Player
  #attending: Attending
  #gestures: Gestures | undefined
  #report: Reporting
  #sessions = new Sessions()
  #open: Conversation | undefined
  #speakerId = ''

  constructor(input: {
    world: World
    log: QuestLog
    player: PlayerState
    sidecar: Sidecar
    hud: Hud
    body: Player
    attending: Attending
    /** Without an art pack there is nobody to move, and the conversation is the same. */
    gestures?: Gestures
    report: Reporting
  }) {
    this.#world = input.world
    this.#log = input.log
    this.#player = input.player
    this.#sidecar = input.sidecar
    this.#hud = input.hud
    this.#body = input.body
    this.#attending = input.attending
    this.#gestures = input.gestures
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
      sessions: this.#sessions,
    })
    if (!opened.ok) return

    const conversation = opened.value.conversation
    this.#open = conversation
    this.#speakerId = npcId
    this.#attending.hold(npcId)
    // meeting them is what the codex earns first, and the person goes in it
    this.#report.report({ ok: true, value: opened.value.changes })
    // they speak first: the opening line is built off the game's own data and
    // costs no model call, and it is already the last turn of the transcript,
    // so the panel has the whole history in it the instant it appears
    this.#hud.show({
      talk: {
        speaker: this.#world.npc(npcId)?.name ?? 'Someone',
        turns: conversation.history().map(turnOf),
        moves: this.#clickable(opened.value.opening.moves),
      },
    })
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
    this.#gestures?.stop()
    this.#open = undefined
    this.#hud.show({ talk: null })
    this.#body.setTyping(false)
  }

  /** One turn, however the player gave it: the reply, then the next menu. */
  async #turn(conversation: Conversation, stream: AsyncGenerator<TalkEvent>): Promise<void> {
    // a fresh turn opens with nothing said: the speaker's turn on the panel
    // starts empty and what they do this turn goes on it when it arrives
    this.#hud.show({ talk: { reply: '' } })
    let directed = false
    for await (const event of stream) {
      // walking away has to be enough to stop a model that is still thinking.
      // Breaking out of the stream is what releases the call.
      if (this.#open !== conversation) break
      if (event.kind === 'turn') {
        // the body first, then the words: what they do is stage direction on
        // the turn, never read as dialogue
        directed = event.does !== undefined
        this.#hud.show({ talk: { does: event.does ?? null, replyChunk: event.says } })
        // their hands go while the words are arriving, and stop with them; a
        // direction that reads as a nod or a shake is played as one, and any
        // other is words alone, because the model never names a clip
        this.#gestures?.start(this.#speakerId)
        if (event.does) this.#gestures?.direct(this.#speakerId, event.does)
      }
      // how their reply came down, on most turns not at all. It arrives with
      // the action, so it lands over the talking hands rather than under them
      if (event.kind === 'answered') this.#gestures?.answer(this.#speakerId, event.answer)
      if (event.kind === 'did' && !directed) this.#hud.show({ talk: { does: DONE[event.action] } })
      // a fact about themselves let slip: the codex has a line more
      if (event.kind === 'learned') this.#report.refresh()
      if (event.kind === 'changed') this.#report.announce(event.change)
      if (event.kind === 'over') this.end()
    }
    this.#gestures?.stop()
    this.#report.refresh()
    // Every turn ends by publishing the menu again, even an empty one: that is
    // what tells the interface the turn is over and its buttons are live.
    if (this.#open === conversation) this.#hud.show({ talk: { moves: this.#clickable(conversation.moves()) } })
  }

  /**
   * What the player can do without saying a word. Walking away is left off: the
   * conversation already ends two ways they can see, the button that prints Esc
   * and the key itself, so a menu whose one entry is "Say goodbye" would be a
   * row of noise on every idle chat.
   */
  #clickable(moves: readonly TalkMove[]): readonly TalkMove[] {
    return moves.filter((move) => move.action !== 'end_talk')
  }
}

/** A line of the transcript as the panel draws one: whose it was, what was said, and what they did saying it. */
function turnOf(turn: Turn): TalkTurn {
  return { who: turn.role === 'user' ? 'you' : 'them', says: turn.content, ...(turn.does ? { does: turn.does } : {}) }
}
