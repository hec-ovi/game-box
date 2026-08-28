import type { QuestSheet } from './tools.ts'
import type { CityLocks } from './locks.ts'

type Beat = QuestSheet['beats'][number]

/**
 * What the buys in a run of beats cost, so a job that sends the player shopping
 * is only offered to somebody who can pay for it.
 *
 * The prices are the city's, not the writer's, so the bill is added up here and
 * put on the quest as a `money-at-least` rather than asked for. A fork costs
 * whichever of its roads costs most, since the player only walks one of them.
 */
export function billFor(beats: readonly Beat[], city: CityLocks): number {
  let total = 0
  for (const beat of beats) {
    if (beat.kind === 'choice') {
      total += Math.max(0, ...beat.options.map((road) => billFor(road.beats, city)))
      continue
    }
    if (beat.kind !== 'buy') continue
    total += (city.counter(beat.itemId)?.value ?? 0) * (beat.count ?? 1)
  }
  return total
}
