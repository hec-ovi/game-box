import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { World } from '@gb/world'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

/** Everything an NPC is ever able to do in a conversation. */
export const ACTIONS = [
  'give_quest',
  'ask_about',
  'take_delivery',
  'hand_over',
  'follow_player',
  'stop_following',
  'end_talk',
] as const
export type ActionName = (typeof ACTIONS)[number]

export interface Situation {
  readonly world: World
  readonly log: QuestLog
  readonly player: PlayerState
  readonly npcId: string
}

/** One thing this NPC could do this turn, and the plain words it is offered in. */
export interface Move {
  readonly action: ActionName
  /** The quest, item or subject it names, fixed when the turn began. Never shown to the model. */
  readonly id?: string
  /** What it is about, named the way a person would name it: a job title, a thing on the counter. */
  readonly subject?: string
  readonly line: string
}

const WORDING = keyed(PROMPTS.moves)

/**
 * What this NPC may do this turn. The list is built from live state, so an NPC
 * cannot offer a quest that is not theirs or take an item the player is not
 * carrying: there is no entry for it to choose. Ids stay on this side; the
 * model only ever sees the wording.
 */
export function legalMoves(situation: Situation): readonly Move[] {
  const { world, log, player, npcId } = situation
  const moves: Move[] = []

  // The subject a step is waiting to hear raised comes first: it is what the
  // player was sent here to do, so it is the move the greeting nudges at.
  for (const topic of topicsFor(log, npcId)) {
    moves.push({ action: 'ask_about', id: topic, subject: topic, line: fill(WORDING.ask_about!, { topic }) })
  }

  for (const quest of log.offeredBy(npcId)) {
    moves.push({
      action: 'give_quest',
      id: quest.id,
      subject: quest.title,
      line: fill(WORDING.give_quest!, { title: quest.title, summary: quest.summary }),
    })
  }

  for (const itemId of owedTo(log, npcId).filter((id) => player.has(id))) {
    const item = itemName(world, itemId)
    moves.push({ action: 'take_delivery', id: itemId, subject: item, line: fill(WORDING.take_delivery!, { item }) })
  }

  for (const itemId of carriedBy(world, npcId)) {
    const item = itemName(world, itemId)
    moves.push({ action: 'hand_over', id: itemId, subject: item, line: fill(WORDING.hand_over!, { item }) })
  }

  if (escortsNeeded(log, npcId) && !player.isCompanion(npcId)) {
    moves.push({ action: 'follow_player', line: WORDING.follow_player! })
  }
  if (player.isCompanion(npcId)) {
    moves.push({ action: 'stop_following', line: WORDING.stop_following! })
  }

  moves.push({ action: 'end_talk', line: WORDING.end_talk! })
  return moves
}

/** The choice put to the model: doing nothing is always the first and easiest answer. */
export function menu(moves: readonly Move[]): string {
  return [WORDING.nothing!, ...moves.map((move) => move.line)].map((line, index) => `${index + 1}. ${line}`).join('\n')
}

/** The move behind a number. Anything outside the menu, one included, is doing nothing. */
export function picked(moves: readonly Move[], number: number): Move | undefined {
  return moves[number - 2]
}

/** The subject a move is about, for the moves that are about one. */
export function topicOf(move: Move): string | undefined {
  return move.action === 'ask_about' ? move.id : undefined
}

/**
 * The subjects an open step wants raised with this NPC. A talk step that names
 * a topic is only credited by a `talked` event carrying it, so standing in
 * front of the person is not enough: it takes a move of its own, and this is
 * the list of them.
 */
export function topicsFor(log: QuestLog, npcId: string): readonly string[] {
  const topics = new Set<string>()
  for (const objective of log.objectives()) {
    if (objective.npcId === npcId && objective.topic) topics.add(objective.topic)
  }
  return [...topics]
}

/**
 * Items an open step wants delivered to this NPC: the one it names and anything
 * the quest lets stand in for it. A delivery objective carries the person it is
 * delivered to, so this is a read of the objective and nothing more.
 */
function owedTo(log: QuestLog, npcId: string): string[] {
  const wanted = new Set<string>()
  for (const objective of log.objectives()) {
    if (objective.npcId !== npcId || !objective.itemId) continue
    wanted.add(objective.itemId)
    for (const alternate of objective.alternates ?? []) wanted.add(alternate)
  }
  return [...wanted]
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

function carriedBy(world: World, npcId: string): string[] {
  return world
    .placements()
    .filter((placement) => placement.at === 'npc' && placement.npcId === npcId)
    .map((placement) => placement.itemId)
}

function itemName(world: World, itemId: string): string {
  return world.item(itemId)?.name.toLowerCase() ?? 'thing'
}
