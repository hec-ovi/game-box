import type { Objective } from '@gb/quest'

/**
 * Who a quest is waiting on right now: every person named on an open line of
 * the board. A step that sends the player to somebody points at their post,
 * so anybody on this list has to be at it, whatever share of the town is out
 * walking. The running game reads it off the same `objectives()` the harness
 * does, so the two agree on who stays in.
 */
export function questTargets(objectives: readonly Objective[]): ReadonlySet<string> {
  const kept = new Set<string>()
  for (const line of objectives) if (line.npcId) kept.add(line.npcId)
  return kept
}
