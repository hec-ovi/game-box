import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { ToolSpec } from '@gb/sidecar'
import type { World } from '@gb/world'

/** Everything an NPC is ever able to do in a conversation. */
export const ACTIONS = ['give_quest', 'take_delivery', 'hand_over', 'follow_player', 'stop_following', 'end_talk'] as const
export type ActionName = (typeof ACTIONS)[number]

export interface Situation {
  readonly world: World
  readonly log: QuestLog
  readonly player: PlayerState
  readonly npcId: string
}

/**
 * The tools this NPC may call this turn, with the ids they may name written
 * into the schema as an enum. An NPC cannot offer a quest that is not theirs or
 * take an item the player is not carrying, because there is no way to say it.
 */
export function legalActions(situation: Situation): ToolSpec[] {
  const { world, log, player, npcId } = situation
  const tools: ToolSpec[] = []

  const offers = log.offeredBy(npcId).map((quest) => quest.id)
  if (offers.length) {
    tools.push({
      name: 'give_quest',
      description: 'Ask this person to do a job for you. Only when the conversation has got there.',
      parameters: idEnum('questId', offers, 'The job you are handing them'),
    })
  }

  const expected = log
    .objectives()
    .filter((objective) => objective.stepId && objective.questId)
    .flatMap((objective) => deliveriesTo(log, objective.questId, npcId))
    .filter((itemId) => player.has(itemId))
  if (expected.length) {
    tools.push({
      name: 'take_delivery',
      description: 'Take what they are handing you, when they hand it over.',
      parameters: idEnum('itemId', unique(expected), 'What you are taking from them'),
    })
  }

  const carried = world
    .placements()
    .filter((placement) => placement.at === 'npc' && placement.npcId === npcId)
    .map((placement) => placement.itemId)
  if (carried.length) {
    tools.push({
      name: 'hand_over',
      description: 'Give them something of yours, if you have decided to.',
      parameters: idEnum('itemId', carried, 'What you are giving them'),
    })
  }

  if (escortsNeeded(log, npcId) && !player.isCompanion(npcId)) {
    tools.push({ name: 'follow_player', description: 'Go with them.', parameters: empty() })
  }
  if (player.isCompanion(npcId)) {
    tools.push({ name: 'stop_following', description: 'Stop going with them and stay here.', parameters: empty() })
  }

  tools.push({ name: 'end_talk', description: 'End the conversation, when it is over.', parameters: empty() })
  return tools
}

/** Items an open step of an active quest wants delivered to this NPC. */
function deliveriesTo(log: QuestLog, questId: string, npcId: string): string[] {
  const quest = log.quests().find((q) => q.id === questId)
  if (!quest) return []
  const open = new Set(log.objectives().filter((o) => o.questId === questId).map((o) => o.stepId))
  return quest.steps
    .filter((step) => open.has(step.id) && step.kind === 'deliver' && step.toNpcId === npcId)
    .map((step) => (step.kind === 'deliver' ? step.itemId : ''))
    .filter(Boolean)
}

/** True when an open step needs this NPC walking with the player. */
function escortsNeeded(log: QuestLog, npcId: string): boolean {
  for (const objective of log.objectives()) {
    const quest = log.quests().find((q) => q.id === objective.questId)
    const step = quest?.steps.find((s) => s.id === objective.stepId)
    if (step?.kind === 'escort' && step.npcId === npcId) return true
    if (step?.effects.some((e) => e.kind === 'companion-join' && e.npcId === npcId)) return true
  }
  return false
}

function idEnum(field: string, values: readonly string[], description: string): Record<string, unknown> {
  return {
    type: 'object',
    properties: { [field]: { type: 'string', enum: [...values], description } },
    required: [field],
    additionalProperties: false,
  }
}

function empty(): Record<string, unknown> {
  return { type: 'object', properties: {}, additionalProperties: false }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}
