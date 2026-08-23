# @gb/forge contract

contractVersion: 0.3.0

## Purpose

Builds a whole city from one brief: streets, plots, interiors, the people standing in them, the things lying around, and the quests that string them together, then checks all of it before handing it over.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Forge.build(brief)` | [schema/brief.json](schema/brief.json) | theme, seed, blocks across and down, cells per block, density, max storeys, roads out (1 to 4) |
| `new Forge(narrator)` | a `Narrator` | answers `nameCity`, `namePlace`, `describeNpc`, `describeItem`, `writeQuests` |
| `Forge.extend(world, count)` | a `@gb/world` `World` | the world has empty land touching a sidewalk |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `build` | `{ world, quests, rejected }` | `world.check()` is empty; every quest passed `@gb/quest` validation; `rejected` lists the ones that did not, with why. The world carries the street grid, the plots and the road graph, roads out included |
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
- An interior is planned in that order: rooms, then doors, then furniture, then the places people stand. The entry room touches the wall the street door is in; every other room hangs off it rather than off another room, so nobody walks through a bedroom to reach the kitchen.
- One door from the street, one door between rooms, and every room reachable from the street door.
- Furniture never lands in a doorway (1.2 m across the opening, a metre either side of the wall), never overlaps another piece, and never seals off a door or a place somebody stands. Every piece is tested against the free floor before it lands, so a building that is too small simply holds less.
- Every anchor is somewhere a person can get to: open floor for anyone standing, their own seat or bed for anyone sitting or sleeping, and never inside somebody else's furniture or in a doorway. Anyone working faces what they work at: staff behind their counter, a cook at the stove, a browser at the case, a seat drawn up to its table.
- The layout varies with the seed and stays identical for the same one: an entrance hall or none, service rooms across the back or down one side, counters on either hand, furniture swept along the walls until it fits.
- Each kind of building is recognisable from the inside: a bar has a counter you can walk behind with stools along it, a shop a till and cases to browse, a house a sofa facing a screen and a bed against a wall.
- Same seed, same city, down to the byte. Sub-streams are forked per block, per site and per interior, so adding a building later cannot change one already built. Streets, roads out and the road graph are arithmetic with no randomness in them at all, so retuning the layout cannot move a building.
- Nothing a narrator writes is trusted: quests are validated against the world and dropped if they do not hold up.
- Every service post is staffed: a bar has a bartender, a shop has a clerk, whatever the density.
- Buildings leave gaps. `extend` fills them, and never moves anything already placed.
- Proportions come from `@gb/world`'s `METRICS`: 2 m cells, 6 m roadways, 2 m sidewalks, rooms sized in metres.

### The roads out

The city sits in a valley ringed with mountains, and `brief.exits` says how many roads leave it: one by default, up to four, taking south, north, east then west in turn.

- It is the same 6 m roadway the town is laid with, leaving from one of the town's own street crossings, straight out along that crossing's centreline.
- It carries the roadway across the pavement ring, so a car meets a T junction rather than a kerb, and pedestrians get a crossing where the ring pavement meets it.
- A 2 m pavement runs each side of it through the mountains, kerbed against the roadway by the same drop as any other street.
- It is in the road graph: a node where the roadway leaves the map, joined to the crossing's own node by a segment of kind `exit`. `@gb/traffic` can drive it and `@gb/scene` marks it, because both read the graph.
- The pavement stops one cell short of the map edge and the roadway runs on to it, so the road leaves the grid instead of ending in two kerbs in a field. `@gb/land` grades the corridor for 120 m past the boundary and the haze closes the view; paving past the boundary is land's ground, not this box's.

## How to modify this blackbox safely

The `Narrator` interface is the seam for a language model: implement it elsewhere and pass it in; `OfflineNarrator` stays as the offline default and the reference shape.

The layout is four files under `src/layout/`: `bands.ts` is the grid arithmetic every other one reads, `streets.ts` paints the town, `exits.ts` plans and paints the roads out, and `roads.ts` builds the graph. Nothing there touches the `Rng`, which is what keeps the buildings where they are.

`tests/fixtures/town.json` is the app's own city recorded cell by cell, with a digest of its plots, interiors, people, items and quests. It is a baseline, not something to regenerate: a change that makes that test fail has moved a city somebody may already have exported.

Interiors live in `src/interior/`: `recipes.ts` says what rooms a building has, `rooms.ts` cuts them out of the shell, `doors.ts` hangs the doors, `room-plan.ts` is the only way furniture and anchors get placed (it holds the clearance and reachability tests), and `furnish/` has one dresser per family of building. A new building kind needs a programme in `recipes.ts`, a dresser in `furnish/`, and a role mapping in `populate.ts`, or it generates an empty shell. Prop sizes live in `src/interior/props.ts` and are what the planner keeps apart, so they have to match what the renderer draws.

Run `pnpm --filter @gb/forge test`, and regenerate `schema/brief.json` with `pnpm --filter @gb/forge run generate` when the brief changes. `pnpm --filter @gb/forge run preview` prints a town; `pnpm --filter @gb/forge run plans [seed]` draws one interior per building kind as a floor plan, which is the fastest way to see whether a change reads.
