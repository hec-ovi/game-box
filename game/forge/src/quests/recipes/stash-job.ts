import type { Rng } from '@gb/kit'
import type { Flavour } from '../../theme/flavour.ts'
import type { CityCast } from '../cast.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** Take something, put it somewhere it will not be found, and say it is done. */
export class StashJob extends RecipeBase {
  readonly name = 'stash-job'

  weight(cast: CityCast, flavour: Flavour): number {
    if (cast.stocked() === 0 || !cast.places.some((place) => place.stashAnchorId)) return 0
    return flavour === 'neon' ? 5 : 3
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const source = cast.source(rng, giver.place, 1)
    if (!source) return undefined
    const hiding = cast.hidingPlace(rng, [source.plotId], source)
    if (!hiding?.stashAnchorId || !hiding.interiorId) return undefined

    const item = rng.pick([...cast.free(source)])
    const thing = item.name.toLowerCase()
    const stolen = item.ownerNpcId !== undefined
    const walk = cast.metres(giver.place, source) + cast.metres(source, hiding) + cast.metres(hiding, giver.place)

    return this.finish(cast, job, {
      giver,
      title: `Put the ${thing} somewhere else`,
      summary: `${giver.npc.name} wants the ${thing} out of ${source.name} and left inside ${hiding.name}, where nobody is looking for it.`,
      items: [item],
      load: { metres: walk, legs: 3, stolen },
      failWhen: [{ kind: 'item-lost', itemId: item.itemId }],
      steps: [
        {
          id: stepId(1),
          kind: 'collect',
          itemId: item.itemId,
          allowSteal: stolen,
          objective: `Get the ${thing} out of ${source.name}`,
          markerLabel: source.name,
          next: [stepId(2)],
        },
        {
          id: stepId(2),
          kind: 'stash',
          itemId: item.itemId,
          interiorId: hiding.interiorId,
          anchorId: hiding.stashAnchorId,
          objective: `Leave it inside ${hiding.name}`,
          markerLabel: hiding.name,
          hint: 'Put it down where it looks like it belongs.',
          next: [stepId(3)],
        },
        {
          id: stepId(3),
          kind: 'talk',
          npcId: giver.npc.npcId,
          objective: `Tell ${giver.npc.name} where it is`,
          markerLabel: giver.place.name,
          next: [stepId(4)],
        },
        { id: stepId(4), kind: 'complete', objective: 'Get paid and forget about it' },
      ],
    })
  }
}
