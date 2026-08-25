import type { Rng } from '@gb/kit'
import type { CastItem, CityCast } from '../cast.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** The most things one shopping list asks for. */
const MOST = 3

/**
 * A shopping list: buy a few things over a counter with the player's own
 * money and bring them back, the bill repaid on delivery. Offered only to
 * somebody who can cover the bill, and only when the job's own band leaves
 * room to repay it.
 */
export class Shopping extends RecipeBase {
  readonly name = 'shopping'

  weight(cast: CityCast): number {
    return cast.counters && cast.peopled.length >= 2 ? 4 : 0
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const counter = cast.counter(rng, giver.place)
    if (!counter) return undefined
    const walk = cast.metres(giver.place, counter) * 2
    const load = { metres: walk, legs: 2 }
    // the bill has to fit inside what a step of this band may pay back
    const bill = this.bonus(load)
    const list = cheapest(cast.priced(counter), bill).slice(0, rng.int(1, MOST + 1))
    const [head, ...rest] = list
    if (!head) return undefined
    const total = list.reduce((sum, item) => sum + (item.value ?? 0), 0)
    const seller = counter.npcs.find((npc) => npc.npcId === head.ownerNpcId)?.name ?? `the counter at ${counter.name}`
    const noun = list.length === 1 ? head.name.toLowerCase() : `${list.length} things`

    return this.finish(cast, job, {
      giver,
      title: `${noun[0]!.toUpperCase()}${noun.slice(1)} from ${counter.name}`,
      summary: `${giver.npc.name} wants ${noun} from ${counter.name}, paid for at the counter, and will cover the ${total} credits on delivery.`,
      items: list,
      load,
      steps: [
        {
          id: stepId(1),
          kind: 'buy',
          itemId: head.itemId,
          alternates: rest.map((item) => item.itemId),
          count: list.length,
          objective: `Buy ${noun} from ${seller} at ${counter.name}`,
          markerLabel: counter.name,
          hint: `It comes to ${total} credits, out of your own pocket for now.`,
          next: [stepId(2)],
        },
        {
          id: stepId(2),
          kind: 'deliver',
          itemId: head.itemId,
          alternates: rest.map((item) => item.itemId),
          count: list.length,
          toNpcId: giver.npc.npcId,
          objective: `Bring it to ${giver.npc.name} at ${giver.place.name}`,
          markerLabel: giver.place.name,
          effects: [{ kind: 'pay', amount: total }],
          next: [stepId(3)],
        },
        { id: stepId(3), kind: 'complete', objective: 'The bill covered, and paid on top' },
      ],
      requires: [{ kind: 'money-at-least', amount: total }],
    })
  }
}

/** As many of the counter's things as fit under the bill, cheapest first. */
function cheapest(items: readonly CastItem[], bill: number): CastItem[] {
  const picked: CastItem[] = []
  let spent = 0
  for (const item of [...items].sort((a, b) => (a.value ?? 0) - (b.value ?? 0))) {
    if (spent + (item.value ?? 0) > bill) break
    picked.push(item)
    spent += item.value ?? 0
  }
  return picked
}
