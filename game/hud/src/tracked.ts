import type { Objective, QuestKind } from '@gb/quest'
import type { HudState, WorkOffer } from './types.ts'

/**
 * Which quest the objectives panel and the map are about. The game says so with
 * `trackedQuestId`; until it does, the first open step decides, so the panel is
 * never empty while there is work to do.
 */
export function trackedQuest(state: HudState): string | undefined {
  const tracked = state.trackedQuestId
  const open = state.objectives
  // A chosen quest keeps being followed until the board says its steps are gone.
  if (tracked && (open.length === 0 || open.some((step) => step.questId === tracked))) return tracked
  return open[0]?.questId
}

/** The open steps of one quest, in the order the game sent them. */
export function stepsOf(state: HudState, questId: string | undefined): readonly Objective[] {
  return questId === undefined ? [] : state.objectives.filter((step) => step.questId === questId)
}

/** Story or errand, as far as the pages the game pushed say. */
export function kindOf(state: HudState, questId: string | undefined): QuestKind | undefined {
  return state.quests.find((quest) => quest.questId === questId)?.kind
}

/**
 * Where the story starts from here: the first job on the main line that nobody
 * has taken. The game decides which offers the player can see; this only reads
 * the story out of them.
 */
export function mainOffer(state: HudState): WorkOffer | undefined {
  return state.offers.find((offer) => offer.line === 'main')
}

/** True while the story has work open and the player is following something else. */
export function mainWaiting(state: HudState, questId: string | undefined): boolean {
  return state.objectives.some((step) => step.questId !== questId && kindOf(state, step.questId) === 'main')
}

/** How many other quests have open steps: the "3 more" line. */
export function otherQuests(state: HudState, questId: string | undefined): number {
  const ids = new Set(state.objectives.map((step) => step.questId))
  ids.delete(questId ?? '')
  return ids.size
}
