import type { Rng } from '@gb/kit'
import type { Flavour } from '../../theme/flavour.ts'
import type { CityCast } from '../cast.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** What is on a locked screen. Somebody there sells the code, the player opens the screen, and reports what it held. */
export class HackJob extends RecipeBase {
  readonly name = 'hack-job'
  override readonly leads = true

  weight(cast: CityCast, flavour: Flavour): number {
    if (!cast.screens || cast.peopled.length < 2) return 0
    return flavour === 'neon' ? 6 : 3
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const screen = cast.screen(rng, giver.place)
    if (!screen) return undefined
    const { place, machine } = screen
    const insider = cast.anyone(rng, [giver.npc.npcId], place)
    if (!insider) return undefined

    const what = machine.program === 'ledger' ? 'the books' : machine.program === 'camera-feed' ? 'the camera feed' : 'the mail'
    const walk = cast.metres(giver.place, insider.place) + cast.metres(insider.place, place) + cast.metres(place, giver.place)

    return this.finish(cast, job, {
      giver,
      title: `${what[0]!.toUpperCase()}${what.slice(1)} at ${place.name}`,
      summary: `${giver.npc.name} wants to know what is on the screen at ${place.name}. ${insider.npc.name} at ${insider.place.name} knows the code that opens it.`,
      items: [],
      load: { metres: walk, legs: 3 },
      steps: [
        {
          id: stepId(1),
          kind: 'talk',
          npcId: insider.npc.npcId,
          objective: `Get the code for the screen at ${place.name} from ${insider.npc.name}`,
          markerLabel: insider.place.name,
          hint: `${insider.npc.name} is at ${insider.place.name}.`,
          effects: [{ kind: 'give-password', password: machine.password! }],
          next: [stepId(2)],
        },
        {
          id: stepId(2),
          kind: 'hack',
          machineId: machine.machineId,
          objective: `Open the screen at ${place.name} and read ${what}`,
          markerLabel: place.name,
          hint: 'Sit at it and type the code.',
          next: [stepId(3)],
        },
        {
          id: stepId(3),
          kind: 'talk',
          npcId: giver.npc.npcId,
          objective: `Tell ${giver.npc.name} at ${giver.place.name} what was on it`,
          markerLabel: giver.place.name,
          next: [stepId(4)],
        },
        { id: stepId(4), kind: 'complete', objective: 'Paid for what you read' },
      ],
    })
  }
}
