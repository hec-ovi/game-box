import type { Hud, TalkTurn } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { Sidecar } from '@gb/sidecar'
import { Conversation, Sessions, type ActionName, type Grant, type TalkEvent, type TalkMove, type Turn } from '@gb/talk'
import type { Npc, World } from '@gb/world'
import type { Attending } from './attending.ts'
import type { Gestures } from './gestures.ts'
import type { Player } from './player.ts'
import type { FaceSource } from './portraits.ts'
import type { Reporting } from './reporting.ts'

/**
 * What the speaker did, in the player's words. It is stage direction and never
 * dialogue, and it names a deed rather than a line: nobody here writes what
 * anybody said, so a move carried out with no words is what the player is told
 * happened, not what they were told.
 *
 * It reads two ways. On a turn with words, it goes on their turn where a
 * direction of their own would have gone. On a turn with none, it is the whole
 * of what the player gets, said on the interface, because a turn with no words
 * in it has no bubble to write a direction on.
 */
const DONE: Record<ActionName, string> = {
  give_quest: 'gives you a job',
  ask_about: 'hears you out',
  take_delivery: 'takes what you were carrying',
  hand_over: 'hands something over',
  follow_player: 'comes with you',
  stop_following: 'stays here',
  show_wares: 'shows you what they have',
  invite_home: 'opens their door to you',
  end_talk: 'turns back to what they were doing',
}

/** A turn on which they neither spoke nor did anything: the silence is the whole of it. */
const NOTHING = 'says nothing'

/**
 * What walking up handed over, in the player's words. Nobody has spoken yet, so
 * these lines are the only place a word, a key, a door or a page of the codex
 * is said out loud.
 */
const HANDED = {
  password: 'Password:',
  key: 'a key',
  door: 'A door is open to you.',
  learned: 'Something noted about',
} as const

/** Who the panel and the notes call them when the city gave them no name. */
const SOMEBODY = 'Someone'

/**
 * Talking to somebody: open the conversation, put the transcript and the moves
 * they will allow on screen, stream the reply into the panel with what they do
 * apart from what they say, and let the game have its keys back when it ends.
 * Every word and every action is decided in `@gb/talk`; this only carries them
 * to the screen and carries the player's answer back, whether they typed it
 * or clicked it. One `Sessions` for the playthrough, so walking back up to
 * somebody carries on where the two of them left off.
 *
 * Nobody speaks first, so walking up is a menu and whatever the walk-up itself
 * paid out. Nothing says that out loud, which is why it is announced here.
 *
 * A whole conversation can happen with nobody speaking at all: a picked move
 * costs no model call, and a typed line no model answered comes back as
 * silence. Both are turns that were taken and neither has words, so both are
 * drawn as what happened rather than as a reply on its way.
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
  #wares: (npcId: string) => void
  #granted: (grant: Grant) => void
  #over: () => void
  #sessions = new Sessions()
  #open: Conversation | undefined
  #speakerId = ''
  #speakerName = ''
  #portraits: FaceSource | undefined
  #outdoors: (npcId: string) => boolean

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
    /** They named their stock: the counter is where it is bought. */
    wares?: (npcId: string) => void
    /** A word, a key or a door changed hands. */
    granted?: (grant: Grant) => void
    /** The conversation is over, and so is anything it opened. */
    over?: () => void
    /** Where a face comes from. Without one the panel draws a silhouette. */
    portraits?: FaceSource
    /** Whether the crowd has this person out on the pavement rather than at their post. Nobody is out by default. */
    outdoors?: (npcId: string) => boolean
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
    this.#wares = input.wares ?? (() => {})
    this.#granted = input.granted ?? (() => {})
    this.#over = input.over ?? (() => {})
    this.#report = input.report
    this.#portraits = input.portraits
    this.#outdoors = input.outdoors ?? (() => false)
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
      // somebody the crowd has walked off their post is out walking, and saying
      // so is what stops a bartender stopped on a crossing talking about the
      // shelf behind a counter a street away
      ...(this.#outdoors(npcId) ? ({ where: 'street' } as const) : {}),
      sessions: this.#sessions,
    })
    if (!opened.ok) return

    const conversation = opened.value.conversation
    const npc = this.#world.npc(npcId)
    this.#open = conversation
    this.#speakerId = npcId
    this.#speakerName = npc?.name ?? SOMEBODY
    this.#attending.hold(npcId)
    // meeting them is what the codex earns first, and the person goes in it
    this.#report.report({ ok: true, value: opened.value.changes })
    // a step credited on the way in has already paid, and nobody has spoken, so
    // what changed hands and what was learned are said here. On a turn their
    // own words carry both, which is why they are announced only on the way in
    for (const grant of opened.value.granted) this.#handed(grant)
    // however many facts seeing them earned, the codex gained a page: one line
    if (opened.value.learned.length > 0) this.#report.note(`${HANDED.learned} ${this.#speakerName}`)
    // they answer when they are spoken to, so the panel opens on the transcript
    // the two of them already have and the moves the player walked into
    this.#hud.show({
      talk: {
        speaker: this.#speakerName,
        turns: conversation.history().map(turnOf),
        moves: this.#clickable(opened.value.opening.moves),
      },
    })
    // their face follows: drawing one is a body build and a render, and the
    // panel is already up. A face that arrives after the player has walked off
    // goes to nobody, which is what the check is for
    if (npc) void this.#face(npcId, npc)
  }

  /**
   * A word, a key or a door that changed hands: the inventory, the locks and
   * the routes read it, and the player is told in the same breath.
   */
  #handed(grant: Grant): void {
    this.#granted(grant)
    if ('password' in grant) this.#report.note(`${HANDED.password} ${grant.password}`)
    else if ('keyItemId' in grant) this.#hud.announce({ kind: 'item-taken', item: this.#world.item(grant.keyItemId)?.name ?? HANDED.key })
    else this.#report.note(HANDED.door)
  }

  /** Draw their face, and put it on the panel if they are still the one being talked to. */
  async #face(npcId: string, npc: Npc): Promise<void> {
    const portrait = await this.#portraits?.of(npc)
    if (portrait && this.#speakerId === npcId) this.#hud.show({ talk: { portrait } })
  }

  /**
   * Send a line to whoever the player is talking to and play back the reply. A
   * typed line does go looking for a model, so the speaker's turn is opened
   * empty and the interface draws the wait on it until the words arrive. It is
   * the one turn that is ever opened before there is anything in it, because it
   * is the one turn something is on its way to.
   */
  async say(text: string): Promise<void> {
    const conversation = this.#open
    if (!conversation) return
    this.#hud.show({ talk: { reply: '' } })
    await this.#turn(conversation, conversation.say(text))
  }

  /**
   * Take a move the player clicked instead of typing. It costs no model call:
   * `@gb/talk` checks it is still legal and carries it out, and nobody speaks
   * over it. So no turn is opened for them and nothing waits: an empty turn on
   * the panel would say an answer was coming when none ever was.
   */
  async choose(key: string): Promise<void> {
    const conversation = this.#open
    if (!conversation) return
    await this.#turn(conversation, conversation.choose(key))
  }

  end(): void {
    if (this.#open) this.#attending.release()
    this.#gestures?.release()
    this.#open = undefined
    this.#hud.show({ talk: null })
    this.#body.setTyping(false)
    // the counter they opened goes with them: it is theirs, not the room's
    this.#over()
  }

  /** One turn, however the player gave it: the reply, then the next menu. */
  async #turn(conversation: Conversation, stream: AsyncGenerator<TalkEvent>): Promise<void> {
    let spoke = false
    let directed = false
    let walkedOff = false
    let deed: string | undefined
    for await (const event of stream) {
      // walking away has to be enough to stop a model that is still thinking.
      // Breaking out of the stream is what releases the call.
      if (this.#open !== conversation) {
        walkedOff = true
        break
      }
      if (event.kind === 'turn') {
        // the body first, then the words: what they do is stage direction on
        // the turn, never read as dialogue
        spoke = true
        directed = event.does !== undefined
        this.#hud.show({ talk: { does: event.does ?? null, replyChunk: event.says } })
        // their hands go while the words are arriving and their head beats to
        // each piece of the line; a direction that reads as a nod or a shake is
        // played as one, and any other is words alone, because the model never
        // names a clip
        this.#gestures?.start(this.#speakerId)
        this.#gestures?.pulse(this.#speakerId)
        if (event.does) this.#gestures?.direct(this.#speakerId, event.does)
      }
      // no model answered, so there is nothing to draw and nothing left to wait
      // for. The turn the wait opened comes back off the transcript, which goes
      // up as `@gb/talk` holds it: the interface reads a speaker's turn with no
      // words in it as an answer on its way and draws it as three dots, and
      // dots that never resolve say a model is still writing when none is
      if (event.kind === 'silent') this.#hud.show({ talk: { turns: conversation.history().map(turnOf) } })
      // how their reply came down, on most turns not at all. It arrives with
      // the action, so it lands over the talking hands rather than under them
      if (event.kind === 'answered') this.#gestures?.answer(this.#speakerId, event.answer)
      if (event.kind === 'did') {
        // the deed is stage direction on a turn that had words and no direction
        // of its own; on a turn with no words it is held back for the note
        // below, because there is no turn of theirs on the panel to write it on
        if (spoke && !directed) this.#hud.show({ talk: { does: DONE[event.action] } })
        deed = DONE[event.action]
        // naming their stock is not selling it: the counter is where that happens
        if (event.action === 'show_wares') this.#wares(this.#speakerId)
      }
      // a word, a key or a door handed over: the inventory and the locks read
      // it, and it is the conversation that says so out loud
      if (event.kind === 'granted') this.#granted(event)
      // a fact about themselves let slip: the codex has a line more
      if (event.kind === 'learned') this.#report.refresh()
      if (event.kind === 'changed') this.#report.announce(event.change)
      if (event.kind === 'over') this.end()
    }
    this.#gestures?.stop()
    this.#report.refresh()
    // A turn with no words is not a turn with nothing in it: the move still
    // happened. With no turn of theirs on the panel to carry it, the interface
    // is where the player reads what they did, under their own name and in the
    // same channel everything else nobody says out loud goes out in. The
    // silence itself is only worth a line when it is all there was, or every
    // click of a menu would announce that nobody spoke over it.
    if (!spoke && !walkedOff) this.#report.note(`${this.#speakerName} ${deed ?? NOTHING}`)
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
