import { PlayerState } from '@gb/play'
import { QuestLog, type QuestDoc } from '@gb/quest'
import type { World } from '@gb/world'
import { City } from './city.ts'
import { Player, type Choose, type Living, type Playthrough } from './player.ts'
import { Street } from './street.ts'

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
  /** Quests that stopped at an empty room: the person a step named was out walking. */
  readonly absent: number
  /** Quests that stopped at a locked door the player had no way past. */
  readonly shut: number
  /** Quests that stop for a reason that is not a missing verb: this box wrote them badly. */
  readonly stranded: readonly Playthrough[]
  /** Every road played, so a caller can look at one. */
  readonly runs: readonly Playthrough[]
}

/**
 * A quest log that knows what time it is. The game reports the clock whenever
 * the reading moves, so a log has heard it before any quest is taken and a
 * timer counts from then; a log that has never heard the clock counts a timed
 * quest from the beginning of time and fails it on the first tick.
 */
export function openLog(quests: readonly QuestDoc[], state: PlayerState): QuestLog {
  const log = QuestLog.create(quests, state)
  log.handle({ kind: 'clock', seconds: state.clock.totalSeconds })
  return log
}

/**
 * How the town is living while it is played: everybody at their post, a third
 * out walking with the people a quest is waiting on kept in, or a third out
 * with nobody kept. The middle one is the rule the running game is asked to
 * keep; the last one is what a town looks like without it.
 */
export type Town = 'at-post' | 'kept' | 'loose'

/** A player who meets what a quest waits on: the flags it needs raised, and the money it needs in hand. */
export function meeting(quest: QuestDoc, state: PlayerState): void {
  for (const need of quest.requires ?? []) {
    if (need.kind === 'flag') state.setFlag(need.flag, need.value)
    if (need.kind === 'money-at-least') state.earn(need.amount)
  }
}

/**
 * Plays every quest in a town on its own, from a fresh player who already meets
 * whatever it waits on, both ways round wherever it makes the player choose.
 */
export function playEvery(world: World, quests: readonly QuestDoc[], town: Town = 'at-post', choices: readonly Choose[] = [() => 0, () => 1]): Report {
  const city = new City(world)
  const living: Living | undefined = town === 'at-post' ? undefined : { street: new Street(world), keepTargets: town === 'kept' }
  const runs: Playthrough[] = []
  for (const quest of quests) {
    for (const choose of choices) {
      const state = PlayerState.create(world.id)
      meeting(quest, state)
      const log = openLog(quests, state)
      const started = log.start(quest.id)
      if (!started.ok) throw new Error(`${quest.title} cannot be started at all: ${JSON.stringify(started.error)}`)
      runs.push(new Player(log, state, city, { choose, ...(living ? { living } : {}) }).play(quest))
    }
  }
  return tally(runs)
}

/**
 * One town's runs as one row per quest rather than per road: a quest counts as
 * completable only when every road through it pays out, which is what a town
 * that forks has to promise.
 */
function tally(runs: readonly Playthrough[]): Report {
  const roads = new Map<string, Playthrough[]>()
  for (const run of runs) roads.set(run.questId, [...(roads.get(run.questId) ?? []), run])

  const blockedBy = new Map<string, number>()
  let completable = 0
  let absent = 0
  let shut = 0
  for (const taken of roads.values()) {
    if (taken.every((run) => run.completable)) completable++
    if (taken.some((run) => run.absent.length > 0)) absent++
    if (taken.some((run) => run.shut.length > 0)) shut++
    for (const kind of new Set(taken.flatMap((run) => run.blocked.map((block) => block.kind)))) {
      blockedBy.set(kind, (blockedBy.get(kind) ?? 0) + 1)
    }
  }
  return {
    quests: roads.size,
    completable,
    blockedBy,
    absent,
    shut,
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
    absent: reports.reduce((total, report) => total + report.absent, 0),
    shut: reports.reduce((total, report) => total + report.shut, 0),
    stranded: reports.flatMap((report) => [...report.stranded]),
    runs: reports.flatMap((report) => [...report.runs]),
  }
}

/** The figure in one line, for a failing test to say out loud. */
export function line(report: Report): string {
  const blockers = [...report.blockedBy].map(([kind, count]) => `${kind} ${count}`).join(', ')
  const away = report.absent ? `; ${report.absent} sent to an empty room` : ''
  const locked = report.shut ? `; ${report.shut} stopped at a locked door` : ''
  return `${report.completable} of ${report.quests} completable${blockers ? `; blocked by ${blockers}` : ''}${away}${locked}`
}
