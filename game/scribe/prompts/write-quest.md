Write one errand that somebody in this city hands to the player.

City: {{cityName}}
Theme: {{theme}}
Give this quest the id {{questId}} and the kind {{questKind}}.
{{questRole}}

## The corner of the city it happens in

This errand starts at {{home}}. Here is that place and the ones around it, with
everyone in them and everything lying about, by id, and the walk from
{{home}}'s door:

{{places}}

Use only the ids above. An id you invent throws the whole quest away. Pick the
giver from the people above and put their id in `giverNpcId`.

The metres are the walk between two doors. Most of these places are within
shouting distance of each other, so an errand that sends the player a few
hundred metres is a walk across town: say so in the objective, and let the
difficulty and the pay carry it.

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

## Side work and secrets

- Any step may be `optional: true`. The quest still finishes if the player never
  touches it. Point its `next` at the step the main line was going to reach
  anyway, so the side trip rejoins rather than stranding the player. Use it for
  what a careful player finds and a hurried one misses.
- Any step may be `hidden: true`. It stays off the player's board until a
  `reveal` effect on an earlier step shows it. Every hidden step needs something
  that reveals it, and if the quest cannot finish without that step, the reveal
  has to sit on a step that always runs.

## What gates a step, and what a step changes

`requires` gates a step: `has-item`, `flag`, `money-at-least`,
`reputation-at-least`, `reputation-below`, `has-companion`.

`effects` are the only way a quest changes the player: `give-item`, `take-item`,
`pay`, `charge`, `reputation`, `set-flag`, `companion-join`, `companion-leave`,
`reveal`.

## Ending badly

`failWhen` ends the quest badly without the player reaching a `fail` step:

- `time-limit`, in seconds from the moment the quest is taken.
- `npc-lost`, when that person dies or leaves.
- `item-lost`, when the thing is destroyed.

Add one only when the errand really is against the clock or really does hang on
one person or one object. Most errands have none.

## Difficulty and pay

`difficulty` says how much work this is, and the pay has to sit inside that
tier's band. Everything the quest hands over is measured against it: the
`reward` plus every `pay` effect on every step.

{{rewardBands}}

Paying nothing is refused. Pick the tier that matches the work, then pay
somewhere inside its band. `reward.faction` is who the standing is with; the
town itself is `town`.

## Stealing

If an item has an owner, taking it is stealing: set `allowSteal: true` on the
`collect` step, and let the pay and the standing reflect what you are asking for.

## The writing

The `objective` lines are the words on the player's screen, so write them to the
player and name the person and the place: "Take the unmarked ledger from Dunn
Supply", "Give Hollis the envelope at the Copper Wheel". `title` is what the
journal calls this quest. `summary` is the giver's own reason for asking, in
their voice.

Titles already used in this city, which this one must not repeat:

{{usedTitles}}
