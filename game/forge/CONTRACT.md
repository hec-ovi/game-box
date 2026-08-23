# @gb/forge contract

contractVersion: 0.12.0

## Purpose

Builds a whole city from one brief: streets, plots, interiors, the people standing in them, the things lying around, and the quests that string them together, then checks all of it before handing it over.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Forge.build(brief)` | [schema/brief.json](schema/brief.json) | theme (60 characters) and seed are yours; blocks across and down, density and max storeys have defaults; cells per block and roads out (1 to 4) are picked from the seed if you leave them out. Blocks go as high as the grid holds, below |
| `new Forge(narrator)` | a `Narrator` | answers `nameCity`, `namePlace`, `describeNpc`, `describeItem`, `writeQuests` |
| `Forge.extend(world, count)` | a `@gb/world` `World` | the world has empty land touching a sidewalk |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `build` | `{ world, quests, rejected }` | `world.check()` is empty; every quest passed `@gb/quest` validation; `rejected` lists the ones that did not, with why. The world carries the street grid, the plots and the road graph, roads out included. Most plots carry no interior: a city is mostly frontage, and only the doors worth opening open |
| `extend` | plot ids added | nothing already in the world changed |
| `summarise(world)` | `WorldSummary` | the abstract world a quest writer reads: places, who is in them, what is there, where each street door stands in metres, and a surface inside each place something can be left on |

## Errors (closed set)

- `invalid-brief`: the brief failed its schema, or the city it asks for is one no world will hold (the widest grid those blocks could need is over 1024 cells a side). Nothing is built, and no world constructor throws. The size bound is not expressible in JSON Schema, so it lives in the brief's own check rather than in `schema/brief.json`.
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
- Every anchor is somewhere a person can get to, and close enough to do the job. Anyone sitting or sleeping is on their own seat or bed; nobody stands in a doorway, inside somebody else's furniture, or on floor cut off from the doors. Anyone working faces what they work at: staff behind their counter, a cook at the stove, a browser at the case, a seat drawn up to its table.
- How close a body stands is the reach of what it is doing, not the width of a walking body. Hands on a surface (serving, cooking, working a bench) means 0.15 m of floor between the body and the face of the piece, because the standing clips put the hands 0.02 to 0.13 m in front of the body at about 1.03 m up: further back and the forearms rest on air. Facing a piece without touching it (a browser at a case, somebody at a sink or an altar) means 0.3 m. The bands live in `src/interior/stance.ts` and nowhere else, and every anchor is measured against them in the tests, in metres, off the piece's own footprint.
- Standing that close is standing inside the skirt the walk grid keeps clear round anything solid. A body may be inside the skirt of the one piece it is working at, never another's, and still has to have walkable floor within a step of its back, so the place it stands is a place it could have walked to.
- A body on a seat is not at the seat's centre. The sitting clip holds the body well behind its own root: the pelvis 0.33 m back and the back of the widest coat in the wardrobe 0.50 m back, measured off `Sitting_Idle_Loop` in `assets/dist/anims.glb` skinned onto all twelve dressed characters. So a root at the centre of a chair puts the back rest through the torso. The anchor goes forward of the seat instead, along the way the seat faces, far enough that the body's back is against the front face of the back rest with 2 cm to spare; a seat with nothing to lean on centres the pelvis on the pad. That is a different number for every seat, because the backs are at different depths:

  | seat | back rest face | pad | anchor, forward of the centre |
  |---|---|---|---|
  | chair | 0.194 | -0.220 to 0.220 | 0.326 |
  | office-chair | 0.235 | -0.232 to 0.232 | 0.285 |
  | bar-stool | none | -0.162 to 0.162 | 0.330 |
  | sofa | 0.370 | -0.402 to 0.242 | 0.150 |
  | bed | 0.950 | -0.970 to 0.867 | -0.430 |

  Metres from the piece's own centre, positive towards its back. The two seat numbers are measured off the triangles `@gb/furnish` draws in both interior languages and live in `src/interior/props.ts` beside the footprints; the body numbers and the rule live in `src/interior/stance.ts`. A bed comes out negative because a headboard is 0.95 m back, so a body sits up against it rather than out in the middle of the mattress. The pelvis has to land on the pad whatever the rule says, and every seat is held to that in the tests.
- Whether a seat is a place somebody can sit is a question about the seat, so nothing about which anchors are accepted turns on that offset: reachability, doorways and other people's furniture are all judged at the seat, exactly as they were when the body sat on its centre. Moving a body onto its seat properly cannot cost a town a single anchor.
- A city is mostly frontage. Every plot is a building with a door, a sign and a name; about one in eight also has an interior, and the rest cannot be walked into. A plot without an interior is closed all the way through: nobody is stationed in it, nothing is lying about in it, and no quest step points into it, so a closed door offers the player nothing rather than teasing them with something they cannot reach.
- Which doors open is never a list of building kinds. Each kind is weighed by what its own dresser turns out to make: a counter that is always staffed counts most, then anybody else who works there, then loose stock, then whether the place reads as somewhere people are. A kind added to `@gb/world` next week is weighed the same way without anybody coming back here. On top of that a plot near the middle of town scores higher, because that is the door a player tries, and a seeded nudge wide enough to let a chapel on the square in ahead of a shop at the ring road, so a town is not a list of its businesses.
- A town opens somewhere to sit down, somewhere to buy something, somewhere to sleep and somewhere to work, however small it is and wherever the ranking falls, because those four go in first. Each is a question about what a place holds, not about what it is called: a nightclub answers the first and a hospital the third without anything being added here.
- A piece that belongs on a counter top stands on one. `PROP_SPECS` marks those pieces, and the planner puts each one over the back of a counter already in the room, facing the way that counter faces, with `Furniture.lift` set to that counter's own top: `METRICS.furniture.serviceCounterHeight` for a service counter, `barCounterHeight` for a bar. It claims no floor, because the floor under it is the counter's. So a bar and a shop have a till on the counter and a cafe has its machine, and nothing is left standing beside the counter it belongs on.
- The interior varies with the seed and stays identical for the same one: an entrance hall or none, service rooms across the back or down one side, counters on either hand, furniture swept along the walls until it fits.
- Each kind of building is recognisable from the inside: a bar has a counter you can walk behind with stools along it, a shop a counter you queue at and cases to browse, a house a sofa facing a screen and a bed against a wall.
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

- **How much work there is.** A density rather than a number: about two side jobs for every five places with somebody standing in them, moved by how busy a town of this kind is and swung up to a third either way by the seed. It is measured against the places that open, because those are the only places a job can be about, so 29 buildings come with about 4 jobs and 2,300 with about 80. Two towns of the same size do not get the same number. The only ceiling is what the town can actually book: a couple of jobs per person who gives work, and one unclaimed thing per job. Both of those grow with the town, so no city is ever told it has as little to do as a hamlet.
- **How far a job sends you.** A job reaches into the part of town it starts in: the next street over, a few streets away, or about one in twenty, the far side of town. Those are metres, not a share of the map, so the middling job in a city is the same size of job as the middling job in a village, and only a city is big enough to hold one that crosses it. It is what makes a big city read as many neighbourhoods instead of one village with half-hour errands.
- **How much of it is offered.** About a third of a town's work is offered before the player has done anything, whatever the size, and nobody hands out more than two jobs, so a big city puts more jobs on the board without putting more than two in front of any one person.
- **A main line, and what it is for.** A generated town has no story, but it has a social order, and the main line is the way into it. One to four links come from the town's busiest staffed place, and each one finished raises a standing flag. Side work waits on those flags, so the first morning offers a fraction of the town and the rest of it opens as they earn their place.
- **The town's argument, and taking a side in it.** A town with three links or more in it has two counters that matter: the busiest one, and the furthest staffed place from it, so the two sides are in two parts of town. At a seeded link in the middle, the line hands the player one thing that both of them want and makes them pick. From there the ladder is climbed from whichever side they chose, from that side's own person, for that side's own pay, and the other side's links are never offered. A town too small for two sides does not fork, and its line is the one it always was.
- **What the town remembers.** A choice that moves a number leaves no history, so every choice leaves a mark as well, and a mark outlives the quest that set it. There are four kinds and each names somebody the town actually generated, so a town's history is a set of specific facts rather than one boolean: `sided:<place>` (you did what they wanted), `crossed:<place>` (you went against them, and they know), `owed:<person>` (they owe you one), `allied:<place>` (the side of the argument you came down on). Later quests read them: the branches of the main line are offered on `allied:`, and no side job is offered by somebody whose place the player has crossed.
- **Standing is per place, not per town.** A generated town has no factions written down, so its factions are its places. A job pays standing with the place it was for, and coming down on one side of a choice moves that place's standing up and the other's down. A town of a few hundred buildings carries a couple of dozen standings, which is what makes two playthroughs of one seed end up in different places rather than at different scores.
- **The recipes.** Fetch one thing from somewhere else; gather several of a kind and count them out; carry a parcel two people want and choose who gets it; walk somebody home; do a job with something else worth picking up on the way; hear about what else is in a building from the right person; lift something and beat the clock with it; put something somewhere it will not be found; two halves of one job in either order. Each one says whether the town can serve it and how likely it is here, so a town without anything worth stealing never writes a theft.
- **What it pays.** `rewardFor(difficulty)` from `@gb/quest`, with the difficulty read off the work: metres walked door to door, steps, whether it is a theft, whether it is timed, whether somebody has to be kept safe, and how much has to be carried. Inside its band a job is paid for where it sits, so a fetch across a hundred blocks is not paid the same as one next door, and a step that pays on top of the reward is kept inside what the band allows.
- **Nobody is sent back to the person they are standing in front of.** A quest never opens with a `talk` step aimed at its own giver; the conversation that hands the job out is the conversation.
- **No fork can strand a player.** Every rung of the ladder raises the same `standing_n` on both branches, so side work never waits on a branch and the ladder is always climbable to the top. A rung is written all at once: if either side of it cannot be written, neither is, and the line stops there rather than leaving a branch with a gap in it. A fork does make the other branch's links unreachable, on purpose, and that is the only work a fork ever takes away: crossing a place shuts its own side work and opens the side work of whoever you sided with instead. Both branches of every fork are played to the end in the tests, and a whole town is played twice over from one seed to prove the two runs finish in different places.
- **Timers are game seconds.** A time limit is measured against the clock `@gb/play` runs, at its default rate, and is always longer than the walk the job asks for.

### How big a city can be

Nothing here holds the number of blocks down. `@gb/world` will not hold a grid over 1024 cells a side, and the brief's block limit is that bound read in blocks: how many of the smallest block the planner cuts fit across it, which is 77. Ask for more than the grid holds at the block size you named and the brief is refused before a cell is allocated, with the grid it would have needed in the message. That is why 50 blocks of 6 cells builds and 38 blocks of the default size does not: blocks are not a size, cells are.

What the sizes cost, on one seed with the offline narrator. Another seed moves the building count and the quest count by up to a third, because the plan and the appetite are both drawn:

| blocks | grid | buildings | open | people | quests | build | world file |
|---|---|---|---|---|---|---|---|
| 2x2 | 53x57 | 29 | 6 | 16 | 4 | 0.05 s | 0.04 MB |
| 5x5 | 119x119 | 169 | 18 | 56 | 11 | 0.04 s | 0.14 MB |
| 10x10 | 221x211 | 598 | 65 | 212 | 25 | 0.08 s | 0.51 MB |
| 20x20 | 427x417 | 2,344 | 256 | 750 | 80 | 0.32 s | 1.97 MB |
| 37x37 | 769x775 | 9,656 | 1,054 | 3,318 | 310 | 1.5 s | 8.10 MB |

About 0.2 ms and 0.8 KB a building, flat, all the way up: a building that does not open is a footprint, an entrance and a name, and an interior is nearly everything a city costs to build and to carry. The same 20x20 town with every door open takes 11 s and 12.7 MB. Nothing in the generator degrades before the grid wall; what runs out first is the player. A 20x20 city is 854 m corner to corner, a ten-minute walk at 1.4 m/s; 37x37 is 1.5 km, eighteen minutes; the widest grid there is, 1024 cells, would be 2 km and twenty-four. Somewhere past twenty blocks a side, a city stops being a place you cross on foot and starts being a place you live in one part of.

### The town plan

Two seeds are two towns to walk, not one town with the buildings shuffled. What the seed decides, before a single building is placed:

- **Block sizes, per column and per row.** A nominal side of 15, 17, 19 or 20 cells, then each column band and each row band takes that give or take two. Blocks are rectangles of two of those numbers, so a town has wide blocks and narrow ones and the walk between two streets is never the same length twice.
- **Every block faces four ways.** A block is cut into a strip of building on each side with a yard in the middle, and the middle has to stay deep enough for a frontage or the east and west strips are dropped. Any size that would fail that is nudged up a cell, which is why doors end up on north-south streets as well as east-west ones.
- **A missing street.** On one axis at most, an inner street is sometimes left out and the two blocks either side become one long block. Never two in a row, so a town never grows a field in the middle.
- **An open block.** Up to one block in four, and never the only one, is left unbuilt as a paved plaza or a green park. Both are painted on the grid, so nothing builds there afterwards and `@gb/nav`, `@gb/crowd` and `@gb/scene` read them as ground people walk on.
- **The roads out**, below: how many and which walls of the valley they leave through.

A brief that names `blockCells` or `exits` gets what it asks for; the jitter still varies blocks around the number it named, and the size check measures the jittered width, so a brief that is accepted always plans a grid the world will found.

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

Quest writing is `src/quests/`: `marks.ts` holds the four things a town remembers and how a place becomes a faction, `line.ts` plans the main line and where it forks, `demand.ts` says how much work the town has in it, `cast.ts` is the town as a writer uses it (who can give work, who will walk with you, what nothing else has claimed, how far apart two doors are), `stock.ts` is its ledger of what no quest has taken, `reach.ts` decides how far a job may send the player and picks by sampling rather than scanning, `difficulty.ts` turns the work into a band and its pay, `pace.ts` turns metres into game seconds, `write.ts` writes the line rung by rung and then the side work, and `recipes/` holds one recipe per file behind `recipes/recipe.ts`. Nothing a recipe calls may walk the whole town: a thousand quests over three thousand places is a quadratic, which is why the ledger keeps counts and every pick is sampled. A new recipe is a new file, a new entry in `recipes/index.ts`, and a `weight` that returns zero when the town cannot serve it. A recipe that can put two named people in front of the player and make them pick sets `takesSides`, and only those may write the link that forks the line. Recipes hand back drafts; `write.ts` puts them through `questDraftContract` and `sealQuest`, and a draft the door refuses is handed on unsealed so the forge reports it rather than hiding it.

The layout is five files under `src/layout/`: `bands.ts` is the grid arithmetic every other one reads, `plan.ts` decides the whole town from one `Rng` and touches nothing, `streets.ts` paints that plan onto the grid, `exits.ts` plans and paints the roads out, and `roads.ts` builds the graph. Deciding and painting are apart on purpose: the plan is the only place a street number comes from, and it can be read and measured without a world.

The `streets` stream is forked off the root and drawn from only in `plan.ts`. Draw from it anywhere else, or add a draw before it, and every seed lays out a different town.

`tests/fixtures/sealed-city.json` is a city this box built and sealed before the streets were seeded, quests included. It proves an already-exported city still loads and still validates. It is never regenerated: regenerating it is deleting the only proof that old files still open.

Interiors live in `src/interior/`: `open.ts` decides which buildings get one at all (and is where the share, the ranking and the four things a town needs live), `recipes.ts` says what rooms a building has, `rooms.ts` cuts them out of the shell, `doors.ts` hangs the doors, `room-plan.ts` is the only way furniture and anchors get placed (it holds the clearance and reachability tests), `stance.ts` says where a body's root goes relative to its piece, standing at it or sitting on it, and `furnish/` has one dresser per family of building. A new building kind needs a programme in `recipes.ts`, a dresser in `furnish/`, and a role mapping in `populate.ts`, or it generates an empty shell. Prop sizes live in `src/interior/props.ts` and are what the planner keeps apart, so they have to match what the renderer draws; the same file carries `SEAT_SPECS`, the back rest and the pad of every piece a body sits on. A dresser never passes its own clearance or its own seat offset: it names the kind of anchor and the piece, and `stance.ts` answers.

Every generated quest is played to the end in the tests by `tests/drive.ts`, which reads nothing but `objectives()` and does what each one says, so a recipe that writes a job nobody can finish fails the suite whatever shape it is.

Run `pnpm --filter @gb/forge test`, and regenerate `schema/brief.json` with `pnpm --filter @gb/forge run generate` when the brief changes. `pnpm --filter @gb/forge run preview [seed]` prints a town; `pnpm --filter @gb/forge run plans [seed]` draws one interior per building kind as a floor plan, which is the fastest way to see whether a change reads; `pnpm --filter @gb/forge run measure [seed] [sizes]` prints the table above for whatever sizes you name.
