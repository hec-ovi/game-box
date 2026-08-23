import type { Objective } from '@gb/quest'
import type { HudState } from './types.ts'

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

/** How many other quests have open steps: the "3 more" line. */
export function otherQuests(state: HudState, questId: string | undefined): number {
  const ids = new Set(state.objectives.map((step) => step.questId))
  ids.delete(questId ?? '')
  return ids.size
}
