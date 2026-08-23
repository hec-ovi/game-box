# @gb/world contract

contractVersion: 0.8.0

## Purpose

Holds a city: its grid of streets and plots, the buildings you can enter, the people stationed in them and the things lying around, and refuses any state that does not hold together.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `World.found(spec)` | `CitySpec`: name, theme, seed, width, height, cellSize?, generator?, premise? | none: the spec is checked here |
| `World.create(spec)` | same `CitySpec` | the spec must already be sound; a bad one throws. Going: use `found` |
| `World.load(value)` | [schema/world.json](schema/world.json) | any untrusted JSON, including generated output |
| `World.addPlot(spec)` | `PlotSpec`: kind, name, rect, entrance, storeys, style, design? | footprint is free land; kind is one of `BUILDING_KINDS`; a design names a recorded catalogue |
| `World.recordCatalogues(refs)` | `AssetPackRef[]`, at most `MAX_CATALOGUES`: `{ pack, version, sha256? }` | the list is checked here, and must still name every catalogue a plot is already pinned to. Replaces the recorded list |
| `World.recordDesign(plotId, design)` | `PlotDesign`: `{ pack, model, mirror, rooms }` | the plot exists and `pack` is one of the recorded catalogues |
| `World.addInterior(interior)` | `interior` in [schema/world.json](schema/world.json) | its `plotId` exists |
| `World.addNpc(npc)` / `addItem(item, placement)` | same | referenced interior, anchor and item exist |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `World.toJSON()` | [schema/world.json](schema/world.json) | complete document; id counters included so a later session keeps minting fresh ids |
| `World.check()` | `IntegrityProblem[]` | empty means every reference resolves and the grid agrees with the plots |
| `buildSites(w, h)` | `Rect[]` | free footprints that touch a sidewalk: where a later generation pass may build |
| queries: `plot`, `npc`, `item`, `interior`, `plotsOfKind`, `npcsIn`, `positionOf` | plain records | undefined when the id is unknown, never a throw |
| `World.catalogues()` | `AssetPackRef[]` | what this city was designed against. Empty means the file records none |
| `World.premise()` | `Premise` or nothing | the history this city was built against, as it was written. Nothing means it was founded without one |
| `questView(world)` | `QuestView` | the five questions `@gb/quest` asks of a world: `hasNpc`, `hasPlot`, `hasInterior`, `hasItem`, `hasAnchor(interiorId, anchorId)` |

## What a city was designed against

A world file says which art it was drawn from, so opening it years later draws
the same city and not a newer catalogue's idea of it.

- **`world.catalogues`** is the list of art packs the city was designed
  against: pack, version, and the hash of that pack's own manifest where the
  producer publishes one. Absent means the file records nothing, which is the
  honest state of every city exported before this.
- **`plot.design`** is what one plot was actually dressed with: `pack` (one of
  the recorded catalogues), `model`, `mirror`, and `rooms`, the whole pictures
  its window rooms are slid along. It is written once, when the choice is made,
  and read back forever after.
- A plot whose `design.pack` is not in `world.catalogues` is a dangling
  reference like any other: `load` refuses the document, `check()` reports it,
  and the three ways to write one (`addPlot`, `recordDesign`,
  `recordCatalogues` dropping a pack in use) all refuse instead.

A renderer reads `plot.design` and draws that model. A model the reader's copy
of the pack no longer has falls back the same way a missing pack does; nothing
re-picks. Whoever holds the catalogue writes the pin, because the generator
never sees the art.

Both fields are optional and `schemaVersion` is still 1, so a city exported
before this loads, checks and hashes exactly as it did.

## The history a city was built against

A city is planned from a history: why the town is here, what happened to it,
what is at stake, who is arguing about it, what everybody knows, and what the
town therefore holds. `world.premise` is that history, written into the file at
founding.

It lives here because a city that is only steered by its history and does not
carry it is a city that forgets what it is: growing it later grows it
unsteered, and nothing reading the file afterwards can say what the town is
about. Only what rode along on the people survived otherwise.

- **`Premise`** is `livesOn`, `happened`, `stake`, `sides` (two at least, each
  with a name and what it wants), `common`, and `build` (`moreOf`, `fewerOf`,
  `mustHave`) in this box's own `BUILDING_KINDS`.
- It is short by design and bounded like everything else in the document, so a
  history cannot bloat a file or a prompt.
- It is written once, at `found`, and never rewritten. A city grown later is
  grown against the same story it started from.
- `build` is a record of what the history asked for, not a claim about what was
  built: a town that could not fit a demanded kind is still a sound world.

The shape lives here rather than in the generator because the generator depends
on this box and not the other way round: a world document can only carry what
this box validates, and `build` is already in this box's vocabulary. Whoever
opens a shared city can read its history without the generator present.

`premise` is optional and `schemaVersion` is still 1, so a city exported before
this loads, checks and hashes exactly as it did.

## Errors (closed set)

- `invalid-document`: failed the JSON Schema, whether it arrived as a whole document or as a city spec. Carries the offending paths.
- `inconsistent-world`: schema-valid but references dangle or the grid disagrees. Carries every problem found, not just the first.
- `no-space`: the footprint is not free land.
- `unknown-reference`: an added interior, NPC or item points at something that does not exist, or a design names a catalogue the city has not recorded.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): ids, results, schema validation.

## Invariants

- A `World` that returns `ok` from `load` is sound: no duplicate ids, no dangling references, exactly one street door per interior, one plot per interior pointing back at it, no two NPCs on one anchor, every item somewhere in the world, every plot footprint marked on the grid.
- Content is only ever accepted through the schema plus the integrity check, so a language model cannot write a broken city into the file (fail closed).
- Ids are minted once and never reused; a document loaded and saved keeps every id it had.
- **A city's history is a fact about the file.** It is written at founding and nothing here rewrites it, so growing a city later grows it against the story it started from, and a shared file says what its town is about without the generator that built it.
- **A plot's design is a fact about the file, never re-derived.** Nothing here chooses a model, and nothing rewrites one that is written down, so the same file is the same city on every machine and in every version of the art.
- **`plot.interiorId` is exactly the set of doors that open.** A plot with an interior can be walked into and a plot without one cannot, and the two directions are checked: an interior whose plot does not point back at it is refused. There is no second field saying the same thing.
- The grid is the single source of truth for what occupies a cell, which is what makes "add three more houses later" a lookup rather than a regeneration.
- Vocabularies (`BUILDING_KINDS`, `ROOM_KINDS`, `ANCHOR_KINDS`, `NPC_ROLES`, `ITEM_ARCHETYPES`, `FURNITURE_PROPS`, `BODY_KINDS`, `FACINGS`, `ROAD_KINDS`) are closed: every value maps to something the game can render, animate or place.
- **Which doors open is a fact about the file, not a list of kinds.** `plot.interiorId` is the whole answer, and what makes a door worth opening is what the place turns out to hold, which nothing here can know. There is no vocabulary of enterable kinds.
- An anchor kind is one stance, not one job: `work-desk` is sat in the chair at a desk, `work-bench` is on their feet at a bench with their hands on the top. Two stances at one surface height are two kinds, because a clip is chosen from the kind alone.
- An item carries what it is (archetype, value, bulk, who owns it). Whether it matters to a quest is not stored here: `@gb/quest` answers that from the live quest log.
- One world unit is one metre; cell coordinates convert through `cellSize`, and `METRICS` holds the proportions everything is sized from.
- **Width is a property of the class of road, not one number for all of them.** `METRICS.road` holds every class at its own width, in whole cells, and `ROAD_KINDS` is the closed vocabulary a segment's `kind` comes from:

  | kind | roadway | pavement each side | lanes | what it is |
  |---|---|---|---|---|
  | `street` | 5 cells, 10 m | 2 cells, 4 m | 2 | the ordinary road: one lane each way and room to stop at the kerb |
  | `avenue` | 7 cells, 14 m | 2 cells, 4 m | 4 | the spine a district hangs off: two lanes each way at 3.5 m |
  | `exit` | 9 cells, 18 m | 2 cells, 4 m | 4 | the road out of the valley: everything leaving town goes down it and nothing fronts onto it |

  Metres are cells times `cellSize`. `METRICS.street.roadwayCells` is the street class's own number, unchanged in meaning, and `METRICS.street.curbHeight` is the drop from any pavement to any roadway.
- A roadway is always an **odd** number of cells, so its centreline is a line of cell centres. That is where the road graph's nodes sit and where a lane is measured from: an even roadway would put every junction and every car half a cell off the middle of the road. `WIDEST_ROADWAY_CELLS` is the widest of the classes, which is how far a pedestrian may have to walk from one kerb to the other.
- Furniture stands on the floor unless it says otherwise. `Furniture.lift` is the metres off the floor its base sits, for a piece that stands on another piece: a till or a coffee machine on a counter top. Absent is the floor, which is where all but a handful of pieces are, and the number is the host's own contact height, so nothing downstream measures anything.
- `METRICS.furniture` is where a body meets a piece: the bar counter, service counter, worktop, table, stool, seat and mattress it sits, sleeps or works on. The art is built to those heights, so the number lives here and not in each box that needs it.
- **A height a body works at is inside the reach of the stance that works there.** `METRICS.reach` is how far a body actually reaches, measured off the shipped clips skinned onto all twelve dressed characters with the root on the floor, and every working surface is held to it in the tests:

  | surface | stance | measured | height |
  |---|---|---|---|
  | `serviceCounterHeight` | on the feet, hands on the top | palms 0.972, wrists 1.041 | 1.0 |
  | `worktopHeight` | the same stance: a hob, a bench, a run beside a sink | palms 0.972, wrists 1.041 | 1.0 |
  | `tableHeight` | sat at a desk, leaning in | palms 0.720, wrists 0.787 | 0.75 |
  | `seatHeight` | sat down, soles on the floor | body's underside 0.423 | 0.45, so the pad gives 2.7 cm |

  A worktop is the same number as a service counter because one standing clip serves both and there is no lower standing pose on this rig. They stay two names because they are two surfaces, and the day a lower clip exists a worktop drops on its own.
- **Two heights carry no stance at all**, and nothing should read them as one. `barCounterHeight` (1.1) is the customer's rail where a drink stands; the staff work the shelf behind it at `serviceCounterHeight`. `stoolHeight` (0.75) is set for the bar the stool stands at, and the only seated clip has its soles on the floor with the body's underside at 0.423, so no body on this rig sits on one properly.
- A city spec is measured against the world document's own bounds before a single cell is allocated (grid 4-1024 a side, name 80 characters, theme 60, seed 120, cellSize up to 16), so a world that `found` hands back is a world that `load` accepts. Nothing large is ever built only to fail validation after it has been written.

## How to modify this blackbox safely

`tests/fixtures/sealed-bundle.json` is a city `@gb/bundle` sealed before this box last changed. It is never regenerated: it is the only proof that a file somebody already has still opens, still holds together, and still hashes to the string it was shared with.

The heights in `METRICS` are not free numbers: `METRICS.reach` was measured by
skinning `assets/dist/anims.glb` onto all twelve characters in
`assets/dist/characters/` and reading the lowest point of the hands, the
buttocks and the thighs with the root on the floor. `@gb/cast`'s pose tests
take the same measurement from the other side. Change a clip and both move.

Add fields as optional and bump the minor contractVersion; a required field or a changed meaning needs `schemaVersion: 2` alongside the old shape. Vocabularies may gain values freely and lose them only with a migration, because worlds already exported use them. Regenerate `schema/world.json` in the same change (`pnpm --filter @gb/world run generate`) and run `pnpm --filter @gb/world test`.
