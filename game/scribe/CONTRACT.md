# @gb/scribe contract

contractVersion: 0.8.0

## Purpose

The narrator backed by the local model: the brief itself where the owner asks for one, then the city's history, written from the owner's own brief, with a charter for every kind of place that history invents, then its name, the names of the parts of the city and the signs over its doors, whole places and the people in them with their lives, each place written knowing the locks and screens the plan put in it, and the quests they hand out, through those locks, screens and counters where the town has them, each one a forced tool call validated against the schema the tool was built from, every call pinned to a seed of its own.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new Scribe(options?)` | `sidecar?`, `fallback?`, `seed?`, `attempts?`, `concurrency?`, `temperature?`, `signal?`, `progress?` | defaults: a `Sidecar` on `GAME_BOX_URL` or `http://127.0.0.1:8976`, `OfflineNarrator` as the fallback, two attempts, as many calls at once as `GAME_BOX_SLOTS` says the engine has slots for (four if it says nothing), a temperature of 0.9, and no progress port |
| `writeBrief(input)` | `want`: which of `theme`, `brief`, `mainQuest`, `sideQuests`, `tone` to write; `have?`: what the owner has typed so far; `seed` | the call made from the form, before there is a city |
| `writePremise(input)` | `PremiseInput`: `theme`, `seed`, and the owner's `brief?` and `asks?` in `@gb/world`'s shapes | the first call of a build, made before a plot is placed |
| `namePlaces(requests)` | `PlaceRequest[]`: per building its `kind` (the word of its charter), the `charter` itself, the `theme`, its `index` in the town, the `street?` its door is on, and the city's `premise?` as `premiseLines` renders it | for the buildings that do not open |
| `nameDistricts(requests)` | `@gb/forge`'s `DistrictRequest[]`: per part its `index` in the city, the `theme`, how many `blocks` of the town it holds, which way it lies (`bearing`), and the city's `premise?` as `premiseLines` renders it | the whole cut, asked for together. No coordinate and no metre is in a request |
| `namePlace(input)`, `describeNpc(input)` | the `Narrator` shapes: a place's `kind` and `charter`; a person's `role`, `placeKind`, `place` (the charter) and `placeName` | the single-place questions, each told what such a place is here |
| `writeInstances(requests)` | `@gb/forge`'s `InstanceRequest[]`: for each place its `kind`, its `charter`, the `theme`, its `index`, the `rooms` its shell was cut into, the `posts` to fill (an id, a role and an index each), the `things` lying about (an id, an archetype and an index each), `has` (the instance brief: the rooms behind a lock and how each opens, the screens by room and program, whether a camera watches the door, and the price when the place is for sale), and the city's `premise` once there is one | the ids are the caller's own handles and come straight back on the answer; nothing about any other place may be in a request |
| `writeQuests(input)` | `QuestInput`: `@gb/forge`'s `WorldSummary` with `asks?` on it, and `sideQuests` | the summary's `premise` is what the quests are written against; its places' `locks`, `machines`, `forSale` and prices are what a job through a door, a screen or a counter is written against |

Scribe implements `@gb/forge`'s `Narrator`, so a `Forge` takes one and builds a city with it. What it takes beyond the interface is optional: a forge that hands over no brief, no asks and no sign requests gets the same city the interface promises.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `writePremise` | `@gb/forge`'s `History`: `@gb/world`'s `Premise`, plus `charters` when the history invented a kind of place | always answered, and always one a city can be built out of. What the model writes is checked against the premise contract and against whether the town could be built from it; a history it will not write is the one the seed composes. Every word in `build` that no preset declares is asked for next as a charter, one call per word against `@gb/world`'s charter contract; a word the model then will not write is taken out of `build`, so `build` names only kinds the town can raise. The brief reaches the call verbatim, quoted; the tone, the main errand and the style choices reach it beside; a field left blank puts nothing in the prompt, and a form left wholly blank tells the model the choice is its own |
| `writeBrief` | `BriefDraft` (the same five fields) or nothing | the fields in `want` are written; every other field comes back exactly as it was handed in, so a box the owner typed is never quietly rewritten. There is no fallback: a model that will not answer returns nothing, because a composed brief handed over as the model's answer is what this call exists to replace. Every field of the tool carries its own description, so the constrained decoder reads the same thing the prompt says |
| `nameCity`, `namePlace`, `describeNpc`, `describeItem` | the `Narrator` shapes | always answered: the fallback covers whatever the model cannot. `nameCity` is shown the history, so the town is named after what it lives on. `namePlace` and `describeNpc` are shown what the place's charter says such a place is here. `describeNpc` answers `life` and `background`, every part written, and a name whose family name starts with the letters its index was dealt |
| `namePlaces` | signs, in the order they were asked for | one per request, twenty to a model call, the history in front of the model and each building's label (what its charter says a person calls it) and street. No word heads two signs in the city: the head being the first word after any "The", possessives dropped. A sign the model repeats is written by the fallback composer |
| `nameDistricts` | names, in the order they were asked for | one per part, all of them in one model call, the history in front of the model and each part's share of the town and side of it in words rather than in numbers. No two parts of a city are called the same thing: a repeat is quoted back and refused, and a name the model then leaves out, writes too long for the file, or repeats anyway is composed by the fallback narrator |
| `writeInstances` | `@gb/forge`'s `Instance[]`, in the order the places were asked for | each one carries the place's `name`, its `character` (what the place is, empty when the model wrote none of it), one person per post with the post's own role, their `life` (every field of `@gb/world`'s `Life`) and `background` (at least one fact behind each of the four unlocks), and one named thing per thing handed in, all of it written knowing what the plan put in the place (`has`). No two signs in a city share a head word, and nobody in a city shares a name with anybody else |
| `writeQuests` | quest documents, sealed | one call per quest, every one of them already accepted by `@gb/quest` against the city it was written for and walked here the way the harness walks it (below); a slot the model cannot fill is filled by the fallback narrator's quest for that slot, so a model that will not write never costs a quest the offline narrator would have written. A job may go through a locked door (`unlock`), a locked screen (`hack`), a game screen (`beat-game`) or a counter (`buy`), hand out a password (`give-password`), and pay `access`, a `car` or a `deed` where the town has the thing. Every call is shown the town's history; the main line is shown `asks.mainQuest`, each side errand `asks.sideQuests`, and all of them `asks.tone` |
| `problems()` | `ScribeProblem[]`: the `task` (the tool), `at` (the call's position, `charter:jail`, `quest:3`) and the `error` | every call that failed, so a thin world can be explained rather than guessed at |
| `progress` port | `ScribeProgress`: `stage` (`history`, `city`, `places`, `quests`), `done`, `total`, `what` | published as each stage opens and each answer lands, and every stage ends with `done` equal to `total`. The history stage is the premise and then the charters it calls for, one bar that grows. Nothing reads it back, so a build with a loader writes the same city as one without, and a port that throws is dropped rather than failing the build |

## Errors (closed set)

`Scribe` records what the call came back as:

- `unreachable`: the sidecar could not be contacted.
- `refused`: it answered with a non-2xx status.
- `no-tool-call`: the model wrote prose instead of calling the tool. Tried again on the next attempt's seed, which is a different draw.
- `invalid-arguments`: the answer did not hold up, either against the tool's own contract or, for a quest, against `@gb/quest` and the city it names and then against what the harness holds it to at a lock, a screen or a counter, for a place, against the posts and things it was handed and the four unlocks its people's codices have to cover, for a batch of signs, against the labels it was handed and the head words already hung, for a history, against whether a town could be built out of it, or for a charter, against a blade that spells nothing and a sign template with no slot in it. The next attempt is told exactly which fields.
- `timeout`: nothing came back in time. Tried again on the next attempt's seed.
- `broken`: the engine died mid-reply. Tried again on the next attempt's seed.
- `aborted`: the caller stopped the call. Never tried again.

`Scribe` itself never fails: an unanswerable call falls through to the fallback narrator.

## Dependencies

- `@gb/kit` contract: contracts, results, the deterministic rng the per-call seeds are drawn with.
- `@gb/sidecar` contract (game/sidecar/CONTRACT.md): the client that makes the call and carries the seed and the temperature.
- `@gb/forge` contract: the `Narrator` interface it implements, the `History` it answers, the instance shapes, `premiseLines`, and the `OfflineNarrator` it falls back to.
- `@gb/quest` contract: the quest draft shape a quest writer fills in, the validator every draft goes through with the seven questions of its `WorldView`, and the reward table the prompt is written from.
- `@gb/world` contract: the closed vocabularies a narrator must choose from, the premise contract the city's history is written against, the charter contract a kind of place is written against and `SHIPPED_CHARTERS` (the kinds every town has), `Life` and `BackgroundFact` for a person, `MachineProgram` for what a screen runs, and `Asks` for what the owner typed.

## Invariants

- The model is never asked for prose. Every call offers exactly one tool and names it in `tool_choice`, and the tool's parameters come from the contract's own JSON Schema, so what defines the shape and what checks it cannot drift apart.
- Nothing caps how long an answer runs: no `max_tokens`, and no prompt asking for so many words.
- A rejected call is retried with the exact violations quoted back, then given up on. Two failures cost one name, never the world.
- **Every call is pinned.** Each request carries a `seed` and a `temperature`. The seed is drawn from the build's seed, the call's position (`premise`, `charter:jail`, `city-name`, `signs:2`, `place:12`, `person:4`, `thing:9`, `quest:3`) and the attempt number, never from a counter, so the same build sends the same seed to the same call however many calls were in the air and whichever order they landed in, and a second attempt is a second draw. Reproducibility is best effort: the engine decides whether a pinned request comes back the same, and the ones measured do not promise it (llama-server holds a seed only while nothing else shares the engine; the hosted router does not honour one at all). What the seed buys is that a draw which went wrong once is not the draw tried again.
- **No example in a prompt can come back as an answer.** Measured: a house-style example name was hung over a bar. So a shape is shown with bracketed slots (`[first name]'s [trade]`) and never with a name, the system prompt says the brackets are slots, and the prompts test refuses a quoted proper name in any of them. The live scan reads the slots off the prompts themselves, so it is always about what the prompts say today: measured on one live 3x3 town (61 signs, 25 people, 5 quests, every string of the world and the quests scanned), none of the eleven came back; `pnpm --filter @gb/scribe run measure 10` scans ten towns.
- Quests are written one per call: a small model writes a better single quest than a batch, and a failure costs one quest.
- A place is written whole, in one call: what it is, everybody in it and everything lying about are one decision, because they are one decision in the world. That call is shown its own building and nothing else.
- A quest is checked here before it is handed over, against the same ids the model was shown. A draft that will not hold up goes back to the model with the reason; a slot it still cannot fill is written by the offline narrator. A build with the model on therefore never ends up with fewer quests than the same build with it off.
- Prompts live in `prompts/*.md` and are bundled into `src/prompts.generated.ts` by `pnpm --filter @gb/scribe run generate`. Edit the markdown, never the generated file. A line a prompt falls back to (the town has no history yet) is a prompt file too.
- Nothing here decides geometry. The prompts say so, and the forge would ignore it anyway.

### What the owner asked for

The brief is the owner's own words and goes to the history writer verbatim, quoted, under "What the owner asked for". Beside it go the parts of `asks` that writer consumes: `tone`, `mainQuest` (the stake is the main errand's subject, so the history has to know what it is about), and `style` as one line of the choices made (`neon lit, wear run-down`). The charter writer gets the brief too, because the charter is where a lock is decided and a history that summarises the town does not carry the sentence that asked for one ("a cellar nobody but the doorman gets into" is `admitted`, `watch` and a `shut` room). The quest writer gets `tone` on every call, `mainQuest` on the main line's call and `sideQuests` on each side errand's, with the town's history in front of all of them.

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
  runs, never a word the model gets to invent, and what the engine then makes
  of them: which values put a lock on a room, a camera over the door, a screen
  on a desk, a game on a counter and a gate of bars across an inner door, so a
  history that wants a cellar only the doorman gets into can write the charter
  that produces one.
- **What the schema cannot refuse is refused here.** A blade with no letter or
  digit on it, and a sign template with no `{family}`, `{adjective}` or
  `{noun}` slot (which would hang one sign over every door of the kind), go
  back with the field named, and the prompt says `work` and `holding` name each
  value once, since a repeat is a list the contract throws away whole. What the
  contract refuses (storeys written high before low, a value off an axis) goes
  back the same way, with the contract's own message.
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
  repeats one of them or one of its own, which buys a second draw and never
  costs the batch: the last answer that named every building exactly once is
  kept whatever its heads. Then the answers are read in index order: the lower
  index keeps a head, and a sign whose head is spent by then is written by the
  fallback composer, so which sign keeps a word never depends on which batch
  landed first. Measured on one live 3x3 town: 2 of the 4 sign calls
  were refused for one repeated head, which is a clash the mend settles one
  sign at a time and no reason to lose the other nineteen.
- **More than one shape.** The prompt shows five shapes as bracketed slots
  (possessive, family firm, place word with the trade, numbered address, The X
  Y) and asks for a mix. Measured on one live 1x1 town: 9 signs, 9 distinct
  heads, all five shapes present.
- **The offline composer stays the offline path.** A batch the model will not
  write, and any sign it repeats, comes from `fallback.namePlace`, asked again
  at the next index until its head is free.

### The names of the parts of the city

A district is what the map labels and what somebody says instead of a bearing,
so its name has to belong to the town it is in.

- **One call for the whole cut.** A city has a handful of parts, so there is
  never a second batch: they all go out together with the town's history in
  front of the model, which is what lets one name answer another (a wharf end
  and the hill above it) instead of each being written in the dark.
- **What the model is shown is coarse on purpose.** Each part carries how much
  of the town it holds, in words (`most`, `about a third`, `a small corner`),
  and which way it lies from the middle of it. No cell, no metre, no shape,
  because `docs/CITY.md` section 9 makes the district the coarsest handle there
  is and a writer given metres writes about geography.
- **No two parts of a city share a name.** A batch that names two of them the
  same thing is quoted the repeat and asked again; whatever is still repeated,
  missing, or too long for the world document is composed by the fallback
  narrator instead, so the answer is always one name per part with no two alike.
- **The tool's own fields say what a name is.** `name_districts` carries the
  label and the name, and the name's description is the same rule the prompt
  gives, so the constrained decoder reads it too.

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

### Locks, screens and counters

The second wave puts things in a place a quest can be built on: a room behind
a lock and what opens it, a screen and what it runs, a thing with a price over
a counter, a home for sale. Both writers are told, and the quest writer is held
to what the harness holds a player to.

- **The place writer reads the plan.** `src/brief-lines.ts` renders
  `InstanceRequest.has` as the lines the place prompt reads: the rooms behind a
  lock and how each opens (a key or a card somebody here carries, a code typed
  at the door), the screens by room and what each runs, the camera, the sale.
  The prompt says who keeps the place carries every key and card, and asks for
  that in the people (who holds the key, who is let through, what is on the
  screen) and never for the code itself, which forge decides and a quest hands
  out. A place the plan put nothing in is told so in one line.
- **The quest writer sees every lock, screen and price.** `src/place-lines.ts`
  writes each place of the corner with its people and where they stand, its
  things with seller and price, its locked doors (id, room, the key by id and
  whose pocket it is in, the code), its screens (id, what it runs, locked with
  its code or open to anybody) and what it sells for with the interior id a
  deed names; everything standing behind a lock says so on its own line. The
  prompt's step table carries `unlock`, `hack`, `beat-game` and `buy`, the
  effects carry `give-password`, and the reward section says what `access`,
  `car` and `deed` may name, with the pay table showing each tier's allowance
  of them off `REWARD_TABLE`.
- **The tool is pinned to the corner.** `src/schema/corner.ts` rewrites every
  id pattern in the quest schema as the corner's own list (`idsOf` in
  `src/neighbourhood.ts`): the people, the things (the keys the locks name
  among them), the plots, the places that open, the doors; a `hack` may only
  name a locked screen, a `beat-game` a screen running a game, a `buy` a
  thing with a price, a `give-password` a code the corner has, a `deed` a
  place for sale, a `car` a corner with a bench somebody works at; and a step
  kind the corner cannot serve is not offered at all. Measured on ten live drafts before: one named a door the city did not
  have, and the retry rewrote the whole quest. Validation still runs against
  the full draft contract, so the enum is the grammar's and the check is the
  contract's.
- **The model writes the pay; the tier follows.** `difficulty` is not in the
  tool. `src/tier.ts` reads it off what the reward hands over: the lowest
  tier that allows the car, the home, the things and the doors it carries and
  holds its money and standing, so the bands table in the prompt says what a
  car or a home costs rather than asking the model to name a tier and then
  pay inside it. Measured on ten live drafts before: five paid outside the
  band they named. `hidden`, `reveal` and `pay` are cut with it (three of the
  ten revealed a step that was not hidden; the reward is the pay).
- **The view answers the seven questions.** `CitySummary.view()` answers
  `hasDoor` off the locks, `hasMachine` off the screens, `hasInterior` off the
  places that open (what an access or a deed reward names), and `hasItem` for
  a key a lock names even though it lies in a pocket and not on a shelf.
- **A draft is walked the way the harness walks it.** `@gb/quest` proves a flow
  is playable; the harness then opens a door only with its key in hand or its
  code known, reaches nothing behind a locked door until it is open, hacks a
  screen only with its code, plays a game only on a screen that runs one, and
  buys only with the money. `src/locks.ts` reads the summary into what stands
  between the street and every id (a street lock puts the whole place behind
  it), and `src/reach.ts` walks an accepted draft in flow order carrying what
  the player is guaranteed to hold on every path into each step (a `join`
  keeps what its branches gathered). Each rule broken is a violation with the
  step's path and the fix in it: the giver behind a lock, a person, thing or
  screen named before its door is open, an `unlock` with neither the key
  given nor the code, a `hack` on an open screen or without its code, a
  `beat-game` on a screen that runs no game, a `buy` of a thing nobody sells,
  and a bill no `money-at-least` on the quest covers. The model gets them
  quoted back on the next attempt like any other violation.
- **Measured on one live 3x3 town** (`pnpm --filter @gb/scribe run measure 1 3
  16 10`, a brief asking for a disco with a cellar nobody but the doorman gets
  into and a shipping office with a locked back room and a terminal in it): 61
  plots, 8 open, 25 people, 5 quests, 29 model calls, 478 s. The history put
  `disco` in `moreOf` and `mustHave` and its charter came back first time,
  `admitted` with a `Back Room`, so the city raised 18 discos, opened one, and
  locked its back room behind a key in the doorman's pocket: 1 locked door, 7
  screens of which 5 locked, one house for sale at 1,330. Of the 5 quests 3
  went through a screen (`hack`), one paid the run of the locked door as
  `access`, three paid a `car` and two a `deed`, and 5 of 5 passed the lock
  walk with 0 rejected. The walk fired on the model's drafts and was quoted
  back ("nothing opens door_0015 yet: a give-item effect with item_0001 on a
  talk step with npc_0016, who carries it"); 9 of the 10 quest attempts came
  back with a violation, and 4 of the 5 slots ended on the offline narrator's
  quest after two attempts, which is the thinnest part of the model path. 25
  of 25 people had a whole life and a four-stage codex; 61 signs had 61
  distinct heads in all five shapes, 2 of the 4 sign calls refused for one
  repeated head with the rest of the batch kept; no slot came back. A premise
  call is 2,359 prompt tokens and 343 back in 9 s, a charter 3,337 and 210 in
  11 s, a batch of signs 1,607 and 219 in 34 s, a place 2,618 and 1,244 in 93
  s, a quest 10,311 and 519 in 56 s.

### Determinism, with more than one call in flight

Calls run in waves: `concurrency` of them go out together and all land before the next wave starts. That is the whole of the concurrency and the whole of the back-pressure, and it is what keeps the same seed producing the same city.

- Answers are reassembled by index, never by arrival.
- What a call is told about the answers before it is the previous waves' answers, never its own wave's, so it does not depend on which reply landed first.
- The corner of the city a quest is set in is drawn from the build's seed and the quest's index.
- The seed a call sends is drawn from its position, so it is the same however the waves fell.

The charters, `namePlaces`, `writeInstances` and quest writing each fan out across the full width. `nameDistricts` is one call, because a city has a handful of parts. The single-place shapes (`namePlace`, `describeNpc`, `describeItem`) are one call each, in whatever order the caller issues them.

### The schema the model is handed

The quest draft's own JSON Schema is 58,937 characters, most of it the same six conditions and ten effects spelled out again inside every step kind. Three passes cut it to about 13,000 before it goes on the wire, on every call (a corner of 8 places, 24 people and 20 things measures 12,942):

- **Narrowed** to what the model can get right, because the schema is what it decodes against and a rule that lives only in the prompt is a rule it can walk past. Nothing a `WorldSummary` cannot name, so `stash` steps and going into an interior are cut; an interior id survives only where a reward names one. `next` is required on every step kind whose dead end the flow check refuses (`unlock`, `hack`, `beat-game` and `buy` among them), and gone from the two that end a quest. Each step is in writing order: `kind` first, so a step commits to a mechanic before it writes the sentence the player reads, then the fields that kind needs, then `next`. No step is `optional`: measured on two live 3x3 towns, five of eighteen drafts hung the only path to `complete` off a step they had marked optional and none wrote a side trip that rejoined, and two earlier drafts marked the `complete` step itself optional. The reward's `money` is required and starts at 1, because a job that pays nothing sits under the floor of any tier that carries a thing (measured on ten live drafts: two rewarded 0 while handing over an item or a door). Everything the narrowed schema still allows, the full draft contract accepts.
- **Pinned** to the corner the quest is set in, above, so every id is an enum of what the model was shown.
- **Written without repeats**: every subschema that appears more than once is hoisted into `$defs`. Dereference the result and the pinned schema comes back exactly.

Validation always runs against `@gb/quest`'s own contract, never against the shortened copy.

### What each call knows about the city

A model cannot be specific about a world it cannot see. Every descriptive call is told the city's name, its history and the names already spent, so the same city does not end up with four Vidals, and its people talk about the place they are standing in.

## How to modify this blackbox safely

A new authoring task is a new prompt file, a new tool in `src/tools.ts`, and a method that asks for it with a label for its position. A task that runs many at once also needs a `Pass` in `src/unique.ts`, which is what settles the names in index order. Changing a prompt needs no code change, only a regenerate. `GAME_BOX_SLOTS` is how many calls the engine behind the sidecar serves at once; llama-server reports it as `total_slots` and the sidecar does not pass it on, so it is set by hand or left at the default.

One file per job: `src/premise.ts` writes the city's history, `src/charters.ts` writes the charter behind each kind of place it invents, `src/charter-lines.ts` says what a charter is in the words a prompt reads, `src/asked.ts` renders what the owner typed for each writer, `src/signs.ts` names the buildings that do not open in batches, `src/districts.ts` names the parts of the city in one call, `src/instance.ts` writes a place whole, `src/brief-lines.ts` says what the plan put in it, `src/person.ts` is the one shape a person is written in, `src/quests.ts` writes the work, `src/neighbourhood.ts` cuts the city into corners a quest can be written about, `src/place-lines.ts` writes one place of a corner out with its locks, screens and prices, `src/locks.ts` reads the city's locks, screens and counters by id, `src/reach.ts` walks a draft the way the harness plays it, `src/tier.ts` reads a quest's tier off its reward, `src/schema/narrow.ts` cuts the quest schema to what a summary can name and `src/schema/corner.ts` pins it to one corner's ids, `src/claim.ts` deals out the family names, `src/head.ts` says what word a sign is read by, `src/registry.ts` keeps what is spent, `src/unique.ts` settles which answer keeps a name, `src/pins.ts` draws the seed a call sends, and `src/progress.ts` says how far it has got.

A length in a tool's schema is `@gb/world`'s own limit on the field the answer ends up in, never a limit on how much the model may write. The engine does not enforce `maxLength` anyway: it lets the answer run and the contract then throws the whole call away, which is why nothing has a cap the world does not already impose.

Run `pnpm --filter @gb/scribe test`, which checks every outgoing request against the service's own published `chat-request.json`. `pnpm --filter @gb/scribe run measure [cities] [blocks] [blockCells] [firstTown]` builds that many towns through the live sidecar, each on a brief that calls for a kind of place the presets lack (the eleventh asks for a disco and a locked office with a terminal), and prints what came back: the charters the history invented and how many plots of each the city raised, the locks and screens the city placed and every quest's chain of step kinds with what it pays beyond credits and whether the lock walk passes it, distinct head words and shapes over the signs, who got a life and a codex, tokens and seconds per call by tool (counted through llama-server's `/tokenize`), the problems by code, and whether any slot a prompt shows came back as output.
