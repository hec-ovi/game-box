import type { Rng } from '@gb/kit'
import type { CityCast } from '../cast.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** A plain job with something else worth picking up while you are out. */
export class ErrandPlus extends RecipeBase {
  readonly name = 'errand-plus'

  weight(cast: CityCast): number {
    return cast.stocked(1).length >= 2 ? 4 : 0
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const source = cast.source(rng, giver.place, 1)
    if (!source) return undefined
    const spare = cast.stocked(1).filter((place) => place.plotId !== source.plotId)
    if (!spare.length) return undefined
    const aside = rng.pick(spare)

    const item = rng.pick([...cast.free(source)])
    const extra = rng.pick([...cast.free(aside)])
    const thing = item.name.toLowerCase()
    const other = extra.name.toLowerCase()
    const stolen = item.ownerNpcId !== undefined
    const walk = cast.metres(giver.place, source) * 2
    const load = { metres: walk, legs: 2, stolen }
    const pay = this.bonus(load)

    return this.finish(cast, job, {
      giver,
      title: `${item.name}, and whatever else turns up`,
      summary: `${giver.npc.name} wants the ${thing} from ${source.name}, and will pay again for the ${other} at ${aside.name} if you happen past it.`,
      items: [item, extra],
      load,
      steps: [
        {
          id: stepId(1),
          kind: 'collect',
          itemId: item.itemId,
          allowSteal: stolen,
          objective: `Pick up the ${thing} at ${source.name}`,
          markerLabel: source.name,
          next: [stepId(2), stepId(3)],
        },
        {
          id: stepId(2),
          kind: 'deliver',
          itemId: item.itemId,
          toNpcId: giver.npc.npcId,
          objective: `Get it to ${giver.npc.name} at ${giver.place.name}`,
          markerLabel: giver.place.name,
          next: [stepId(4)],
        },
        {
          id: stepId(3),
          kind: 'collect',
          itemId: extra.itemId,
          allowSteal: extra.ownerNpcId !== undefined,
          optional: true,
          objective: `Pick up the ${other} at ${aside.name} as well`,
          markerLabel: aside.name,
          hint: `Nobody is counting on it, but it is paid work.`,
          ...(pay ? { effects: [{ kind: 'pay', amount: pay } as const] } : {}),
        },
        { id: stepId(4), kind: 'complete', objective: 'Get paid' },
      ],
    })
  }
}
