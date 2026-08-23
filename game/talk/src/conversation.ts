import { err, ok, type Result } from '@gb/kit'
import type { PlayerState } from '@gb/play'
import type { Change, QuestLog } from '@gb/quest'
import type { Sidecar } from '@gb/sidecar'
import type { World } from '@gb/world'
import { Brief } from './brief.ts'
import { Credit } from './credit.ts'
import { Decider } from './decide.ts'
import type { Decision, Opening, TalkError, TalkEvent, Turn } from './events.ts'
import { Greeting } from './greeting.ts'
import { legalMoves, topicOf, type ActionName, type Move, type Situation } from './moves.ts'
import { Performer } from './perform.ts'
import { pickByKey, pickLabel, picks, type TalkMove } from './picks.ts'
import { Script } from './script.ts'
import { Voice } from './voice.ts'

/**
 * One conversation with one NPC. A turn runs on two tracks: the voice, which
 * only ever speaks and is handed no ids at all, and the action, which is a
 * single choice from the moves that were legal when the turn began, with doing
 * nothing at the top of the list. What an NPC can do is bounded by the quest
 * script, not by how the sentence was phrased. The NPC speaks first, off the
 * game's own data, so there is something on screen the instant the panel opens.
 * With no sidecar to reach, both tracks run off the quest data too, and the job
 * can still be handed out, agreed to and delivered.
 */
export class Conversation {
  #situation: Situation
  #brief: Brief
  #credit: Credit
  #greeting: Greeting
  #voice: Voice
  #decider: Decider
  #script: Script
  #performer: Performer
  #history: Turn[] = []
  #open = true
  #signal: AbortSignal | undefined

  private constructor(input: {
    world: World
    log: QuestLog
    player: PlayerState
    sidecar: Sidecar
    npcId: string
    signal?: AbortSignal | undefined
  }) {
    this.#situation = { world: input.world, log: input.log, player: input.player, npcId: input.npcId }
    this.#signal = input.signal
    this.#brief = new Brief(this.#situation)
    this.#credit = new Credit(this.#situation)
    this.#greeting = new Greeting(this.#situation)
    this.#voice = new Voice(input.sidecar)
    this.#decider = new Decider(input.sidecar)
    this.#script = new Script(this.#situation)
    this.#performer = new Performer(this.#situation)
  }

  /**
   * Walking up to someone is itself an event: a quest step that already asked
   * the player to talk to them completes here, and the person speaks first.
   * The opening line and the moves that come with it are the game's own data,
   * so the panel is never empty and nothing is waited on.
   *
   * `signal` is the player's way out. It rides on every model call this
   * conversation makes, so a turn can be cut short before the first word of the
   * reply arrives.
   */
  static open(input: {
    world: World
    log: QuestLog
    player: PlayerState
    sidecar: Sidecar
    npcId: string
    signal?: AbortSignal | undefined
  }): Result<{ conversation: Conversation; changes: readonly Change[]; opening: Opening }, TalkError> {
    if (!input.world.hasNpc(input.npcId)) return err({ code: 'unknown-npc', npcId: input.npcId })
    const conversation = new Conversation(input)
    // Crediting first: a step that completes on the way in changes what is legal,
    // and the greeting is drawn from the state the player is walking into.
    const changes = conversation.#credit.earned()
    return ok({ conversation, changes, opening: conversation.#begin() })
  }

  /** They speak first, off the game's own data, and the menu opens with them. */
  #begin(): Opening {
    const moves = legalMoves(this.#situation)
    const line = this.#greeting.line(moves)
    this.#history.push({ role: 'assistant', content: line })
    return { line, moves: picks(moves) }
  }

  get npcId(): string {
    return this.#situation.npcId
  }

  get isOpen(): boolean {
    return this.#open
  }

  history(): readonly Turn[] {
    return this.#history
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

    const line = this.#script.acting(move)
    this.#history.push({ role: 'user', content: pickLabel(move) })
    this.#history.push({ role: 'assistant', content: line })
    yield { kind: 'said', text: line }
    yield* this.#act({ move })
  }

  /** Say something to them. Their reply arrives in pieces, their actions as they take them. */
  async *say(playerText: string): AsyncGenerator<TalkEvent> {
    if (this.#cut) return
    this.#history.push({ role: 'user', content: playerText })
    const moves = legalMoves(this.#situation)

    const spoken = await this.#voice.speak({
      system: this.#brief.voice(moves),
      history: this.#history,
      signal: this.#signal,
    })
    if (!spoken.ok) {
      // Cut short is the player's own decision, so nothing stands in for the reply.
      if (spoken.error.code !== 'aborted') yield* this.#unattended(playerText, moves)
      return
    }

    let line = ''
    for await (const piece of spoken.value) {
      line += piece
      yield { kind: 'said', text: piece }
    }
    if (line.trim()) this.#history.push({ role: 'assistant', content: line })
    // Cut off mid-reply: the turn ends on the words that got through, and nothing is done.
    if (this.#cut) return
    // A reply that broke off before a word of it arrived is no reply at all.
    if (!line.trim()) {
      yield* this.#unattended(playerText, moves)
      return
    }

    const chosen = await this.#decider.choose({
      npcName: this.#brief.npcName,
      city: this.#brief.city,
      moves,
      transcript: this.#brief.transcript(this.#history),
      signal: this.#signal,
    })
    if (this.#cut) return
    // A call that never came back with a line off the menu is not a decision to
    // do nothing: the player's own words decide, the way they do with no model.
    yield* this.#act(chosen.ok ? chosen.value : this.#script.decide(playerText, moves))
  }

  /** The player pulled the plug: the turn stops where it is and nothing is decided. */
  get #cut(): boolean {
    return this.#signal?.aborted === true
  }

  /** No sidecar: the quest data speaks and the player's own words decide. */
  *#unattended(playerText: string, moves: readonly Move[]): Generator<TalkEvent> {
    const scripted = this.#script.turn(playerText, moves)
    this.#history.push({ role: 'assistant', content: scripted.line })
    yield { kind: 'said', text: scripted.line }
    yield* this.#act(scripted)
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
      for (const change of this.#credit.earned(topicOf(decision.move))) yield { kind: 'changed', change }
    }
    if (!this.#open) yield { kind: 'over' }
  }
}
