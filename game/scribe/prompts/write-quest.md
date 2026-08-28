Write one errand that somebody in this city hands to the player.

City: {{cityName}}
Theme: {{theme}}
What the town is about:
{{premise}}
{{asked}}
Give this quest the id {{questId}} and the kind {{questKind}}.
{{questRole}}

## The corner of the city it happens in

This errand starts at {{home}}. Here is that place and the ones around it, with
everyone in them and everything lying about, by id, and the walk from
{{home}}'s door:

{{places}}

The tool offers these ids and no others. Pick the giver from the people above
and put their id in `giverNpcId`.

The metres are the walk between two doors. Most of these places are within
shouting distance of each other, so an errand that sends the player a few
hundred metres is a walk across town: say so in the objective, and let the
pay carry it.

## How a quest is told

You tell the story as `beats`: what happens, in the order it happens. One beat
is one thing the player does. The game builds the flow out of them, so there is
nothing here about steps, ids or what leads where. Write the errand the way you
would tell it to somebody: first this, then that, then this.

Each beat says what kind of thing it is, the people, places and things it
involves by id, and the `objective` line the player reads while they are on it.

A run of four to eight beats is an errand. Keep the order true: if the player
carries something to somebody, the beat that picks it up comes before the beat
that hands it over.

## The beats, and what each one makes the player do

| kind | fields it needs | what the player does |
|---|---|---|
| `talk` | `npcId`, optional `topic`, optional `hands` | finds that person and talks to them |
| `goto` | `where: {"plotId": "..."}` | walks to that building |
| `collect` | `itemId`, optional `count`, `alternates`, `allowSteal` | picks the thing up and carries it |
| `deliver` | `itemId`, `toNpcId`, optional `count`, `alternates` | hands what they are carrying to that person |
| `escort` | `npcId`, `where: {"plotId": "..."}` | walks to that building with that person alongside |
| `unlock` | `doorId` | opens that locked door, with its key in hand or its code known |
| `hack` | `machineId` | opens that locked screen, with its code known |
| `beat-game` | `machineId`, `score` | plays the game on that screen until it reaches that score |
| `buy` | `itemId`, optional `count`, `alternates` | pays for the thing over its counter and carries it |
| `choice` | `prompt`, `options` (each a `label` and its own `beats`) | is offered a fork and picks one |

**Taking a thing is `collect`. Handing it over is `deliver`.** If an objective
line says the player takes, fetches, lifts, fishes out or picks something up,
there is a `collect` beat for that exact `itemId`. If it says they bring, give,
hand over, return or drop something off, there is a `deliver` beat naming that
`itemId` and the `toNpcId` who receives it, and a `collect` for it earlier.
Talking to somebody is not collecting from them, and walking to a building is
not picking anything up.

Writing an objective that promises something the beats do not do is the worst
mistake available here: the player reads the line, goes looking for the ledger,
and the game never lets them touch it. Read your own objective lines back and
check each verb against the beat it sits on.

`count` is how "three of the crates" is written: put the same `count` on the
`collect` and on the `deliver`, over the pool made of `itemId` plus anything in
`alternates`. Never ask for more of a thing than the list above holds.

An `escort` beat is somebody walking with the player, so the person has to be
somebody who would leave their post, and the beat after it should be worth the
walk.

## Forks

A `choice` beat is where the player decides something: `prompt` is the question
in the giver's words, and each option is a `label` (the words on the button) and
its own short run of `beats`. Whichever road they take, the quest carries on
with the beat after the fork. Use one where the errand really does turn on a
decision: who ends up with the thing, whose side the player takes.

## Locks, screens and counters

The corner above says which doors are locked, what opens each, which screens
are on and what opens those, and what each thing over a counter sells for.

- A person, a thing or a screen marked as behind a locked door is reached by
  writing an `unlock` beat for that door first. Getting hold of the key or the
  code is not your problem: the game puts the conversation in, with whoever
  carries it. The giver is never somebody behind a lock.
- A `hack` names a locked screen. A screen that is open to anybody is nothing
  to hack.
- A `beat-game` names a screen that runs snake or tetris and the score to
  reach. It is somebody's bet, so let the giver say what beating it is worth.
- A `buy` names a thing with a price and a seller. The player pays the price out
  of their own pocket, and the reward should cover what they spent.
- Where the story wants somebody to hand something over in front of the player,
  put it in that talk beat's `hands`.

## Ending badly

`failWhen` ends the quest badly:

- `time-limit`, in seconds from the moment the quest is taken.
- `npc-lost`, when that person dies or leaves.
- `item-lost`, when the thing is destroyed.

Add one only when the errand really is against the clock or really does hang on
one person or one object. Most errands have none.

## Pay

Pay what the work is worth: the walk, the beats, whether it is a theft or
against the clock. The tier follows from the pay, and the tier decides what
else the reward may carry:

{{rewardBands}}

Paying nothing is refused. `reward.faction` is who the standing is with; the
town itself is `town`.

Beyond credits and standing, a reward may hand over what the corner holds,
inside the tier's allowance: `access`, a list of doors the player may pass from
now on (`{"doorId": "..."}` for one of the locked doors above, or
`{"interiorId": "..."}` for a place's street door, the second id in its
heading); `car`, one of the models the tool offers, off the bench of somebody
in this corner who works at one; `deed`, the interior id of a place listed
above as for sale, which makes it the player's. A job through a lock is worth
the run of that door.

## Stealing

If an item has an owner, taking it is stealing: set `allowSteal: true` on the
`collect` beat, and let the pay and the standing reflect what you are asking for.

## The writing

The `objective` lines are the words on the player's screen, so write them to the
player and name the person and the place, in the shape of "Take the [thing] from
[place]" or "Give [person] the [thing] at [place]", with the brackets filled from
the corner above. `title` is what the journal calls this quest. `summary` is the
giver's own reason for asking, in their voice.

Everything in this city is already named, and the list above is where the names
are. Call a building, a part of town or a person by exactly the name it is given
there, and invent none of your own: a line that calls a building anything else
sends the player to a door with another name over it, and the marker still goes
where the id says.

Two rules follow from that, and a line that breaks either comes back to you:

- **A beat that walks the player somewhere says where**, by that building's own
  name off the list.
- **A beat names only where it happens.** The place it is set in, the part of
  town that place is in, and the people standing in that place. Somebody who
  works in another building does not belong there, and an errand that needs them
  wants a beat of its own.

A line that names nobody and nowhere is fine where that is what the beat wants.

Titles already used in this city, which this one must not repeat:

{{usedTitles}}
