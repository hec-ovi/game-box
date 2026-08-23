# @gb/quest contract

contractVersion: 0.6.0

## Purpose

Quests as flows: a checked graph of steps ("talk to her, go there, take three of those, bring them back") that is refused unless it can actually be played and pays what the work is worth, then run from the events the game reports.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `validateQuest(value, world)` | [schema/quest.json](schema/quest.json) | `world` answers `hasNpc`, `hasPlot`, `hasInterior`, `hasItem`, `hasAnchor` |
| `checkFlow(quest, world)` | a parsed `QuestDoc` | same `world`; returns the problems without the reward check |
| `rewardFor(difficulty, faction?)` | one of `DIFFICULTIES` | none |
| `checkReward(quest)` | a parsed `QuestDoc` | none |
| `QuestLog.create(quests, player)` | validated quests, a `@gb/play` `PlayerState` | quests came back `ok` from `validateQuest` |
| `QuestLog.load(value, quests, player)` | [schema/quest-progress.json](schema/quest-progress.json) | same quest set the save was made with |
| `QuestLog.start(questId)` | a quest id | the quest is unstarted and the player meets its `requires` |
| `QuestLog.abandon(questId)` | a quest id | the quest is being played |
| `QuestLog.handle(event)` | [schema/game-event.json](schema/game-event.json) | any untrusted event from the game |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `validateQuest` | a `QuestDoc` | every step reachable, every path ends, every reference exists, every item in hand before it is asked for, reward inside the band |
| `checkReward` | `SchemaViolation[]` | empty means the pay fits the difficulty; each entry names the field to fix |
| `rewardFor` | a `Reward` | inside the band for that difficulty |
| `QuestLog.handle` / `start` / `abandon` | `Change[]` | `quest-started`, `step-opened`, `step-revealed`, `step-progress`, `step-done`, `step-abandoned`, `quest-abandoned`, `quest-complete`, `quest-failed`; empty when nothing moved |
| `QuestLog.objectives()` | `Objective[]` | one line per open step the player can see: `questId`, `questTitle` and the step line below |
| `QuestLog.journal()` | `JournalEntry[]` | one page per quest the player has taken: `questId`, `questTitle`, `status` and its steps in the order the quest was written, each a step line plus its `state` |
| `QuestLog.offeredBy(npcId)` | `QuestDoc[]` | unstarted quests from that giver whose `requires` the player already meets |
| `QuestLog.isQuestItem(itemId)` | boolean | true while a live quest still needs that item |
| `QuestLog.toJSON()` | [schema/quest-progress.json](schema/quest-progress.json) | resumes to exactly the same open steps, counts, secrets and dropped branches |

## What a step line says

One shape for a step wherever the interface shows it, so the objectives panel and the journal never disagree: `stepId`, `text` (the objective line), `markerLabel` and `hint` where the step has them, `optional` on side work, `count` (`{done, needed}`, only while the step wants several), `choice` on a step that asks a question, and the target below. An `Objective` is that line with `questId` and `questTitle` on it; a `JournalStep` is that line with `state` on it.

## The journal

`journal()` is the quests tab. One page per quest the player has taken, and none for a quest nobody has been offered yet, so the list never gives away work that has not come up. The steps on a page are in the order the quest was written, never the order the player got through them, so a journal reads top to bottom the way the quest was authored.

| `state` | Where the step stands |
|---|---|
| `upcoming` | the flow has not reached it, and can still walk into it |
| `open` | the one the player is on |
| `done` | finished |
| `dropped` | a branch nobody took: the flow can no longer reach it |

A quest splits at a `choice` and at an `any-of`. Picking an option drops everything only the other options led to; one branch winning an `any-of` drops its rivals. Whatever a finished or failed quest never reached is dropped as well. A secret stays off the page until something reveals it, then it appears in the place it was written.

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
| `choice` | nowhere in the world, but `choice`: the question and the roads out of it, below |
| `join`, `any-of`, `complete`, `fail` | nothing: they point at no one and nowhere |

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

`talk`, `goto`, `collect`, `deliver`, `stash`, `escort`, `choice`, `join`, `any-of`, `complete`, `fail`. A generator may use no others.

- `collect`, `deliver` and `stash` take `count` (default 1) over a pool of interchangeable items: the one in `itemId` plus `alternates`. That is how "three of the five crates" is written, and each item counts once.
- A `talk` may name a `topic`. Then only a `talked` event carrying that same topic completes it, and the objective publishes the topic so the caller knows which one to send.
- A `choice` holds the question in `prompt` and the roads in `options` (`id`, `label`, and the `next` it routes to). The line publishes the question and the roads' words and keys, so a caller can draw the decision and send back the one that was taken.
- Any step may be `optional` (side work: the quest finishes without it, and it may be a dead end) or `hidden` (off the board until a `reveal` effect shows it).
- `join` waits for every branch in `waitFor`. `any-of` takes the first branch in `oneOf` to finish and drops the rest. Both name steps the flow already runs through: every branch has to be reachable from the first step, and has to have the `join` or `any-of` in its own `next`. Listing a step in `waitFor` or `oneOf` does not wire it into the flow, so a branch that only appears there is refused as unreachable.

## Conditions and effects (closed sets)

Conditions: `has-item`, `flag`, `money-at-least`, `reputation-at-least`, `reputation-below`, `has-companion`. They gate a step, and on the quest itself they gate whether it is offered at all.

Effects: `give-item`, `take-item`, `pay`, `charge`, `reputation`, `set-flag`, `companion-join`, `companion-leave`, `reveal`.

## Failing (closed set)

`failWhen` ends a quest badly without the flow reaching a `fail` step: `time-limit` (seconds since the quest was taken, counted off the `clock` event), `npc-lost` (that person died or left, or either), `item-lost` (the thing was destroyed).

## Difficulty and pay

`difficulty` is one of `errand`, `small`, `standard`, `hard`, `epic` (default `small`). `REWARD_TABLE` holds one band per tier: what the whole quest may hand over (the reward plus every `pay` effect), how far one reputation swing may go, and how many items the reward may include. `rewardFor(difficulty)` returns a reward that fits, so a generator asks for "a small job" instead of inventing a number. The table is the one place pay is tuned.

## Errors (closed set)

- `invalid-quest`: failed the JSON Schema. Carries the offending paths.
- `broken-flow`: schema-valid but unplayable. Carries every problem: dangling reference, unreachable step, dead end, loop, no completion, a count larger than its pool, a secret nothing reveals, required work hanging off optional work, or an item asked for before the player can have it.
- `unbalanced-reward`: playable, but the pay does not match the difficulty. Carries the difficulty and one violation per offending field.
- `invalid-event`: the reported event is not one of the known shapes. Nothing moves.
- `invalid-progress`: the save is not quest progress.
- `unknown-quest` / `already-started` / `requirements-not-met`: from `start`. The last one carries the conditions the player does not meet.
- `not-active`: `abandon` on a quest nobody is playing. Carries the status it is in instead.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): results and schema validation.
- `@gb/play` contract (game/play/CONTRACT.md): the player state that conditions read and effects write.

## Invariants

- A quest is only ever run after `validateQuest` accepted it, so the runtime never has to handle a broken flow.
- Solvability is proved before play: walking the flow forward, every `deliver`, `stash`, `has-item` and `escort` is guaranteed to be satisfiable on every path that reaches it. A `join` keeps what its branches gathered; every other merge, `any-of` included, keeps only what all of them guarantee.
- Counting is over item instances, so a pool of five crates satisfies a count of three and the same crate never counts twice.
- A flow runs forward only: cycles are rejected, so a quest cannot trap the player.
- Optional work never gates the quest: a `complete` step is always reachable without entering an optional step, and no join or any-of waits on one.
- A hidden step is always revealed by something; when it is required, by something that must run before it.
- Steps that need no player action (`join`, `any-of`, `complete`, `fail`) resolve the moment they open.
- A journal page lists a quest's steps in document order, whatever order the player did them in.
- A secret is published nowhere: while a hidden step waits to be revealed it is off the objectives and off the journal page, question and roads included, so nothing on screen gives away that it exists.
- A step is `dropped` exactly when the flow can no longer walk into it from an open step. Because a flow runs forward only, nothing dropped ever comes back.
- The runtime reads the world only through `WorldView`, and touches the player only through `@gb/play`, so it runs headless with no renderer.
- Effects are the only way a quest changes the player: nothing is applied implicitly by an event, and neither is giving up.
- Being a quest item is a binding from a live quest, not a property of the thing, so the same ledger can be untouchable in one playthrough and ordinary loot in another. Shipped RPGs bind it the same way, per quest rather than per item.

## How to modify this blackbox safely

New step kinds, conditions, effects and failure rules are additive: extend the union, teach `checkEdges`/`checkShape` what they promise, teach `checkSolvability` what they guarantee, teach `targetOf` what the new kind points at (the switch there is exhaustive, so it will not compile until you do), teach the runtime what completes them, bump the minor contractVersion. New fields go on as optional, because exported worlds contain quests written without them. Never change what an existing kind means. Regenerate `schema/` (`pnpm --filter @gb/quest run generate`) and run `pnpm --filter @gb/quest test` in the same change.
