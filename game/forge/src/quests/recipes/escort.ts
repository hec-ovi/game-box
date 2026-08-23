import type { Rng } from '@gb/kit'
import type { Flavour } from '../../theme/flavour.ts'
import type { CityCast } from '../cast.ts'
import { secondsToWalk } from '../pace.ts'
import { stepId, type Draft, type FailWhen } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** How often the walk has to be done before something happens. */
const IN_A_HURRY = 0.35

/** Walk somebody across town and get them there in one piece. */
export class EscortRun extends RecipeBase {
  readonly name = 'escort'
  override readonly leads = true

  weight(cast: CityCast, flavour: Flavour): number {
    if (cast.peopled.length < 3) return 0
    return flavour === 'alpine' || flavour === 'agrarian' ? 7 : 5
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const walker = cast.walker(rng, [giver.npc.npcId])
    if (!walker) return undefined
    const destinations = cast.peopled.filter((place) => place.plotId !== walker.place.plotId)
    if (!destinations.length) return undefined
    const destination = rng.pick(destinations)

    const walk = cast.metres(giver.place, walker.place) + cast.metres(walker.place, destination)
    const hurried = rng.chance(IN_A_HURRY)
    const failWhen: FailWhen[] = [{ kind: 'npc-lost', npcId: walker.npc.npcId }]
    if (hurried) failWhen.push({ kind: 'time-limit', seconds: secondsToWalk(walk) })

    return this.finish(cast, job, {
      giver,
      title: `See ${walker.npc.name} to ${destination.name}`,
      summary: `${giver.npc.name} would rather ${walker.npc.name} did not walk from ${walker.place.name} to ${destination.name} alone${hurried ? ', and wants it done today' : ''}.`,
      items: [],
      load: { metres: walk, legs: 2, escort: true, timed: hurried },
      failWhen,
      steps: [
        {
          id: stepId(1),
          kind: 'talk',
          npcId: walker.npc.npcId,
          objective: `Find ${walker.npc.name} at ${walker.place.name}`,
          markerLabel: walker.place.name,
          hint: `${walker.npc.name} will not set off until somebody turns up.`,
          effects: [{ kind: 'companion-join', npcId: walker.npc.npcId }],
          next: [stepId(2)],
        },
        {
          id: stepId(2),
          kind: 'escort',
          npcId: walker.npc.npcId,
          place: { plotId: destination.plotId },
          objective: `Walk ${walker.npc.name} over to ${destination.name}`,
          markerLabel: destination.name,
          next: [stepId(3)],
        },
        {
          id: stepId(3),
          kind: 'complete',
          objective: `See ${walker.npc.name} inside`,
          effects: [{ kind: 'companion-leave', npcId: walker.npc.npcId }],
        },
      ],
    })
  }
}
