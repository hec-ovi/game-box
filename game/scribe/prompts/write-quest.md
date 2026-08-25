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

## How a quest is put together

A quest is a chain of steps the player works through. Every step has its own id
(`step_0001`, `step_0002`, and on), an `objective` line written to the player,
and `next`, naming the step or steps that follow.

`startStepId` names the first step. Exactly one path has to end in a `complete`
step.

Every step names its next step. Only `complete` and `fail` end a chain, and only
`choice` routes through its own options instead. Anything else that leads
nowhere is a dead end, and a dead end throws the quest away.

## The step kinds, and what each one makes the player do

| kind | fields it needs | what the player does |
|---|---|---|
| `talk` | `npcId`, optional `topic` | finds that person and talks to them |
| `goto` | `place: {"plotId": "..."}` | walks to that building |
| `collect` | `itemId`, optional `count`, `alternates`, `allowSteal` | picks the thing up and carries it |
| `deliver` | `itemId`, `toNpcId`, optional `count`, `alternates` | hands what they are carrying to that person |
| `escort` | `npcId`, `place: {"plotId": "..."}` | walks to that building with that person alongside |
| `unlock` | `doorId` | opens that locked door, with its key in hand or its code known |
| `hack` | `machineId` | opens that locked screen, with its code known |
| `beat-game` | `machineId`, `score` | plays the game on that screen until it reaches that score |
| `buy` | `itemId`, optional `count`, `alternates` | pays for the thing over its counter and carries it |
| `choice` | `prompt`, `options` (each an `id`, a `label` and its own `next`) | is offered a fork and picks one |
| `join` | `waitFor` | waits until every branch listed there has finished |
| `any-of` | `oneOf` | whichever branch listed there finishes first wins, the rest are dropped |
| `complete` | | the quest ends well |
| `fail` | | the quest ends badly |

**Taking a thing is `collect`. Handing it over is `deliver`.** If an objective
line says the player takes, fetches, lifts, fishes out or picks something up,
there is a `collect` step for that exact `itemId`. If it says they bring, give,
hand over, return or drop something off, there is a `deliver` step naming that
`itemId` and the `toNpcId` who receives it, and a `collect` for it earlier on the
same path. Talking to somebody is not collecting from them, and walking to a
building is not picking anything up.

Writing an objective that promises something the steps do not do is the worst
mistake available here: the player reads the line, goes looking for the ledger,
and the game never lets them touch it. Read your own objective lines back and
check each verb against the step it sits on.

`count` is how "three of the crates" is written: put the same `count` on the
`collect` and on the `deliver`, over the pool made of `itemId` plus anything in
`alternates`. Never ask for more of a thing than the list above holds.

An `escort` step is somebody walking with the player, so the person has to be
somebody who would leave their post, and the step after it should be worth the
walk.

## Locks, screens and counters

The corner above says which doors are locked, what opens each, which screens
are on and what opens those, and what each thing over a counter sells for. A
job through one of them is written like this:

- Anything marked as behind a locked door (a person, a thing, a screen) cannot
  be named by a step until an `unlock` step for that door has run earlier on
  the same path. The giver is never somebody behind a lock.
- An `unlock` opens only with the key in hand or the code known. Before it,
  put a `talk` step with whoever carries the key and a `give-item` effect
  naming that key on it, or a `talk` step with somebody who would know the
  code and a `give-password` effect with the door's own code. An `unlock`
  with neither before it is a door the player stands in front of and cannot
  open.
- A `hack` opens a locked screen only with its code known: a `give-password`
  effect with the screen's own code on an earlier `talk` step. A screen that
  is open to anybody is nothing to hack.
- A `beat-game` names a screen that runs snake or tetris and the score to
  reach. It is somebody's bet, so let the giver say what beating it is worth.
- A `buy` names a thing with a price and a seller. The player pays the price,
  so put `money-at-least` for the whole bill in the quest's own `requires`,
  and let the reward cover what they spent.

## What gates a step, and what a step changes

`requires` gates a step: `has-item`, `flag`, `money-at-least`,
`reputation-at-least`, `reputation-below`, `has-companion`.

`effects` are the only way a quest changes the player: `give-item`, `take-item`,
`charge`, `reputation`, `set-flag`, `companion-join`, `companion-leave`,
`give-password` (the player learns that word). The `reward` is the pay: no
step pays on its own.

## Ending badly

`failWhen` ends the quest badly without the player reaching a `fail` step:

- `time-limit`, in seconds from the moment the quest is taken.
- `npc-lost`, when that person dies or leaves.
- `item-lost`, when the thing is destroyed.

Add one only when the errand really is against the clock or really does hang on
one person or one object. Most errands have none.

## Pay

Pay what the work is worth: the walk, the steps, whether it is a theft or
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
`collect` step, and let the pay and the standing reflect what you are asking for.

## The writing

The `objective` lines are the words on the player's screen, so write them to the
player and name the person and the place, in the shape of "Take the [thing] from
[place]" or "Give [person] the [thing] at [place]", with the brackets filled from
the corner above. `title` is what the journal calls this quest. `summary` is the
giver's own reason for asking, in their voice.

Titles already used in this city, which this one must not repeat:

{{usedTitles}}
