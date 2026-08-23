# The generation pipeline

What the four stages are, what actually exists, what connects to what, and the order the missing parts have to land in.

Measured on committed code. Six boxes were mid-edit while this was written (`game/drive`, `game/prefab`, `game/traffic`, `game/cast`, `game/furnish`, plus `game/forge/src/interior/open.ts` untracked); nothing in flight is reported here as a defect.

---

## 1. The pipeline as he wants it

| # | Stage | One line | Today |
|---|---|---|---|
| S1 | History | A premise for the city: why it is here, who runs it, what happened, what is at stake. | **Absent.** |
| S2 | City architecture | Streets, blocks, exits, and the buildings that go on them, including specific instances the story demands (one hospital, one bar). | **Partly.** Streets, blocks, exits and a theme-weighted building mix are built and green. No way to demand an instance, and the vocabulary has no hospital, police station, corporate office or nightclub. |
| S3 | Instances and people | Interiors, furniture, anchors, and a person at every post, with names, personalities and knowledge; some of them out walking the city. | **Partly.** Indoor people are complete (100% of NPCs are stationed at an interior anchor). Outdoor people do not exist in any schema: who walks is drawn at play time from all residents. |
| S4 | Quest creator | Given the whole cast, write the main line, the side work, the splits inside a quest, and the person you have to go and find. | **Partly, and it is the most finished stage.** Engine 11 step kinds, 6 conditions, 9 effects, 953 quests generated across 10 builds with 0 rejected. Splits exist mechanically and change nothing that lasts. Finding a person in the street is not expressible. |

The chain that runs today is S2 to S3 to S4. S1 is a 60 character genre string and a seed.

---

## 2. The missing first stage

There is no history stage. `grep -rniE "premise|backstory|lore|storyline"` across every `.ts`, `.md`, `.json`, `.js`, `.mjs` outside `node_modules` returns exactly one line, `docs/PENDING.md:67`, added as a single table row in commit `1c7d0f2` and never touched since.

What stands in for it: `Narrator.nameCity({theme, seed}) -> string` (`game/forge/src/narrator.ts:43`), whose tool schema is literally `z.object({ name: z.string().min(2).max(60) })` (`game/scribe/src/tools.ts:36`). The history stage returns a city name.

The theme string reaches structure through one function, `flavourOf(theme)` (`game/forge/src/theme/flavour.ts`), which collapses free text to one of 7 enum values off 80 keywords. Everything else in the theme is inert. Controlled experiment, same seed `same-seed`, 3x3 blocks, two themes with opposite stories (`"neon city ruled by a kind AI"` and `"neon city where a plague killed half"`): blank the raw theme string and the `plot.style` prefix derived from its first word, and the two worlds are byte identical. Same grid, same 53 buildings, same kinds, same plot names, same 133 NPCs, same knowledge, same 30 quests, same city name. The story half of the theme changes nothing.

`game/forge/CONTRACT.md:72` says it out loud: "A generated town has no story, but it has a social order, and the main line is the way into it."

### What it would produce

One document per city, written once, before anything geometric:

- why the town is here and what it lives off
- what happened, recent enough that people still talk about it
- who runs it, as 2 to 4 named factions with a relationship between them
- what is at stake, which is the subject of the main line
- what the town therefore has: the kinds it needs more of, the kinds it needs fewer of, and the specific instances it must contain (the hospital because of the flood, the precinct because of the crackdown)
- what everyone knows, as a handful of facts NPC dialogue and quest text can both draw on

### Which box owns it

`@gb/scribe`. Its own contract already prescribes the recipe: "A new authoring task is a new prompt file, a new tool in `src/tools.ts`, and a method that asks for it." Today: 5 tools, 14 prompt files, none about a situation. A new `game/premise/` box buys nothing that a sixth tool does not.

One thing to change in scribe's framing: `game/scribe/prompts/system.md` currently closes the list against a premise ("You write the invented part only: names, personalities, what people know, and the errands they hand out. Someone else has already decided where every street and building goes"). If the premise is to steer the plot mix, that sentence is no longer true.

The offline path needs the same method on `OfflineNarrator`, and a table-driven premise is fine there: the point is that the field exists and everything downstream reads it.

### Which contracts have to carry it

Fifteen surfaces, in dependency order:

| Where | Change |
|---|---|
| `game/scribe/prompts/write-premise.md`, `src/tools.ts`, `src/scribe.ts` | the producer |
| `game/forge/src/narrator.ts:42` `Narrator` | a `writePremise` method, plus the premise threaded into the input of `namePlace`, `describeNpc`, `describeItem`, `writeQuests`. Two implementers change: `offline-narrator.ts` and `scribe.ts`. |
| `game/forge/src/brief.ts` `BriefSchema` | a premise field (or a second argument to `Forge.build`), then regenerate `schema/brief.json` |
| `game/forge/src/theme/plot-mix.ts:65,86` `kindWeights`, `stapleKinds` | take the premise, not a 7 value flavour enum. This is where "a hospital because of the flood" becomes real. |
| `game/forge/src/layout/plan.ts:86` `planStreets` | today `grep -n theme game/forge/src/layout/*.ts` returns 0 hits. Optional, and only if the premise is to say "this town grew around the docks". |
| `game/forge/src/quests/demand.ts:37` | how much work a town holds, currently a per flavour constant |
| `game/forge/src/quests/write.ts:35-53` | the main line gets a subject and an ending instead of `standing_1..4` over recipe output |
| `game/forge/src/narrator.ts:15` `WorldSummary` + `forge.ts:282` `summarise` | carry the premise to the quest writer |
| `game/scribe/src/summary.ts` `CitySummary`, `src/quests.ts:73` | expose it and interpolate it into `write-quest.md` |
| `game/world/src/model/city-spec.ts` + `model/schema.ts` | persist it, regenerate `schema/world.json`, bump minor contractVersion. World's contract rule: add fields as optional. |
| `game/bundle` | nothing, if the premise lives inside `world`; `contentHash` already covers it |
| `game/talk/src/brief.ts:43`, `game/talk/prompts/npc.md:2` | the highest value consumer. An NPC's only city context today is "The kind of place {{city}} is: {{theme}}." |
| `game/quest/src/schema.ts:97` `reward.faction` | measured over a generated city: 1 distinct faction, `'town'`. `reputation-at-least` and `reputation-below` are built and unused because nothing names who runs the place. |

Two constraints on the task:

- **Ordering.** It must run before `forge.ts:63 planStreets` if it steers the plan, before `:78 #raise` if it steers the mix, and before `:84 #writeQuests` if it steers the quests. `nameCity` is already the pre-`found` call, so the natural shape is one call returning name and premise together, replacing `nameCity`.
- **Determinism.** Forge's contract: "A new stream is a new label, never a draw from an existing one." A premise stage forks its own labelled stream or every existing seed lays out a different town.

---

## 3. What connects to what

### The build order, `game/forge/src/forge.ts:57-86`

```
:57  briefContract.parse(brief)                  8 fields, defaults, grid bounds
:58  new Rng(brief.seed)                         root, only forked
:63  planStreets(brief, rng.fork('streets'))     pure, theme-blind, touches no world
:64  narrator.nameCity({theme, seed})            the whole of S1
:65  World.found({name, theme, seed, w, h})
:75  paintStreets(world, plan)                   sidewalk bands, then roadway bands, then exits
:77  layRoads(world, crossings, exits)           road graph, segments street | exit
:78  #raise                                      sites -> kindWeights/stapleKinds -> namePlace -> addPlot -> planInterior
:79  #populate                                   roleFor + occupancy -> describeNpc, describeItem
:81  world.check()                               else unsound-world
:84  #writeQuests(rng.fork('quests'))            summarise -> writeQuests -> validateQuest each
```

### Stage by stage

**S1 history.** Consumes `{theme, seed}` from the panel (`game/app/src/boot/panel.ts`) or the CLI (`gb build --theme --seed --blocks --cells --density --storeys --model --out`). Produces a string. Consumed by `World.found(name)`. That is the whole stage.

**S2 city architecture.** Consumes the 8 field brief (`game/forge/schema/brief.json`: theme, seed, blocksX, blocksY, blockCells, density, maxStoreys, exits), `rng.fork('streets')`, `rng.fork('plots')`, `rng.fork('site/N')`, and `@gb/world`'s `METRICS` and closed vocabularies. Produces grid cells, the road graph, exits, and plots. Contract surface out: `game/world/schema/world.json` (`grid`, `roads`, `plots`). Read by `@gb/nav` (the grid is the navmesh), `@gb/scene` and `@gb/kitbash` (geometry), `@gb/traffic` (road graph), `@gb/land` (mountain ring), `@gb/crowd` (pavement runs and crossings).

Exactly one model call in this stage: `namePlace({kind, theme, index}) -> string`. The kind is passed in, not chosen: geometry is arithmetic (D8).

**S3 instances and people.** Consumes the plots and their interiors from the same box, plus `ANCHOR_KINDS`, `NPC_ROLES`, `ITEM_ARCHETYPES` from `@gb/world`, and the `Narrator` port for `describeNpc` and `describeItem`. Produces interiors, npcs, items, placements. Contract surface out: `world.addInterior/addNpc/addItem` and the persisted `interiors`, `npcs`, `items` in the world file. Read by `@gb/furnish` and `@gb/scene` (rooms and props), `@gb/cast` (bodies from `appearance`), `@gb/talk` (personality, knowledge, station), `@gb/crowd` (residents on the pavement).

S3 is not a separate box or a separate contract. It is `#populate` inside `Forge.build`, reading `interior.kind` and `anchor.kind`. If it is to be a separate agent, that seam does not exist yet.

**S4 quest creator.** Consumes exactly one thing:

```
game/forge/src/forge.ts:226   const summary = summarise(world)
game/forge/src/forge.ts:227   narrator.writeQuests({ summary, sideQuests: questDemand(summary, rng) })
```

`WorldSummary` (`game/forge/src/narrator.ts:15-34`) is:

```
{ cityName, theme,
  places: [{ plotId, interiorId?, kind, name, door: {x, z},
             stashAnchorId?,
             npcs:  [{ npcId, name, role }],
             items: [{ itemId, name, archetype, ownerNpcId? }] }] }
```

`door` is metres, and it is the only coordinate in the structure, so a recipe can price a walk without knowing the grid. This is the abstract roster he described, and it is built as specified.

Produces validated `QuestDoc[]` through `questDraftContract` -> `sealQuest` -> `validateQuest(candidate, questView(world))`, where `questView` is the five question port `@gb/world` publishes (`hasNpc hasPlot hasInterior hasItem hasAnchor`). Read by `@gb/bundle` (sealed with the world under one sha-256), `@gb/quest` `QuestLog` at play time, `@gb/talk` (`log.offeredBy` builds the dialogue menu), `@gb/hud` (objectives and the quests tab).

### The two writers behind one port

`Narrator` is the seam. `OfflineNarrator` (default) and `@gb/scribe` (model) implement the same five methods. They are not equivalent:

| | offline | `--model` |
|---|---|---|
| cast the quest writer sees | the whole city | 8 places per call (`game/scribe/src/quests.ts:11 PLACES_PER_QUEST`). At 20x20 that is 0.3% of the city per call. |
| interior and anchor targets | allowed | refused: `CitySummary.view()` answers `hasInterior: () => false, hasAnchor: () => false` (`summary.ts:47-53`), so 2 of 11 step kinds are unreachable |
| main quests | up to 4, chained by `standing_N` | 1 (`quests.ts:79 index === 0 ? main : side`), and `prompts/quest-role-side.md` tells the model "nothing else waits on it" |
| structure emitted, 1x1 city | flags, requires, optional, hidden, choice, join | 0 `set-flag`, 0 `requires`, 0 effects, 0 `failWhen`, 0 optional, 0 hidden, 0 choice |
| quests on the same brief | 6 | 5. Scribe's contract says a model build never has fewer. `quests.ts:55 total = sideQuests + 1` is where they disagree. |
| wall time, 1x1 | 0.1 s | 1,011 s. 40 descriptive calls run serially on 1 of 5 slots at ~18.8 s each (753 s), then 5 quest calls in one wave (258 s). A 5x5 city is roughly 4.5 hours of descriptive calls before quests start. |

### The edges that are wrong

**A. S4 cannot see anybody who is not in a building.** `summarise` builds each place's `npcs` as `world.npcs().filter(n => n.station?.interiorId === interior.id)` (`forge.ts:288`). There is no top level `people[]`. An NPC without a station appears nowhere in `WorldSummary`. Today that costs nothing because 259 of 259 NPCs are stationed, but it means the walking NPC he wants is invisible to the quest writer by construction.

**B. The interior decision silently decides the quest cast.** `CityCast` (`game/forge/src/quests/cast.ts:50-62`) only uses places with npcs, items or a stash anchor, all of which come from an interior. `#raise` (step 8) and `#writeQuests` (step 11) never talk. `docs/LOOK.md` already says openness must be "decided in the same pass that writes the quests"; it is not. Measured: 39 of 285 quest givers are stationed indoors across 36 of 134 buildings (27%). A naive "10% open" filter applied after generation breaks two thirds of the givers.

**C. Four of nine game events have no producer.** `stashed`, `chose`, `npc-gone`, `item-destroyed`: 0 emitters outside tests across `app`, `hud`, `talk`, `scene`, `crowd`, `cast`, `traffic`, `nav`. Driving all 494 generated quests with only the events the game can produce: **382 of 494 complete (77.3%)**, 46 stick on `choice`, 66 stick on `stash`. Roughly 6% of playthroughs have a main line that cannot be advanced at all.

**D. `arrived` fires from one call site**, `Buildings.enter()` (`game/app/src/buildings.ts:104-105`), and it returns early when the plot has no interior (`:79-80`). `PlaceSchema` is `{plotId} | {interiorId}` (`game/quest/src/schema.ts:31-34`). So there is no outdoor destination, and once "most buildings do not open" lands, a `goto` at a closed plot can never be credited.

**E. `talk` topics are a dead letter.** `game/quest/src/matching.ts:21` requires `!step.topic || step.topic === event.topic`; `@gb/talk`'s `greet.ts:26` emits `{kind:'talked', npcId}` with no topic, and `Objective` publishes no topic. The offline writer routes around it by never emitting one. The model put topics on 2 of 5 talk steps in today's run, both in the main quest, which is therefore dead at step 2.

**F. Splits converge.** 82 of 82 `choice` quests across 9 cities have both branches pointing at the same next step. The branch delta is a `pay` of 21 to 70 coins and a `reputation` of -3, and the main line's `set-flag` hangs off the shared `complete` (`recipes/recipe.ts:85`), so the flag is raised identically either way. `-3` is inside one `@gb/talk` standing band, and 67% of quests already pay negative reputation for theft.

**G. Who walks the city is decided at play time.** `game/app/src/street.ts:56 residents() { return this.#world.npcs() }`, drawn with `rng.pick(residents)` at spawn (`:47`), 14 walkers alive. The app then hides the indoor copy of anyone currently out (`buildings.ts:90-91`). Measured at one bar door over 50 s: 16 distinct walkers, **15 of them stationed more than 100 m away, median 143.7 m, in a 228 x 216 m city**. The walker list is `Rng.fork("walker/" + serial)`, so it is the same 14 people in the same order wherever the player stands (14 of 14 overlap between two corners). P(a given resident is on the pavement) is 5.36%, which means ~3.3 of 61 quest named people are off their post at any moment, and 8 of them are the only person in their building.

---

## 4. Every open feature

Layer: **G** generation-time, **P** play-time, **A** art, **C** contract/plumbing.

| Feature | Layer | Stage | Depends on | Blocked |
|---|---|---|---|---|
| Premise: why this town exists | G | S1 | nothing | no |
| Premise steers plot mix and staples | G | S1 to S2 | premise | yes, on premise |
| Premise reaches NPC dialogue | C | S1 to play | premise, `@gb/talk` brief | yes, on premise |
| Factions with real names, reputation gates that fire | G+C | S1 to S4 | premise | yes, on premise |
| Main line with a subject, not just `standing_N` | G | S4 | premise | yes, on premise |
| Most buildings do not open | G | S2+S3 | openness set shared with `#writeQuests` | no, but must land with the quest pass |
| Demand a specific instance (one hospital) | G | S2 | staples map already exists, one brief field | no |
| Hospital, police station, corporate office, nightclub | G+A | S2+S3 | 9 exhaustive `Record<BuildingKind, ...>` plus 10 soft tables plus wardrobe | no |
| Prefab building meshes from a catalogue | A+G+C | S2 | `game/prefab`, `game/blueprint`, `plot.design` field | in flight |
| Walkers written into the world file (a beat, no station) | G | S3 | `NpcSchema` outdoor whereabouts | no |
| `WorldSummary` names walkers | C | S3 to S4 | walkers exist | yes |
| Crowd told who belongs where; stationed people excluded from the draw | P+C | S3 | `CrowdPeople.street(serial, rng)` gains the spawn point it already computes | yes, on walkers |
| Outdoor place in `PlaceSchema` plus an event that fires for it | C | S4 | walkers, `@gb/app` proximity trigger | yes |
| "Find her in the city" as a quest step | G | S4 | all four rows above | yes |
| NPC daily routines | G+P | S3 | interior navigation | yes, `@gb/nav` has none |
| Interior crowds | P | play | interior navigation | yes, same |
| `chose` producer: HUD intent, talk option, app emit | P | S4 | `HudIntent` gains a member; `Objective` publishes `prompt`/`options` | no |
| `stashed` producer | P | S4 | app interaction | no |
| Splits that stick (per branch `set-flag`, mutually exclusive follow-ups) | G | S4 | `chose` producer; premise for it to mean anything | partly |
| `failWhen: flag` (a decision cancels an accepted job) | C | S4 | `game/quest/src/schema.ts:37-43` | no. Only genuinely missing engine capability for branching. |
| `companion-join` moves the person | P | S3/S4 | bridge the effect and `did: follow_player` to `Crowd.follow` (PLAN task 9) | no |
| Main line scales past 4 links | G | S4 | `write.ts:11 MOST_MAIN = 4` | no |
| Model writes structure (flags, gates, splits) | G | S4 | prompts and `narrow.ts` already keep choice/join/any-of | no |
| Model slot count matches offline | C | S4 | `game/scribe/src/quests.ts:55` | no |
| Model descriptive calls use all slots | C | S3 | scribe wave concurrency | no |
| `talk` topics: publish on `Objective` or delete the field | C | S4 | pick one | no |
| Main vs side visible in the HUD | P | S4 | `QuestEntry` has no `kind` | no |
| Journal ticks (`reporting.ts:73 done: !open.has(step.id)`) | P | play | publish step completion from `@gb/quest` | no |
| The map tab is fed | P+C | play | `grep "map:" game/app/src/` returns nothing | no |
| Route guide to an objective | P | play | `nav.pathToDoor` and `waypoints` have zero callers | no |
| `plot.design {model, mirror, palette}` in the file | C | S2 | prefab | in flight |
| `requires` written with asset hashes | C | boundary | every file today has `requires: []` | no |
| Start hour and weather authored in the file | C | S1/S2 | `DEFAULT_START_HOUR = 8` against a midnight grade | no |
| Grow the city while playing | G at P | S2 | `Forge.extend` has one caller, a test; `scene.add` leaves ground unrepainted | no |
| Quests paying in items | C | S4 | nothing removes a rewarded item from its shelf | no |
| Drivable car with passengers | P | play | `game/drive` | in flight |
| Modern wardrobe | A | S3 | recut of owned outfits, 24 CC0 sources rejected on the 65 joint rig | in flight |
| Cyberpunk interior props | A | S3 | props are still Fantasy MegaKit and Dungeon Pack | no |
| Lip sync, conversation gestures | A+P | play | gestures exist in `@gb/cast`, nothing drives them | no |
| TV screen plays something | A | play | prop exists, screen is dead | no |
| Voice in the game | C | play | `host/src/stt`, `host/src/tts` exist, nothing under `game/` calls them | no |
| Repo hygiene (PLAN 19) | C | none | dead files, three `nodeNames()`, five GLTFLoader setups, two gate holes in `check-isolation.mjs` | no |
| LOD and occlusion culling | P | play | deliberately deferred | no |
| Shooting | P | play | deprioritised | no |

---

## 5. The generation-time / play-time boundary

Clean about determinism, dirty about authority.

The world file carries grid, roads, plots, interiors, npcs, items, placements, quests, `requires` (always empty), `createdWith`, `contentHash`. Everything else about the place you stand in is recomputed at play time from `world.seed`:

| Recomputed | Where |
|---|---|
| facade composition, signs, palette | `@gb/kitbash`, `new Rng(plot.id + plot.kind + plot.style)` at `compose/plan.ts:47` |
| street clutter, wet film | `game/scene/src/city.ts:59` `options.seed ?? world.seed` |
| terrain, ponds, woods, mountains beyond the grid | `game/land/src/land.ts:258` |
| cars | `game/traffic/src/traffic.ts:62` |
| who is on the pavement | `${world.seed}/crowd` |
| furniture geometry | `PROP_SPECS` plus a variant seed |

Because all of them key off `world.seed`, two players on the same commit see the same city. That is the guarantee that is tested. But `contentHash` covers world plus quests only, so the real guarantee is "same file **and** same code". Change kitbash's recipes, scene's clutter, land's terrain, traffic's settings or crowd's people rule and every already shared world file re-skins itself, with a matching hash and no way to detect it. `docs/PLAN-buildings.md` section 2 identifies exactly this hazard and kills the Stock design over it. The same hole is already open in five boxes.

The places the boundary is in the wrong position, worst first:

1. **Who walks the city.** A generation decision executed as a play-time lottery. Everything about the findable NPC follows from this one fault: no walkers in `WorldSummary`, no outdoor `Place`, no route, and quest givers randomly absent from their own counters.
2. **Which buildings open.** Not decided anywhere yet, and when it lands it is a dependency edge from S4 back into S2/S3, not a filter applied afterwards.
3. **The building look.** Recomputed per play. `PLAN-buildings.md` moves it into the file as `design {model, mirror, palette}` plus a `requires` entry with a sha256. That plan is the template for fixing the same class in scene, land, traffic and crowd.
4. **The hour the city is meant to be seen at.** `docs/LOOK.md`: "Cyberpunk, at night. Not one reference is a daylight scene." `game/app/CONTRACT.md`: "night is the hour the city is built for." `game/play/src/day.ts:20 DEFAULT_START_HOUR = 8`. The world file has no clock, so every shared city opens in the morning under a grade tuned for midnight, and no author can say otherwise.
5. **Art travels outside the file.** `requires` is in the bundle schema and read at `bundle.ts:79`, and nothing writes it. Assets are fetched from the site (`game/app/src/pack.ts` -> `${base}/downtown-kit.glb`, `anims.glb`, `wardrobe.json`, `interior-kit.glb`). The file cannot declare what it needs, let alone refuse to open against the wrong pack.
6. **`Forge.extend` is generation code that has to run at play time.** One caller in the repo, a test. `scene.add(plot)` deliberately leaves the ground unrepainted. With the model on it also means an LLM call inside the frame loop; scribe has an `AbortSignal` but no budget for that shape of call.
7. **Step completion is reconstructed in the app by subtraction** (`reporting.ts:73`), which is why unreached steps read done. That state belongs to `@gb/quest` and should be published.

---

## 6. What to do in what order

**1. One `@gb/world` schema bump that opens every slot the rest needs.** A premise on the city spec, an outdoor whereabouts on `NpcSchema`, `design` on `PlotSchema`, a start hour and weather on the city spec. All optional, one minor contractVersion bump, one `pnpm --filter @gb/world run generate`. Doing these one at a time is five migrations of the same file and five rounds of caller churn. `positionOf` has to answer for an NPC with a whereabouts and no station, or nothing downstream can put a marker on them.

**2. The premise stage.** Scribe tool plus prompt, `Narrator.writePremise`, offline implementation, forked rng stream, threaded into `namePlace`, `describeNpc`, `describeItem`, `writeQuests` and into `WorldSummary`. Before the plot mix and before the quest writer, because both are supposed to read it, and before `@gb/talk` picks it up. Everything narrative that follows is worthless without it: a split that "changes the history" has nothing to change, and factions have no names.

**3. The openness set, computed in `#raise` and readable by `#writeQuests`.** Before new building kinds and before prefab, because both key on which buildings open, and because a demanded hospital that is not in the open set is a wall with a HOSPITAL blade. `docs/LOOK.md` already specifies the coupling. Add the `goto`-at-a-closed-plot guard here, since `arrived` cannot fire for one.

**4. Demanded instances, then the four new building kinds.** Demand first: the staples map at `forge.ts:120` already bypasses the density roll, so a demand is more entries in that map plus one optional brief field and an `invalid-brief` refusal when the town has fewer sites than the demand. Nothing downstream changes. Then the kinds, which is 9 compulsory exhaustive records (tsc fails without them), 10 soft tables that make the building not wrong, and `game/cast/wardrobe.json` if a new staff role comes with them. Note for whoever picks it up: the dressers are `game/forge/src/interior/furnish/`, not `@gb/furnish`; PENDING has that wrong.

**5. Walkers as a generation-time fact.** `#populate` emits some people with a whereabouts instead of a station; `summarise` exposes them (a `people[]` beside `places[]`, or place-less entries); `CrowdPeople.street(serial, rng)` gains the spawn point `crowd.ts:240-244` already computes so the game can answer "who belongs here"; stationed people drop out of the pedestrian draw so the bartender stops leaving the bar. Needs step 1. Do not leave the person as a uniform draw: at 5.36% presence and a 143.7 m median displacement, "go and find her" is a lottery.

**6. Outdoor destinations.** `PlaceSchema` gains an outdoor member, `@gb/app` gains a proximity trigger that fires `arrived` outdoors, `game/scribe/prompts/write-quest.md` gains the vocabulary. After step 5, because without a whereabouts there is nowhere to point. This is what makes "one you have to find" writable, validatable and creditable, and `docs/PLAN.md` section 6 already scoped it as world plus quest plus app.

**7. Splits that stick.** Three parts, in this order: the `chose` producer (a `HudIntent` member, a talk option, an app emit; `game/app/src/game.ts:271` is where it lands, same as the waiting `abandon` branch), `Objective` publishing `prompt` and `options` so a UI can render the fork, and `failWhen: flag` in `game/quest/src/schema.ts:37-43`. Then `write.ts` plans per branch: a branch carries its own `set-flag`, and two mutually exclusive follow-ups both require `standing_2` with opposite flag values. Everything except `failWhen: flag` is already expressible; the gap is planning, not engine. Do this after step 2 or the branches still differ only by a number. It also unsticks 46 of 494 quests, and the `stashed` producer unsticks another 66.

**8. Scale and parity of the quest writer.** `MOST_MAIN = 4` becomes a function of city size (a 764 building city gets 4 mains from one NPC today). Fix `scribe/src/quests.ts:55` so a model build is not one quest short of an offline one, ask the model for the structure it is already allowed to emit, and resolve `talk` topics one way or the other before the model writes another dead main quest. Also worth the same pass: run scribe's descriptive calls across all slots, since 753 of 1,011 seconds on a 1x1 city were 40 calls queued on one slot.

**9. Move authority into the file.** `plot.design` written at generation time, `requires` written with asset hashes and checked on open, start hour and weather authored. This is what makes the world file portable in the sense he asked for, and it closes the silent re-skin hole across kitbash, scene, land, traffic and crowd. After prefab lands, because prefab is the box that forces the `design` field to exist.

**10. Wayfinding.** Feed `patch.map`, and route the player with `nav.pathToDoor` and `waypoints`, which have zero callers today. Last, because it is only worth building once objectives can point outdoors; before that it is a pin on a door.

Parallel and unblocked at any point: journal ticks, `kind` on `QuestEntry`, the `companion-join` to `Crowd.follow` bridge (PLAN task 9, its blocker landed), interior props, wardrobe, gestures, repo hygiene.

---

## Stale in the docs, so nobody re-does finished work

- `docs/PENDING.md` still lists the junction paint bug. Fixed: `game/forge/src/layout/streets.ts:27-30` paints all sidewalk bands, then all roadway bands. Measured 17 of 17 road graph nodes on `street` cells, 0 on sidewalk.
- `docs/PENDING.md` still says street NPCs do not talk. They do: `game/app/src/targets.ts:69-74`.
- `docs/STATUS.md` still lists the head turn as open. Landed in `ca1dffd` and `34d4dbf`.
- `docs/PLAN.md` task 18 (save and resume) is done: `game/app/src/session.ts` calls `Bundle.save` and `Bundle.resume`.
- `docs/PENDING.md` attributes the per kind dresser to `@gb/furnish`. The dressers are in `game/forge/src/interior/furnish/`; `@gb/furnish` only builds prop geometry.
- `game/forge/CONTRACT.md` lists three files to touch for a new building kind. The real count is 9 compulsory plus 10 more that decide whether the building reads correctly.
