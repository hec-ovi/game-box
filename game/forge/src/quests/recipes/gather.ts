import type { Rng } from '@gb/kit'
import type { Flavour } from '../../theme/flavour.ts'
import type { CityCast } from '../cast.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** The most of one thing anybody asks for at once. */
const MOST = 3

/** Several of the same thing from one place, counted out and carried back. */
export class GatherRun extends RecipeBase {
  readonly name = 'gather'
  override readonly leads = true

  weight(cast: CityCast, flavour: Flavour): number {
    if (cast.stocked(2) === 0) return 0
    return flavour === 'agrarian' || flavour === 'coastal' ? 6 : 4
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const source = cast.source(rng, giver.place, 2)
    if (!source) return undefined

    const free = cast.free(source)
    const wanted = rng.int(2, Math.min(MOST, free.length) + 1)
    const items = free.slice(0, wanted)
    const [head, ...rest] = items
    if (!head) return undefined
    const kinds = new Set(items.map((item) => item.archetype))
    const noun = kinds.size === 1 && head.archetype ? `${head.archetype}s` : 'things'
    const stolen = items.some((item) => item.ownerNpcId !== undefined)
    const walk = cast.metres(giver.place, source)

    return this.finish(cast, job, {
      giver,
      title: `${wanted} ${noun} from ${source.name}`,
      summary: `${giver.npc.name} needs ${wanted} ${noun} out of ${source.name} and has neither the time nor the legs for it.`,
      items,
      load: { metres: walk * 2, legs: 2, stolen, items: wanted },
      steps: [
        {
          id: stepId(1),
          kind: 'collect',
          itemId: head.itemId,
          alternates: rest.map((item) => item.itemId),
          count: wanted,
          allowSteal: stolen,
          objective: `Gather ${wanted} ${noun} at ${source.name}`,
          markerLabel: source.name,
          hint: `Any ${wanted} of them will do, they are all in ${source.name}.`,
          next: [stepId(2)],
        },
        {
          id: stepId(2),
          kind: 'deliver',
          itemId: head.itemId,
          alternates: rest.map((item) => item.itemId),
          count: wanted,
          toNpcId: giver.npc.npcId,
          objective: `Carry them to ${giver.npc.name} at ${giver.place.name}`,
          markerLabel: giver.place.name,
          next: [stepId(3)],
        },
        { id: stepId(3), kind: 'complete', objective: 'Settled up' },
      ],
    })
  }
}
