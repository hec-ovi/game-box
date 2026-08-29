# The generation pipeline, version 2

Four stages, one context each. This is the specification: what every stage is
told, the tool it is handed, what comes back, what the engine decides instead,
and what happens when the local model answers badly.

Written against measured behaviour of `gemma-4-26b-a4b` through `host` and
`game/scribe`. Every number here comes from this repository.

---

## 1. The decision

A city is written from a style alone, and it marks slots: plots whose door can
be opened by a story written later. A story is written from the slot count, the
district each slot is in and the shape of the building standing on it, and it
decides what each slot becomes, who is in it and what work the town hands out.
An instance agent writes each place, one per slot, with a context that knows its
own building and nothing else. At runtime an NPC's prompt merges the three.

The order changes because today the kind of a place is decided before the plot
is placed, so the story owns the city and the city cannot be shared. Deciding
the kind at the story stage makes the city file a thing somebody else can write
over. Three constraints hold that decision in place, and they are what most of
this document is about:

- **The kind decides the exterior.** Frontage, blade sign, storeys, sign voice,
  tint and the prefab that gets picked all read the charter (`game/forge/src/charters/resolve.ts`,
  `game/forge/src/layout/plots.ts:108`, `game/kitbash/src/compose/plan.ts:47`).
  A kind chosen late either rewrites a building the base already sealed, or
  opens a hospital behind a shopfront with a cafe's word on the blade.
  So stage 1 draws a **shell**, not a kind, and stage 2 picks a kind the shell
  can wear from an enum the engine computes.
- **The interior decides the headcount.** Posts are cut from anchors, one per
  anchor `roleFor` accepts, and the instance tool cannot decode more or fewer
  people than there are posts (`game/scribe/src/tools.ts:147`). So the kind is
  decided before the interior is cut, and the cast is written after it, against
  the post list the plan produced.
- **A quest is only checkable against ids that exist.** Every id in the quest
  tool is an enum of real ids (`game/scribe/src/schema/corner.ts:51`). So the
  story writes its work in two parts: a skeleton of quest rows against minted
  quest ids and a giver enum, then one quest per call against the pinned corner,
  after the interiors are cut.

The rule under all of it: **the model chooses from sets the engine minted and
writes text.** Every id, count, metre, coordinate, clip, piece, room, anchor,
price and role is arithmetic.

---

## 2. What the engine owns, in every stage

| Owned by the engine | Where it is decided |
|---|---|
| grid, streets, avenues, blocks, dead ends, exits | `game/forge/src/layout/` |
| plot rects, entrances, storeys, facings | `game/forge/src/layout/plots.ts`, held to `PLOT_BAND` |
| stations, one every 500 m | `game/forge/src/layout/stations.ts` |
| which plots are slots, and which slot opens | the kind-free ranking in section 3 |
| rooms, doors, furniture, anchors, posts, machines, keys | `game/forge/src/interior/`, `src/raise/plan.ts` |
| every id: plot, slot, interior, room, door, anchor, post, thing, npc, item, machine, quest, step | minted in the plan and in the assembly loop, nowhere else |
| every metre, every stance offset, every clip | `game/forge/src/interior/stance.ts` |
| `role` on a person | `roleFor`, off the anchor and the charter |
| a quest's tier, its standing, and the walk band it is priced on | `game/scribe/src/tier.ts`, `game/forge/src/quests/difficulty.ts` |
| a lock's code, a screen's password | `game/forge/src/interior/machines.ts` |
| district boundaries | assigned per plot from the grid |

The model writes text and picks from enums. Nothing else.

Two facts about the harness that shape every schema below:

- On the local path the tool's `description` never reaches the engine. The task
  lives in the messages (`host/CONTRACT.md`, "Why the tools stay out of that
  request"). No stage may put load-bearing instruction in a tool description.
- The grammar enforces `enum`, `minItems`, `maxItems`, `required` and property
  order. It does not enforce a relation between two fields, coverage of an enum
  across an array, or a reference from one part of an answer to another part of
  the same answer. Anything the grammar cannot enforce is checked by the engine
  and costs a whole call, and there are two attempts. So every "one of each"
  rule is written as named required fields, never as an array plus an enum.

Every field of every schema below carries `.describe()` in the same words the
prompt uses. It is the one channel inside the grammar's line of sight and it
costs nothing at runtime.

---

## 3. Stage 1, the city

### Context in

| Told | Not told |
|---|---|
| the style, in the owner's words (`an ancient city`, `a neon dystopia`) | the story: no history, no factions, no stake |
| the fourteen preset kinds by word (shop, market, clinic, station, chapel, office, workshop, warehouse, bar, cafe, restaurant, house, apartment, hotel) | anything about quests, people or items |
| the seed | how many slots the story wants beyond the minimum |

### Tool 1a: `write_style`, one call

| Field | Type | Constraint | Req | For |
|---|---|---|---|---|
| `cityName` | string | 2 to 40 | yes | what this city is called |
| `districts` | array of object | exactly 4 | yes | the named parts of town |
| `districts[].name` | string | 2 to 30 | yes | what people call it |
| `districts[].character` | string | 20 to 200 | yes | one line of what it is like to stand in |
| `moreOf` | array of enum(preset word) | 0 to 4, no repeats | yes | kinds this style builds a lot of |
| `fewerOf` | array of enum(preset word) | 0 to 4, no repeats | yes | kinds this style builds few of |
| `invents` | array of word | 0 to 6, `^[a-z][a-z0-9-]{0,23}$` | yes | kinds the presets lack that this style needs |
| `streetWords` | array of string | exactly 8, 2 to 20 each | yes | nouns the street names and the sign pool draw on |

About 20 leaves, one level of nesting, roughly 300 tokens of answer.
`moreOf` and `fewerOf` are over the presets only, because an invented word in
the same answer is a cross-reference the grammar cannot check. An invented word
is read as `moreOf` by construction: a style invents a kind because it needs it.

### Tool 1b: `write_charter`, one call per word in `invents`

`@gb/world`'s `CharterSchema` with `word` pinned as a constant. Twelve closed
axes, two clamped numbers, bounded text. It exists (`game/scribe/src/charters.ts`),
it is measured at 3,337 prompt tokens and 210 back in 11 s, and it is unchanged
here. This is what makes style structural: two neon cities differ because they
declared different kinds of place, not because their signs differ.

### What comes back, and what the engine does with it

| Answer | Where it goes |
|---|---|
| `cityName` | `World.found({name})` |
| `districts` | `districts[]` on the city spec; every plot is assigned the district it stands in |
| `moreOf` / `fewerOf` | `game/forge/src/theme/plot-mix.ts`, which is what moves 38% of a city's buildings |
| `invents` | one charter call per word, then `world.recordCharters` |
| `streetWords` | the street namer and the sign pool |

### Then the engine, with nothing awaited

Plans the grid, the streets, the stations and every plot. Names every sign over
every door that does not open. Then picks the slots, on a ranking with no kind
in it:

```
score = spread    (hard gate: further from every slot already picked than
                   the town's longest side over one more than the slot count)
      + station   (distance to the nearest station, zero in a town with none)
      + avenue    (a door on an avenue is a door a player tries)
      + floor     (frontage area, so a slot can hold a place)
      + district  (a district already holding a slot charges the next one)
      + nudge     (seeded, wide enough to move one pick)
```

The station term is zero where a town has no station, and the file says so:
`slots[].transit` is `none` there, and the story stage is told the town has no
transport rather than being handed a criterion that evaluates to nothing.

A slot is a plot standing on a **shell**: a reserved charter, word `slot`,
declared at `found` like any other, deliberately mute. Blank or shopfront
frontage, no blade, quiet voice, a storey band wide enough for every kind the
shell can wear, sprawl and material drawn from the style. The plot's `style`
key and the rng that composes its facade are seeded on `plot.id` plus the shell,
never on the story's kind, so opening a slot never re-skins the building.

`slots[]` on the world document, written here and validated on load:

| Field | What |
|---|---|
| `slotId` | minted |
| `plotId` | the plot it stands on |
| `district` | the district's name |
| `shell` | frontage, openness, material, sprawl, storey band, floor area in square metres |
| `wears` | the declared kinds this shell can carry, computed by the engine |
| `transit` | `none`, or the walk band to the nearest station |
| `door` | the drawn entrance, recorded off `PrefabDressing.face`, not re-derived |
| `spent` | whether a story has opened it |

Slots are `openPlaces + reserve`, reserve 3 by default, so a pack written later
has a door to open. `openPlaces` is on the brief and reaches the launcher panel
and `gb build`.

### What comes out of stage 1

A world file with districts, slots, charters, streets, plots, signs, stations,
zero interiors, zero people, zero items and zero quests. It loads, it checks, it
walks. This is the artefact somebody publishes.

### When the model answers badly

| What | What happens |
|---|---|
| no tool call, or the answer fails the contract | retried once on the next seed with the violations quoted |
| still bad | the offline composer answers: districts off the seed's word list, a mix off the style's traits, a name off the pool |
| a charter fails its schema, plans an interior nobody can stand in, or is past the twenty-fourth | dropped with its reason into `dropped`, its word taken out of the mix |
| a repeated sign head | that one sign is written by the fallback composer; the batch is kept |

A style is never a reason not to build a city.

---

## 4. Stage 2, the story

Five calls. Four of them are small. The fifth repeats once per quest.

### Context in

| Told | Not told |
|---|---|
| the style line, so a medieval town gets no police station | any coordinate, any metre, any grid cell |
| the slot count | which plot, which cell, which street |
| per slot: its district, its shell as bands (frontage, storeys, floor: tight, room, large), and `wears`, the kinds it can carry | the shape of the interior, which does not exist yet |
| the walk band between every pair of slots: same street, one stop, across town | the metres those bands were computed from |
| whether the town has transport | anything about the art, the pieces or the props |
| the declared kinds of the city, by word | |

The walk bands are computed from the real door positions. The metres stay inside
the engine, where `difficulty.ts` prices a job on them.

### Tool 2a: `write_history`, one call

`@gb/world`'s premise contract without `build`, because the mix belongs to
stage 1 now and the kinds belong to `write_slots`.

| Field | Type | Constraint | Req | For |
|---|---|---|---|---|
| `livesOn` | string | 1 to 400 | yes | what the town lives on |
| `happened` | string | 1 to 400 | yes | what happened to it |
| `stake` | string | 1 to 400 | yes | what is at stake now |
| `sides` | array of object | 2 to 4 | yes | who is arguing |
| `sides[].name` | string | 1 to 60 | yes | what that side is called |
| `sides[].wants` | string | 1 to 300 | yes | what it wants |
| `common` | array of string | 3 to 6, 1 to 300 each | yes | what everybody in town knows |

Six top-level fields, measured today at 2,359 prompt tokens and 343 back in 9 s.
Written in the order it is read, because a constrained model writes properties in
schema order.

### Tool 2b: `write_slots`, one call, exactly K rows

| Field | Type | Constraint | Req | For |
|---|---|---|---|---|
| `slots` | array of object | exactly K | yes | one row per slot |
| `slots[].slotId` | enum(minted slot ids) | | yes | which slot this row is about |
| `slots[].kind` | enum(that slot's `wears`) | per row | yes | what this place is |
| `slots[].what` | string | 40 to 300 | yes | what this place is in this story |
| `slots[].people` | integer | 1 to 6 | yes | how many work or live here |
| `slots[].needsLock` | boolean | | yes | a room only some people get into |
| `slots[].needsScreen` | boolean | | yes | a machine somebody works at |
| `slots[].needsPrice` | boolean | | yes | something sold over a counter |
| `slots[].needsBench` | boolean | | yes | somebody who works with their hands |
| `slots[].forSale` | boolean | | yes | somewhere the player could buy |

`kind` before `what`, so the place commits to what it is before it writes the
sentence about it. The six demands are named required booleans rather than an
array of enums, because coverage across an array is not something the grammar
can hold and a rejection costs a whole call.

Keystones live in the enum, not in the prompt. Of the K rows, the engine offers
`wears` sets that force at least one place that sells over a counter, at least
one with seats in its main room, and one home. A story that would leave the town
with nothing to buy, nowhere to sit and nowhere to live is a story the enum
cannot express.

### Then the engine cuts the interiors

Each slot's kind resolves to its charter. The interior is planned from the
charter's own room programme and sized to it, not to the plot's footprint: a
tight shopfront can open into a place with as many rooms as the kind needs.
`slots[].people` is the target the room programme is cut to, so the post count
is what the story asked for, clamped to what the rooms hold, and the clamp is
reported. Every door, room, anchor, post, thing, machine, key and npc id is
minted here.

Every demand the story made is either met or reported: a `needsLock` the charter
cannot carry comes back as a dropped demand, and the quest skeleton is told
before it writes work that leans on it.

### Tool 2c: `write_cast`, one call, exactly N rows

This is the one call that sees the whole cast, which is why it is the one place
name uniqueness can be checked.

| Field | Type | Constraint | Req | For |
|---|---|---|---|---|
| `people` | array of object | exactly N | yes | one row per post in the town |
| `people[].npcId` | enum(minted npc ids) | | yes | which post this row is about |
| `people[].name` | string | 2 to 60 | yes | what this person is called |
| `people[].title` | string | 2 to 40 | yes | what people call their job here, in the story's own words |
| `people[].knows` | string | 20 to 300 | yes | the one thing this person knows about the story |

Each row's `npcId` arrives with its slot, its post and the `role` the engine
computed off the anchor. `role` is not asked for. `title` is the free string the
dialogue and the quest text use ("desk sergeant"); `role` is the closed enum the
art and the quest cast read (`clerk`). Two fields, one enum and one free, so the
story is not flattened into twelve words and the wardrobe still has an outfit.

The roster line also says whether that person can hand out work and whether they
can walk with the player, both read off `GIVER_ROLES` and `WALKER_ROLES`. That is
what stops a cast of wardens and registrars producing a town with no quest giver.

At 12 people this is 48 leaves and roughly 600 tokens of answer.

### Tool 2d: `write_work`, one call, the skeleton

| Field | Type | Constraint | Req | For |
|---|---|---|---|---|
| `quests` | array of object | 3 to 8 | yes | the work the town holds |
| `quests[].questId` | enum(minted quest ids) | | yes | which quest this row is |
| `quests[].kind` | enum(`main`, `side`) | | yes | the main line or an errand |
| `quests[].giverNpcId` | enum(npc ids whose role can give work) | | yes | who hands it out |
| `quests[].oneLine` | string | 20 to 200 | yes | what this job is, in one line |
| `quests[].unlocks` | array of enum(minted quest ids) | 0 to 2 | yes | what finishing this opens |

This is the one thing today's pipeline cannot produce, because each quest is
written blind of the others. It is a few hundred tokens.

`unlocks` names quest ids in its own answer, which is the reference class the
grammar cannot hold. The engine checks: no row unlocks itself, no cycle, exactly
one `main` row with nothing unlocking it, and every `main` row reachable. A
skeleton that breaks one of those goes back with the row named.

No steps here, no rewards, no items, no places. One bad draw costs one small
call.

### Tool 2e: `write_quest`, one call per row, after stage 3

The call that exists today (`game/scribe/src/quests.ts`), pinned to the corner
of the city the quest is set in, handed its skeleton row, the walk band to every
other slot, and the place's own words as the instance agent wrote them, matched
by interior id rather than by name. Measured at 7,800 to 10,311 prompt tokens,
519 to 690 back, 56 to 65 s.

One change to the tool: **step ids come from an enum.** The engine mints
`step_0001` upward, a pool of twelve, and `id` and `next` decode against that
pool. Free-typed step ids are measured coming back as `step_001` and
`step_0005_a` against `^step_[0-9]{4,}$` (`host/CONTRACT.md`), and a pattern is
the one thing the grammar does not hold.

The model writes what the reward hands over and its money; `src/tier.ts` reads
the tier off it. One engine rule beside that: standing paid to the side that
handed out the work is never negative.

### When the model answers badly

| Call | Salvaged | Dropped | Retried |
|---|---|---|---|
| `write_history` | field by field against `premiseContract` | a side missing half of itself, a line that is not a line | once, with the fields named; then the seed's own composed history |
| `write_slots` | rows that fit | a row whose demand its kind cannot carry keeps the kind and loses the demand | once, with the row named; then the offline assignment, which reads the keystone rule off the same enum |
| `write_cast` | rows that fit | a duplicate name loses to the lower index and is asked again | once; then the offline roster names that person |
| `write_work` | rows that fit | a row that breaks the graph check | once, with the row named; then a flat skeleton composed offline: one main, the rest side, givers dealt round the slots |
| `write_quest` | nothing partial | a draft that fails `validateQuest` or the lock walk | once, with the violations quoted; then the offline recipe writes that slot's quest |

Every one of these five has an offline twin, and that is a constraint on their
shape rather than an afterthought: a flat array of rows is composable offline,
a free-form graph is not.

---

## 5. Stage 3, the instance

One agent per slot, context reset, blind to every other slot. Two tools, both
pinned to the shell, all of them in the air at once.

### Context in

| Told | Not told |
|---|---|
| the kind, and what its charter says such a place is here | the city, its streets, its grid, any coordinate |
| the district it stands in and the style line | the other slots and the people in them |
| what the story says this place is (`what` from 2b) | the quest graph, and which of its people is a giver |
| the rooms its shell was cut into, the posts to fill with the role and the room of each, the things lying about | the ids of anything outside this building |
| the plan's brief: rooms behind a lock and how each opens, screens and their programs, the camera, the sale price | the code that opens a lock, which the engine decides and a quest hands out |
| the people it must write, by id, with the name and title the story gave them | any name that belongs to another building |
| what everybody in town knows, the stake, and the sides | |

The brief is richer than what the place call is handed today, not thinner. A thin
brief produces a thin answer: this model mirrors what it is given.

### Tool 3a: `write_place`, one call

| Field | Type | Constraint | Req | For |
|---|---|---|---|---|
| `name` | string | 2 to 80 | yes | the sign over the door |
| `character` | string | 40 to 600 | yes | what this place is to stand in |
| `things` | array of object | exactly the count handed in | yes | one row per thing on a shelf |
| `things[].thingId` | enum(this shell's thing ids) | | yes | which thing |
| `things[].name` | string | 2 to 60 | yes | what it is called |
| `things[].description` | string | 4 to 300 | yes | what it is |

`character` lands on `@gb/world`'s interior as `Interior.description`, so it
survives the process, is hashed with the file, and is what a later story reads
back.

### Tool 3b: `write_person`, one call per post

| Field | Type | Constraint | Req | For |
|---|---|---|---|---|
| `npcId` | const (the id handed in) | | yes | who this is |
| `name` | const (the name the story wrote) | | yes | pinned, so it cannot drift |
| `personality` | string | 20 to 400 | yes | how they come across |
| `knowledge` | array of string | 2 to 4, 1 to 300 each | yes | what they can talk about |
| `life.history` .. `life.errand` | seven strings | 1 to 400 each, all required | yes | `@gb/world`'s `Life`, every field |
| `background.met` | string | 1 to 300 | yes | what the player learns on meeting them |
| `background.talked` | string | 1 to 300 | yes | what they learn from talking |
| `background.quest` | string | 1 to 300 | yes | what doing their work reveals |
| `background.told` | string | 1 to 300 | yes | what somebody else tells you about them |

About 15 leaves per call. The codex is four named required fields rather than an
array with an `unlockedBy` enum, because "one fact per stage" is a coverage rule
and the grammar cannot hold it: as an array it is a legal answer that fails the
check and burns the call.

This splits what is one call today. What that costs: the place and its people
stop being one answer. What it buys: the answer stops growing while the brief
grows, one person failing costs one person, and a six-post place is seven short
calls in one wave instead of one answer of 126 required leaves.

### What the engine does, not the model

The interior already exists. Stage 3 writes text into it. It mints nothing, moves
nothing, and places nobody: the person written for `post_0007` stands where
`post_0007` is, in the stance the anchor says, in the outfit `role` picks.

### When the model answers badly

| What | What happens |
|---|---|
| a person's call fails twice | the offline narrator writes that person, at that post, under the same pinned name |
| a place call fails twice | the offline composer names the place off the pool and writes its things |
| a codex stage comes back empty | the violation names the stage, once; then the fallback |
| a name that is not the pinned one | the grammar cannot emit it; a reply that carries one is prose and is retried |

A place always gets a name, and a post is never left empty.

---

## 6. Stage 4, the NPC at runtime

The call that exists (`take_turn` in `@gb/talk`). What its brief gains:

| Added | Why |
|---|---|
| the district this person is standing in | the only geography anybody in the city has |
| the city directory: three lines, each a place name, its kind and its district | so somebody can answer "where is the precinct" |
| the town's stake and its two sides, and which side this person is on | `Premise.sides` exists and no NPC carries one |
| `title` beside `role` | the prompt says the title, the engine reads the role |

What it is still not told: any conversation the player had with anybody else, any
coordinate, and the quest graph beyond the quests this person carries and the
open objectives pointing at them, which `game/talk/src/wants.ts` already renders.

One change to the answer's shape: `does` comes before `says` in schema order, so
the body is decided before the speech. A single free text field for a turn is
measured coming back with narration and speech in one string.

---

## 7. The seam checks

Each runs after its stage. Each fails closed, with a closed error set, and each
quotes what it refused.

**After stage 1, before a story may be written:**
- `world.check()` is empty.
- Every plot's kind names a declared charter, the `slot` shell included.
- `slots.length` is at least 3, every slot has a district, and every district
  named on a slot exists in the file.
- Every slot's `wears` is non-empty. A shell no declared kind can wear is the
  one refusal that stops the build, because it is a slot nobody can ever open.
- Zero interiors, zero npcs, zero quests. A stage 1 file that carries a person
  is not a stage 1 file.

**After `write_slots`, before the interiors are cut:**
- Every slot has exactly one row, and its kind is in that slot's `wears`.
- The three keystones are covered.
- Every demand is one the chosen charter can carry, or it is dropped and named.

**After the cut, before the cast is written:**
- Every slot has at least one post, and the post count is reported against what
  the story asked for.
- Every locked room names its key or its code, every screen names its program.

**After `write_cast`:**
- Exactly one row per npc id, no id twice, no id missing.
- Every name is distinct across the city and shares no head word with a sign.
- At least one person in town can hand out work.

**After stage 3:**
- Every post is filled, and no post is filled by anybody the story did not name.
- Every name equals the one the story pinned.
- Every codex covers all four unlocks.

**After every quest:**
- `validateQuest` against `questView(world)`, then the lock walk in
  `game/scribe/src/reach.ts`, both as they run today.

**Before the file is sealed, the binder:**
One pass that sees both sides, and the only place that does. Every id any part
of the story names resolves to exactly one minted id; every quest's giver is a
filled post whose role can give work; every item, door, machine and place a step
names exists; every district named exists. It runs inside `Forge.build` and
inside `gb check`, so a file somebody was sent is checkable by its receiver
rather than only by its author.

---

## 8. Three things the four stages cannot fix

The stage split is worth building, and these three are outside it. Until they
land, the shareable city is a diagram.

### 8.1 A pack cannot open a slot

Opening a facade writes `plot.interiorId` onto a base plot, and
`game/bundle/src/pack/appended.ts:9` requires the base's plots to be a
byte-for-byte prefix. Measured: `Forge.extend(world, {places: 2})` opened two
plots and `Pack.cut` answered `{"code":"not-an-extension","problems":[{"path":"plots.33","message":"changed since the base"}]}`.
`game/cli/src/extend.ts` also passes the base's own quests through, so
`gb pack base grown` prints "0 interiors, 0 people, 0 things, 0 quests", and
`extendQuests` has no caller outside its own test.

What it needs: one whitelisted delta beside `plots`, `opened: [{plotId, interiorId, kind, name, design}]`,
legal on slot plots only; `Extension.between` compares base plots ignoring
exactly those fields; `applyTo` writes them back. Everything else stays byte for
byte. And `extendQuests` wired into `gb extend` and `gb pack`.

### 8.2 A second story has nowhere to put its history

`premise` is in `FIXED` (`game/bundle/src/pack/extension.ts:9`), so a pack that
writes its own history is `not-an-extension`. Stage 4 is specified to know who
this person is in the story, and it reads that off the world document, which
belongs to the city's author.

What it needs: history goes additive, the way charters already are. A `stories[]`
on the document, each carrying its premise and the interiors and npcs that belong
to it. `game/talk/src/brief.ts` and `summarise` read the story that owns the
person, falling back to the city's.

### 8.3 Stage 1's product is not shippable yet

Three separate holes, all measured:

- `openPlaces` is `min(1)` on the brief and `Forge.build` always populates and
  writes quests, so a city with no story cannot be built.
- Every generated city calls itself `world_0001` (`game/bundle/src/bundle.ts:140`
  compares that constant; `game/app/src/boot/kept.ts:48` works round it). Two
  cities collide on save, and two stories over one base mint the same ids for
  different people.
- Every person in a file is stationed inside a building, so a city with three
  doors and no residents puts nobody on the pavement. A published empty city is
  a ghost town by construction until strangers land
  (`docs/CITY.md` section 5: made when you meet them, derived from the city seed,
  written into the playthrough once spoken to, never into the file).

---

## 9. The gaps the review found

Every row is folded into the sections above. Severity is what the finding costs
if it is not.

| # | Gap | Severity | Where it is answered |
|---|---|---|---|
| 1 | `plot.kind` is required and integrity refuses a kind no charter declares, so a kindless slot cannot be written | fatal | 3, the `slot` shell and the `wears` enum |
| 2 | The exterior is a function of the kind: a late kind re-skins the building or stands behind the wrong facade | fatal | 3, the mute shell; the facade rng seeds on `plot.id` plus the shell |
| 3 | Headcount is an anchor roll, and the instance tool cannot decode a different count | fatal | 4, kinds first, cut second, cast third; `people` is a target on `write_slots` |
| 4 | Stage 3 minting ids and building geometry breaks two invariants at once | fatal | 5, stage 3 writes text only |
| 5 | Quests written before ids exist cannot be validated by anything | fatal | 4, `write_work` on minted ids, `write_quest` after the cut |
| 6 | One call for the whole story is the largest batch handed to the weakest model | fatal | 4, five calls, four of them small |
| 7 | Nothing owns the check across the seam | fatal | 7, the binder |
| 8 | Free choice of slot kinds loses the keystones: nothing to buy over, nothing to sit at, no home | fatal | 4, the keystone rule lives in the `wears` enum |
| 9 | Cross-stage references by name, which no grammar or retry can hold | fatal | 4, ids cross the seam; the name is minted once at `write_cast` and pinned as a const at stage 3 |
| 10 | A pack cannot open a slot: the plot changed since the base | fatal | 8.1 |
| 11 | A second story has nowhere to put its own history | fatal | 8.2 |
| 12 | Districts exist in no schema, no producer and no consumer | serious | 3, `districts[]` and `district` on the plot |
| 13 | The story is denied metres and districts carry no distance | serious | 4, walk bands computed from real doors; metres stay in the engine |
| 14 | An interior is cut from the plot footprint, so a restaurant opens where nobody can sit | serious | 4, the interior is sized from the room programme |
| 15 | Style is a 7-value keyword vote, and two of the four named examples land on the same value | serious | 3, style declares the city's charter set |
| 16 | Slots "near transport" in cities with no station | serious | 3, the term is zero and the file says `transit: none` |
| 17 | `role` is a closed enum of 12 and the story writes job titles | serious | 4, `title` free beside `role` computed |
| 18 | Who may give work and who may walk are closed sets nobody tells the story about | serious | 4, the roster line says which |
| 19 | Four step kinds have no producer, so 6% of main lines cannot be advanced | serious | 4, the step enum is generated from the producer list; `chose` and `stashed` get producers or leave the enum |
| 20 | No offline twin for a whole-story stage | serious | 4, every call's shape is one the offline composer can answer |
| 21 | 0 of 94 tool schema fields carry a `description` | serious | 2, `.describe()` on every field of every stage schema |
| 22 | Coverage rules ("one fact per stage") are unenforceable as arrays | serious | 5, four named required codex fields |
| 23 | Stage 3's brief as proposed is thinner than the one that works | serious | 5, the brief keeps the shell, the charter lines, the plan brief and the story facts |
| 24 | Nobody in the city knows what the city is about | serious | 4 and 5, `knows` per person, stake and sides in the instance brief |
| 25 | The story writes step kinds and rewards whose legality is a fact about the built town | serious | 4, the demand booleans; the quest tool stays pinned to the corner |
| 26 | Model-written step ids come back off the pattern | serious | 4, step ids are an enum of a minted pool |
| 27 | No outdoor place, so every errand is a walk between the same three doors | serious | 10, named as out of scope for the split and scheduled after it |
| 28 | Stage 4 has no directory, so nobody can say where anything is | serious | 6 |
| 29 | Every city is `world_0001` | serious | 8.3 |
| 30 | No `slots[]` in the file: which doors may open lives in a build | serious | 3 |
| 31 | The street is empty: strangers do not exist | serious | 8.3 |
| 32 | A pack pins the whole catalogue, so a story written a month later is refused | serious | 10, per plot pins |
| 33 | `openPlaces` reaches no caller, so "at least three" is exactly three | annoying | 3 |
| 34 | Door lamps land 1.0 m off the drawn door on 71 of 170 plots | annoying | 3, the slot records the drawn door |
| 35 | Entering an interior builds it inside one frame, 64.6 ms at 8 blocks | annoying | 10, the veil `@gb/hud` already draws for a ride |
| 36 | Nothing on the map says where work is | annoying | 10, a third `MapMark` kind |
| 37 | `@gb/kitbash` already uses the word district for a 48 m LOD chunk | annoying | 10, renamed to chunk in the same pass |
| 38 | Five layers are recomputed at play time and covered by no hash | annoying | 10 |

---

## 10. What is not in this design

- **Stage 3 does not build geometry and does not mint ids.** Geometry is measured
  to the centimetre and ids are what every check keys on. Stage 3 decides who
  these people are.
- **No stage writes a coordinate or a metre**, and no prompt renders one. Walk
  bands carry the ordering; the engine keeps the numbers.
- **No fifth stage for the people on the street.** Strangers are made at runtime
  from the city seed and their slot, and enter the playthrough only when spoken
  to.
- **No free text where the engine can enumerate.** Kind, role, room use,
  frontage, openness, material, voice, access, service, work, holding, finish,
  prominence, sprawl, step kind, condition kind, effect kind and every id are
  enums. `title`, `name`, `what`, `character`, `personality`, `knowledge`,
  `life`, `background`, `objective` and `oneLine` are text.
- **No `max_tokens`, and no prompt asking for a number of words.** Output is
  steered by describing what to include.
- **No load-bearing instruction in a tool description.** It does not reach the
  local engine on a forced call.
- **No interior held to the footprint of the building it stands behind.** The
  instance is its own space.
- **No off-grid diagonal streets.** The grid is the navmesh, plots are cell
  rectangles, cars drive cell lanes.
- **Outdoor quest destinations, splits that stick, and the map's offer marks are
  not part of the split.** They are real gaps and they land after it, because
  none of them is a reason to hold the reorder and the reorder is not a reason
  to hold them.

---

## 11. The order of work

The rule that makes this cheap: land the schema first, then move one consumer at
a time. Steps 1 to 5 are visible the day they land and none of them is throwaway
under the new order. Steps 6 to 8 are the only ones that can break the game.

**1. One `@gb/world` bump, one migration.** `districts` on the city spec,
`district` on `PlotSchema`, `slots[]` on the document, a reserved `slot` charter
word, `title` and `side` on `NpcSchema`, `description` on the interior, `world.id`
minted from the seed. All optional but the id, `schemaVersion` stays 1, every
existing city still loads. Doing this in six bumps is six rounds of caller churn.

**2. Districts end to end, today's pipeline untouched.** Forge assigns every plot
a district; hud names them on the map, in the guide and in the station picker;
talk's brief gains one line. Visible the same day, and it is the geography stage 2
needs.

**3. The interior comes off the plot footprint.** `planInterior` takes its size
from the room programme, `Interior.size` already carries it, `@gb/scene` already
builds an interior in its own coordinates. Drop the floor-area term from the door
ranking. This is the restaurant-too-tight failure, fixed, with no reorder.

**4. The harness pass.** `.describe()` on every field of every stage schema; step
ids as an enum pool; the veil wired into `Buildings.enter`; `openPlaces` wired
into the launcher and `gb build`. Four small changes, all measurable, none of
them touching generation order.

**5. The binder, running against today's build.** It has to exist and be green on
the current order before the stages move, or the reorder lands with no check
behind it. Wire it into `Forge.build` and `gb check`.

**6. The split, in one commit.** Stage 1 becomes style plus slots with a
premise-blind layout; the history call moves to stage 2 and is handed the slot
count, the districts and the shell bands; the keystone rule moves into
`write_slots`'s enum in the same commit, or the first city built the new way has
no counter, no home and no deed. Re-pin `golden.json` here and nowhere else.

**7. The quest skeleton, then the per-quest writer reading it.** Only after step 5.
Writing a quest graph with no validator behind it is the one change here that can
produce a city that looks finished and cannot be played.

**8. The pack.** The `opened` delta, additive `stories[]`, `extendQuests` in the
CLI. This is what turns "somebody else writes a different story over the same
city" from a sentence into a command, and it is the only thing that makes steps
1 to 7 worth their cost.

**9. Strangers**, so the published empty city has people in it.

Unblocked at any point, in any order: outdoor destinations, the `chose` and
`stashed` producers, offer marks on the map, per plot catalogue pins, the kitbash
rename.
