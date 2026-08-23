import type { Rng } from '@gb/kit'
import type { BuildingKind, NpcRole } from '@gb/world'

/** The one line that says how somebody carries themselves. */
const ROLE_TRAITS: Record<NpcRole, readonly string[]> = {
  bartender: ['pours slowly, listens hard, forgets nothing', 'keeps the peace by knowing who to serve last', 'friendly, and reads a room in one glance'],
  patron: ['here most nights, opinions on everything', 'talks to whoever sits down, whether they meant to or not', 'nurses one drink for hours and watches the door'],
  clerk: ['polite, precise, watching the clock', 'knows the stock list by heart and says so', 'helpful right up to the moment you argue about the price'],
  resident: ['keeps to themselves, notices the street', 'chatty about the neighbours, careful about themselves', 'up early, in bed late, always halfway through a chore'],
  worker: ['tired, straightforward, wants the shift over', 'proud of doing it right, sick of doing it twice', 'answers in as few words as the job allows'],
  vendor: ['cheerful until you haggle', 'shouts prices at the street and means every one', 'gives you the good stuff if you ask about their day'],
  cook: ['brusque, proud of the food, hates waste', 'moves fast, talks faster, never puts the knife down', 'suspicious of anyone who orders it well done'],
  receptionist: ['friendly on the surface, sharp underneath', 'remembers every name and half the secrets', 'runs the place and lets the owner think otherwise'],
  mechanic: ['talks in parts and prices', 'wipes their hands twice before shaking yours', 'would rather show you the fault than explain it'],
  courier: ['always half out the door', 'knows every shortcut and none of the street names', 'counts the parcels twice and the money three times'],
  guard: ['bored, but not as bored as they look', 'polite, immovable, and paid by the hour', 'watches your hands, not your face'],
  wanderer: ['drifted in from somewhere, vague about where', 'talks like they are already leaving', 'grateful for company, careful with the details'],
}

/** A habit on top of the trait, so two bartenders are not one bartender twice. */
const QUIRKS: readonly string[] = [
  'Keeps a ledger nobody else is allowed to read.',
  'Owes money on the other side of town and knows it.',
  'Feeds a stray that turns up at the same hour every day.',
  'Collects something small and will show you if asked.',
  'Sleeps badly and is up before anyone else.',
  'Never sits with their back to the door.',
  'Hums the same four bars all day.',
  'Writes letters they do not send.',
  'Has a brother in the next town they will not name.',
  'Counts change out loud, every time.',
  'Keeps a coat by the door in case they have to leave fast.',
  'Trusts the weather more than the news.',
  'Grew up two streets away and has never left.',
  'Came in on a freight and stayed for somebody.',
  'Reads the same book over and over.',
  'Fixes things nobody asked them to fix.',
]

/** What somebody in this role has picked up, in their own line of work. */
const ROLE_KNOWLEDGE: Record<NpcRole, readonly string[]> = {
  bartender: ['Hears who is short of money before their landlord does.', 'Knows which regulars have stopped coming in and why.', 'Waters nothing down, and says so twice a night.'],
  patron: ['Sees who comes in with somebody they should not.', 'Can name every drink on the shelf and half the people at the bar.', 'Was here the night of the thing everybody stopped talking about.'],
  clerk: ['Knows what came in this week and what never turned up.', 'Keeps the returns nobody claimed in a box out the back.', 'Can tell you the price of anything within a coin.'],
  resident: ['Knows whose window is lit at odd hours.', 'Has a key to a door two streets over, for a neighbour.', 'Remembers what stood here before the current building did.'],
  worker: ['Knows which of the tools is about to fail.', 'Can say who was on shift on any given night.', 'Has been paid late twice this month.'],
  vendor: ['Knows which supplier is cutting the weight.', 'Can tell a forged coin by the sound of it.', 'Keeps the best of the stock under the counter for regulars.'],
  cook: ['Knows exactly what goes out the back door after closing.', 'Can tell you who has an account and who owes on it.', 'Buys from one grower and will not say which.'],
  receptionist: ['Knows who signed the book under a false name.', 'Keeps the spare keys and a list of who borrowed them.', 'Takes the messages nobody else was supposed to hear.'],
  mechanic: ['Knows every vehicle in town by the sound of it.', 'Has a part on order that never arrives.', 'Can say who drove out of town late and came back muddy.'],
  courier: ['Knows every address worth knowing and half the shortcuts.', 'Has carried a parcel they wish they had opened.', 'Can tell you which road out of town is passable today.'],
  guard: ['Knows which door does not lock properly.', 'Watches the same three people every shift.', 'Was told not to write something in the log.'],
  wanderer: ['Has walked in from the next town and seen the road.', 'Knows which places will let you sleep out of the rain.', 'Hears things in three towns and repeats them in the fourth.'],
}

/** What the walls of this kind of place tell somebody who stands in them all day. */
const PLACE_KNOWLEDGE: Record<BuildingKind, readonly string[]> = {
  bar: ['The back room is booked on the same night every week.', 'The cellar door sticks unless you lift it.'],
  cafe: ['The morning crowd and the evening crowd never overlap.', 'Somebody left a bag here a week ago and never came back.'],
  restaurant: ['The kitchen orders more than the tables can eat.', 'One table is kept free most nights, for nobody in particular.'],
  shop: ['Stock goes missing in ones, never in fives.', 'The good goods come in on the same day as the post.'],
  market: ['The best stalls are gone by mid morning.', 'Two traders here refuse to stand next to each other.'],
  office: ['The upstairs office has not been used in months.', 'Papers go out of here in a locked case.'],
  workshop: ['There is a job on the bench nobody has paid for.', 'The forge is lit before anyone else in the street is awake.'],
  warehouse: ['Half the crates in the back are addressed to one buyer.', 'The night door is used more than the day one.'],
  clinic: ['People come in at night with injuries they will not explain.', 'The medicine cupboard is counted twice a day now.'],
  hotel: ['One room has been paid for a month in advance and never slept in.', 'The register has more names than there are guests.'],
  station: ['Freight comes through at hours the timetable does not mention.', 'People wait here who never board anything.'],
  chapel: ['The collection box is emptied by somebody who does not attend.', 'The bell is rung on days that are not holy.'],
  house: ['The neighbours argue on the same night each week.', 'A room in this house is kept locked.'],
  apartment: ['Nobody knows who lives on the top floor.', 'The stairwell light has been out since spring.'],
}

/** Talk of the town: what anybody standing in the street would know. */
const STREET_KNOWLEDGE: readonly string[] = [
  'The road out of town is slower than it looks on a map.',
  'Prices went up twice this season and nobody explained why.',
  'The town council meets and decides nothing.',
  'There is work going for anybody who does not ask questions.',
  'Somebody new has been asking about the old buildings.',
  'A shipment came in last month and half of it is unaccounted for.',
  'The rain comes off the hills without warning here.',
  'Two families in this town do not speak, and everybody keeps track.',
  'There was a fire on this street years ago and the gap is still there.',
  'The night watch does one round and then sits down.',
]

/** How somebody comes across: their role, one habit, and where they work. */
export function personalityOf(role: NpcRole, placeName: string, rng: Rng): string {
  return `${rng.pick(ROLE_TRAITS[role])}. ${rng.pick(QUIRKS)} Works at ${placeName}.`
}

/**
 * What one person can tell you: their post, something their trade taught them,
 * something the building knows, and now and then what the street is saying.
 */
export function knowledgeOf(role: NpcRole, placeKind: BuildingKind, placeName: string, rng: Rng): string[] {
  const lines = [
    `Works at ${placeName} as the ${role}.`,
    rng.pick(ROLE_KNOWLEDGE[role]),
    rng.pick(PLACE_KNOWLEDGE[placeKind]),
  ]
  if (rng.chance(0.5)) lines.push(rng.pick(STREET_KNOWLEDGE))
  return lines
}
