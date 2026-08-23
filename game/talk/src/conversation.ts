import { err, ok, type Result } from '@gb/kit'
import type { PlayerState } from '@gb/play'
import type { Change, QuestLog } from '@gb/quest'
import type { Sidecar } from '@gb/sidecar'
import type { World } from '@gb/world'
import { Brief } from './brief.ts'
import { Decider } from './decide.ts'
import type { TalkError, TalkEvent, Turn } from './events.ts'
import { Greeting } from './greet.ts'
import { legalMoves, type ActionName, type Move, type Situation } from './moves.ts'
import { Performer } from './perform.ts'
import { Script } from './script.ts'
import { Voice } from './voice.ts'

/**
 * One conversation with one NPC. A turn runs on two tracks: the voice, which
 * only ever speaks and is handed no ids at all, and the action, which is a
 * single choice from the moves that were legal when the turn began, with doing
 * nothing at the top of the list. What an NPC can do is bounded by the quest
 * script, not by how the sentence was phrased. With no sidecar to reach, both
 * tracks run off the quest data instead, and the job can still be handed out,
 * agreed to and delivered.
 */
export class Conversation {
  #situation: Situation
  #brief: Brief
  #greeting: Greeting
  #voice: Voice
  #decider: Decider
  #script: Script
  #performer: Performer
  #history: Turn[] = []
  #open = true

  private constructor(input: { world: World; log: QuestLog; player: PlayerState; sidecar: Sidecar; npcId: string }) {
    this.#situation = { world: input.world, log: input.log, player: input.player, npcId: input.npcId }
    this.#brief = new Brief(this.#situation)
    this.#greeting = new Greeting(this.#situation)
    this.#voice = new Voice(input.sidecar)
    this.#decider = new Decider(input.sidecar)
    this.#script = new Script(this.#situation)
    this.#performer = new Performer(this.#situation)
  }

  /**
   * Walking up to someone is itself an event: a quest step that already asked
   * the player to talk to them completes here.
   */
  static open(input: {
    world: World
    log: QuestLog
    player: PlayerState
    sidecar: Sidecar
    npcId: string
  }): Result<{ conversation: Conversation; changes: readonly Change[] }, TalkError> {
    if (!input.world.hasNpc(input.npcId)) return err({ code: 'unknown-npc', npcId: input.npcId })
    const conversation = new Conversation(input)
    return ok({ conversation, changes: conversation.#greeting.credit() })
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

  /** Say something to them. Their reply arrives in pieces, their actions as they take them. */
  async *say(playerText: string): AsyncGenerator<TalkEvent> {
    this.#history.push({ role: 'user', content: playerText })
    const moves = legalMoves(this.#situation)

    const spoken = await this.#voice.speak({ system: this.#brief.voice(moves), history: this.#history })
    if (!spoken.ok) {
      yield* this.#unattended(playerText, moves)
      return
    }

    let line = ''
    for await (const piece of spoken.value) {
      line += piece
      yield { kind: 'said', text: piece }
    }
    // A reply that broke off before a word of it arrived is no reply at all.
    if (!line.trim()) {
      yield* this.#unattended(playerText, moves)
      return
    }
    this.#history.push({ role: 'assistant', content: line })

    const chosen = await this.#decider.choose({
      npcName: this.#brief.npcName,
      city: this.#brief.city,
      moves,
      transcript: this.#brief.transcript(this.#history),
    })
    const answered = chosen.ok && chosen.value.answered
    yield* this.#act(answered ? chosen.value.move : this.#script.decide(playerText, moves))
  }

  /** No sidecar: the quest data speaks and the player's own words decide. */
  *#unattended(playerText: string, moves: readonly Move[]): Generator<TalkEvent> {
    const scripted = this.#script.turn(playerText, moves)
    this.#history.push({ role: 'assistant', content: scripted.line })
    yield { kind: 'said', text: scripted.line }
    yield* this.#act(scripted.move)
  }

  *#act(move: Move | undefined): Generator<TalkEvent> {
    if (move) {
      for (const event of this.#performer.run(move)) {
        if (event.kind === 'did' && event.action === 'end_talk') this.#open = false
        yield event
      }
      // Handing the job over is what opens "go and hear them out": credit it here,
      // while the player is still stood in front of the person who said it.
      for (const change of this.#greeting.credit()) yield { kind: 'changed', change }
    }
    if (!this.#open) yield { kind: 'over' }
  }
}
