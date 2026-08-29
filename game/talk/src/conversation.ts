import { err, ok, type Result } from '@gb/kit'
import type { PlayerState } from '@gb/play'
import type { Change, QuestLog } from '@gb/quest'
import type { Sidecar } from '@gb/sidecar'
import type { World } from '@gb/world'
import { Background } from './background.ts'
import { Brief } from './brief.ts'
import { Credit } from './credit.ts'
import { Decider } from './decide.ts'
import type { Decision, Grant, Opening, TalkError, TalkEvent, Turn } from './events.ts'
import { Listener } from './listen.ts'
import { Memory } from './memory.ts'
import { legalMoves, topicOf, type ActionName, type Situation, type Where } from './moves.ts'
import { Payoffs } from './payoffs.ts'
import { Performer } from './perform.ts'
import { pickByKey, pickLabel, picks, type TalkMove } from './picks.ts'
import { Sessions, type Transcript } from './sessions.ts'
import { Speaker } from './speak.ts'

interface Input {
  world: World
  log: QuestLog
  player: PlayerState
  sidecar: Sidecar
  npcId: string
  /** Where they actually are right now. Left out, they are at the post the world file gives them. */
  where?: Where | undefined
  /** The playthrough's sessions, one transcript per person. Left out, this conversation starts from nothing. */
  sessions?: Sessions | undefined
  signal?: AbortSignal | undefined
}

/**
 * One conversation with one person, built from the world and the playthrough
 * as they stand when it opens, and holding nothing of anyone else. A turn runs
 * on two tracks: the voice, which is the person (what they do, say, let slip,
 * keep in mind, and how the turn left them) and is handed no ids and no menu;
 * and the action, a single choice from the moves that were legal when the turn
 * began, with doing nothing at the top of the list. What they can do is bounded
 * by the quest script, not by how the sentence was phrased. Nobody says
 * anything until the player does: walking up opens a menu, and the person
 * answers when spoken to. Every word an NPC says is the model's: with no model
 * to reach they say nothing, and the turn is published as silence. The action
 * side stands on its own, so the player's words still hand a job over, take a
 * delivery, raise a subject or end the conversation with nobody speaking.
 */
export class Conversation {
  #situation: Situation
  #transcript: Transcript
  #brief: Brief
  #credit: Credit
  #background: Background
  #memory: Memory
  #payoffs: Payoffs
  #speaker: Speaker
  #decider: Decider
  #listener: Listener
  #performer: Performer
  #open = true
  #signal: AbortSignal | undefined

  private constructor(input: Input) {
    this.#situation = {
      world: input.world,
      log: input.log,
      player: input.player,
      npcId: input.npcId,
      where: input.where ?? 'station',
    }
    this.#transcript = (input.sessions ?? new Sessions()).of(input.npcId)
    this.#signal = input.signal
    this.#brief = new Brief(this.#situation)
    this.#credit = new Credit(this.#situation)
    this.#background = new Background(this.#situation)
    this.#memory = new Memory(this.#situation)
    this.#payoffs = new Payoffs(this.#situation)
    this.#speaker = new Speaker(input.sidecar)
    this.#decider = new Decider(input.sidecar)
    this.#listener = new Listener(this.#situation)
    this.#performer = new Performer(this.#situation)
  }

  /**
   * Walking up to someone is itself an event: they go in the codex as met, the
   * facts that seeing them earns are earned, and a quest step that already
   * asked the player to talk to them completes here, with whatever it pays out
   * in hand. Nobody speaks: the panel opens on the moves the player can take,
   * and the person answers once they are spoken to.
   *
   * `signal` is the player's way out. It rides on every model call this
   * conversation makes, so a turn can be cut short before a word of the reply
   * arrives.
   */
  static open(
    input: Input,
  ): Result<
    { conversation: Conversation; changes: readonly Change[]; opening: Opening; learned: readonly string[]; granted: readonly Grant[] },
    TalkError
  > {
    if (!input.world.hasNpc(input.npcId)) return err({ code: 'unknown-npc', npcId: input.npcId })
    const conversation = new Conversation(input)
    input.player.discover({ npc: input.npcId })
    const learned = conversation.#background.meet()
    // Crediting first: a step that completes on the way in changes what is
    // legal, and the menu is the state the player is walking into.
    const changes = conversation.#credit.earned()
    const granted = conversation.#payoffs.landed(changes)
    return ok({ conversation, changes, opening: { moves: conversation.moves() }, learned, granted })
  }

  get npcId(): string {
    return this.#situation.npcId
  }

  get isOpen(): boolean {
    return this.#open
  }

  history(): readonly Turn[] {
    return this.#transcript.turns
  }

  /** What this NPC could do if they chose to, right now. */
  available(): readonly ActionName[] {
    return [...new Set(legalMoves(this.#situation).map((move) => move.action))]
  }

  /** The moves that are legal right now, in words the player can click. */
  moves(): readonly TalkMove[] {
    return picks(legalMoves(this.#situation))
  }

  /**
   * The player picked a move instead of typing one. The list is built again
   * here, so a move that has stopped being legal since it was drawn does
   * nothing at all and the caller reads the moves again. Nothing is asked of a
   * model, so nobody speaks: the move is carried out and what it did is the
   * whole of the turn.
   */
  async *choose(key: string): AsyncGenerator<TalkEvent> {
    const move = pickByKey(legalMoves(this.#situation), key)
    if (!move) return

    this.#transcript.push({ role: 'user', content: pickLabel(move) })
    yield* this.#act({ move })
  }

  /** Say something to them. Their turn arrives whole, their actions as they take them. */
  async *say(playerText: string): AsyncGenerator<TalkEvent> {
    if (this.#cut) return
    this.#transcript.push({ role: 'user', content: playerText })
    const moves = legalMoves(this.#situation)
    const offered = this.#background.offered()

    const taken = await this.#speaker.take({
      npcName: this.#brief.npcName,
      system: this.#brief.voice(moves, offered),
      exchange: this.#brief.exchange(this.#transcript.turns),
      facts: offered.length,
      signal: this.#signal,
    })
    // Cut short is the player's own decision, so nothing stands in for the reply.
    if (this.#cut) return
    // No reply at all is no reply. Nobody writes words for them, so the turn is
    // silence, and what the player asked for still decides what they do about it.
    if (!taken.ok || !taken.value.says) {
      yield { kind: 'silent' }
      yield* this.#act(this.#listener.decide(playerText, moves))
      return
    }

    const reply = taken.value
    yield* this.#spoken(reply.does, reply.says)
    // What they gave away and what they were told stand with the words, whatever comes of the decision.
    yield* this.#learned(this.#background.reveal(offered, reply.reveals))
    this.#memory.keep(reply.remembers, reply.mood)

    const chosen = await this.#decider.choose({
      npcName: this.#brief.npcName,
      city: this.#brief.city,
      moves,
      transcript: this.#brief.transcript(this.#transcript.turns),
      signal: this.#signal,
    })
    if (this.#cut) return
    // A call that never came back with a line off the menu (nothing running, a
    // busy model, an engine that died mid-reply, prose, a number off the menu) is
    // not a decision to do nothing: the player's own words decide, as with no model.
    yield* this.#act(chosen.ok ? chosen.value : this.#listener.decide(playerText, moves))
  }

  /** The player pulled the plug: the turn stops where it is and nothing is decided. */
  get #cut(): boolean {
    return this.#signal?.aborted === true
  }

  /** One turn out loud, into the transcript and out to the caller: the body and the words apart. */
  *#spoken(does: string | undefined, says: string): Generator<TalkEvent> {
    this.#transcript.push(does ? { role: 'assistant', content: says, does } : { role: 'assistant', content: says })
    yield does ? { kind: 'turn', does, says } : { kind: 'turn', says }
  }

  *#learned(factId: string | undefined): Generator<TalkEvent> {
    if (factId !== undefined) yield { kind: 'learned', npcId: this.#situation.npcId, factId }
  }

  /**
   * The one place both tracks come out, so a turn settles the same way whether a
   * model decided it or the player's own words did. Carrying something out is
   * itself a yes, whatever was said around it; a yes with nothing to carry out,
   * and every no, is the reply as the turn reported it.
   */
  *#act(decision: Decision): Generator<TalkEvent> {
    const done = decision.move ? this.#performer.run(decision.move) : []
    const answer = done.some((event) => event.kind === 'did') ? 'yes' : decision.answer
    if (answer) yield { kind: 'answered', answer }

    for (const event of done) {
      if (event.kind === 'did' && event.action === 'end_talk') this.#open = false
      yield event
    }
    if (decision.move) {
      // Handing the job over is what opens "go and hear them out": credit it here,
      // while the player is still stood in front of the person who said it. A
      // move that put them to a subject carries it, and credits the steps that
      // were waiting on that subject and no others.
      const credited = this.#credit.earned(topicOf(decision.move))
      for (const change of credited) yield { kind: 'changed', change }
      yield* this.#granted(done, credited)
    }
    if (!this.#open) yield { kind: 'over' }
  }

  /**
   * What the turn handed over, once each: the payoffs of every step it did and
   * every reward it paid, less any the move already published on its own.
   */
  *#granted(done: readonly TalkEvent[], credited: readonly Change[]): Generator<TalkEvent> {
    const changes = done.flatMap((event) => (event.kind === 'changed' ? [event.change] : []))
    const seen = new Set(done.filter((event) => event.kind === 'granted').map((grant) => JSON.stringify(grant)))
    for (const grant of this.#payoffs.landed([...changes, ...credited])) {
      const key = JSON.stringify(grant)
      if (seen.has(key)) continue
      seen.add(key)
      yield grant
    }
  }
}
