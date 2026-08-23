# @gb/forge contract

contractVersion: 0.5.0

## Purpose

Builds a whole city from one brief: streets, plots, interiors, the people standing in them, the things lying around, and the quests that string them together, then checks all of it before handing it over.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Forge.build(brief)` | [schema/brief.json](schema/brief.json) | theme (60 characters) and seed are yours; blocks across and down, density and max storeys have defaults; cells per block and roads out (1 to 4) are picked from the seed if you leave them out |
| `new Forge(narrator)` | a `Narrator` | answers `nameCity`, `namePlace`, `describeNpc`, `describeItem`, `writeQuests` |
| `Forge.extend(world, count)` | a `@gb/world` `World` | the world has empty land touching a sidewalk |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `build` | `{ world, quests, rejected }` | `world.check()` is empty; every quest passed `@gb/quest` validation; `rejected` lists the ones that did not, with why. The world carries the street grid, the plots and the road graph, roads out included |
| `extend` | plot ids added | nothing already in the world changed |
| `summarise(world)` | `WorldSummary` | the abstract world a quest writer reads: places, who is in them, what is there, where each street door stands in metres, and a surface inside each place something can be left on |

## Errors (closed set)

- `invalid-brief`: the brief failed its schema, or the city it asks for is one no world will hold (blocks times cells over 1024 a side). Nothing is built, and no world constructor throws. The size bound is not expressible in JSON Schema, so it lives in the brief's own check rather than in `schema/brief.json`.
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
- The interior varies with the seed and stays identical for the same one: an entrance hall or none, service rooms across the back or down one side, counters on either hand, furniture swept along the walls until it fits.
- Each kind of building is recognisable from the inside: a bar has a counter you can walk behind with stools along it, a shop a till and cases to browse, a house a sofa facing a screen and a bed against a wall.
- Same seed, same city, down to the byte. Sub-streams are forked by label off a root the generator never draws from: `streets` for the town plan, `plots` for the mix of buildings, `quests` for how much work the town has in it, then one per block, per site and per interior. A new stream is a new label, never a draw from an existing one, so adding one cannot shift what another already decided.
- Nothing a narrator writes is trusted: quests are validated against the world and dropped if they do not hold up.
- Every service post is staffed: a bar has a bartender, a shop has a clerk, whatever the density.
- Nobody in a town shares a name, a personality or a script: names, habits and what a person knows come from a vocabulary the theme picks, not from one template.
- Buildings leave gaps. `extend` fills them, and never moves anything already placed.
- The roadway is `METRICS.street.roadwayCells` wide, from `@gb/world`, so the width a car drives and the width the city is laid with are one number. Cells are 2 m, pavements 1 cell, the mountain ring 4; rooms and furniture are sized in metres from the same `METRICS`.

### What a town is made of

The theme is read as one of seven kinds of town (frontier, coastal, industrial, neon, alpine, agrarian, or plain when it names none of them), and that kind decides the place, not just the words on the sign.

- **The mix.** Every building kind has a base weight, the theme multiplies it (a neon city stacks apartments and offices, a mining town spreads houses and chapels), and the seed swings each kind up or down and drops up to two kinds the town turns out not to have at all. Housing is never dropped and never swung below what the theme asks for, because a town is mostly where people live.
- **The staples.** Every town has a bar, wherever the dice fall: one place everybody passes through, which is also where the main line starts. One to three more places the theme is known for go up alongside it, drawn from that theme's own set, and all of them stand on seeded sites rather than the first sites in the list.
- **The people.** Names, habits and what somebody knows are drawn from the theme's vocabulary: a shared core plus the words that flavour uses, so two towns under one theme are not the same cast twice.

### The quests

A town's work is written by recipes over the people and things it actually holds, never one template. What the seed and the theme decide:

- **How much work there is.** Not the block count: how many people are standing in shops and front rooms, how much is lying about to be carried, and how busy a town of this kind is.
- **A main line, and what it is for.** A generated town has no story, but it has a social order, and the main line is the way into it. One to four jobs come from the town's busiest staffed place, from the same person each time, and each one finished raises a standing flag. Side work waits on those flags, so a player is offered a handful of jobs on the first morning and the rest of the town opens as they earn their place.
- **The recipes.** Fetch one thing across town; gather several of a kind and count them out; carry a parcel two people want and choose who gets it; walk somebody home; do a job with something else worth picking up on the way; hear about what else is in a building from the right person; lift something and beat the clock with it; put something somewhere it will not be found; two halves of one job in either order. Each one says whether the town can serve it and how likely it is here, so a town without anything worth stealing never writes a theft.
- **What it pays.** `rewardFor(difficulty)` from `@gb/quest`, with the difficulty read off the work: metres walked door to door, steps, whether it is a theft, whether it is timed, whether somebody has to be kept safe, and how much has to be carried. Inside its band a job is paid for where it sits, so a fetch across a hundred blocks is not paid the same as one next door, and a step that pays on top of the reward is kept inside what the band allows.
- **Nobody is sent back to the person they are standing in front of.** A quest never opens with a `talk` step aimed at its own giver; the conversation that hands the job out is the conversation.
- **Timers are game seconds.** A time limit is measured against the clock `@gb/play` runs, at its default rate, and is always longer than the walk the job asks for.

### The town plan

Two seeds are two towns to walk, not one town with the buildings shuffled. What the seed decides, before a single building is placed:

- **Block sizes, per column and per row.** A nominal side of 15, 17, 19 or 20 cells, then each column band and each row band takes that give or take two. Blocks are rectangles of two of those numbers, so a town has wide blocks and narrow ones and the walk between two streets is never the same length twice.
- **Every block faces four ways.** A block is cut into a strip of building on each side with a yard in the middle, and the middle has to stay deep enough for a frontage or the east and west strips are dropped. Any size that would fail that is nudged up a cell, which is why doors end up on north-south streets as well as east-west ones.
- **A missing street.** On one axis at most, an inner street is sometimes left out and the two blocks either side become one long block. Never two in a row, so a town never grows a field in the middle.
- **An open block.** Up to one block in four, and never the only one, is left unbuilt as a paved plaza or a green park. Both are painted on the grid, so nothing builds there afterwards and `@gb/nav`, `@gb/crowd` and `@gb/scene` read them as ground people walk on.
- **The roads out**, below: how many and which walls of the valley they leave through.

A brief that names `blockCells` or `exits` gets what it asks for; the jitter still varies blocks around the number it named.

At a crossing, the roadway runs right through in both directions and the pavement keeps a corner in each quarter. That falls out of the painting order: mountains, then every pavement band, then every roadway band on top. Paint one band at a time and the last band wins the cells they share, which is how pavement ended up lying across the middle of every north-south street.

So a pavement ends at the kerb: crossing a street means stepping onto the roadway, whichever way you are walking. Anything that keeps people off the road (`@gb/crowd` walks `sidewalk` and `park`) walks one block's ring and no further.

### The roads out

The city sits in a valley ringed with mountains, and `brief.exits` says how many roads leave it: one to four, picked from the seed when the brief leaves it out, through walls the seed picks.

- It is the same 6 m roadway the town is laid with, leaving from one of the town's own street crossings, straight out along that crossing's centreline. Which crossing is seeded too, so the way out is not always the middle of town.
- It carries the roadway across the pavement ring, so a car meets a T junction rather than a kerb, and pedestrians get a crossing where the ring pavement meets it.
- A 2 m pavement runs each side of it through the mountains, kerbed against the roadway by the same drop as any other street.
- It is in the road graph: a node where the roadway leaves the map, joined to the crossing's own node by a segment of kind `exit`. `@gb/traffic` can drive it and `@gb/scene` marks it, because both read the graph.
- The pavement stops one cell short of the map edge and the roadway runs on to it, so the road leaves the grid instead of ending in two kerbs in a field. `@gb/land` grades the corridor for 120 m past the boundary and the haze closes the view; paving past the boundary is land's ground, not this box's.

## How to modify this blackbox safely

The `Narrator` interface is the seam for a language model: implement it elsewhere and pass it in; `OfflineNarrator` stays as the offline default and the reference shape.

What a theme means lives in `src/theme/`: `flavour.ts` reads the theme text, `plot-mix.ts` turns it into building weights and staples, `words.ts` holds the vocabulary a town names itself from. `src/narrator/` is what the offline narrator says: `places.ts` for signs, `knowledge.ts` for people.

Quest writing is `src/quests/`: `cast.ts` is the town as a writer uses it (who can give work, who will walk with you, what nothing else has claimed, how far apart two doors are), `difficulty.ts` turns the work into a band and its pay, `pace.ts` turns metres into game seconds, `write.ts` plans the main line and the side work, and `recipes/` holds one recipe per file behind `recipes/recipe.ts`. A new recipe is a new file, a new entry in `recipes/index.ts`, and a `weight` that returns zero when the town cannot serve it. Recipes hand back drafts; `write.ts` puts them through `questDraftContract` and `sealQuest`, and a draft the door refuses is handed on unsealed so the forge reports it rather than hiding it.

The layout is five files under `src/layout/`: `bands.ts` is the grid arithmetic every other one reads, `plan.ts` decides the whole town from one `Rng` and touches nothing, `streets.ts` paints that plan onto the grid, `exits.ts` plans and paints the roads out, and `roads.ts` builds the graph. Deciding and painting are apart on purpose: the plan is the only place a street number comes from, and it can be read and measured without a world.

The `streets` stream is forked off the root and drawn from only in `plan.ts`. Draw from it anywhere else, or add a draw before it, and every seed lays out a different town.

`tests/fixtures/sealed-city.json` is a city this box built and sealed before the streets were seeded, quests included. It proves an already-exported city still loads and still validates. It is never regenerated: regenerating it is deleting the only proof that old files still open.

Interiors live in `src/interior/`: `recipes.ts` says what rooms a building has, `rooms.ts` cuts them out of the shell, `doors.ts` hangs the doors, `room-plan.ts` is the only way furniture and anchors get placed (it holds the clearance and reachability tests), and `furnish/` has one dresser per family of building. A new building kind needs a programme in `recipes.ts`, a dresser in `furnish/`, and a role mapping in `populate.ts`, or it generates an empty shell. Prop sizes live in `src/interior/props.ts` and are what the planner keeps apart, so they have to match what the renderer draws.

Every generated quest is played to the end in the tests by `tests/drive.ts`, which reads nothing but `objectives()` and does what each one says, so a recipe that writes a job nobody can finish fails the suite whatever shape it is.

Run `pnpm --filter @gb/forge test`, and regenerate `schema/brief.json` with `pnpm --filter @gb/forge run generate` when the brief changes. `pnpm --filter @gb/forge run preview [seed]` prints a town; `pnpm --filter @gb/forge run plans [seed]` draws one interior per building kind as a floor plan, which is the fastest way to see whether a change reads.
