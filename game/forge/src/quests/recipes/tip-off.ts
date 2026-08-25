import type { Rng } from '@gb/kit'
import type { CityCast } from '../cast.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** A job with something else in the same building, if the right person tells you. */
export class TipOff extends RecipeBase {
  readonly name = 'tip-off'

  weight(cast: CityCast): number {
    return cast.stocked(2) > 0 && cast.peopled.length >= 2 ? 4 : 0
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const source = cast.source(rng, giver.place, 2)
    if (!source) return undefined
    const informant = cast.anyone(rng, [giver.npc.npcId], source)
    if (!informant) return undefined

    const free = cast.free(source)
    const item = free[0]!
    const secret = free[1]!
    const thing = item.name.toLowerCase()
    const other = secret.name.toLowerCase()
    const stolen = item.ownerNpcId !== undefined
    const walk = cast.metres(giver.place, source) * 2 + cast.metres(giver.place, informant.place)
    const load = { metres: walk, legs: 2, stolen }
    const pay = this.bonus(load)

    return this.finish(cast, job, {
      giver,
      title: `What else is in ${source.name}`,
      summary: `${giver.npc.name} wants the ${thing} out of ${source.name}. ${informant.npc.name} at ${informant.place.name} knows what else is in there.`,
      items: [item, secret],
      load,
      steps: [
        {
          id: stepId(1),
          kind: 'collect',
          itemId: item.itemId,
          allowSteal: stolen,
          objective: `Pick up the ${thing} at ${source.name}`,
          markerLabel: source.name,
          next: [stepId(2), stepId(4)],
        },
        {
          id: stepId(2),
          kind: 'talk',
          npcId: informant.npc.npcId,
          optional: true,
          objective: `Ask ${informant.npc.name} what else ${source.name} is holding`,
          markerLabel: informant.place.name,
          hint: `${informant.npc.name} talks more freely than anybody there.`,
          effects: [{ kind: 'reveal', stepId: stepId(3) }],
          next: [stepId(3)],
        },
        {
          id: stepId(3),
          kind: 'collect',
          itemId: secret.itemId,
          allowSteal: secret.ownerNpcId !== undefined,
          optional: true,
          hidden: true,
          objective: `Go back for the ${other} ${informant.npc.name} mentioned`,
          markerLabel: source.name,
          ...(pay ? { effects: [{ kind: 'pay', amount: pay } as const] } : {}),
        },
        {
          id: stepId(4),
          kind: 'deliver',
          itemId: item.itemId,
          toNpcId: giver.npc.npcId,
          objective: `Take it to ${giver.npc.name} at ${giver.place.name}`,
          markerLabel: giver.place.name,
          next: [stepId(5)],
        },
        { id: stepId(5), kind: 'complete', objective: 'Paid for the word' },
      ],
    })
  }
}
