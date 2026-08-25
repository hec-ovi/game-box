# @gb/play contract

contractVersion: 0.5.0

## Purpose

The playthrough: what the player carries, what they stole, what they left standing somewhere, what they can afford, what they have been told, who is walking with them, where they are standing, which job they are following, what they have found, what each person holds of them, and what time it is.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `PlayerState.create(worldId, startingMoney?)` | ids as strings | money is a whole number, zero or more |
| `PlayerState.load(value, worldId)` | [schema/player-state.json](schema/player-state.json) | the save's `worldId` matches the world being played |
| mutations: `take`, `drop`, `earn`, `setFlag`, `adjustReputation`, `addCompanion`, `removeCompanion` | ids and whole numbers | see errors |
| `pay(amount)` | a whole number of credits, zero or more | refused when it is not, or not held; `spend(amount)` is the same call under the name `@gb/quest` pays with, kept until it moves to `pay` |
| `buy(itemId, price)` | an item id and a price as for `pay` | pays and takes in one motion; refused, nothing moves |
| `discover({ place } \| { npc })` | an interior id, or an npc id | names, not lookups; a nameless id is ignored |
| `unlock(npcId, factId)` | ids as strings | names, not lookups; also lists the person as known of |
| `remember(npcId, fact, source)` | a sentence up to `FACT_LENGTH` (200) characters, and one of `MEMORY_SOURCES` | see errors |
| `warm(npcId)`, `cool(npcId)` | an npc id | one step along `DISPOSITIONS`, staying on the scale at either end |
| `setWhere(where)` | `{ x, z, heading, interiorId? }`, metres and radians | numbers that are not real leave the last place standing |
| `setTracked(questId)` | a quest id, or `null` / nothing for none | the id is a name, not a lookup |
| `place(itemId, at)` | `{ interiorId, anchorId }`, or `null` to forget | the ids are names, not lookups |
| `clock.advance(realSeconds)` | real seconds since the last frame | a negative or non-finite step does nothing |
| `clock.setRate(gameSecondsPerRealSecond)` | 0 to 86400 | a positive rate runs at it, resuming if paused; 0 is `pause()` |
| `clock.pause()`, `clock.resume()` | nothing | stop and start; the rate is kept across both |
| `clock.setTime(hour, minute?)` | whole 0-23 and 0-59 | leaves the day alone |
| `clock.setDay(day)` | whole, 1 or more | leaves the hour alone |
| `clock.setWeather(weather)` | one of `WEATHERS` | `clear`, `overcast`, `rain` |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `toJSON()` | [schema/player-state.json](schema/player-state.json) | a complete save for this world, clock included |
| queries: `has`, `isStolen`, `inventory`, `money`, `flag`, `reputation`, `companions`, `isCompanion` | plain values | unknown flags read `false`, unknown factions read `0` |
| `where` | `{ x, z, heading, interiorId? }` or nothing | a copy, so writing to it changes no state; the heading is inside one turn |
| `tracked` | a quest id or nothing | whatever was last followed, resolved against nothing |
| `placedAt(itemId)` | `{ interiorId, anchorId }` or nothing | where the player left that thing |
| `placed()` | `[{ itemId, interiorId, anchorId }]` | everything they left somewhere, each thing once |
| `discovered()` | [schema/player-state.json](schema/player-state.json) `codex` | `{ places, people: [{ npcId, unlocked }] }`, each in the order first found; a copy |
| `unlocked(npcId)` | fact ids | what has been learned of one person, in the order learned; nobody reads `[]` |
| `memories(npcId)` | `[{ fact, source }]` | what that person holds, oldest first, at most `MEMORY_CAP` (12); nobody reads `[]` |
| `disposition(npcId)` | one of `DISPOSITIONS` | `hostile`, `cool`, `neutral`, `warm`, `friendly`; anyone not yet moved reads `neutral` |
| `clock` | a `GameClock` | the playthrough's own clock, saved and restored with it |
| `clock.day`, `clock.hour`, `clock.minute`, `clock.secondsOfDay` | numbers | day counts from 1; `secondsOfDay` is fractional, the rest are whole |
| `clock.rate`, `clock.weather` | a number above 0, one of `WEATHERS` | the rate it runs at, and what the sky was last set to |
| `clock.paused` | boolean | whether it is stopped; `rate` is what `resume` brings back |
| `clock.isDark` | boolean | true from 20:00 up to 05:59, whatever the weather |
| `clock.phase`, `clock.reading` | one of `DAY_PHASES`, a plain sentence fragment | `reading` is the phase in words ("late evening", "just before dawn"), written to go in front of a language model |
| `clock.totalSeconds` | whole seconds | game seconds since day 1 at 00:00; this is the number the `clock` game event carries |

## Money

`earn` is the reward and takes whatever it is given, rounding down to whole
credits and ignoring anything below zero. `pay` and `buy` are the other
direction and fail closed: a price is a whole number of credits, zero or more,
and a refused payment deducts nothing.

```ts
player.buy('item_0005', 5)   // pays 5 and the thing is in hand
player.buy('item_0005', 1)   // already-carried: nothing paid
player.buy('item_0006', 40)  // not-enough-money: nothing paid, nothing taken
player.pay(2.5)              // invalid-amount
```

The price comes from whoever sells: the world file or the counter. This box
holds the credits and the rule that they never go below zero.

## What the player has found

The codex is a record of what has been come across: places walked into and
people met, each once, in the order they were first found. Per person it also
holds which of their background facts the player has learned, by id.

```ts
player.discover({ place: 'interior_0003' })
player.discover({ npc: 'npc_0002' })
player.unlock('npc_0002', 'fact_0001')
player.discovered()
// { places: ['interior_0003'], people: [{ npcId: 'npc_0002', unlocked: ['fact_0001'] }] }
```

A fact id is a name to this box: the box that wrote the person's background
decides what it means, and the codex on screen looks it up there. Learning a
fact about somebody never met lists them too, since being told of a person is
knowing of them; `discover` on somebody already listed changes nothing.

## What each person holds of the player

Each person keeps a few facts of their own, with where each came from: `told`
when the player said it, `seen` when they watched it happen. Nothing spreads: a
fact given to one person is held by that person and nobody else. A person holds
at most `MEMORY_CAP` (12) facts and the oldest goes when a new one arrives, so a
save grows by a few lines per person spoken to and no more. A fact is one
sentence, `FACT_LENGTH` (200) characters at most; the same fact from the same
source is held once.

```ts
player.remember('npc_0002', 'took a job from the rival bar', 'told')
player.memories('npc_0002') // [{ fact: 'took a job from the rival bar', source: 'told' }]
```

Each person also has a disposition towards the player, separate from the town's
reputation: one barman can warm while another turns. `warm` and `cool` move it
one step along `DISPOSITIONS` and stop at either end.

```ts
player.disposition('npc_0002') // 'neutral'
player.warm('npc_0002')
player.disposition('npc_0002') // 'warm'
```

## Where the player is standing

```ts
player.setWhere({ x: 41.5, z: -12.25, heading: 2.1 })                             // out in the city
player.setWhere({ x: 2.5, z: 3, heading: 0.5, interiorId: 'interior_0007' })      // inside a room
player.where // { x: 2.5, z: 3, heading: 0.5, interiorId: 'interior_0007' }
```

`x` and `z` are metres and `heading` is radians. Name `interiorId` whenever the
player is indoors, because a room is measured in its own metres from its own
corner: the same three numbers with the id missing put them somewhere out in the
city instead. Outdoors, leave it out.

A new playthrough has nowhere yet, and so does a save written before this box
remembered places: `where` reads nothing and the game puts the player wherever it
starts them. Write it as often as you like; it is four numbers.

## Things left somewhere

The city file says where everything started. This says which of those answers is
out of date, and it is the only record of it: without it a thing left on a
strongbox is back on the shelf it was generated on after a reload, and can be
picked up a second time.

```ts
player.place('item_0001', { interiorId: 'interior_0003', anchorId: 'anchor_0012' })
player.placedAt('item_0001') // { interiorId: 'interior_0003', anchorId: 'anchor_0012' }
player.placed()              // [{ itemId: 'item_0001', interiorId: 'interior_0003', anchorId: 'anchor_0012' }]
```

Leaving something is putting it down, so `place` takes it out of the inventory
and clears its stolen mark, the same as `drop`. Picking it back up is `take`,
which forgets the spot: nothing else to call, and no way for a save to claim a
thing is in a hand and on a shelf at once.

The interior and the anchor are names here, checked for being names and nothing
more, so this box needs no world to hold them. A save can therefore carry a spot
this city has not got, from a room that was never in it: it loads, and
`placedAt` answers with what it was told. Whoever knows the city settles it, and
`place(itemId, null)` forgets the entry, which puts the thing back wherever the
city file had it rather than leaving it standing nowhere.

## The quest being followed

`tracked` is the quest the player chose to follow, the one the objectives panel
and the map pins are pointed at. To this box it is a name and nothing else: it is
never looked up, so a save can carry a quest that has since been finished, given
up, or that this city never had, and it still loads. The caller holds the quest
set, so the caller decides what a name it cannot find means, and clears it with
`setTracked(null)`.

## Time of day

`DAY_PHASES` is the closed set of readings, one per span of hours:

| Hours | Phase | Reading |
|---|---|---|
| 23:00-02:59 | `night` | the dead of night |
| 03:00-04:59 | `before-dawn` | just before dawn |
| 05:00-06:59 | `dawn` | first light |
| 07:00-10:59 | `morning` | mid morning |
| 11:00-13:59 | `midday` | the middle of the day |
| 14:00-16:59 | `afternoon` | the afternoon |
| 17:00-19:59 | `dusk` | sundown |
| 20:00-22:59 | `evening` | late evening |

The rate is game seconds per real second. The default is `DEFAULT_RATE` (24): a whole day passes in one real hour, so an hour of game time takes two and a half real minutes. A new playthrough opens on day 1 at 08:00 under a clear sky.

## Pausing, and what a save brings back

The clock carries two things: the rate it runs at, and whether it is stopped.
`pause()` stops it and keeps the rate; `resume()` runs it again at that rate.
`setRate(0)` is the same pause and `setRate(n)` with a positive `n` both sets
the rate and runs, so a caller toggling between 0 and a number still works.

Both go in the save. A save written while paused opens paused, on the day and
hour it was written, with `rate` holding what it ran at: one `resume()` and it
moves again at that speed. A save from before `paused` was written carried its
pause as `rate: 0`; it opens paused with `rate` at `DEFAULT_RATE`, ready to
resume, rather than frozen with nothing to resume to.

## Driving the clock, and telling quests about it

The app owns the frame loop and does two things with it:

```ts
player.clock.advance(realSecondsSinceLastFrame)
questLog.handle({ kind: 'clock', seconds: player.clock.totalSeconds })
```

`totalSeconds` is game time, not wall time, so a paused game never fails a quest on a timer, and a quest given "one hour" gets 3600 of these seconds. Send the event whenever the whole second changes; sending it every frame is also fine, since a repeated reading moves nothing. Jumping the clock forward with `setTime` or `setDay` moves that number with it, which is the point: skipping to tomorrow really does run out the timers.

This box does not import `@gb/quest`. It publishes the number; the app carries it across.

## Errors (closed set)

From `PlayerState`:

- `invalid-save`: failed the JSON Schema. Carries the offending paths.
- `wrong-world`: the save belongs to a different world id.
- `missing-item`: dropping something the player is not carrying.
- `already-carried`: buying something already in hand. Nothing is paid.
- `invalid-amount`: paying a price that is not a whole number of credits, zero or more. Nothing is deducted.
- `not-enough-money`: paying more than is held. Nothing is deducted. Carries what was needed and what is held.
- `bad-fact`: a fact for a person to hold that is blank, over `FACT_LENGTH`, or for a nameless person. Nothing is held. Carries the limit.
- `unknown-source`: a fact from somewhere other than `MEMORY_SOURCES`. Carries the allowed set.

From `GameClock`, each leaving the clock exactly as it was:

- `invalid-rate`: negative, not a number, or over 86400. A rate of 0 is accepted as a pause.
- `invalid-time`: hour outside 0-23 or minute outside 0-59, or either not whole.
- `invalid-day`: below 1 or not whole.
- `unknown-weather`: not one of `WEATHERS`. Carries the allowed set.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): results and schema validation.

## Invariants

- Money never goes negative and a refused payment or purchase changes nothing: no credits move, nothing is taken.
- A place or a person is in the codex at most once, in the order first found; a fact is unlocked for a person at most once; a person with a fact unlocked is listed.
- A fact given to one person is held by that person only. A person holds at most `MEMORY_CAP` facts, the newest kept. A disposition is always one of `DISPOSITIONS` and moves one step at a time.
- Reputation stays within -100 and 100 whatever is applied to it.
- An item is in the inventory at most once, and dropping it also clears its stolen mark.
- A save is only ever loaded against the world it was made in, so ids cannot silently point at different things.
- The clock only ever reads a time that exists: `secondsOfDay` stays under a day and the overflow becomes days, so running past midnight lands on the next day at the right hour.
- A paused clock freezes every reading, including `totalSeconds`, and keeps the rate it was running at; `rate` is always above 0.
- A save written before clocks existed has no `clock` and loads at the default: day 1, 08:00, clear, `DEFAULT_RATE`, running. A save written before places has no `where`, no `tracked` and no `moved`, and loads with nothing left anywhere. One written before the codex and memory has no `codex` and no `memory`, and loads with nothing found and nobody holding anything. A save whose `memory` lists more facts than the cap keeps the newest; one whose `codex` repeats an entry keeps it once.
- A remembered place is always one a save can be written from and read back: a place carrying a number that is not real is refused at the door rather than stored, so a single bad frame cannot cost the playthrough.
- A heading is read back as a direction inside one turn, whatever angle was reported; an angle already inside one turn is read back exactly as it was reported.
- A tracked quest id is stored, never resolved. This box holds no quests to check it against. The same goes for the room and the surface a thing was left on.
- A thing is in the inventory or standing somewhere, never both: taking it forgets its spot, leaving it takes it out of the inventory, and a save that claims both loads with the thing in hand.
- A thing has one spot: leaving it somewhere else moves it rather than copying it.
- This box knows nothing about quests, dialogue or geometry, and nothing about rendering: it holds state, does arithmetic, and answers questions. The sky is drawn elsewhere from what `clock.weather` and `clock.hour` say.

## How to modify this blackbox safely

Add fields as optional and bump the minor contractVersion; a required field needs `schemaVersion: 2` alongside the old shape. A new weather is a new value in `WEATHERS`, and only worth adding once the renderer has a look for it. Regenerate `schema/player-state.json` (`pnpm --filter @gb/play run generate`) and run `pnpm --filter @gb/play test` in the same change.
