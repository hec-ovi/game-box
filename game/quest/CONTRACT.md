# @gb/quest contract

contractVersion: 0.1.0

## Purpose

Quests as flows: a checked graph of steps ("talk to her, go there, take that, bring it back") that is refused unless it can actually be played, then run from the events the game reports.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `validateQuest(value, world)` | [schema/quest.json](schema/quest.json) | `world` answers `hasNpc`, `hasPlot`, `hasInterior`, `hasItem`, `hasAnchor` |
| `QuestLog.create(quests, player)` | validated quests, a `@gb/play` `PlayerState` | quests came back `ok` from `validateQuest` |
| `QuestLog.load(value, quests, player)` | [schema/quest-progress.json](schema/quest-progress.json) | same quest set the save was made with |
| `QuestLog.handle(event)` | [schema/game-event.json](schema/game-event.json) | any untrusted event from the game |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `validateQuest` | a `QuestDoc` | every step reachable, every path ends, every reference exists, every item in hand before it is asked for |
| `QuestLog.handle` | `Change[]` | `quest-started`, `step-opened`, `step-done`, `quest-complete`, `quest-failed`; empty when nothing moved |
| `QuestLog.objectives()` | `Objective[]` | one line per open step, with its marker label, hint, and the place or person it points at |
| `QuestLog.isQuestItem(itemId)` | boolean | true while a live quest still needs that item |
| `QuestLog.toJSON()` | [schema/quest-progress.json](schema/quest-progress.json) | resumes to exactly the same open steps |

## Step kinds (closed set)

`talk`, `goto`, `collect`, `deliver`, `stash`, `escort`, `choice`, `join`, `complete`, `fail`. A generator may use no others.

## Errors (closed set)

- `invalid-quest`: failed the JSON Schema. Carries the offending paths.
- `broken-flow`: schema-valid but unplayable. Carries every problem: dangling reference, unreachable step, dead end, loop, no completion, or an item asked for before the player can have it.
- `invalid-event`: the reported event is not one of the known shapes. Nothing moves.
- `invalid-progress`: the save is not quest progress.
- `unknown-quest` / `already-started`: from `start`.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): results and schema validation.
- `@gb/play` contract (game/play/CONTRACT.md): the player state that conditions read and effects write.

## Invariants

- A quest is only ever run after `validateQuest` accepted it, so the runtime never has to handle a broken flow.
- Solvability is proved before play: walking the flow forward, every `deliver`, `stash`, `has-item` and `escort` is guaranteed to be satisfiable on every path that reaches it.
- A flow runs forward only: cycles are rejected, so a quest cannot trap the player.
- Steps that need no player action (`join`, `complete`, `fail`) resolve the moment they open.
- The runtime reads the world only through `WorldView`, and touches the player only through `@gb/play`, so it runs headless with no renderer.
- Effects are the only way a quest changes the player: nothing is applied implicitly by an event.
- Being a quest item is a binding from a live quest, not a property of the thing, so the same ledger can be untouchable in one playthrough and ordinary loot in another. Shipped RPGs bind it the same way, per quest rather than per item.

## How to modify this blackbox safely

New step kinds, conditions and effects are additive: extend the union, teach `checkFlow` what they guarantee, teach the runtime what completes them, bump the minor contractVersion. Never change what an existing kind means, because exported worlds contain quests written against it. Regenerate `schema/` (`pnpm --filter @gb/quest run schema`) and run `pnpm --filter @gb/quest test` in the same change.
