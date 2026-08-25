import type { Rng } from '@gb/kit'
import type { Flavour } from '../../theme/flavour.ts'
import type { CityCast } from '../cast.ts'
import { stepId, type Draft, type Effect } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/**
 * Something behind a locked door. The way past it is handed out by whoever
 * keeps the key, or is a code somebody nearby knows; then the door, the thing,
 * and the walk back. Finishing it leaves the player with the run of that door.
 *
 * A locked door is rare and deliberate: the charter behind it admits people
 * only so far, so a town with one has a job through it ahead of any errand.
 */
export class KeyRun extends RecipeBase {
  readonly name = 'key-run'
  override readonly leads = true

  weight(cast: CityCast, flavour: Flavour): number {
    if (!cast.locked || cast.peopled.length < 2) return 0
    return flavour === 'neon' || flavour === 'industrial' ? 10 : 8
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const locked = cast.lock(rng, giver.place)
    if (!locked) return undefined
    const { place, lock } = locked
    // the keeper hands the key over, or somebody else in the place gets it off them when the keeper is the one asking;
    // where nobody in the place can be asked, the code is known to somebody near the door
    const keeper = locked.keeper && (locked.keeper.npc.npcId !== giver.npc.npcId ? locked.keeper : cast.inside(rng, place, [giver.npc.npcId]))
    const teller = keeper ?? (lock.password ? cast.anyone(rng, [giver.npc.npcId], place) : undefined)
    if (!teller) return undefined
    const item = rng.pick([...locked.behind])
    if (!item) return undefined

    const thing = item.name.toLowerCase()
    const room = lock.street ? place.name : `the ${lock.room.toLowerCase()} at ${place.name}`
    const told: Effect = keeper && lock.keyItemId ? { kind: 'give-item', itemId: lock.keyItemId } : { kind: 'give-password', password: lock.password! }
    const walk = cast.metres(giver.place, teller.place) + cast.metres(teller.place, place) + cast.metres(place, giver.place)
    const stolen = item.ownerNpcId !== undefined

    return this.finish(cast, job, {
      giver,
      title: `Behind the door at ${place.name}`,
      summary: `${giver.npc.name} wants the ${thing} that is kept in ${room}. ${teller.npc.name} at ${teller.place.name} can get you through the door.`,
      items: [item],
      load: { metres: walk, legs: 4, stolen },
      access: [lock.street && place.interiorId ? { interiorId: place.interiorId } : { doorId: lock.doorId }],
      steps: [
        {
          id: stepId(1),
          kind: 'talk',
          npcId: teller.npc.npcId,
          objective: told.kind === 'give-item' ? `Get the key to ${room} from ${teller.npc.name}` : `Get the code for ${room} from ${teller.npc.name}`,
          markerLabel: teller.place.name,
          hint: `${teller.npc.name} is at ${teller.place.name}.`,
          effects: [told],
          next: [stepId(2)],
        },
        {
          id: stepId(2),
          kind: 'unlock',
          doorId: lock.doorId,
          objective: `Open the door to ${room}`,
          markerLabel: place.name,
          hint: told.kind === 'give-item' ? 'The key is in your pocket.' : 'Type the code at the door.',
          next: [stepId(3)],
        },
        {
          id: stepId(3),
          kind: 'collect',
          itemId: item.itemId,
          allowSteal: stolen,
          objective: `Take the ${thing} from ${room}`,
          markerLabel: place.name,
          next: [stepId(4)],
        },
        {
          id: stepId(4),
          kind: 'deliver',
          itemId: item.itemId,
          toNpcId: giver.npc.npcId,
          objective: `Bring it to ${giver.npc.name} at ${giver.place.name}`,
          markerLabel: giver.place.name,
          next: [stepId(5)],
        },
        { id: stepId(5), kind: 'complete', objective: 'Paid, and the door stays open to you' },
      ],
    })
  }
}
