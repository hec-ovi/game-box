/** The best the player has done at each game on each machine. */
import { named } from './named.ts'
import type { ScoreDoc } from './schema.ts'

/** A score is a whole number of points, zero or more. */
const isScore = (points: number): boolean => Number.isInteger(points) && points >= 0

export class Scores {
  #bests: ScoreDoc[] = []

  /** Restore from a save, one entry per game per machine, the highest kept. */
  static from(docs: readonly ScoreDoc[] | undefined): Scores {
    const scores = new Scores()
    for (const { machineId, game, best } of docs ?? []) scores.record(machineId, game, best)
    return scores
  }

  /** A game ended on that many points. Answers whether it beat the best so far; a lower score changes nothing. */
  record(machineId: string, game: string, points: number): boolean {
    if (!named(machineId, game) || !isScore(points)) return false
    const held = this.#entry(machineId, game)
    if (!held) {
      this.#bests.push({ machineId, game, best: points })
      return true
    }
    if (points <= held.best) return false
    held.best = points
    return true
  }

  /** The best so far at that game on that machine, if it has been played. */
  best(machineId: string, game: string): number | undefined {
    return this.#entry(machineId, game)?.best
  }

  list(): readonly ScoreDoc[] {
    return this.#bests.map((held) => ({ ...held }))
  }

  get any(): boolean {
    return this.#bests.length > 0
  }

  toJSON(): ScoreDoc[] {
    return this.list() as ScoreDoc[]
  }

  #entry(machineId: string, game: string): ScoreDoc | undefined {
    return this.#bests.find((held) => held.machineId === machineId && held.game === game)
  }
}
