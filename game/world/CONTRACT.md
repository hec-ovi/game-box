# @gb/world contract

contractVersion: 0.12.0

## Purpose

Holds a city: what it was asked to be, the kinds of place it has and what each one is, its grid of streets and plots, the buildings you can enter, the people stationed in them with their own lives, the things lying around and what they cost, the sizes everything is drawn and cut to, and refuses any state that does not hold together.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `World.found(spec)` | `CitySpec`: name, theme, seed, width, height, cellSize?, generator?, premise?, brief?, asks?, charters? | none: the spec is checked here |
| `World.create(spec)` | same `CitySpec` | the spec must already be sound; a bad one throws. Going: use `found` |
| `World.load(value)` | [schema/world.json](schema/world.json) | any untrusted JSON, including generated output |
| `World.addPlot(spec)` | `PlotSpec`: kind, name, rect, entrance, storeys, style, design?, the `plot` record in [schema/world.json](schema/world.json) without its id | footprint is free land; kind is the word of a declared charter; a design names a recorded catalogue |
| `World.recordCharters(charters)` | `ResolvedCharter[]`, 1 to `MAX_CHARTERS` (24), see [schema/world.json](schema/world.json) `charters` | the list is checked and normalised here, and must still hold every word a plot already has. Replaces the declared list |
| `World.recordCatalogues(refs)` | `AssetPackRef[]`, at most `MAX_CATALOGUES`: `{ pack, version, sha256? }` | the list is checked here, and must still name every catalogue a plot is already pinned to. Replaces the recorded list |
| `World.recordDesign(plotId, design)` | `PlotDesign`: `{ pack, model, mirror, rooms }` | the plot exists and `pack` is one of the recorded catalogues |
| `World.addInterior(interior)` | `interior` in [schema/world.json](schema/world.json) | its `plotId` exists. A `finish` left out is written from the plot's charter |
| `World.addNpc(npc)` / `addItem(item, placement)` | `npc`, `item` and `placement` in the same schema | referenced interior, anchor and item exist |
| `World.addRoad(nodes, segments)` | `roads.nodes` and `roads.segments` in the same schema | none: the graph is checked by `check()` and refused by `load` |

**One rule at both doors.** Every add reads its record through the same
schema `load` reads a file with, so a record added at runtime is what the
file would carry: defaults filled (a door's `locked` false, an item's `value`
0 and `bulk` pocket), keys in schema order, anything outside the schema
dropped. It then refuses exactly what `load` would refuse in that record, as
`invalid-document` with the same paths (`interior_1` is not an id, a plot
of 41 storeys, a body the pack does not hold), and nothing that `load` would
take. A refusal writes nothing: no id, no ground, no record.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `World.toJSON()` | [schema/world.json](schema/world.json) | complete document; id counters included so a later session keeps minting fresh ids |
| `World.check()` | `IntegrityProblem[]` | empty means every reference resolves and the grid agrees with the plots |
| `buildSites(w, h)` | `Rect[]` | free footprints that touch a sidewalk: where a later generation pass may build |
| queries: `plot`, `npc`, `item`, `interior`, `plotsOfKind(word)`, `npcsIn`, `positionOf` | plain records | undefined when the id is unknown, never a throw. `interior(id)` and `interiors()` always carry `finish`, see below |
| `CELL_KINDS`, `CELL`, `Grid` | the closed cell vocabulary; the char each kind is written as; the matrix | what each kind means for walking, driving and drawing, see below |
| `World.charters()`, `World.charter(word)` | `ResolvedCharter[]`; `ResolvedCharter` or nothing | the kinds of place this city has: its own list when the file carries one, else `SHIPPED_CHARTERS`. Nothing means no charter declares the word |
| `CharterSchema`, `ResolvedCharterSchema`, `ChartersSchema` | zod, with `charterContract`, `resolvedCharterContract`, `chartersContract` | what a generator writes, what the file carries, and the whole list, see below |
| `SHIPPED_CHARTERS`, `BUILDING_KINDS` | fourteen `ResolvedCharter`s; their words as a tuple | the presets every city was built from before charters, in the order a mix draws them. `BUILDING_KINDS` and `BuildingKind` are the preset word list for this release only |
| `ROOM_USES`, `FRONTAGES`, `OPENNESS`, `MATERIALS`, `SIGN_VOICES`, `ACCESS_KINDS`, `SERVICES`, `WORK_KINDS`, `HOLDINGS`, `FINISHES`, `PROMINENCES`, `SPRAWLS`, `KIT_PIECES` | closed lists | the axes a charter is written on, and the wall pieces a resolved one may name |
| `HOLDING_ARCHETYPES` | `Record<Holding, ItemArchetype[]>` | what each class of holding is made of; every archetype is in exactly one class |
| `ROOM_USE_KIND`, `roomKindOf(spec)`, `roomUseOf(room, charter)` | `Record<RoomUse, RoomKind>`; `RoomKind`; `RoomUse` | the label a use cuts to, the label a charter's room takes, and which routine dressed a room, read off its label through the charter when the file left `use` out |
| `World.catalogues()` | `AssetPackRef[]` | what this city was designed against. Empty means the file records none |
| `World.premise()` | `Premise` or nothing | the history this city was built against, as it was written. Nothing means it was founded without one |
| `World.brief()`, `World.asks()` | a string or nothing; `Asks` or nothing | what the owner asked for, in their words, as it was typed. Nothing means they gave only the theme |
| `PROP_SPECS`, `PROP_CELL`, `footprintOf(prop)` | `Record<FurnitureProp, PropSpec>`, `0.1`, `{ width, depth }` in metres | one entry per `FURNITURE_PROPS` value: the floor it claims and the height a body meets it at |
| `PLOT_BAND`, `plotShape(plot)`, `inPlotBand(shape)` | cell ranges; `{ frontage, depth, storeys }` in cells read in the door's frame; boolean | how a city is cut, see below |
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

## What a kind of place is

A place is not a name the engine knows. It is a **charter**: an entry in
`world.charters`, keyed by whatever word the premise invented, whose every
field is a closed enum this box ships, a clamped number, or text that is only
printed or hashed. `plot.kind` and `interior.kind` hold the word (`WORD`,
lowercase, 24 characters), and the word is legal only because the file
declares it. Nothing here branches on a word.

**The charter** (`CharterSchema`, what a generator writes):

- text: `word`, `label` (what a person says out loud), `blade` (2 to 8
  capitals, digits and spaces: what the sign atlas can spell), `names` (1 to 3
  templates interpolating only `{family}`, `{adjective}` and `{noun}`),
  `rumours` (0 to 3 sentences; empty falls through to `premise.common`);
- placement: `share` (1 to 10, its weight in the mix), `prominence`
  (`PROMINENCES`), `residential`;
- mass: `size.storeys` (`[low, high]`, 1 to 40), `size.sprawl` (`SPRAWLS`);
- street: `frontage` (`FRONTAGES`), `openness` (`OPENNESS`, the upper
  window rhythm: dense every module, even every second, sparse every third),
  `material` (`MATERIALS`), `voice` (`SIGN_VOICES`);
- behaviour: `access` (`ACCESS_KINDS`), `service` (`SERVICES`), `work` (up
  to 3 of `WORK_KINDS`), `holding` (up to 3 of `HOLDINGS`), `finish`
  (`FINISHES`);
- rooms: `hall?`, `main`, `services` (up to 5, each with `weight` 1 to 3,
  `spare?`, `shut?`), every room a `use` from `ROOM_USES` (one value per
  dressing routine that exists) and a display `name`, plus `kind?` for a
  room cut under a label its use does not imply (a bar's store is a cellar).

**The resolved charter** (`ResolvedCharterSchema`, what the file carries) is
the charter plus what the engine derived from it, written once so no reader
re-derives anything: `built` (street, flank and upper courses as
`{ plain, window, rhythm }` in `KIT_PIECES`, `crown?`, `fascia`, `door`),
`signage` (`blade`, `hanging`, `nameplate` 0 to 1, `accents` 0 to 4), `tint`
(packed `0xRRGGBB`) and `suits` (tags a building catalogue matches a look
against). A model never writes a piece id.

**Normalised as it is read.** The list is sorted by word and refuses a word
twice; inside a charter every map's keys are sorted, `work`, `holding` and
`suits` are sorted, every number is clamped to its range and every fraction
rounded to three decimals. A generator that dithers or reorders its output
cannot move a building, and reading a document twice gives the same bytes.

**The presets.** `SHIPPED_CHARTERS` is the fourteen kinds every city was
built from before charters, each carrying the resolved values it has always
been drawn with, in the order a mix has always drawn them. A file with no
`charters` is read against exactly these, so a city exported before charters
loads, checks and hashes as it did. A file that carries `charters` is read
against those alone: it is self-describing, and a preset it wants has to be
in the list. Presets are all `access: open`, which is how every door opens
today. Their `finish` is `domestic` for house, apartment and hotel and
`corporate`, `civic` or `industrial` for the rest, so a furnisher with two
languages keeps today's picture by reading `domestic` as home and the rest
as its other.

**Rooms, anchors and finish.** `Room.use` is which routine dressed a room; a
file that left it out reads it back with `roomUseOf(room, charter)`, off the
room's `kind` through the rooms its charter asks for, which is total.
`Anchor.doing` is an optional phrase for the talk, what whoever stands there
is doing, only ever printed. `Interior.finish` (`FINISHES`) is the language
its rooms are dressed in, so a furnisher reads the interior and no table of
kinds: `addInterior` writes the plot's charter's `finish` into a new interior
that brought none, and an interior a `World` hands out (`interior(id)`,
`interiors()`) always carries one, read off the charter when the file left it
out. A loaded file is left as written: a city exported before interiors
carried a finish saves back byte for byte.

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
  `mustHave`), each a list of words for kinds of place.
- It is short by design and bounded like everything else in the document, so a
  history cannot bloat a file or a prompt.
- It is written once, at `found`, and never rewritten. A city grown later is
  grown against the same story it started from.
- `build` is a record of what the history asked for, not a claim about what was
  built: a town that could not fit a demanded kind is still a sound world.

The shape lives here rather than in the generator because the generator depends
on this box and not the other way round: a world document can only carry what
this box validates, and `build` is written in the same words the charters are. Whoever
opens a shared city can read its history without the generator present.

`premise` is optional and `schemaVersion` is still 1, so a city exported before
this loads, checks and hashes exactly as it did.

## What the owner asked for

`theme` is the short keyword hint (60 characters) the offline author reads.
Everything longer the owner has to say goes in two other fields, written at
`found` and read back by whoever opens the file, so a shared city says what it
was asked to be and a later growth keeps to it.

- **`world.brief`** is what the city is about, in the owner's own words,
  unbounded. It is the owner's text and never the model's, which is why it has
  no cap.
- **`world.asks`** is everything else, all optional: `mainQuest`, `sideQuests`
  and `tone` as free text for the writers, and `style` as choices inside the
  catalogue: `neon` (`NEON_LEVELS`: dark, some, lit), `density`
  (`DENSITY_LEVELS`: sparse, mixed, dense), `wear` (`WEAR_LEVELS`: kept,
  lived-in, run-down).
- **A style outside the catalogue cannot be honoured.** The art is one set of
  building looks, facades and outfits on one skeleton; a period or a look it
  does not hold (medieval, pastel, brutalist) would give the same town with
  different names. So `style` is a closed set and there is no free-text style:
  a form offers these choices and says that anything else is not drawable,
  rather than taking the word and dropping it.

Both fields are optional; a city founded with only a theme carries neither.

## A person's life, and what the player earns of it

`personality` and `knowledge` are what a person is and what they know. Two
optional fields carry the rest, both written once by the generator and only
ever printed into a prompt or hashed:

- **`npc.life`** is their own life, every part optional and bounded because it
  is model output riding in the file: `history` (600 characters), and
  `interests`, `manner`, `cares`, `avoids`, `reason` (why they are at this spot
  at this hour) and `errand` (what a walker is doing, or where they are going)
  at 300 each. Two people in one room answer differently because of it.
- **`npc.background`** is the codex: up to `MAX_BACKGROUND_FACTS` (12) staged
  facts of 300 characters, each with what earns it, `unlockedBy` in
  `BACKGROUND_UNLOCKS`: `met` (seen them), `talked` (spoken to them), `quest`
  (finished their job), `told` (heard it from somebody else). Which facts a
  player holds is playthrough state and lives in `@gb/play`; the file holds
  only what there is to earn.

## The sizes everything is drawn and planned from

`PROP_SPECS` is the one table of furniture sizes: for every `FURNITURE_PROPS`
value, `cells` (the floor it claims, across the front then front to back, in
`PROP_CELL` = 10 cm room cells, so two pieces can never half-overlap),
`contact` (the surface a body meets: `work` for a top it leans or works on,
`rest` for a seat or a mattress, at a `METRICS.furniture` height), `height`
for a piece nobody touches, `staffContact` for the bar counter's shelf worked
from the far side, `onSurface` for a piece that stands on a counter top, and
`blocks` (whether a body walks around it: a rug and a till stop nobody).
`footprintOf(prop)` is the same footprint in metres. The planner keeps pieces
apart by this table and the renderer builds to it, so a chair is never
planned against a table drawn another size.

## How a city is cut

`PLOT_BAND` is the sizes a plot comes in, in grid cells: `frontage` 3 to 6
across the wall the door is on, `depth` 5 to 8 back from it, `storeys` 1 to 4.
`plotShape(plot)` reads a plot in its door's frame (a door on an east or west
wall is the same shape turned a quarter) and `inPlotBand(shape)` says whether
every side is inside the band. The generator cuts inside it and the building
art is drawn for exactly those shapes; a plot outside it is still a sound
world (the document allows up to 40 storeys), it is dressed from the kit
instead of the catalogue.

## The cells a city is laid in

`CELL_KINDS` is every kind of cell the grid holds, `CELL` the char each one is
written as, and this table what each means. Whoever routes (`@gb/nav`), drives
(`@gb/traffic`, `@gb/drive`) or draws (`@gb/scene`, `@gb/land`) reads it here
and keeps no list of its own; a char outside it fails `load`.

| kind | char | walking | driving | drawn as |
|---|---|---|---|---|
| `empty` | `.` | crossed | never | unbuilt ground at road level, inside the town; the only ground `buildSites` offers a later plot |
| `street` | `S` | crossed, at a price | the only ground a car drives | the roadway, kerb to kerb, at zero |
| `sidewalk` | `W` | where people walk | never | the pavement, `METRICS.street.curbHeight` above the roadway, a kerb closing the drop |
| `building` | `B` | never; the way in is the plot's entrance door | never | a plot's footprint, the building standing on it |
| `park` | `P` | crossed | never | open ground at pavement height, never built on |
| `mountain` | `M` | never | never | the valley wall, see below |
| `water` | `~` | never | never | standing water at zero |

Heights are `@gb/scene`'s to draw and `@gb/nav`'s to price; what is passable is
written here so the three cannot disagree.

### What a mountain cell means

A `mountain` cell (`M`) is the valley wall. The city is a valley with far
limits, and the wall is where the built ground ends:

- **Impassable.** No route starts, ends or passes there, for a walker or a car.
- **The ground rises from the city's edge.** Where a `mountain` cell shares an
  edge with a `sidewalk` or a verge, the rise starts at the pavement's top, so
  nothing shows under the edge of the city, and it climbs away from the town
  from there.
- **No kerb against it.** The pavement meets the rise flush; the drop a kerb
  closes is a drop to a roadway, and there is none here.

The grid says where the wall is; whoever draws the land draws the rise, whoever
draws the city draws no kerb against it, and whoever routes never crosses it.

## Errors (closed set)

- `invalid-document`: failed the JSON Schema, whether it arrived as a whole document, as a city spec, or as one record added at runtime. Carries the offending paths.
- `inconsistent-world`: schema-valid but references dangle or the grid disagrees. Carries every problem found, not just the first.
- `no-space`: the footprint is not free land.
- `unknown-reference`: an added interior, NPC or item points at something that does not exist, a design names a catalogue the city has not recorded, a plot's word names no charter the city declares, or a recorded list of charters or catalogues drops one a plot holds.

## Dependencies

- `@gb/kit` contract (game/kit/CONTRACT.md): ids, results, schema validation.

## Invariants

- A `World` that returns `ok` from `load` is sound: no duplicate ids, no dangling references, every `plot.kind` resolves in the declared charters, exactly one street door per interior, one plot per interior pointing back at it, no two NPCs on one anchor, every item somewhere in the world, every plot footprint marked on the grid.
- **What a place is, is a fact about the file.** A charter is a composition over shipped atoms only: a value outside the closed lists fails the schema, a charter stripped to its word fails the schema, and a reader draws what the charter carries. Adding a charter adds nothing to download.
- Content is only ever accepted through the schema plus the integrity check, so a language model cannot write a broken city into the file (fail closed).
- **A city saves to the same bytes whichever door it came in by.** Every record is read through its schema at both doors, and a field written on the document or on a plot later (`charters`, `catalogues`, a plot's `interiorId` or `design`) lands where the file carries it, so a city founded and filled through the adds, saved, loaded and saved again is byte for byte the first save. A file is left as it was written.
- Ids are minted once and never reused; a document loaded and saved keeps every id it had.
- **A city's history is a fact about the file.** It is written at founding and nothing here rewrites it, so growing a city later grows it against the story it started from, and a shared file says what its town is about without the generator that built it.
- **A plot's design is a fact about the file, never re-derived.** Nothing here chooses a model, and nothing rewrites one that is written down, so the same file is the same city on every machine and in every version of the art.
- **`plot.interiorId` is exactly the set of doors that open.** A plot with an interior can be walked into and a plot without one cannot, and the two directions are checked: an interior whose plot does not point back at it is refused. There is no second field saying the same thing.
- The grid is the single source of truth for what occupies a cell, which is what makes "add three more houses later" a lookup rather than a regeneration.
- Vocabularies (`CELL_KINDS`, `ROOM_KINDS`, `ROOM_USES`, `ANCHOR_KINDS`, `NPC_ROLES`, `ITEM_ARCHETYPES`, `FURNITURE_PROPS`, `BODY_KINDS`, `FACINGS`, `ROAD_KINDS`, `KIT_PIECES`, `BACKGROUND_UNLOCKS`, `NEON_LEVELS`, `DENSITY_LEVELS`, `WEAR_LEVELS`, and the twelve charter axes) are closed: every value names a routine the engine runs or a thing it ships. What a place is, is closed by the world document instead, in its charters. `BODY_KINDS` is the two bodies of the shipped pack, `male` and `female`: its two files are one mesh per sex, each with a light and a dark skin sheet, both on the canonical 65-joint skeleton, and a heavier build would be a name for the same mesh until a pack ships one. `dance` is an anchor kind because a dance clip ships.
- **Which doors open is a fact about the file, not a list of kinds.** `plot.interiorId` is the whole answer, and what makes a door worth opening is what the place turns out to hold, which nothing here can know. There is no vocabulary of enterable kinds.
- An anchor kind is one stance, not one job: `work-desk` is sat in the chair at a desk, `work-bench` is on their feet at a bench with their hands on the top. Two stances at one surface height are two kinds, because a clip is chosen from the kind alone.
- An item carries what it is (archetype, value, bulk, who owns it). `value` is whole credits, 0 or more, the price a counter sells it for; a file that leaves it out reads as 0, so every city exported without prices still opens. Whether it matters to a quest is not stored here: `@gb/quest` answers that from the live quest log.
- One world unit is one metre; cell coordinates convert through `cellSize`, and `METRICS` holds the proportions everything is sized from.
- **Width is a property of the class of road, not one number for all of them.** `METRICS.road` holds every class at its own width, in whole cells, and `ROAD_KINDS` is the closed vocabulary a segment's `kind` comes from:

  | kind | roadway | pavement each side | lanes | what it is |
  |---|---|---|---|---|
  | `street` | 5 cells, 10 m | 2 cells, 4 m | 2 | the ordinary road: one lane each way and room to stop at the kerb |
  | `avenue` | 7 cells, 14 m | 2 cells, 4 m | 4 | the spine a district hangs off: two lanes each way at 3.5 m |
  | `exit` | 9 cells, 18 m | 2 cells, 4 m | 4 | the road out of the valley: everything leaving town goes down it and nothing fronts onto it |

  Metres are cells times `cellSize`. `METRICS.street.roadwayCells` is the street class's own number, unchanged in meaning, and `METRICS.street.curbHeight` is the drop from any pavement to any roadway.
- A roadway is always an **odd** number of cells, so its centreline is a line of cell centres. That is where the road graph's nodes sit and where a lane is measured from: an even roadway would put every junction and every car half a cell off the middle of the road. `WIDEST_ROADWAY_CELLS` is the widest of the classes, which is how far a pedestrian may have to walk from one kerb to the other.
- Furniture stands on the floor unless it says otherwise. `Furniture.lift` is the metres off the floor its base sits, for a piece that stands on another piece: a till or a coffee machine on a counter top. Absent is the floor, which is where all but a handful of pieces are, and the number is the host's own contact height, so nothing downstream measures anything. `Furniture.on` names the host: a prop in the same interior, never itself, and a piece with a host carries `lift`. `check()` holds all three, and a renderer draws a lifted piece at `lift` without looking the host up.
- `METRICS.furniture` is where a body meets a piece: the bar counter, service counter, worktop, table, stool, seat and mattress it sits, sleeps or works on. The art is built to those heights, so the number lives here and not in each box that needs it.
- **A height a body works at is inside the reach of the stance that works there.** `METRICS.reach` is how far a body actually reaches, measured off the shipped clips skinned onto all twelve dressed characters with the root on the floor, and every working surface is held to it in the tests:

  | surface | stance | measured | height |
  |---|---|---|---|
  | `serviceCounterHeight` | on the feet, hands on the top | palms 0.972, wrists 1.041 | 1.0 |
  | `barCounterHeight` | the same stance, forearms on the rail | the rail clip's hands at 1.02 to 1.04 | 1.0 |
  | `worktopHeight` | the same stance: a hob, a bench, a run beside a sink | palms 0.972, wrists 1.041 | 1.0 |
  | `tableHeight` | sat at a desk, leaning in | palms 0.720, wrists 0.787 | 0.75 |
  | `seatHeight` | sat down, soles on the floor | body's underside 0.423 | 0.45, so the pad gives 2.7 cm |
  | `stoolHeight` | sat on a stool, feet on the rail under the seat (`Sitting_Stool_Loop` and the clips posed from it) | body's underside 0.723, soles 0.38 off the floor | 0.75, so the pad gives 2.7 cm and the rail sits 0.37 under it |

  A worktop is the same number as a service counter because one standing clip serves both and there is no lower standing pose on this rig. They stay two names because they are two surfaces, and the day a lower clip exists a worktop drops on its own.
- **A bar counter is one height on both sides.** The customer's rail at `barCounterHeight` and the staff shelf behind it at `serviceCounterHeight` are both 1.0, inside the standing reach, so a body leaning on the rail keeps its forearms on it rather than through its front face. `PROP_SPECS['bar-counter'].staffContact` publishes the shelf.
- **A stool is its own stance.** The stool clips carry their own height: hips on the pad at `stoolHeight`, shins back under the seat, soles on a rail `METRICS.reach.stoolSoles` (0.38) off the floor. `PROP_SPECS['bar-stool']` rests a body there and a chair at `seatHeight`, 0.30 lower with the soles on the floor, so a body sat for one on the other is in the air.
- A city spec is measured against the world document's own bounds before a single cell is allocated (grid 4-1024 a side, name 80 characters, theme 60, seed 120, cellSize up to 16, `asks.style` inside its enums), so a world that `found` hands back is a world that `load` accepts. Nothing large is ever built only to fail validation after it has been written.
- **The brief and the asks are facts about the file**, written at `found` like the premise and never rewritten here, so a city grown later is grown to what it was asked for.

## How to modify this blackbox safely

`tests/fixtures/sealed-bundle.json` is a city `@gb/bundle` sealed before this box last changed. It is never regenerated: it is the only proof that a file somebody already has still opens, still holds together, and still hashes to the string it was shared with.

The heights in `METRICS` are not free numbers: `METRICS.reach` was measured by
skinning `assets/dist/anims.glb` onto all twelve characters in
`assets/dist/characters/` and reading the lowest point of the hands, the
buttocks, the thighs and, on a stool, the soles, with the root on the floor. `@gb/cast`'s pose tests
take the same measurement from the other side. Change a clip and both move.

Add fields as optional and bump the minor contractVersion; a required field or a changed meaning needs `schemaVersion: 2` alongside the old shape. Vocabularies may gain values freely and lose them only with a migration, because worlds already exported use them. A preset in `src/charters/presets/` carries the values its kind has always been drawn with; change one and every city built without charters changes with it, so the forge's golden hash is the gate. Regenerate `schema/world.json` in the same change (`pnpm --filter @gb/world run generate`) and run `pnpm --filter @gb/world test`.
