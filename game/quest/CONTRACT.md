# @gb/quest contract

contractVersion: 0.9.0

## Purpose

Quests as flows: a checked graph of steps ("talk to her, get through the back door, open the terminal, buy three of those, bring them back") that is refused unless it can actually be played and pays what the work is worth (credits, things, access, a car, a home), then run from the events the game reports.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `validateQuest(value, world)` | [schema/quest.json](schema/quest.json) | `world` answers `hasNpc`, `hasPlot`, `hasInterior`, `hasItem`, `hasAnchor`, `hasDoor`, `hasMachine` (`@gb/world`'s `questView(world)` does) |
| `checkFlow(quest, world)` | a parsed `QuestDoc` | same `world`; returns the problems without the reward check |
| `rewardFor(difficulty, faction?)` | one of `DIFFICULTIES` | none |
| `checkReward(quest)` | a parsed `QuestDoc` | none |
| `QuestLog.create(quests, player)` | validated quests, a `@gb/play` `PlayerState` | quests came back `ok` from `validateQuest` |
| `QuestLog.load(value, quests, player)` | [schema/quest-progress.json](schema/quest-progress.json) | same quest set the save was made with |
| `QuestLog.start(questId)` | a quest id | the quest is unstarted and the player meets its `requires` |
| `QuestLog.abandon(questId)` | a quest id | the quest is being played |
| `QuestLog.handle(event)` | [schema/game-event.json](schema/game-event.json) | any untrusted event from the game; which one each step waits for is under "What credits a step" |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `validateQuest` | a `QuestDoc` | every step reachable, every path ends, every reference exists, every item in hand before it is asked for, and the pay settled into the band it belongs in |
| `checkReward` | `SchemaViolation[]` | empty means the pay fits the difficulty; each entry names the field to fix |
| `rewardFor` | a `Reward` | inside the band for that difficulty |
| `QuestLog.handle` / `start` / `abandon` | `Change[]` | `quest-started`, `step-opened`, `step-revealed`, `step-progress`, `step-done`, `step-abandoned`, `quest-abandoned`, `quest-complete` (carrying the whole `Reward`), `quest-failed`; empty when nothing moved |
| `QuestLog.objectives()` | `Objective[]` | one line per open step the player can see: `questId`, `questTitle` and the step line below |
| `QuestLog.journal()` | `JournalEntry[]` | one page per quest the player has taken, failed ones included: `questId`, `questTitle`, `kind` (`main` or `side`), `status`, `failReason` while it is `failed`, `timer` (`{remaining, total}` in game seconds) while a timed quest is being played, and the steps they do, in the order the quest was written, each a step line plus its `state` |
| `QuestLog.offeredBy(npcId)` | `QuestDoc[]` | unstarted quests from that giver whose `requires` the player already meets |
| `QuestLog.isQuestItem(itemId)` | boolean | true while a live quest still needs that item |
| `QuestLog.toJSON()` | [schema/quest-progress.json](schema/quest-progress.json) | resumes to exactly the same open steps, counts, secrets and dropped branches |

## What a step line says

One shape for a step wherever the interface shows it, so the objectives panel and the journal never disagree: `stepId`, `text` (the objective line), `markerLabel` and `hint` where the step has them, `optional` on side work, `count` (`{done, needed}`, only while the step wants several), `choice` on a step that asks a question, and the target below. An `Objective` is that line with `questId` and `questTitle` on it; a `JournalStep` is that line with `state` on it.

## The journal

`journal()` is the quests tab. One page per quest the player has taken, and none for a quest nobody has been offered yet, so the list never gives away work that has not come up. The steps on a page are in the order the quest was written, never the order the player got through them, so a journal reads top to bottom the way the quest was authored. `kind` says whether the page is the story (`main`) or an errand (`side`), so the tab can keep the story where the player can find it.

A page lists the work and nothing else. `join`, `any-of`, `complete` and `fail` resolve the moment they open, so the player never does one and none of them is a line: "Get paid" on a page is a promise nobody keeps, since the reward arrives on its own with `quest-complete`. The page says how a quest ended in `status`; it does not spend a row on it. Everything the page does carry is a line the player can act on, so a caller draws it as it comes and never has to sort work from wiring.

A page is never taken away by the quest ending. A finished quest keeps its page with `status: 'complete'`; a failed one keeps its page with `status: 'failed'` and `failReason` saying why (`fail-step`, `time-limit`, `npc-lost`, `item-lost`), so the player reads that it failed and what for instead of finding a gap. Both survive a save. The one thing that removes a page is `abandon`, because giving up makes the quest unstarted again and the giver offers it afresh.

## Timers

A quest with a `time-limit` in `failWhen` is on a countdown, and its page carries it while it is being played:

```ts
entry.timer // { remaining: 2160, total: 3600 }   game seconds
```

`total` is what the quest was given and `remaining` is what is left of it against the last `clock` event, clamped to `0..total`, so a caller draws "36 min left" or a bar without arithmetic of its own. The page stops carrying `timer` once the quest is over; a page that ran out says `failReason: 'time-limit'` instead.

**The unit is game seconds**: the number the `clock` event carries, which is `@gb/play`'s `clock.totalSeconds`. A timer runs on the game clock, never the wall clock, so pausing the game (rate 0) freezes every countdown, and skipping to tomorrow runs them all out. The game sends `clock` whenever the reading moves; the countdown moves with it and nowhere else, so an interface showing it re-reads the page on every clock push.

Picking a duration, at the clock's rate of 24 game seconds per real second (a game day is one real hour):

| Game time | `seconds` | Real time |
|---|---|---|
| a minute | 60 | 2.5 s |
| ten minutes | 600 | 25 s |
| an hour | 3600 | 2.5 min |
| a quarter day | 21600 | 15 min |
| a day | 86400 | 1 hour |

One reply from the model costs 8 to 19 real seconds, which is 200 to 450 game seconds, and a walk across town is a real minute or two, which is 1500 to 3000. So budget at least 600 game seconds for every conversation the timed work needs and 3000 for every walk, and never give a quest under an hour (3600): below that, a slow reply fails it on its own. A job with two conversations and a walk wants three hours (10800); a chain of errands wants a quarter day or more. The schema floor of 30 exists so a world file written earlier still loads; pick from the table above.

| `state` | Where the step stands |
|---|---|
| `upcoming` | the flow has not reached it, and can still walk into it |
| `open` | the one the player is on |
| `done` | finished |
| `dropped` | a branch nobody took: the flow can no longer reach it |

A quest splits at a `choice` and at an `any-of`. Picking an option drops everything only the other options led to; one branch winning an `any-of` drops its rivals. Whatever a finished or failed quest never reached is dropped as well. A secret stays off the page until something reveals it, then it appears in the place it was written.

## Tracking a quest

The quest the objectives panel and the map pins point at is the **tracked** quest: the player picks it with the interface's Track, and `@gb/play` remembers it as `tracked`. This box calls it nothing else. "Following" is what a companion does when they walk behind the player, and it is never a word for a quest here, so an escort's companion following the player and the player tracking the escort quest cannot be confused in a report or a contract.

## What an objective points at

A step names its target in whatever field its kind uses, and the objective carries it under one name for all of them, so a map pin, a waypoint or a route reads the same fields and never asks what kind of step it came from.

| Step kind | The objective carries |
|---|---|
| `talk` | `npcId`, and `topic` when the step names one |
| `goto` | `place` |
| `collect` | `itemId`, `alternates` |
| `deliver` | `npcId` (who it goes to), `itemId`, `alternates` |
| `stash` | `place` (the interior it goes in), `anchorId`, `itemId`, `alternates` |
| `escort` | `npcId` (who walks with you), `place` (where to) |
| `unlock` | `doorId` |
| `hack` | `machineId` |
| `beat-game` | `machineId`, `score` (the one to reach) |
| `buy` | `itemId`, `alternates` |
| `choice` | nowhere in the world, but `choice`: the question and the roads out of it, below |
| `join`, `any-of`, `complete`, `fail` | nothing: they point at no one and nowhere |

A door or a machine is named by id alone; where it stands is the world's to answer (`world.door(doorId)`, `world.machine(machineId)` in `@gb/world`), so the map pins it from there.

## What credits a step

A step is credited by the thing happening in the world, never by a record of intent: a flag, a menu state or an agreement is not a step done. Each kind waits for exactly one event, and the game (`@gb/app` in play, `@gb/forge`'s harness when proving a quest) sends that event when the thing has happened. Anything else moves nothing and comes back empty.

| Step kind | Credited by | Sent when |
|---|---|---|
| `talk` | `talked { npcId, topic? }` | a conversation with that person has ended; `topic` names what it covered, and a step with a `topic` is credited only by the same one |
| `goto` | `arrived { place }` | the player's own body entered that plot or interior |
| `collect` | `acquired { itemId, stolen? }` | the thing is in the player's hand; `stolen: true` credits only a step with `allowSteal` |
| `deliver` | `gave { itemId, npcId }` | the thing left the player's hand and went to that person |
| `stash` | `stashed { itemId, interiorId, anchorId }` | the thing is standing on that anchor in that room |
| `escort` | `companion-arrived { npcId, place }` | that person's body, walking with the player, entered that plot or interior. The companion flag `@gb/play` keeps is not this: it says they agreed to come, and an escort is credited only when they got there |
| `unlock` | `unlocked { doorId }` | that door's lock came off, with its key item in hand or its password typed at it. A password known (`@gb/play`'s `knows`) is not this |
| `hack` | `machine-unlocked { machineId }` | that machine's lock came off at its own screen, with its password typed or a hack |
| `beat-game` | `scored { machineId, score }` | a game on that machine ended; the step is credited by the first score at or past its own |
| `buy` | `bought { itemId }` | the thing was paid for at a counter and is in the player's hand. A purchase also sends `acquired`, so a `collect` sees it too; `acquired` alone never credits a `buy` |
| `choice` | `chose { questId, stepId, optionId }` | the player took one of the keys the step published |
| `join`, `any-of`, `complete`, `fail` | nothing | they resolve the moment they open |

`collect`, `buy`, `deliver` and `stash` with a `count` are credited once per distinct item in their pool and finish on the last one. A step's `requires` is a gate in front of the credit, read off the player's record (`has-companion` reads the flag, `has-item` the inventory), so a credited event on a step whose gate is shut moves nothing.

Failure rules read the world the same way:

| Rule | Ended by | Sent when |
|---|---|---|
| `time-limit` | `clock { seconds }` | the game clock moved; the quest fails on the first reading at or past the limit |
| `npc-lost` | `npc-gone { npcId, reason }` | that person died or left town, `reason` saying which |
| `item-lost` | `item-destroyed { itemId }` | the thing has been destroyed |

## Making a choice

A `choice` is the one step the player finishes by answering a question instead of going somewhere or fetching something, so the line carries the decision itself:

```ts
objective.choice // { prompt: 'Hollis is offering more than Mara did. Whose is it?',
                 //   options: [{ key: 'keep-word', label: 'Keep your word to Mara' },
                 //             { key: 'sell-out',  label: 'Sell it to Hollis' }] }
```

`prompt` is the question in the quest's own words, and `options` are the roads in the order the quest wrote them: `label` is the words on the button, `key` is what comes back. Answering it is one event:

```ts
log.handle({ kind: 'chose', questId, stepId, optionId: key })
```

Where a road goes is not published. The far side of a choice is the player's to find out by taking it, so an option carries its words and its key and nothing else; `text`, `markerLabel` and `hint` on the same line are the step's own, not any option's.

Only a key the step published moves it. A `chose` naming anything else changes nothing and comes back empty, the way talking about the wrong subject does, so a stale panel cannot finish a decision and leave the quest with nowhere to go. Once one is taken, everything only the other roads led to becomes `dropped`.

## Giving a quest up

`abandon(questId)` takes a live quest off the board: every open step comes back as `step-abandoned`, then `quest-abandoned`. The quest is unstarted again, so its giver offers it once more and a second run starts from nothing, timer included. What the player already collected or was paid stays with them and their standing does not move, because effects are the only way a quest touches the player and giving up runs none. Whatever it had bound as a quest item goes back to being ordinary loot.

## Writing a quest

`questDraftContract` is what an author fills in: a quest without the envelope, which `sealQuest` puts back on. The door is stricter than the document schema in one place, `next`: a step in the middle of a flow has to lead somewhere. A `complete` or a `fail` ends the quest, a `choice` routes through its options, and side work is allowed to trail off, so those four leave `next` out legitimately; everything else without it is the dead end the flow check refuses. Refusing it at the door is what puts the mistake in front of the author while they can still fix it: the violation names `steps.<n>.next`, which is what a generator quotes back to a model on the retry.

## Step kinds (closed set)

`talk`, `goto`, `collect`, `buy`, `deliver`, `stash`, `escort`, `unlock`, `hack`, `beat-game`, `choice`, `join`, `any-of`, `complete`, `fail`. A generator may use no others.

- `collect`, `buy`, `deliver` and `stash` take `count` (default 1) over a pool of interchangeable items: the one in `itemId` plus `alternates`. That is how "three of the five crates" is written, and each item counts once. A `buy` counts what was paid for; what was bought is in hand for the solvability walk, the same as a `collect`.
- `unlock` names a `doorId` and `hack` a `machineId`, both ids the world holds (`door_0001`, `machine_0001`). What opens them is the city's: a door's key item or password, a machine's password. A quest that wants the player to type the word gives it with a `give-password` effect on an earlier step; the door or the screen checks it against what the player knows.
- `beat-game` names a `machineId` and the `score` (1 to 1000000) a game on it has to reach. Which game runs is the machine's `program`, the writer's text says which, and the score is play's to keep.
- A `talk` may name a `topic`. Then only a `talked` event carrying that same topic completes it, and the objective publishes `topic` so the caller knows which one to send.
- An `escort` names who walks (`npcId`) and where to (`place`). It is credited by `companion-arrived` for that person at that place, and by nothing else.
- A `choice` holds the question in `prompt` and the roads in `options` (`id`, `label`, and the `next` it routes to). The line publishes the question and the roads' words and keys, so a caller can draw the decision and send back the one that was taken.
- Any step may be `optional` (side work: the quest finishes without it, and it may be a dead end) or `hidden` (off the board until a `reveal` effect shows it).
- `join` waits for every branch in `waitFor`. `any-of` takes the first branch in `oneOf` to finish and drops the rest. Both name steps the flow already runs through, which means two things at once: every branch has to be reachable from the first step through some chain of `next`, and every branch has to have the `join` or `any-of` in its own `next`. Listing a step in `waitFor` or `oneOf` does not wire it into the flow. A branch that is only listed is refused as "unreachable from the first step: no step's next leads here, and listing it in a oneOf or a waitFor does not connect it"; a branch that is reached but leads elsewhere is refused as "offers X, but X does not lead to it: every branch needs this step in its next, and needs to be reachable from the first step". The usual shape: the step before the split lists both branches in its `next`, and both branches list the `any-of` in theirs.

## Conditions and effects (closed sets)

Conditions: `has-item`, `flag`, `money-at-least`, `reputation-at-least`, `reputation-below`, `has-companion`. They gate a step, and on the quest itself they gate whether it is offered at all.

Effects: `give-item`, `take-item`, `pay`, `charge`, `reputation`, `set-flag`, `companion-join`, `companion-leave`, `give-password`, `reveal`.

Every effect lands on the `@gb/play` `PlayerState` the log was created with, and that is the whole port to the player: `give-item` is `take(itemId)`, `take-item` is `drop(itemId)`, `pay` (the quest paying the player) is `earn(amount)`, `charge` (the player paying) is `pay(amount)`, `reputation` is `adjustReputation(delta, faction)`, `set-flag` is `setFlag(flag, value)`, `companion-join` and `companion-leave` are `addCompanion` and `removeCompanion`, `give-password` (a word, 60 characters, trimmed) is `learn(password, { questId })`. `reveal` touches the player not at all; it is the log's own. The completion reward goes the same way, below.

## What a quest hands over

`reward` is what finishing pays, every part of it landing on the `@gb/play` `PlayerState` with `quest-complete`:

| Field | Shape | Lands as |
|---|---|---|
| `money` | whole credits | `earn(money)` |
| `reputation`, `faction` | a swing, either way | `adjustReputation(reputation, faction)` |
| `items` | item ids | one `take(itemId)` each |
| `access` | `Access[]`, optional: `{ doorId }` for one door, `{ interiorId }` for that interior's street door (`@gb/world`'s `AccessSchema`, the shape a keycard's `opens` is written in) | one `grant(access)` each: the player gets past it from now on, card or no card |
| `car` | a `CarModel`, one of `@gb/world`'s `CAR_MODELS`: the seven cars the city ships | `keepCar(model)` |
| `deed` | an interior id | `own(interiorId)`, and the game writes the city's owner record off `quest-complete`, since whose a place is also stands in the world file |

Every id is checked against the world with the rest of the quest: an access to a door or a place the city has not got, a deed to one, or a car outside the list is refused before play. `quest-complete` carries the whole `Reward`, so the interface can announce it and the game can record the deed.

## Failing (closed set)

`failWhen` ends a quest badly without the flow reaching a `fail` step: `time-limit` (game seconds since the quest was taken, counted off the `clock` event; see "Timers"), `npc-lost` (that person died or left, or either), `item-lost` (the thing was destroyed). Whichever way a quest fails, `quest-failed` carries the reason, the page stays in the journal with `status: 'failed'` and the same `failReason`, and the save keeps both. `FAIL_REASONS` is the closed set: `fail-step`, `time-limit`, `npc-lost`, `item-lost`.

## Difficulty and pay

`difficulty` is one of `errand`, `small`, `standard`, `hard`, `epic` (default `small`). `REWARD_TABLE` holds one band per tier: what the whole quest may hand over (the reward plus every `pay` effect), how far one reputation swing may go, how many items and how many accesses the reward may include, and whether it may be a car or a home. A car is `hard` or `epic` work; a home is `epic`. `rewardFor(difficulty)` returns a reward that fits, so a generator asks for "a small job" instead of inventing a number. The table is the one place pay is tuned. Money and standing are **settled, not refused**: a quest that pays 150 where its tier pays 600 comes back paying 600, and one that pays a fortune comes back at the ceiling, with whatever the steps hand over counted against the same ceiling. A number in the wrong place is not a reason to throw a playable job away. What is still refused is what changing a number cannot fix: more items, doors, a car or a home than the tier hands over.

## Errors (closed set)

- `invalid-quest`: failed the JSON Schema. Carries the offending paths.
- `broken-flow`: schema-valid but unplayable. Carries every problem: dangling reference (a person, thing, place, door or machine the world has not got, a reward's access or deed included), unreachable step, dead end, loop, no completion, a count larger than its pool, a secret nothing reveals, required work hanging off optional work, or an item asked for before the player can have it.
- `unbalanced-reward`: playable, but it hands over something the tier does not: too many items or doors, a car, a home, or steps that charge more than the tier may cost. Carries the difficulty and one violation per offending field. Money and standing never land here, because they are settled first.
- `invalid-event`: the reported event is not one of the known shapes. Nothing moves.
- `invalid-progress`: the save is not quest progress.
- `unknown-quest` / `already-started` / `requirements-not-met`: from `start`. The last one carries the conditions the player does not meet.
- `not-active`: `abandon` on a quest nobody is playing. Carries the status it is in instead.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): results and schema validation.
- `@gb/play` contract (game/play/CONTRACT.md): the player state that conditions read and effects write, and that the reward lands on.
- `@gb/world` contract (game/world/CONTRACT.md): `AccessSchema` and `CAR_MODELS`, the closed shapes a reward names. A world itself is never read here; only `WorldView` is.

## Invariants

- A quest is only ever run after `validateQuest` accepted it, so the runtime never has to handle a broken flow.
- Solvability is proved before play: walking the flow forward, every `deliver`, `stash`, `has-item` and `escort` is guaranteed to be satisfiable on every path that reaches it. A `join` keeps what its branches gathered; every other merge, `any-of` included, keeps only what all of them guarantee.
- Counting is over item instances, so a pool of five crates satisfies a count of three and the same crate never counts twice.
- A flow runs forward only: cycles are rejected, so a quest cannot trap the player.
- Optional work never gates the quest: a `complete` step is always reachable without entering an optional step, and no join or any-of waits on one.
- A hidden step is always revealed by something; when it is required, by something that must run before it.
- Steps that need no player action (`join`, `any-of`, `complete`, `fail`) resolve the moment they open, so they are never an objective and never a journal line.
- A journal page lists the steps the player does, in document order, whatever order they did them in.
- A secret is published nowhere: while a hidden step waits to be revealed it is off the objectives and off the journal page, question and roads included, so nothing on screen gives away that it exists.
- A step is `dropped` exactly when the flow can no longer walk into it from an open step. Because a flow runs forward only, nothing dropped ever comes back.
- The runtime reads the world only through `WorldView`, and touches the player only through `@gb/play`, so it runs headless with no renderer. The whole reward lands there too; the deed reaches the city through the game, off `quest-complete`.
- Effects are the only way a quest changes the player: nothing is applied implicitly by an event, and neither is giving up.
- A step is credited only by the event in "What credits a step", which reports the thing having happened; no step is credited off a flag, a companion record, a password known or a menu state. `requires` gates read the record; credits never do.
- What a quest names in the city is checked against the city before play, doors, machines, access and deeds included, so the runtime never points at a lock or a screen that is not there.
- A quest that ended stays in the journal with its status and, when it failed, its reason. Only giving up removes a page.
- A timer is game seconds off the `clock` event and nothing else: no wall clock, no `Date`, so a paused game holds every countdown.
- Being a quest item is a binding from a live quest, not a property of the thing, so the same ledger can be untouchable in one playthrough and ordinary loot in another. Shipped RPGs bind it the same way, per quest rather than per item.

## How to modify this blackbox safely

New step kinds, conditions, effects and failure rules are additive: extend the union, teach `checkReferences` what it names in the world (widening `WorldView` when the world has to answer something new), teach `checkEdges`/`checkShape` what they promise, teach `checkSolvability` what they guarantee, teach `targetOf` what the new kind points at (the switch there is exhaustive, so it will not compile until you do), teach `matchStep` which event credits it and add that event to "What credits a step", add it to `resolvesItself` if it needs no player, bump the minor contractVersion. A new reward field goes on `reward.ts`, lands through one `@gb/play` call in `payReward`, and gets a column in `REWARD_TABLE`. New fields go on as optional, because exported worlds contain quests written without them. Never change what an existing kind means. Regenerate `schema/` (`pnpm --filter @gb/quest run generate`) and run `pnpm --filter @gb/quest test` in the same change.
