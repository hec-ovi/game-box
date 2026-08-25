# @gb/scribe contract

contractVersion: 0.6.0

## Purpose

The narrator backed by the local model: the city's history first, written from the owner's own brief, with a charter for every kind of place that history invents, then its name and the signs over its doors, whole places and the people in them with their lives, and the quests they hand out, each one a forced tool call validated against the schema the tool was built from, every call pinned to a seed of its own.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new Scribe(options?)` | `sidecar?`, `fallback?`, `seed?`, `attempts?`, `concurrency?`, `temperature?`, `signal?`, `progress?` | defaults: a `Sidecar` on `GAME_BOX_URL` or `http://127.0.0.1:8976`, `OfflineNarrator` as the fallback, two attempts, as many calls at once as `GAME_BOX_SLOTS` says the engine has slots for (four if it says nothing), a temperature of 0.9, and no progress port |
| `writePremise(input)` | `PremiseInput`: `theme`, `seed`, and the owner's `brief?` and `asks?` in `@gb/world`'s shapes | the first call of a build, made before a plot is placed |
| `namePlaces(requests)` | `PlaceRequest[]`: per building its `kind` (the word of its charter), the `charter` itself, the `theme`, its `index` in the town, the `street?` its door is on, and the city's `premise?` as `premiseLines` renders it | for the buildings that do not open |
| `namePlace(input)`, `describeNpc(input)` | the `Narrator` shapes: a place's `kind` and `charter`; a person's `role`, `placeKind`, `place` (the charter) and `placeName` | the single-place questions, each told what such a place is here |
| `writeInstances(requests)` | `@gb/forge`'s `InstanceRequest[]`: for each place its `kind`, its `charter`, the `theme`, its `index`, the `rooms` its shell was cut into, the `posts` to fill (an id, a role and an index each), the `things` lying about (an id, an archetype and an index each), and the city's `premise` once there is one | the ids are the caller's own handles and come straight back on the answer; nothing about any other place may be in a request |
| `writeQuests(input)` | `QuestInput`: `@gb/forge`'s `WorldSummary` with `asks?` on it, and `sideQuests` | the summary's `premise` is what the quests are written against |

Scribe implements `@gb/forge`'s `Narrator`, so a `Forge` takes one and builds a city with it. What it takes beyond the interface is optional: a forge that hands over no brief, no asks and no sign requests gets the same city the interface promises.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `writePremise` | `@gb/forge`'s `History`: `@gb/world`'s `Premise`, plus `charters` when the history invented a kind of place | always answered, and always one a city can be built out of. What the model writes is checked against the premise contract and against whether the town could be built from it; a history it will not write is the one the seed composes. Every word in `build` that no preset declares is asked for next as a charter, one call per word against `@gb/world`'s charter contract; a word the model then will not write is taken out of `build`, so `build` names only kinds the town can raise. The brief reaches the call verbatim, quoted; the tone, the main errand and the style choices reach it beside; a field left blank puts nothing in the prompt, and a form left wholly blank tells the model the choice is its own |
| `nameCity`, `namePlace`, `describeNpc`, `describeItem` | the `Narrator` shapes | always answered: the fallback covers whatever the model cannot. `nameCity` is shown the history, so the town is named after what it lives on. `namePlace` and `describeNpc` are shown what the place's charter says such a place is here. `describeNpc` answers `life` and `background`, every part written, and a name whose family name starts with the letters its index was dealt |
| `namePlaces` | signs, in the order they were asked for | one per request, twenty to a model call, the history in front of the model and each building's label (what its charter says a person calls it) and street. No word heads two signs in the city: the head being the first word after any "The", possessives dropped. A sign the model repeats is written by the fallback composer |
| `writeInstances` | `@gb/forge`'s `Instance[]`, in the order the places were asked for | each one carries the place's `name`, its `character` (what the place is, empty when the model wrote none of it), one person per post with the post's own role, their `life` (every field of `@gb/world`'s `Life`) and `background` (at least one fact behind each of the four unlocks), and one named thing per thing handed in. No two signs in a city share a head word, and nobody in a city shares a name with anybody else |
| `writeQuests` | quest documents, sealed | one call per quest, every one of them already accepted by `@gb/quest` against the city it was written for; a slot the model cannot fill is filled by the fallback narrator's quest for that slot, so a model that will not write never costs a quest the offline narrator would have written. Every call is shown the town's history; the main line is shown `asks.mainQuest`, each side errand `asks.sideQuests`, and all of them `asks.tone` |
| `problems()` | `ScribeProblem[]`: the `task` (the tool), `at` (the call's position, `charter:jail`, `quest:3`) and the `error` | every call that failed, so a thin world can be explained rather than guessed at |
| `progress` port | `ScribeProgress`: `stage` (`history`, `city`, `places`, `quests`), `done`, `total`, `what` | published as each stage opens and each answer lands, and every stage ends with `done` equal to `total`. The history stage is the premise and then the charters it calls for, one bar that grows. Nothing reads it back, so a build with a loader writes the same city as one without, and a port that throws is dropped rather than failing the build |

## Errors (closed set)

`Scribe` records what the call came back as:

- `unreachable`: the sidecar could not be contacted.
- `refused`: it answered with a non-2xx status.
- `no-tool-call`: the model wrote prose instead of calling the tool. Tried again on the next attempt's seed, which is a different draw.
- `invalid-arguments`: the answer did not hold up, either against the tool's own contract or, for a quest, against `@gb/quest` and the city it names, for a place, against the posts and things it was handed and the four unlocks its people's codices have to cover, for a batch of signs, against the labels it was handed and the head words already hung, for a history, against whether a town could be built out of it, or for a charter, against a blade that spells nothing and a sign template with no slot in it. The next attempt is told exactly which fields.
- `timeout`: nothing came back in time. Tried again on the next attempt's seed.
- `broken`: the engine died mid-reply. Tried again on the next attempt's seed.
- `aborted`: the caller stopped the call. Never tried again.

`Scribe` itself never fails: an unanswerable call falls through to the fallback narrator.

## Dependencies

- `@gb/kit` contract: contracts, results, the deterministic rng the per-call seeds are drawn with.
- `@gb/sidecar` contract (game/sidecar/CONTRACT.md): the client that makes the call and carries the seed and the temperature.
- `@gb/forge` contract: the `Narrator` interface it implements, the `History` it answers, the instance shapes, `premiseLines`, and the `OfflineNarrator` it falls back to.
- `@gb/quest` contract: the quest draft shape a quest writer fills in, the validator every draft goes through, and the reward table the prompt is written from.
- `@gb/world` contract: the closed vocabularies a narrator must choose from, the premise contract the city's history is written against, the charter contract a kind of place is written against and `SHIPPED_CHARTERS` (the kinds every town has), `Life` and `BackgroundFact` for a person, and `Asks` for what the owner typed.

## Invariants

- The model is never asked for prose. Every call offers exactly one tool and names it in `tool_choice`, and the tool's parameters come from the contract's own JSON Schema, so what defines the shape and what checks it cannot drift apart.
- Nothing caps how long an answer runs: no `max_tokens`, and no prompt asking for so many words.
- A rejected call is retried with the exact violations quoted back, then given up on. Two failures cost one name, never the world.
- **Every call is pinned.** Each request carries a `seed` and a `temperature`. The seed is drawn from the build's seed, the call's position (`premise`, `charter:jail`, `city-name`, `signs:2`, `place:12`, `person:4`, `thing:9`, `quest:3`) and the attempt number, never from a counter, so the same build sends the same seed to the same call however many calls were in the air and whichever order they landed in, and a second attempt is a second draw. Reproducibility is best effort: the engine decides whether a pinned request comes back the same, and the ones measured do not promise it (llama-server holds a seed only while nothing else shares the engine; the hosted router does not honour one at all). What the seed buys is that a draw which went wrong once is not the draw tried again.
- **No example in a prompt can come back as an answer.** Measured: a house-style example name was hung over a bar. So a shape is shown with bracketed slots (`[first name]'s [trade]`) and never with a name, the system prompt says the brackets are slots, and the prompts test refuses a quoted proper name in any of them. Measured on one live 1x1 town (9 signs, 10 people, 3 quests, every string of the world and the quests scanned): no example and no slot came back; `pnpm --filter @gb/scribe run measure 10` scans ten.
- Quests are written one per call: a small model writes a better single quest than a batch, and a failure costs one quest.
- A place is written whole, in one call: what it is, everybody in it and everything lying about are one decision, because they are one decision in the world. That call is shown its own building and nothing else.
- A quest is checked here before it is handed over, against the same ids the model was shown. A draft that will not hold up goes back to the model with the reason; a slot it still cannot fill is written by the offline narrator. A build with the model on therefore never ends up with fewer quests than the same build with it off.
- Prompts live in `prompts/*.md` and are bundled into `src/prompts.generated.ts` by `pnpm --filter @gb/scribe run generate`. Edit the markdown, never the generated file. A line a prompt falls back to (the town has no history yet) is a prompt file too.
- Nothing here decides geometry. The prompts say so, and the forge would ignore it anyway.

### What the owner asked for

The brief is the owner's own words and goes to the history writer verbatim, quoted, under "What the owner asked for". Beside it go the parts of `asks` that writer consumes: `tone`, `mainQuest` (the stake is the main errand's subject, so the history has to know what it is about), and `style` as one line of the choices made (`neon lit, wear run-down`). The quest writer gets `tone` on every call, `mainQuest` on the main line's call and `sideQuests` on each side errand's, with the town's history in front of all of them.

Absence is silence. A field left blank puts nothing in the prompt, never a line saying it is blank, and a form left wholly blank is told that the choice is the model's and asked to commit to one town. `src/asked.ts` renders the parts; one prompt file per part carries the words.

### The city's history

`writePremise` is the first call of a build and the one every later call is
written against: the mix of buildings, which doors open, how each place is
written and what the main line is about all come out of the answer. So the tool
is worth more care than the ones after it.

- **The parameters are `@gb/world`'s premise contract, unaltered.** Not a copy of
  it: a copy is a shape that drifts, and a history that names a building the
  game cannot put up is a history the forge throws away whole.
- **Written in the order it is read.** A constrained model writes properties in
  the order the schema lists them, and that order is what the town lives on,
  what happened, what is at stake, who is arguing, what everybody knows, and
  only then the buildings. The mix is written out of the history rather than
  before it, which is the whole point of the stage: a premise moves 38% of a
  city's buildings, and one whose `build` does not follow from its own story
  gives a town that does not match it.
- **A history that would build no town is sent back.** The contract cannot say
  that a town needs something everybody knows, that the two sides the main line
  forks between have to be two different groups, that a kind cannot be both
  commoner and rarer here, or that a history naming no buildings changes no
  city. Those are checked here, and the next attempt is told exactly which of
  them it broke.
- **A town always gets a history.** One the model will not write is the one the
  seed composes offline, so a build with the model on never leaves a town with
  less story than the same build with it off.
- **The question is the same every time.** The prompt is a pure function of the
  theme, the seed and the asks, so the same build asks the same thing and sends
  the same seed with it. Whether the answer is the same is the engine's.

### The kinds of place the history invents

The premise call is shown the fourteen kinds every town has (`SHIPPED_CHARTERS`
by word) and told it may build the town out of one they are not: one plain
lowercase word in `build`, invented only when the story needs it and nothing
shipped fits. Every such word is then asked for as a charter, one call per
word, run in waves like the other passes, each call shown the history it is
filling in, the word, and the preset words it is not.

- **The tool is `@gb/world`'s charter contract with the word pinned.** The
  parameters are `CharterSchema` with `word` a constant, so the model decodes
  against the file's own shape (twelve closed axes, two clamped numbers,
  bounded text) and cannot answer a question about a jail with a charter for
  something else. `src/charters.ts` asks; `prompts/write-charter.md` says what
  each axis means in plain words, since a value on it is a routine the engine
  runs, never a word the model gets to invent.
- **What the schema cannot refuse is refused here.** A blade with no letter or
  digit on it, and a sign template with no `{family}`, `{adjective}` or
  `{noun}` slot (which would hang one sign over every door of the kind), go
  back with the field named. What the contract refuses (storeys written high
  before low, a value off an axis) goes back the same way, with the contract's
  own message.
- **A preset in the plural is the preset.** Measured: a history asked for
  "more of hotels, bars" and "fewer of shops, markets, cafes", five words that
  would each have cost a charter call and doubled a kind the town already had.
  `build` is read with every plural of a preset folded onto its word before
  the invented words are counted.
- **A word without a charter is taken out of `build`.** The history handed to
  the forge names only kinds the town can raise: the presets and the charters
  written. A kind the model named and then would not write costs that word,
  never the history.
- **Measured on two live 3x3 towns** (61 plots, 8 open, 5 quests each,
  `border town on the highway` with a brief asking for a customs house and a
  jail): both histories put `jail` in `mustHave`, the model wrote its charter
  (`holding`: blank or industrial front, a desk with somebody on it, `watch`
  and `desk` work, cells as a `ward`, an evidence `store`, signs like
  `{family} HOLDING`), and the city raised 4 and 5 jails (`Holding Cell 4`,
  `Sector 4 Holding`, `The Lockup`, `Direct Custody`), one of them open in the
  first town. A charter call is 2,800 prompt tokens and 220 to 250 back, 19 to
  34 s when it answers; through the sidecar 9 of 16 attempts ran past the 300 s
  clock (the same seed and prompt straight at the engine ends at 470 to 520
  tokens in 11 to 14 s), which is the host's to fix and is what the retry on
  the next seed is for. A batch of signs is 1,450 prompt tokens and 215 to 225
  back, 37 s; a place 2,400 and 890 to 1,060, 71 to 77 s; a quest 7,800 and 600
  to 690, 61 to 65 s. Everybody (46 people) came back with a whole life and a
  four-stage codex; 122 signs had 122 distinct heads in all five shapes.
- **What a place is reaches every call about it.** `src/charter-lines.ts`
  renders a charter as the lines a prompt reads (the post at the front, the
  work, what it keeps, who gets in, its rooms, what people say of such places),
  and `namePlace`, `describeNpc`, `writeInstances` and the sign batches are
  each shown it for the building they are writing, so a jail's people are
  written knowing what a jail is here. `SHIPPED_CHARTERS` covers the presets
  and `@gb/forge` resolves the rest, so the file, not this box, says what a
  kind is.

### The signs over the doors that do not open

Most of a city is frontage, and a sign is five tokens, so what naming it all
cost was never the tokens but the round trips. `namePlaces` asks for twenty at a
time: the call is shown the town's history, then each building by label with
its trade and its street, and hands back one sign per label. Each batch is a
wave's worth of independent calls, and the batches of one wave cannot see each
other.

- **No word heads two signs.** The head is the first word after any "The",
  possessives dropped, so The Anchor, Anchor Supply and Anchor's are one head.
  A batch is told the heads already hung and refused with the sign named if it
  repeats one of them or one of its own. Then the answers are read in index
  order: the lower index keeps a head, and a sign whose head is spent by then is
  written by the fallback composer, so which sign keeps a word never depends on
  which batch landed first.
- **More than one shape.** The prompt shows five shapes as bracketed slots
  (possessive, family firm, place word with the trade, numbered address, The X
  Y) and asks for a mix. Measured on one live 1x1 town: 9 signs, 9 distinct
  heads, all five shapes present.
- **The offline composer stays the offline path.** A batch the model will not
  write, and any sign it repeats, comes from `fallback.namePlace`, asked again
  at the next index until its head is free.

### A place written whole

`writeInstances` is one call per building. It is handed the city (its name, its
theme, its premise) and that building's own shell: the rooms it was cut into,
the posts to fill with the role at each one, and the things lying about with
the shape of each. It hands back the place's name, what the place is, one
person per post and one named thing per thing, and it never sees another
building, which is what lets a whole city's places be written at the same time.

The ids are the caller's: post ids and thing ids go out in the request and come
back on the answer, so the caller zips people onto anchors and names onto items
by id, never by the order they were written in. The tool's parameters are built
around the shell, so the only ids the model can decode are the ones it was
handed, there is exactly one answer for each of them, and the role is never
asked for, because which post is which job is a fact about the building.

### Every person's life

A person is written through `@gb/world`'s own schemas: `life` is `Life` with
every field required (`history`, `interests`, `manner`, `cares`, `avoids`,
`reason`, `errand`), and `background` is `BackgroundFact[]`, at least four
facts and at most `MAX_BACKGROUND_FACTS`. What the schema cannot say is checked
here: a codex has to have a fact behind each of the four unlocks (`met`,
`talked`, `quest`, `told`), or a stage the player reaches earns them nothing,
and the next attempt is told which stage is empty. `reason` and `errand` are
asked for in the first person, as a sentence the person could say out loud,
because that is how the conversation says them. `src/person.ts` is the one
shape, shared by the whole-place tool and the single-person tool, and
`profileOf` is the only way one becomes an `NpcProfile`.

Measured on one live 1x1 town: 10 people, 10 with every field of a life, 10
with a codex using all four stages.

### Unique names when nobody can see anybody else

Two places written at the same time cannot be told about each other, so they
cannot agree between themselves not to write the same person twice. The
agreement moves into the request instead.

- **People.** Each place is handed its own four letters of the alphabet, and the
  tool's schema will not decode a family name that starts with anything else.
  The alphabet is shuffled once per build and dealt out four at a time, so any
  six places in a row hold disjoint letters, which covers every wave the engine
  can serve. Two people can only collide if their family names collide, so
  inside that window a collision is not unlikely, it is unwritable. The
  single-person call is dealt letters the same way, off the person's own index,
  so a narrator asked one person at a time gets the same guarantee.
- **Places and everything else.** Names are spent in index order once the wave
  has landed, never while it is in the air. The lower index keeps the name and
  the higher one is asked again with the taken names quoted at it; a second
  repeat is written by the fallback narrator rather than costing a third call.
  A place's sign is spent by its head word as well as its name, the way a
  batch's are. So which of two answers keeps a name is decided by the index it
  was asked at, and the same seed builds the same city whatever order the
  engine answered in.

### The corner of the city a quest is written about

A quest is shown eight places, which is small on purpose: a whole city in a
prompt is tokens spent on places the errand will never name. Eight places drawn
at random, though, are eight places with nothing between them. So the slice is a
neighbourhood: a seeded home, the places nearest its door, and the walk between
each of them and that door in metres, off the door positions the summary already
carries. About one in five swaps its furthest neighbour for the far side of the
city, so a town is not made entirely of errands you could run in a minute, and
the prompt says what the metres are for. Whatever else the slice holds, it
always holds somebody to hand the errand out and something to pick up.

A place the instance pass wrote is also shown as itself: the quest writer is
told what that bar is, in the words the bar's own agent used. The two are
matched on the place's name, which is the only handle the two passes share and
is unique across the city by the time either of them runs.

### Determinism, with more than one call in flight

Calls run in waves: `concurrency` of them go out together and all land before the next wave starts. That is the whole of the concurrency and the whole of the back-pressure, and it is what keeps the same seed producing the same city.

- Answers are reassembled by index, never by arrival.
- What a call is told about the answers before it is the previous waves' answers, never its own wave's, so it does not depend on which reply landed first.
- The corner of the city a quest is set in is drawn from the build's seed and the quest's index.
- The seed a call sends is drawn from its position, so it is the same however the waves fell.

The charters, `namePlaces`, `writeInstances` and quest writing each fan out across the full width. The single-place shapes (`namePlace`, `describeNpc`, `describeItem`) are one call each, in whatever order the caller issues them.

### The schema the model is handed

The quest draft's own JSON Schema is 41,994 characters, most of it the same six conditions and nine effects spelled out again inside every step kind. Two passes cut it to 10,779 before it goes on the wire, on every call:

- **Narrowed** to what the model can get right, because the schema is what it decodes against and a rule that lives only in the prompt is a rule it can walk past. Nothing a `WorldSummary` cannot name, so `stash` steps and going into an interior are cut. `next` is required on every step kind whose dead end the flow check refuses, and gone from the two that end a quest. Each step is in writing order: `kind` first, so a step commits to a mechanic before it writes the sentence the player reads, then the fields that kind needs, then `next`. Everything the narrowed schema still allows, the full draft contract accepts.
- **Written without repeats**: every subschema that appears more than once is hoisted into `$defs`. Dereference the result and the narrowed schema comes back exactly.

Validation always runs against `@gb/quest`'s own contract, never against the shortened copy.

### What each call knows about the city

A model cannot be specific about a world it cannot see. Every descriptive call is told the city's name, its history and the names already spent, so the same city does not end up with four Vidals, and its people talk about the place they are standing in.

## How to modify this blackbox safely

A new authoring task is a new prompt file, a new tool in `src/tools.ts`, and a method that asks for it with a label for its position. A task that runs many at once also needs a `Pass` in `src/unique.ts`, which is what settles the names in index order. Changing a prompt needs no code change, only a regenerate. `GAME_BOX_SLOTS` is how many calls the engine behind the sidecar serves at once; llama-server reports it as `total_slots` and the sidecar does not pass it on, so it is set by hand or left at the default.

One file per job: `src/premise.ts` writes the city's history, `src/charters.ts` writes the charter behind each kind of place it invents, `src/charter-lines.ts` says what a charter is in the words a prompt reads, `src/asked.ts` renders what the owner typed for each writer, `src/signs.ts` names the buildings that do not open in batches, `src/instance.ts` writes a place whole, `src/person.ts` is the one shape a person is written in, `src/quests.ts` writes the work, `src/neighbourhood.ts` cuts the city into corners a quest can be written about, `src/claim.ts` deals out the family names, `src/head.ts` says what word a sign is read by, `src/registry.ts` keeps what is spent, `src/unique.ts` settles which answer keeps a name, `src/pins.ts` draws the seed a call sends, and `src/progress.ts` says how far it has got.

A length in a tool's schema is `@gb/world`'s own limit on the field the answer ends up in, never a limit on how much the model may write. The engine does not enforce `maxLength` anyway: it lets the answer run and the contract then throws the whole call away, which is why nothing has a cap the world does not already impose.

Run `pnpm --filter @gb/scribe test`, which checks every outgoing request against the service's own published `chat-request.json`. `pnpm --filter @gb/scribe run measure [cities] [blocks] [blockCells]` builds that many towns through the live sidecar, each on a brief that calls for a kind of place the presets lack, and prints what came back: the charters the history invented and how many plots of each the city raised, distinct head words and shapes over the signs, who got a life and a codex, the quests, tokens and seconds per call by tool (counted through llama-server's `/tokenize`), the problems by code, and whether any example from a prompt came back as output.
