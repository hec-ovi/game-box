import { err, ok, type Result } from '@gb/kit'
import type { PlayerState } from '@gb/play'
import type { Change, QuestLog } from '@gb/quest'
import type { Sidecar } from '@gb/sidecar'
import type { World } from '@gb/world'
import { legalActions, type ActionName } from './actions.ts'
import { PROMPTS } from './prompts.generated.ts'

export type TalkError = { readonly code: 'unknown-npc'; readonly npcId: string }

export type TalkEvent =
  | { readonly kind: 'said'; readonly text: string }
  | { readonly kind: 'did'; readonly action: ActionName; readonly detail?: string }
  | { readonly kind: 'changed'; readonly change: Change }
  | { readonly kind: 'over' }

export interface Turn {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/**
 * One conversation with one NPC. The model writes what they say; anything they
 * do is a tool call, offered only when it is legal, with the ids it may name
 * written into the tool's own schema. What the NPC can do is therefore bounded
 * by the quest script, not by asking it nicely.
 */
export class Conversation {
  #world: World
  #log: QuestLog
  #player: PlayerState
  #sidecar: Sidecar
  #npcId: string
  #history: Turn[] = []
  #open = true

  private constructor(input: { world: World; log: QuestLog; player: PlayerState; sidecar: Sidecar; npcId: string }) {
    this.#world = input.world
    this.#log = input.log
    this.#player = input.player
    this.#sidecar = input.sidecar
    this.#npcId = input.npcId
  }

  /**
   * Walking up to someone is itself an event: a quest step that asked the
   * player to talk to them completes here.
   */
  static open(input: {
    world: World
    log: QuestLog
    player: PlayerState
    sidecar: Sidecar
    npcId: string
  }): Result<{ conversation: Conversation; changes: readonly Change[] }, TalkError> {
    if (!input.world.hasNpc(input.npcId)) return err({ code: 'unknown-npc', npcId: input.npcId })
    const greeted = input.log.handle({ kind: 'talked', npcId: input.npcId })
    return ok({
      conversation: new Conversation(input),
      changes: greeted.ok ? greeted.value : [],
    })
  }

  get npcId(): string {
    return this.#npcId
  }

  get isOpen(): boolean {
    return this.#open
  }

  history(): readonly Turn[] {
    return this.#history
  }

  /** What this NPC could do if they chose to, right now. */
  available(): readonly ActionName[] {
    return legalActions({ world: this.#world, log: this.#log, player: this.#player, npcId: this.#npcId }).map(
      (tool) => tool.name as ActionName,
    )
  }

  /** Say something to them. Their reply arrives in pieces, their actions as they take them. */
  async *say(playerText: string): AsyncGenerator<TalkEvent> {
    this.#history.push({ role: 'user', content: playerText })
    const tools = legalActions({ world: this.#world, log: this.#log, player: this.#player, npcId: this.#npcId })

    const stream = await this.#sidecar.converse({
      system: this.#system(),
      messages: this.#history,
      tools,
    })

    if (!stream.ok) {
      const line = this.#fallbackLine()
      this.#history.push({ role: 'assistant', content: line })
      yield { kind: 'said', text: line }
      yield { kind: 'over' }
      return
    }

    let spoken = ''
    for await (const event of stream.value) {
      if (event.kind === 'text') {
        spoken += event.text
        yield { kind: 'said', text: event.text }
      }
      if (event.kind === 'call') {
        for (const result of this.#perform(event.name as ActionName, event.arguments)) yield result
      }
    }
    this.#history.push({ role: 'assistant', content: spoken })
    if (!this.#open) yield { kind: 'over' }
  }

  /** Carry out one action, through the boxes that own the state it changes. */
  #perform(action: ActionName, args: unknown): TalkEvent[] {
    const value = (args ?? {}) as Record<string, string>
    const events: TalkEvent[] = []
    const record = (changes: readonly Change[]) => {
      for (const change of changes) events.push({ kind: 'changed', change })
    }

    switch (action) {
      case 'give_quest': {
        const questId = value.questId ?? ''
        if (!this.#log.offeredBy(this.#npcId).some((quest) => quest.id === questId)) return events
        const started = this.#log.start(questId)
        events.push({ kind: 'did', action, detail: questId })
        if (started.ok) record(started.value)
        break
      }
      case 'take_delivery': {
        const itemId = value.itemId ?? ''
        if (!this.#player.has(itemId)) return events
        this.#player.drop(itemId)
        events.push({ kind: 'did', action, detail: itemId })
        const handled = this.#log.handle({ kind: 'gave', itemId, npcId: this.#npcId })
        if (handled.ok) record(handled.value)
        break
      }
      case 'hand_over': {
        const itemId = value.itemId ?? ''
        if (!this.#world.hasItem(itemId)) return events
        this.#player.take(itemId)
        events.push({ kind: 'did', action, detail: itemId })
        const handled = this.#log.handle({ kind: 'acquired', itemId, stolen: false })
        if (handled.ok) record(handled.value)
        break
      }
      case 'follow_player':
        this.#player.addCompanion(this.#npcId)
        events.push({ kind: 'did', action })
        break
      case 'stop_following':
        this.#player.removeCompanion(this.#npcId)
        events.push({ kind: 'did', action })
        break
      case 'end_talk':
        this.#open = false
        events.push({ kind: 'did', action })
        break
    }
    return events
  }

  #system(): string {
    const npc = this.#world.npc(this.#npcId)!
    const interior = npc.station ? this.#world.interior(npc.station.interiorId) : undefined
    const plot = interior ? this.#world.plot(interior.plotId) : undefined

    return fill(PROMPTS.npc, {
      name: npc.name,
      role: npc.role,
      place: plot?.name ?? 'the street',
      city: this.#world.name,
      personality: npc.personality,
      knowledge: npc.knowledge.map((fact) => `- ${fact}`).join('\n') || '- nothing worth repeating',
      situation: this.#situation(),
    })
  }

  /** What this NPC currently wants from the player, in their own terms. */
  #situation(): string {
    const lines: string[] = []
    for (const quest of this.#log.offeredBy(this.#npcId)) {
      lines.push(`you have a job you could hand out: ${quest.title}. ${quest.summary}`)
    }
    for (const objective of this.#log.objectives()) {
      if (objective.npcId === this.#npcId) lines.push(`they are meant to be here about this: ${objective.text}`)
    }
    if (this.#player.isCompanion(this.#npcId)) lines.push('you are walking with them at the moment')

    return lines.length
      ? fill(PROMPTS['situation-quest'], { lines: lines.map((line) => `\n- ${line}`).join('') })
      : PROMPTS['situation-idle']
  }

  /** What they say when the model cannot be reached: true, and in character. */
  #fallbackLine(): string {
    const npc = this.#world.npc(this.#npcId)!
    return npc.knowledge[0] ?? 'Not now.'
  }
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match)
}
