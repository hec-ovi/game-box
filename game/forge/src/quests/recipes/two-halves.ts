import type { Rng } from '@gb/kit'
import type { CityCast } from '../cast.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** Two halves of one job, in whichever order the player takes them. */
export class TwoHalves extends RecipeBase {
  readonly name = 'two-halves'
  override readonly leads = true

  weight(cast: CityCast): number {
    return cast.stocked() >= 2 ? 4 : 0
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const first = cast.source(rng, giver.place, 1)
    if (!first) return undefined
    const second = cast.source(rng, first, 1)
    if (!second) return undefined

    const one = rng.pick([...cast.free(first)])
    const two = rng.pick([...cast.free(second)])
    const stolen = one.ownerNpcId !== undefined || two.ownerNpcId !== undefined
    const walk = cast.metres(giver.place, first) + cast.metres(first, second) + cast.metres(second, giver.place)

    return this.finish(cast, job, {
      giver,
      title: `Both halves for ${giver.npc.name}`,
      summary: `${giver.npc.name} needs the ${one.name.toLowerCase()} from ${first.name} and the ${two.name.toLowerCase()} from ${second.name}, and neither is any use without the other.`,
      items: [one, two],
      load: { metres: walk, legs: 3, stolen, items: 2 },
      steps: [
        {
          id: stepId(1),
          kind: 'goto',
          place: { plotId: first.plotId },
          objective: `Start at ${first.name}`,
          markerLabel: first.name,
          next: [stepId(2), stepId(3)],
        },
        {
          id: stepId(2),
          kind: 'collect',
          itemId: one.itemId,
          allowSteal: one.ownerNpcId !== undefined,
          objective: `Pick up the ${one.name.toLowerCase()} at ${first.name}`,
          markerLabel: first.name,
          next: [stepId(4)],
        },
        {
          id: stepId(3),
          kind: 'collect',
          itemId: two.itemId,
          allowSteal: two.ownerNpcId !== undefined,
          objective: `Pick up the ${two.name.toLowerCase()} at ${second.name}`,
          markerLabel: second.name,
          next: [stepId(4)],
        },
        {
          id: stepId(4),
          kind: 'join',
          waitFor: [stepId(2), stepId(3)],
          objective: 'Both halves in hand',
          next: [stepId(5)],
        },
        {
          id: stepId(5),
          kind: 'deliver',
          itemId: one.itemId,
          alternates: [two.itemId],
          count: 2,
          toNpcId: giver.npc.npcId,
          objective: `Take the pair to ${giver.npc.name} at ${giver.place.name}`,
          markerLabel: giver.place.name,
          next: [stepId(6)],
        },
        { id: stepId(6), kind: 'complete', objective: 'Paid for both' },
      ],
    })
  }
}
