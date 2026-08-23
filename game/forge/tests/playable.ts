import { PlayerState } from '@gb/play'
import { QuestLog, type QuestDoc } from '@gb/quest'
import type { World } from '@gb/world'
import { ownedItems, Player, type Choose, type Playthrough } from './player.ts'

/**
 * How much of a town a player can actually finish today.
 *
 * This is the number worth quoting about a generated town. It counts a quest as
 * finished only when the verbs the game has were enough to finish it, so a step
 * kind nobody can produce shows up as a blocked quest rather than a green one.
 * It rises as the boxes named in `verbs.ts` ship what they owe.
 */

export interface Report {
  readonly quests: number
  /** Quests a player could take today and finish, whichever road they took. */
  readonly completable: number
  /** Quests nobody can finish, counted by the step kind that stops them. */
  readonly blockedBy: ReadonlyMap<string, number>
  /** Quests that stop for a reason that is not a missing verb: this box wrote them badly. */
  readonly stranded: readonly Playthrough[]
  /** Every road played, so a caller can look at one. */
  readonly runs: readonly Playthrough[]
}

/**
 * Plays every quest in a town on its own, from a fresh player who already meets
 * whatever it waits on, both ways round wherever it makes the player choose.
 */
export function playEvery(world: World, quests: readonly QuestDoc[], choices: readonly Choose[] = [() => 0, () => 1]): Report {
  const owned = ownedItems(world)
  const runs: Playthrough[] = []
  for (const quest of quests) {
    for (const choose of choices) {
      const state = PlayerState.create(world.id)
      for (const need of quest.requires ?? []) if (need.kind === 'flag') state.setFlag(need.flag, need.value)
      const log = QuestLog.create(quests, state)
      const started = log.start(quest.id)
      if (!started.ok) throw new Error(`${quest.title} cannot be started at all: ${JSON.stringify(started.error)}`)
      runs.push(new Player(log, state, { owned, choose }).play(quest))
    }
  }
  return summarise(runs)
}

/**
 * The tally for one town, one row per quest rather than per road: a quest counts
 * as completable only when every road through it pays out, which is what a town
 * that forks has to promise.
 */
export function summarise(runs: readonly Playthrough[]): Report {
  const roads = new Map<string, Playthrough[]>()
  for (const run of runs) roads.set(run.questId, [...(roads.get(run.questId) ?? []), run])

  const blockedBy = new Map<string, number>()
  let completable = 0
  for (const taken of roads.values()) {
    if (taken.every((run) => run.completable)) completable++
    for (const kind of new Set(taken.flatMap((run) => run.blocked.map((block) => block.kind)))) {
      blockedBy.set(kind, (blockedBy.get(kind) ?? 0) + 1)
    }
  }
  return {
    quests: roads.size,
    completable,
    blockedBy,
    stranded: runs.filter((run) => run.stranded.length > 0),
    runs,
  }
}

/** Several towns as one figure. Quest ids start again in every town, so towns are added up, never pooled. */
export function across(reports: readonly Report[]): Report {
  const blockedBy = new Map<string, number>()
  for (const report of reports) for (const [kind, count] of report.blockedBy) blockedBy.set(kind, (blockedBy.get(kind) ?? 0) + count)
  return {
    quests: reports.reduce((total, report) => total + report.quests, 0),
    completable: reports.reduce((total, report) => total + report.completable, 0),
    blockedBy,
    stranded: reports.flatMap((report) => [...report.stranded]),
    runs: reports.flatMap((report) => [...report.runs]),
  }
}

/** The figure in one line, for a failing test to say out loud. */
export function line(report: Report): string {
  const blockers = [...report.blockedBy].map(([kind, count]) => `${kind} ${count}`).join(', ')
  return `${report.completable} of ${report.quests} completable${blockers ? `; blocked by ${blockers}` : ''}`
}
