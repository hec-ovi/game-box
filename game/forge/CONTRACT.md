# @gb/forge contract

contractVersion: 0.1.0

## Purpose

Builds a whole city from one brief: streets, plots, interiors, the people standing in them, the things lying around, and the quests that string them together, then checks all of it before handing it over.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Forge.build(brief)` | [schema/brief.json](schema/brief.json) | theme, seed, blocks across and down, cells per block, density, max storeys, exits |
| `new Forge(narrator)` | a `Narrator` | answers `nameCity`, `namePlace`, `describeNpc`, `describeItem`, `writeQuests` |
| `Forge.extend(world, count)` | a `@gb/world` `World` | the world has empty land touching a sidewalk |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `build` | `{ world, quests, rejected }` | `world.check()` is empty; every quest passed `@gb/quest` validation; `rejected` lists the ones that did not, with why |
| `extend` | plot ids added | nothing already in the world changed |
| `summarise(world)` | `WorldSummary` | the abstract world a quest writer reads: places, who is in them, what is there |
| `viewOf(world)` | `WorldView` | the five questions `@gb/quest` asks |

## Errors (closed set)

- `invalid-brief`: the brief failed its schema. Nothing is built.
- `unsound-world`: the generator produced a world that fails its own integrity check. Carries the problems; this is a bug in the generator, never a bad brief.

A narrator writing an unusable quest is not an error: those quests are dropped and reported in `rejected`.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): deterministic rng, ids, results.
- `@gb/world` contract (game/world/CONTRACT.md): everything it builds into.
- `@gb/quest` contract (game/quest/CONTRACT.md): validation of what the narrator writes.

## Invariants

- Geometry is arithmetic, never invention: streets, sidewalks, plot footprints, entrances, rooms, furniture and anchors are computed. A narrator supplies names, personalities and quest logic only.
- Same seed, same city, down to the byte. Sub-streams are forked per block, per site and per interior, so adding a building later cannot change one already built.
- Nothing a narrator writes is trusted: quests are validated against the world and dropped if they do not hold up.
- Every service post is staffed: a bar has a bartender, a shop has a clerk, whatever the density.
- Buildings leave gaps. `extend` fills them, and never moves anything already placed.
- Proportions come from `@gb/world`'s `METRICS`: 2 m cells, 6 m roadways, 2 m sidewalks, rooms sized in metres.

## How to modify this blackbox safely

The `Narrator` interface is the seam for a language model: implement it elsewhere and pass it in; `OfflineNarrator` stays as the offline default and the reference shape. New building kinds need a room recipe, a furnishing branch and a role mapping, or they generate empty shells. Regenerate `schema/brief.json` (`pnpm --filter @gb/forge run schema`) and run `pnpm --filter @gb/forge test`. `pnpm --filter @gb/forge run preview` prints a town to look at.
