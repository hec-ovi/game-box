import type { Rng } from '@gb/kit'
import type { CastPerson, CityCast } from '../cast.ts'
import { allied, crossed, owed, partyOf, sided, TOWN } from '../marks.ts'
import { stepId, type Draft, type Effect } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** What the buyer's offer costs the player in standing with the town at large. */
const BAD_NAME = 3

/** What coming down on one side is worth to that side, and costs the other. */
const A_SIDE = 5

/** One parcel, two people who want it, and the player picks. */
export class CourierChoice extends RecipeBase {
  readonly name = 'courier-choice'
  override readonly leads = true
  override readonly takesSides = true

  weight(cast: CityCast): number {
    return cast.stocked() > 0 && cast.peopled.length >= 3 ? 4 : 0
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const source = cast.source(rng, giver.place, 1)
    if (!source) return undefined
    // a link that forks the main line already knows who the other side is
    const buyer = job.against ?? cast.anyone(rng, [giver.npc.npcId, ...source.npcs.map((npc) => npc.npcId)], source)
    if (!buyer || buyer.place.plotId === giver.place.plotId) return undefined

    const item = rng.pick([...cast.free(source)])
    const thing = item.name.toLowerCase()
    const stolen = item.ownerNpcId !== undefined
    const walk = cast.metres(giver.place, source) + Math.max(cast.metres(source, giver.place), cast.metres(source, buyer.place))
    const load = { metres: walk, legs: 3, stolen }
    const extra = this.bonus(load)
    const fork = job.against !== undefined

    return this.finish(cast, job, {
      giver,
      title: `The ${thing} nobody agrees on`,
      summary: `${giver.npc.name} wants the ${thing} from ${source.name}. ${buyer.npc.name} at ${buyer.place.name} wants it more, and will say so with money.`,
      items: [item],
      load,
      steps: [
        {
          id: stepId(1),
          kind: 'collect',
          itemId: item.itemId,
          allowSteal: stolen,
          objective: `Pick up the ${thing} at ${source.name}`,
          markerLabel: source.name,
          next: [stepId(2)],
        },
        {
          id: stepId(2),
          kind: 'choice',
          prompt: `Who ends up with the ${thing}?`,
          objective: 'Decide who gets it',
          options: [
            { id: 'client', label: `${giver.npc.name}, who asked for it`, next: stepId(3) },
            { id: 'buyer', label: `${buyer.npc.name}, who is paying more`, next: stepId(4) },
          ],
        },
        {
          id: stepId(3),
          kind: 'deliver',
          itemId: item.itemId,
          toNpcId: giver.npc.npcId,
          objective: `Hand it to ${giver.npc.name} at ${giver.place.name}`,
          markerLabel: giver.place.name,
          effects: [...taking(giver, buyer, fork), { kind: 'set-flag', flag: owed(giver), value: true }],
          next: [stepId(5)],
        },
        {
          id: stepId(4),
          kind: 'deliver',
          itemId: item.itemId,
          toNpcId: buyer.npc.npcId,
          objective: `Sell it to ${buyer.npc.name} at ${buyer.place.name}`,
          markerLabel: buyer.place.name,
          hint: 'Word gets round a town this size.',
          effects: [
            ...(extra ? [{ kind: 'pay', amount: extra } as const] : []),
            { kind: 'reputation', faction: TOWN, delta: -BAD_NAME },
            ...taking(buyer, giver, fork),
          ],
          next: [stepId(5)],
        },
        { id: stepId(5), kind: 'complete', objective: 'The parcel went where you took it' },
      ],
    })
  }
}

/**
 * What the town remembers about coming down on one side: you are in with them,
 * you are out with the other, and their standings move apart. On the link that
 * forks the main line it is also which side of the argument the player is on
 * from here, which is what the rest of the line reads.
 */
function taking(side: CastPerson, against: CastPerson, fork: boolean): Effect[] {
  return [
    { kind: 'set-flag', flag: sided(side.place), value: true },
    { kind: 'set-flag', flag: crossed(against.place), value: true },
    { kind: 'reputation', faction: partyOf(side.place), delta: A_SIDE },
    { kind: 'reputation', faction: partyOf(against.place), delta: -A_SIDE },
    ...(fork ? [{ kind: 'set-flag', flag: allied(side.place), value: true } as const] : []),
  ]
}
