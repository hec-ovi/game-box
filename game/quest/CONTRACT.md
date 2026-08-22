# @gb/quest contract

contractVersion: 0.2.0

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
| `QuestLog.handle(event)` | [schema/game-event.json](schema/game-event.json) | any untrusted event from the game |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `validateQuest` | a `QuestDoc` | every step reachable, every path ends, every reference exists, every item in hand before it is asked for, reward inside the band |
| `checkReward` | `SchemaViolation[]` | empty means the pay fits the difficulty; each entry names the field to fix |
| `rewardFor` | a `Reward` | inside the band for that difficulty |
| `QuestLog.handle` / `start` | `Change[]` | `quest-started`, `step-opened`, `step-revealed`, `step-progress`, `step-done`, `step-abandoned`, `quest-complete`, `quest-failed`; empty when nothing moved |
| `QuestLog.objectives()` | `Objective[]` | one line per open step the player can see, with its marker label, hint, `optional`, `count` (`{done, needed}`) and the place or person it points at |
| `QuestLog.offeredBy(npcId)` | `QuestDoc[]` | unstarted quests from that giver whose `requires` the player already meets |
| `QuestLog.isQuestItem(itemId)` | boolean | true while a live quest still needs that item |
| `QuestLog.toJSON()` | [schema/quest-progress.json](schema/quest-progress.json) | resumes to exactly the same open steps, counts, secrets and dropped branches |

## Step kinds (closed set)

`talk`, `goto`, `collect`, `deliver`, `stash`, `escort`, `choice`, `join`, `any-of`, `complete`, `fail`. A generator may use no others.

- `collect`, `deliver` and `stash` take `count` (default 1) over a pool of interchangeable items: the one in `itemId` plus `alternates`. That is how "three of the five crates" is written, and each item counts once.
- Any step may be `optional` (side work: the quest finishes without it, and it may be a dead end) or `hidden` (off the board until a `reveal` effect shows it).
- `join` waits for every branch in `waitFor`. `any-of` takes the first branch in `oneOf` to finish and drops the rest.

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
- The runtime reads the world only through `WorldView`, and touches the player only through `@gb/play`, so it runs headless with no renderer.
- Effects are the only way a quest changes the player: nothing is applied implicitly by an event.
- Being a quest item is a binding from a live quest, not a property of the thing, so the same ledger can be untouchable in one playthrough and ordinary loot in another. Shipped RPGs bind it the same way, per quest rather than per item.

## How to modify this blackbox safely

New step kinds, conditions, effects and failure rules are additive: extend the union, teach `checkEdges`/`checkShape` what they promise, teach `checkSolvability` what they guarantee, teach the runtime what completes them, bump the minor contractVersion. New fields go on as optional, because exported worlds contain quests written without them. Never change what an existing kind means. Regenerate `schema/` (`pnpm --filter @gb/quest run generate`) and run `pnpm --filter @gb/quest test` in the same change.
