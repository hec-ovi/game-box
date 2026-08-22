# @gb/world contract

contractVersion: 0.1.0

## Purpose

Holds a city: its grid of streets and plots, the buildings you can enter, the people stationed in them and the things lying around, and refuses any state that does not hold together.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `World.create(spec)` | `CitySpec`: name, theme, seed, width, height, cellSize? | grid 4-1024 cells per side |
| `World.load(value)` | [schema/world.json](schema/world.json) | any untrusted JSON, including generated output |
| `World.addPlot(spec)` | `PlotSpec`: kind, name, rect, entrance, storeys, style | footprint is free land; kind is one of `BUILDING_KINDS` |
| `World.addInterior(interior)` | `interior` in [schema/world.json](schema/world.json) | its `plotId` exists |
| `World.addNpc(npc)` / `addItem(item, placement)` | same | referenced interior, anchor and item exist |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `World.toJSON()` | [schema/world.json](schema/world.json) | complete document; id counters included so a later session keeps minting fresh ids |
| `World.check()` | `IntegrityProblem[]` | empty means every reference resolves and the grid agrees with the plots |
| `buildSites(w, h)` | `Rect[]` | free footprints that touch a sidewalk: where a later generation pass may build |
| queries: `plot`, `npc`, `item`, `interior`, `plotsOfKind`, `npcsIn`, `positionOf` | plain records | undefined when the id is unknown, never a throw |

## Errors (closed set)

- `invalid-document`: failed the JSON Schema. Carries the offending paths.
- `inconsistent-world`: schema-valid but references dangle or the grid disagrees. Carries every problem found, not just the first.
- `no-space`: the footprint is not free land.
- `unknown-reference`: an added interior, NPC or item points at something that does not exist.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): ids, results, schema validation.

## Invariants

- A `World` that returns `ok` from `load` is sound: no duplicate ids, no dangling references, exactly one street door per interior, no two NPCs on one anchor, every item somewhere in the world, every plot footprint marked on the grid.
- Content is only ever accepted through the schema plus the integrity check, so a language model cannot write a broken city into the file (fail closed).
- Ids are minted once and never reused; a document loaded and saved keeps every id it had.
- The grid is the single source of truth for what occupies a cell, which is what makes "add three more houses later" a lookup rather than a regeneration.
- Vocabularies (`BUILDING_KINDS`, `ANCHOR_KINDS`, `NPC_ROLES`, `ITEM_ARCHETYPES`, `FURNITURE_PROPS`) are closed: every value maps to something the game can render, animate or place.
- One world unit is one metre; cell coordinates convert through `cellSize`, and `METRICS` holds the proportions everything is sized from.

## How to modify this blackbox safely

Add fields as optional and bump the minor contractVersion; a required field or a changed meaning needs `schemaVersion: 2` alongside the old shape. Vocabularies may gain values freely and lose them only with a migration, because worlds already exported use them. Regenerate `schema/world.json` in the same change (`pnpm --filter @gb/world run schema`) and run `pnpm --filter @gb/world test`.
