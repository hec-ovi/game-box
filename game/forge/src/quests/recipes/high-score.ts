import type { Rng } from '@gb/kit'
import type { CityCast } from '../cast.ts'
import { stepId, type Draft } from '../shape.ts'
import { RecipeBase, type Job } from './recipe.ts'

/** The score a bet is set at: enough to take a few games, never a whole evening. */
const SCORE = { low: 40, high: 260 }

/** A bet on a game screen: reach the score, then collect from whoever bet against you. */
export class HighScore extends RecipeBase {
  readonly name = 'high-score'

  weight(cast: CityCast): number {
    return cast.arcades ? 4 : 0
  }

  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined {
    const giver = this.giverFor(cast, rng, job)
    if (!giver) return undefined
    const arcade = cast.arcade(rng, giver.place)
    if (!arcade) return undefined
    const { place, machine } = arcade
    const score = rng.int(SCORE.low, SCORE.high) * 5
    const walk = cast.metres(giver.place, place) * 2

    return this.finish(cast, job, {
      giver,
      title: `${score} on the ${machine.program} at ${place.name}`,
      summary: `${giver.npc.name} says nobody can put ${score} on the ${machine.program} screen at ${place.name}, and has money on it.`,
      items: [],
      load: { metres: walk, legs: 2 },
      steps: [
        {
          id: stepId(1),
          kind: 'beat-game',
          machineId: machine.machineId,
          score,
          objective: `Score ${score} at ${machine.program} on the screen at ${place.name}`,
          markerLabel: place.name,
          hint: 'Sit at the screen and play until the number comes up.',
          next: [stepId(2)],
        },
        {
          id: stepId(2),
          kind: 'talk',
          npcId: giver.npc.npcId,
          objective: `Collect from ${giver.npc.name} at ${giver.place.name}`,
          markerLabel: giver.place.name,
          next: [stepId(3)],
        },
        { id: stepId(3), kind: 'complete', objective: 'The bet, paid' },
      ],
    })
  }
}
