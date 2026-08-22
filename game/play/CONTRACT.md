# @gb/play contract

contractVersion: 0.1.0

## Purpose

The playthrough: what the player carries, what they stole, what they can afford, what they have been told, and who is walking with them.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `PlayerState.create(worldId, startingMoney?)` | ids as strings | money is a whole number, zero or more |
| `PlayerState.load(value, worldId)` | [schema/player-state.json](schema/player-state.json) | the save's `worldId` matches the world being played |
| mutations: `take`, `drop`, `earn`, `spend`, `setFlag`, `adjustReputation`, `addCompanion`, `removeCompanion` | ids and whole numbers | see errors |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `toJSON()` | [schema/player-state.json](schema/player-state.json) | a complete save for this world |
| queries: `has`, `isStolen`, `inventory`, `money`, `flag`, `reputation`, `companions`, `isCompanion` | plain values | unknown flags read `false`, unknown factions read `0` |

## Errors (closed set)

- `invalid-save`: failed the JSON Schema. Carries the offending paths.
- `wrong-world`: the save belongs to a different world id.
- `missing-item`: dropping something the player is not carrying.
- `not-enough-money`: spending more than is held. Nothing is deducted.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): results and schema validation.

## Invariants

- Money never goes negative and a refused purchase changes nothing.
- Reputation stays within -100 and 100 whatever is applied to it.
- An item is in the inventory at most once, and dropping it also clears its stolen mark.
- A save is only ever loaded against the world it was made in, so ids cannot silently point at different things.
- This box knows nothing about quests, dialogue or geometry; it only holds state and answers questions about it.

## How to modify this blackbox safely

Add fields as optional and bump the minor contractVersion; a required field needs `schemaVersion: 2` alongside the old shape. Regenerate `schema/player-state.json` (`pnpm --filter @gb/play run schema`) and run `pnpm --filter @gb/play test` in the same change.
