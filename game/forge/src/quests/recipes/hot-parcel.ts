import type { Rng } from '@gb/kit'
import type { Flavour } from '../../theme/flavour.ts'
import type { CastItem, CastPlace, CityCast } from '../cast.ts'
import { secondsToWalk } from '../pace.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** Something that belongs to somebody, wanted somewhere else, and wanted now. */
export class HotParcel extends RecipeBase {
  readonly name = 'hot-parcel'
  override readonly leads = true

  weight(cast: CityCast, flavour: Flavour): number {
    if (!this.#owned(cast).length) return 0
    return flavour === 'neon' || flavour === 'industrial' ? 6 : 3
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const owned = this.#owned(cast).filter(([place]) => place.plotId !== giver.place.plotId)
    if (!owned.length) return undefined
    const [source, item] = rng.pick(owned)

    const thing = item.name.toLowerCase()
    const walk = cast.metres(giver.place, source) * 2
    const seconds = secondsToWalk(walk)

    return this.finish(cast, job, {
      giver,
      title: `The ${thing} out of ${source.name}`,
      summary: `${giver.npc.name} wants the ${thing} off the shelf at ${source.name} before anybody at ${source.name} notices it is gone.`,
      items: [item],
      load: { metres: walk, legs: 2, stolen: true, timed: true },
      failWhen: [
        { kind: 'time-limit', seconds },
        { kind: 'item-lost', itemId: item.itemId },
      ],
      steps: [
        {
          id: stepId(1),
          kind: 'collect',
          itemId: item.itemId,
          allowSteal: true,
          objective: `Lift the ${thing} from ${source.name}`,
          markerLabel: source.name,
          hint: 'It belongs to somebody, and they are standing right there.',
          next: [stepId(2)],
        },
        {
          id: stepId(2),
          kind: 'deliver',
          itemId: item.itemId,
          toNpcId: giver.npc.npcId,
          objective: `Get it to ${giver.npc.name} at ${giver.place.name} before the fuss starts`,
          markerLabel: giver.place.name,
          next: [stepId(3)],
        },
        { id: stepId(3), kind: 'complete', objective: 'Take the money and say nothing' },
      ],
    })
  }

  /** Things with an owner: the only things worth stealing. */
  #owned(cast: CityCast): ReadonlyArray<readonly [CastPlace, CastItem]> {
    return cast.places.flatMap((place) =>
      cast.free(place).filter((item) => item.ownerNpcId !== undefined).map((item) => [place, item] as const),
    )
  }
}
