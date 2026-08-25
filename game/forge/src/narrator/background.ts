import type { Rng } from '@gb/kit'
import type { Npc, NpcRole } from '@gb/world'
import type { Life } from './lives.ts'

/** One staged fact of a person's background, in `@gb/world`'s shape. */
export type BackgroundFact = NonNullable<Npc['background']>[number]

/** What the town says about somebody behind their back, which is how a fact is heard from a third party. */
const HEARSAY: readonly string[] = [
  'Owes money on the other side of town and knows it.',
  'Was seen leaving by the night door with something under a coat.',
  'Has a key to a door that is not theirs.',
  'Was there the night everybody stopped talking about, and says nothing.',
  'Sends money somewhere every month and never says where.',
  'Is not the name on the lease.',
  'Turned down more than the place is worth, twice.',
  'Has been asked to leave town once already, politely.',
]

/**
 * The codex: what a player can learn of a person, staged by how they learn it.
 * Meeting them gives the job; talking gives the history and the interest;
 * finishing their work gives what they care about; and the last is only ever
 * heard from somebody else. The first sentence of the history is a fact of its
 * own, so a person met twice has more to read than a person met once.
 */
export function backgroundOf(role: NpcRole, placeName: string, life: Life, rng: Rng): BackgroundFact[] {
  const [origin, past] = life.history.split(/(?<=\.)\s+/)
  const facts: BackgroundFact[] = [
    { fact: `The ${role} at ${placeName}.`, unlockedBy: 'met' },
    { fact: origin ?? life.history, unlockedBy: 'talked' },
    { fact: `Interested in ${life.interests}.`, unlockedBy: 'talked' },
    { fact: `Cares about ${life.cares}.`, unlockedBy: 'quest' },
    { fact: rng.pick(HEARSAY), unlockedBy: 'told' },
  ]
  if (past) facts.splice(2, 0, { fact: past, unlockedBy: 'talked' })
  return facts
}
