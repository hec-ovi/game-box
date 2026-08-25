import type { CountedStep, Place, Step } from './schema.ts'

/**
 * What an objective points at, in one shape whatever kind of step it came from.
 * A `deliver` names its person in `toNpcId` and a `stash` names its place in
 * `interiorId`; both come out of here as `npcId` and `place`, so a map pin, a
 * waypoint or a route reads the same two fields for every step and never has to
 * know what kind it is. A lock names its door and a machine step its machine;
 * where those stand in the city is the world's to answer (`door`, `machine`).
 */
export interface ObjectiveTarget {
  /** Who to reach: the person to talk to, to hand something to, or to walk somewhere. */
  readonly npcId?: string
  /** What to talk about, when the step only counts a conversation on that subject. */
  readonly topic?: string
  /** Where to reach: where to go, where to take an escort, where a stash goes. */
  readonly place?: Place
  /** What the step is about: the thing to pick up, hand over or put away. */
  readonly itemId?: string
  /** Other things that satisfy the step just as well, so a marker can cover the whole pool. */
  readonly alternates?: readonly string[]
  /** The spot inside the interior a stash goes on. */
  readonly anchorId?: string
  /** The locked door to get past. */
  readonly doorId?: string
  /** The machine to open or to play. */
  readonly machineId?: string
  /** The score a game on that machine has to reach. */
  readonly score?: number
}

/** Where a step sends the player. Empty for the kinds that point at nothing. */
export function targetOf(step: Step): ObjectiveTarget {
  switch (step.kind) {
    case 'talk':
      return { npcId: step.npcId, ...(step.topic ? { topic: step.topic } : {}) }
    case 'goto':
      return { place: step.place }
    case 'collect':
      return things(step)
    case 'deliver':
      return { npcId: step.toNpcId, ...things(step) }
    case 'stash':
      return { place: { interiorId: step.interiorId }, anchorId: step.anchorId, ...things(step) }
    case 'escort':
      return { npcId: step.npcId, place: step.place }
    case 'unlock':
      return { doorId: step.doorId }
    case 'hack':
      return { machineId: step.machineId }
    case 'beat-game':
      return { machineId: step.machineId, score: step.score }
    case 'buy':
      return things(step)
    case 'choice':
    case 'join':
    case 'any-of':
    case 'complete':
    case 'fail':
      return {}
  }
}

function things(step: CountedStep): ObjectiveTarget {
  return { itemId: step.itemId, ...(step.alternates?.length ? { alternates: step.alternates } : {}) }
}
