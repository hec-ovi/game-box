import type { Rng } from '@gb/kit'
import type { Npc, NpcRole, Premise } from '@gb/world'

/** A person's own life, in `@gb/world`'s shape with every part written: what the file carries and a prompt is handed. */
export type Life = { readonly [Part in keyof NonNullable<Npc['life']>]-?: string }

/** The place a line is about, filled in where the line says `{place}`. */
const at = (line: string, place: string): string => line.replaceAll('{place}', place)

/**
 * Why somebody is standing where they are, said out loud in the first person:
 * their shift, their shop, their room, their appointment. Talk puts it in the
 * brief as written and describes them to others by it, so it has to be a
 * sentence they could say.
 */
const REASONS: Record<NpcRole, readonly string[]> = {
  bartender: [
    "I keep the bar at {place}; somebody has to be behind it while the doors are open.",
    "I'm on the late shift at {place} and I don't leave till the last one does.",
    "I run {place}, or the bank does, and I'm here whenever it's open.",
  ],
  patron: [
    "I'm off shift and {place} is where I come to sit.",
    "I'm waiting for somebody who is late, and {place} is where we said.",
    "I come to {place} most days about now; it's cheaper than heating my own room.",
  ],
  clerk: [
    "I mind the counter at {place}; it's my shift till closing.",
    "I'm doing the stock at {place}, which is what I do every day at this hour.",
    "I'm the only one on at {place} today, so I'm everywhere at once.",
  ],
  resident: [
    "I live here; this is my front room.",
    "I'm home between shifts and the kettle's on.",
    "I've lived at {place} longer than the roof has.",
  ],
  worker: [
    "I'm on shift at {place} and I'll be here till the whistle.",
    "I'm covering for somebody at {place} who didn't turn up.",
    "I've got a job on at {place} that should have been finished yesterday.",
  ],
  vendor: [
    "This is my stall at {place}, and I'm here every day it opens.",
    "I set up at {place} before light and I stay till the stock's gone.",
    "I'm selling at {place} today; tomorrow I might be two streets over.",
  ],
  cook: [
    "I run the kitchen at {place}; nothing goes out that I haven't looked at.",
    "I'm prepping at {place} for a rush that may or may not come.",
    "I've been on my feet at {place} since the ovens went on.",
  ],
  receptionist: [
    "I'm on the desk at {place}; everybody who comes in comes past me.",
    "I keep the book at {place}, and the book is what runs the place.",
    "I'm holding the front at {place} while the owner is elsewhere again.",
  ],
  mechanic: [
    "I've a job on the bench at {place} that's fighting me.",
    "I'm the one who fixes things at {place}, and there's always something.",
    "I'm waiting on a part at {place} and doing what I can without it.",
  ],
  courier: [
    "I'm between runs, and {place} is where I wait for the next one.",
    "I'm dropping something at {place} and then I'm gone again.",
    "I'm at {place} because a parcel for here is on my list and I'm early.",
  ],
  guard: [
    "I'm on the door at {place}; I watch who comes in and what leaves.",
    "I'm paid to stand at {place}, so I stand at {place}.",
    "I'm keeping an eye on {place} tonight, which is quieter than it sounds.",
  ],
  wanderer: [
    "I came into {place} out of the weather and haven't gone back out yet.",
    "I'm passing through, and {place} had a wall to lean on.",
    "I'm at {place} because it's warm and nobody's asked me to leave.",
  ],
}

/** What a walker is doing out on the street, first person, naming no place: the crowd says where. */
const ERRANDS: Record<NpcRole, readonly string[]> = {
  bartender: ["I'm fetching a crate the supplier left at the wrong door.", "I'm walking to the bank before it shuts, with the takings."],
  patron: ["I'm going to see a man about money he owes me.", "I'm walking off the last drink before the next one."],
  clerk: ["I'm taking a delivery slip across town to sort out a mistake that wasn't mine.", "I'm on my break, and I walk on my break."],
  resident: ["I'm going for bread and the paper before the shop shuts.", "I'm walking to my sister's to see if she's eaten."],
  worker: ["I'm walking home from the shift the long way, to think.", "I'm going to the yard to see if there's work tomorrow."],
  vendor: ["I'm off to the wholesaler to argue about the weight.", "I'm walking the stock back to the lockup."],
  cook: ["I'm going to the market myself, because nobody else can pick a fish.", "I'm walking to the grower to settle the account."],
  receptionist: ["I'm taking a message across town that shouldn't go by phone.", "I'm walking to the post before the last collection."],
  mechanic: ["I'm walking to a customer's to look at a fault I can't see from the bench.", "I'm going to pick up a part that finally came in."],
  courier: ["I'm carrying a parcel across town that somebody paid extra to have today.", "I'm doing the round: six drops and one signature that never turns up."],
  guard: ["I'm walking the block once before I go back on the door.", "I'm going home; my shift's done and my feet know it."],
  wanderer: ["I'm looking for somewhere to sleep that isn't out in it.", "I'm walking because it's the one thing here that's free."],
}

/** Where somebody came from before this. */
const ORIGINS: readonly string[] = [
  'Born two streets from here and never got further.',
  'Came in on a freight years ago and stayed for somebody who has since left.',
  'Grew up in the next town over and came here for the work, which then went.',
  'Raised above a shop that is now something else.',
  'Arrived with a suitcase and a name nobody here could pronounce.',
  'Came here to look after a parent and stayed after the funeral.',
  'Walked in over the pass one autumn and found the road shut behind them.',
  'Was sent here for a season by an employer who forgot to send for them back.',
]

/** What they did before the job they have now. */
const PASTS: readonly string[] = [
  'Did a year of something respectable and hated every day of it.',
  'Kept the books for somebody who did not want them kept accurately.',
  'Worked nights for a decade and still cannot sleep in the dark.',
  'Drove for a haulier until the haulier stopped paying.',
  'Was apprenticed to a trade that no longer exists in this town.',
  'Ran a stall, then a shop, then nothing, then this.',
  'Spent some years away that they describe as "away".',
  'Was somebody in this town once, and is now somebody else.',
]

/** What the town's own turn did to them, when the town has one; otherwise a turn of their own. */
const TURNS: readonly string[] = [
  'Lost a room, a job and a friend in the same season, in that order.',
  'Found out who their friends were the year the money stopped.',
  'Kept their head down through it and came out the other side with a limp.',
  'Was on the wrong side of it and has been paying for that since.',
]

const INTERESTS: readonly string[] = [
  'the racing, and the maths of it',
  'old maps of the town, the more wrong the better',
  'birds, which nobody here will talk about',
  'a card game with rules that change by table',
  'mending clocks that were never worth mending',
  'the history of every building on this street',
  'boats, in a town with or without water',
  'growing something on a windowsill against the odds',
  'the wireless, late, from stations nobody else can find',
  'who is related to whom, and how',
  'cooking one dish very well and nothing else',
  'walking the whole town in one night',
]

const MANNERS: readonly string[] = [
  'short sentences, no small talk, looks past you while thinking',
  'talks with the hands and repeats the last word of your sentence back to you',
  'slow, dry, lets a silence sit until you fill it',
  'quick and warm, interrupts, apologises, interrupts again',
  'formal, old-fashioned, calls everybody by their surname',
  'says less than they know and lets you notice',
  'asks a question back before answering yours',
  'loud in the open, quiet the moment somebody else can hear',
  'chooses every word, then throws in a joke to cover it',
  'blunt to the point of rudeness, and sorry about it afterwards',
]

const CARES: readonly string[] = [
  'the rent, which is due before the money is',
  'a sister two towns over who does not write',
  'getting the books to balance without lying to anyone',
  'being the one person here who is never late',
  'a dog that is not theirs but comes to them',
  'the good name of this place, whatever it is worth',
  'the people who worked here before and were not paid',
  'keeping a promise made to somebody who has died',
  'not being the last one left on this street',
  'a child who is doing better than they did, far away',
]

const AVOIDS: readonly string[] = [
  'the night of the fire, and who was where',
  'who really owns the building',
  'what happened to the money from the last collection',
  'the brother in the next town',
  'why they left the job before this one',
  'anything about the police, with a smile',
  'the name they arrived with',
  'the year they were away',
  'what is kept in the back room',
  'their own health, briskly',
]

/**
 * A life for one person, drawn from their role, their place and the town's own
 * story. Two people in one room answer differently because of it: each has a
 * reason to be standing here, an errand for when they walk, a history, and a
 * few things they care about and will not talk about.
 */
export function lifeOf(role: NpcRole, placeName: string, rng: Rng, premise?: Premise): Life {
  const side = premise ? rng.pick(premise.sides) : undefined
  const turn = premise ? `Then ${premise.happened.replace(/\.$/, '')}, and they came out of it doing this.` : rng.pick(TURNS)
  // in the world schema's own order, so a file written and read back is the same bytes
  return {
    history: `${rng.pick(ORIGINS)} ${rng.pick(PASTS)} ${turn}`,
    interests: rng.pick(INTERESTS),
    manner: rng.pick(MANNERS),
    cares: side && rng.chance(0.4) ? `what ${side.name} want: ${side.wants}` : rng.pick(CARES),
    avoids: premise && rng.chance(0.3) ? `which side of it they are on: ${premise.stake}` : rng.pick(AVOIDS),
    reason: at(rng.pick(REASONS[role]), placeName),
    errand: rng.pick(ERRANDS[role]),
  }
}
