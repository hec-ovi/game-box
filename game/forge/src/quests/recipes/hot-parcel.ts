import type { Rng } from '@gb/kit'
import type { Flavour } from '../../theme/flavour.ts'
import type { CityCast } from '../cast.ts'
import { secondsToWalk } from '../pace.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** Something that belongs to somebody, wanted somewhere else, and wanted now. */
export class HotParcel extends RecipeBase {
  readonly name = 'hot-parcel'
  override readonly leads = true

  weight(cast: CityCast, flavour: Flavour): number {
    if (cast.lootable === 0) return 0
    return flavour === 'neon' || flavour === 'industrial' ? 6 : 3
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const lifted = cast.loot(rng, giver.place)
    if (!lifted) return undefined
    const { place: source, item } = lifted

    const thing = item.name.toLowerCase()
    // the hint is read from wherever the player is standing, which is usually not this room
    const owner = source.npcs.find((npc) => npc.npcId === item.ownerNpcId)?.name ?? `somebody at ${source.name}`
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
          hint: `It belongs to ${owner}, who is in the room with it.`,
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
        { id: stepId(3), kind: 'complete', objective: 'Paid, and nothing said' },
      ],
    })
  }
}
