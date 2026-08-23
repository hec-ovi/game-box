# @gb/play contract

contractVersion: 0.3.0

## Purpose

The playthrough: what the player carries, what they stole, what they can afford, what they have been told, who is walking with them, where they are standing, which job they are following, and what time it is.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `PlayerState.create(worldId, startingMoney?)` | ids as strings | money is a whole number, zero or more |
| `PlayerState.load(value, worldId)` | [schema/player-state.json](schema/player-state.json) | the save's `worldId` matches the world being played |
| mutations: `take`, `drop`, `earn`, `spend`, `setFlag`, `adjustReputation`, `addCompanion`, `removeCompanion` | ids and whole numbers | see errors |
| `setWhere(where)` | `{ x, z, heading, interiorId? }`, metres and radians | numbers that are not real leave the last place standing |
| `setTracked(questId)` | a quest id, or `null` / nothing for none | the id is a name, not a lookup |
| `clock.advance(realSeconds)` | real seconds since the last frame | a negative or non-finite step does nothing |
| `clock.setRate(gameSecondsPerRealSecond)` | 0 to 86400 | 0 is paused |
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
| `clock` | a `GameClock` | the playthrough's own clock, saved and restored with it |
| `clock.day`, `clock.hour`, `clock.minute`, `clock.secondsOfDay` | numbers | day counts from 1; `secondsOfDay` is fractional, the rest are whole |
| `clock.rate`, `clock.weather` | a number, one of `WEATHERS` | what was last set |
| `clock.isDark` | boolean | true from 20:00 up to 05:59, whatever the weather |
| `clock.phase`, `clock.reading` | one of `DAY_PHASES`, a plain sentence fragment | `reading` is the phase in words ("late evening", "just before dawn"), written to go in front of a language model |
| `clock.totalSeconds` | whole seconds | game seconds since day 1 at 00:00; this is the number the `clock` game event carries |

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

The rate is game seconds per real second. The default is `DEFAULT_RATE` (240): a whole day passes in six real minutes, so an hour of game time takes fifteen seconds and one session covers dawn, noon and midnight. A new playthrough opens on day 1 at 08:00 under a clear sky.

## Driving the clock, and telling quests about it

The app owns the frame loop and does two things with it:

```ts
player.clock.advance(realSecondsSinceLastFrame)
questLog.handle({ kind: 'clock', seconds: player.clock.totalSeconds })
```

`totalSeconds` is game time, not wall time, so a paused game (rate 0) never fails a quest on a timer, and a quest given "one hour" gets 3600 of these seconds. Send the event whenever the whole second changes; sending it every frame is also fine, since a repeated reading moves nothing. Jumping the clock forward with `setTime` or `setDay` moves that number with it, which is the point: skipping to tomorrow really does run out the timers.

This box does not import `@gb/quest`. It publishes the number; the app carries it across.

## Errors (closed set)

From `PlayerState`:

- `invalid-save`: failed the JSON Schema. Carries the offending paths.
- `wrong-world`: the save belongs to a different world id.
- `missing-item`: dropping something the player is not carrying.
- `not-enough-money`: spending more than is held. Nothing is deducted.

From `GameClock`, each leaving the clock exactly as it was:

- `invalid-rate`: negative, not a number, or over 86400.
- `invalid-time`: hour outside 0-23 or minute outside 0-59, or either not whole.
- `invalid-day`: below 1 or not whole.
- `unknown-weather`: not one of `WEATHERS`. Carries the allowed set.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): results and schema validation.

## Invariants

- Money never goes negative and a refused purchase changes nothing.
- Reputation stays within -100 and 100 whatever is applied to it.
- An item is in the inventory at most once, and dropping it also clears its stolen mark.
- A save is only ever loaded against the world it was made in, so ids cannot silently point at different things.
- The clock only ever reads a time that exists: `secondsOfDay` stays under a day and the overflow becomes days, so running past midnight lands on the next day at the right hour.
- A rate of 0 freezes every reading, including `totalSeconds`.
- A save written before clocks existed has no `clock` and loads at the default: day 1, 08:00, clear, `DEFAULT_RATE`. A save written before places has no `where` and no `tracked`, and loads with neither.
- A remembered place is always one a save can be written from and read back: a place carrying a number that is not real is refused at the door rather than stored, so a single bad frame cannot cost the playthrough.
- A heading is read back as a direction inside one turn, whatever angle was reported; an angle already inside one turn is read back exactly as it was reported.
- A tracked quest id is stored, never resolved. This box holds no quests to check it against.
- This box knows nothing about quests, dialogue or geometry, and nothing about rendering: it holds state, does arithmetic, and answers questions. The sky is drawn elsewhere from what `clock.weather` and `clock.hour` say.

## How to modify this blackbox safely

Add fields as optional and bump the minor contractVersion; a required field needs `schemaVersion: 2` alongside the old shape. A new weather is a new value in `WEATHERS`, and only worth adding once the renderer has a look for it. Regenerate `schema/player-state.json` (`pnpm --filter @gb/play run generate`) and run `pnpm --filter @gb/play test` in the same change.
