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
import { Greeting } from './greeting.ts'
import { Memory } from './memory.ts'
import { legalMoves, topicOf, type ActionName, type Move, type Situation } from './moves.ts'
import { Payoffs } from './payoffs.ts'
import { Performer } from './perform.ts'
import { pickByKey, pickLabel, picks, type TalkMove } from './picks.ts'
import { Script } from './script.ts'
import { Sessions, type Transcript } from './sessions.ts'
import { Speaker } from './speak.ts'

interface Input {
  world: World
  log: QuestLog
  player: PlayerState
  sidecar: Sidecar
  npcId: string
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
 * by the quest script, not by how the sentence was phrased. They speak first,
 * off the game's own data, so there is something on screen the instant the
 * panel opens. With no sidecar to reach, both tracks run off the quest data
 * too, and the job can still be handed out, agreed to and delivered.
 */
export class Conversation {
  #situation: Situation
  #transcript: Transcript
  #brief: Brief
  #credit: Credit
  #greeting: Greeting
  #background: Background
  #memory: Memory
  #payoffs: Payoffs
  #speaker: Speaker
  #decider: Decider
  #script: Script
  #performer: Performer
  #open = true
  #signal: AbortSignal | undefined

  private constructor(input: Input) {
    this.#situation = { world: input.world, log: input.log, player: input.player, npcId: input.npcId }
    this.#transcript = (input.sessions ?? new Sessions()).of(input.npcId)
    this.#signal = input.signal
    this.#brief = new Brief(this.#situation)
    this.#credit = new Credit(this.#situation)
    this.#greeting = new Greeting(this.#situation)
    this.#background = new Background(this.#situation)
    this.#memory = new Memory(this.#situation)
    this.#payoffs = new Payoffs(this.#situation)
    this.#speaker = new Speaker(input.sidecar)
    this.#decider = new Decider(input.sidecar)
    this.#script = new Script(this.#situation, this.#background)
    this.#performer = new Performer(this.#situation)
  }

  /**
   * Walking up to someone is itself an event: they go in the codex as met, the
   * facts that seeing them earns are earned, a quest step that already asked
   * the player to talk to them completes here, with whatever it pays out in
   * hand, and the person speaks first.
   * The opening line and the moves that come with it are the game's own data,
   * so the panel is never empty and nothing is waited on.
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
    // Crediting first: a step that completes on the way in changes what is legal,
    // and the greeting is drawn from the state the player is walking into.
    const changes = conversation.#credit.earned()
    const granted = conversation.#payoffs.landed(changes)
    return ok({ conversation, changes, opening: conversation.#begin(granted), learned, granted })
  }

  /** They speak first, off the game's own data, and the menu opens with them. */
  #begin(granted: readonly Grant[]): Opening {
    const moves = legalMoves(this.#situation)
    const line = this.#greeting.line(moves, granted)
    this.#transcript.push({ role: 'assistant', content: line })
    return { line, moves: picks(moves) }
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
   * model: the line and the move are both the game's own.
   */
  async *choose(key: string): AsyncGenerator<TalkEvent> {
    const move = pickByKey(legalMoves(this.#situation), key)
    if (!move) return

    const spoken = this.#script.acting(move)
    this.#transcript.push({ role: 'user', content: pickLabel(move) })
    yield* this.#spoken(undefined, spoken.line)
    yield* this.#learned(spoken.learned)
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
    // No reply at all is no reply: the game's own data speaks instead.
    if (!taken.ok || !taken.value.says) {
      yield* this.#unattended(playerText, moves)
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
    yield* this.#act(chosen.ok ? chosen.value : this.#script.decide(playerText, moves))
  }

  /** The player pulled the plug: the turn stops where it is and nothing is decided. */
  get #cut(): boolean {
    return this.#signal?.aborted === true
  }

  /** No sidecar: the quest data speaks and the player's own words decide. */
  *#unattended(playerText: string, moves: readonly Move[]): Generator<TalkEvent> {
    const scripted = this.#script.turn(playerText, moves)
    yield* this.#spoken(undefined, scripted.line)
    yield* this.#learned(scripted.learned)
    yield* this.#act(scripted)
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
