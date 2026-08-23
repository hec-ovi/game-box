import type { Rng } from '@gb/kit'
import type { CityCast } from '../cast.ts'
import { stepId, type Draft, type Step } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** Past this many metres the job is worth a step of its own to find the place. */
const A_TREK = 90

/** Fetch one thing from across town and hand it over. The town's bread and butter. */
export class FetchRun extends RecipeBase {
  readonly name = 'fetch'

  weight(cast: CityCast): number {
    return cast.stocked() > 0 && cast.peopled.length >= 2 ? 6 : 0
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const source = cast.source(rng, giver.place, 1)
    if (!source) return undefined
    const item = rng.pick([...cast.free(source)])
    const thing = item.name.toLowerCase()
    const stolen = item.ownerNpcId !== undefined
    const walk = cast.metres(giver.place, source)
    const trek = walk > A_TREK
    // the walk over is its own step when the place is a long way off
    const first = trek ? 1 : 0

    const steps: Step[] = []
    if (trek) {
      steps.push({
        id: stepId(1),
        kind: 'goto',
        place: { plotId: source.plotId },
        objective: `Get across town to ${source.name}`,
        markerLabel: source.name,
        next: [stepId(2)],
      })
    }
    steps.push(
      {
        id: stepId(first + 1),
        kind: 'collect',
        itemId: item.itemId,
        allowSteal: stolen,
        objective: stolen ? `Take the ${thing} from ${source.name} without a fuss` : `Pick up the ${thing} at ${source.name}`,
        markerLabel: source.name,
        hint: `It is inside ${source.name}.`,
        next: [stepId(first + 2)],
      },
      {
        id: stepId(first + 2),
        kind: 'deliver',
        itemId: item.itemId,
        toNpcId: giver.npc.npcId,
        objective: `Take it back to ${giver.npc.name} at ${giver.place.name}`,
        markerLabel: giver.place.name,
        next: [stepId(first + 3)],
      },
      { id: stepId(first + 3), kind: 'complete', objective: 'Collect what you are owed' },
    )

    return this.finish(cast, job, {
      giver,
      title: `${item.name} for ${giver.npc.name}`,
      summary: `${giver.npc.name} works at ${giver.place.name} and wants the ${thing} that is sitting over at ${source.name}.`,
      steps,
      items: [item],
      load: { metres: walk * 2, legs: trek ? 3 : 2, stolen },
    })
  }
}
