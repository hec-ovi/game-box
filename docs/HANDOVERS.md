# Handovers between boxes

An agent finishes and hands work to a box it does not own. The coordinator has
to carry it. Two were dropped today and the owner noticed, because he had seen
the feature in a render and never in the game. This is the ledger that stops
that.

Checked against the repository, not against the reports. Delete a row when it
is done and the check confirms it.

## Ranked by what the player would notice

1. `forge` never places the wall-lean anchors `cast` built idles for
2. `app` never wired `dressing.room(interior)` and `room.decor`
3. Prop footprints disagree: forge plans a table 1.6x0.9, furnish draws 1.0x1.0, so chairs sit 0.4 m off the edge
4. `forge` serialises the narrator: peak concurrency 1, four of five llama slots idle, 85% of model wall clock
6. No way to give up a quest: three boxes did their half, the middle one was never asked
7. The journal cannot tell an unreached step from an open one
8. The boot panel clamps blocks to 24 where forge now accepts 77

## Outstanding

| # | Handover | From | To | What to do |
|---|---|---|---|---|
| ~~1~~ | done: 73 lean anchors, 29 propped people on a 10x10 town. Place `lean` anchors: 0.44 m out from the wall face, rot 180/0/270/90 per wall, 0.79 x 0.76 m clear, no `propId` | cast | forge | `lean` appears nowhere in `game/forge/src` |
| 2 | `dressing.room(interior)`, `built.root.add(room.decor)` | furnish | app | in flight |
| 3 | One shared prop spec (cells, contact, `onSurface`) with no renderer dependency | furnish, forge | world + forge + furnish | forge cannot import furnish without putting `three` in the headless generator |
| 4 | `Promise.all` over `namePlace` and `describeNpc`/`describeItem`, reassembled by index | scribe | forge | `forge.ts:161/225/250` await one at a time |
| 6 | `HudIntent` needs `{ kind: 'abandon'; questId }`, and a "Give up" beside Follow | app, quest | hud | `Game.abandon` is wired and casts for an intent that does not exist |
| 7 | `QuestStep` carries one boolean where the engine has three states | app | hud | |
| 8 | `BLOCKS.max` is 24; forge's derived bound is 77 | forge | app | |
| 9 | Anchor the bartender against `staffContact` (1.00), not `contact` (1.10) | furnish | forge | `staffContact` is published and unreferenced |
| 13 | Interior surfaces should carry metre UVs like ground meshes do | furnish | scene | would remove furnish's shader projection entirely |
| 18 | The world contract's outputs table omits half of what it publishes | nav | world | |
| 19 | `surroundings.md` has no line for `work-bench` | world | talk | |
| 20 | `nav/tests/contract.test.ts:125` assumes a bar exists | forge | nav | |
| 21 | `nav` prices a mountain cell impassable; `land` calls it walkable verge | forge | nav + land | |
| 22 | `sources.json` claims KayKit was retargeted (30-bone rig, nothing ships) | cast | assets | |
| 23 | `downloaded.json` still records two removed packs | furnish | assets | |
| 24 | No `CHANGELOG.md` | world | repo | project rule asks for one |
| 25 | The design a plot got is not in the world file, so growing the catalogue re-skins shared cities | prefab | world + forge + bundle | the first thing to revisit when those boxes open |
| 26 | Tall towers need forge-marked landmark sites with a raised `maxStoreys` | prefab | forge | the catalogue is 1-4 storeys because that is what forge cuts |
| 27 | Bounce light: walls stay near-black because nothing bounces | prefab | app | the biggest remaining gap against the references |
| 28 | An interior probe so a reflective floor reflects something | furnish | furnish | named as a next task |
| 29 | Overhead wires derived from lamp positions | assessment | kitbash | cheap "inhabited" trick, never done |
| 30 | `KitDressing.building()`'s `door` empty has no consumer | scene | kitbash | dead surface |
| 31 | `SceneCast` recycles bodies by kind, so street variety is capped by the pool | cast | crowd + app | 360 male and 180 female looks exist, far fewer show |
| 32 | Stale lines in `PENDING.md` and `PLAN.md`, including `viewOf` citations for code now deleted | audit | docs | all landed or never true |
| 33 | `talk/src/credit.ts:26` emits `talked` with no topic, so a topic'd step still cannot complete through a real conversation | scene-batch agent | talk | the objective now names the topic; talk must forward it |
| 34 | `game/app/src/spawn.ts` is now redundant: `city.spawn` does the same thing and lands square on the cell centre | scene | app | delete it and use `city.spawn` |
| 35 | A car is placed on a sidewalk cell on the current forge layout | scene-batch agent | traffic | its own test catches it |
| 36 | Root `package.json` carries `pnpm.onlyBuiltDependencies`, which pnpm no longer reads and warns about on every run | scene-batch agent | repo | |
| 37 | Never hand a userland `undici` dispatcher to the built-in fetch: Node 24.19 bundles undici 7.29, a userland 7 Agent works, an 8 Agent is rejected outright | sidecar | repo | pinning `^7` works today and breaks on the Node that bundles 8 |

| 38 | Cast's rotation table gives `rot 270` for the west wall under "90 faces -x"; forge's `dirOf` has 90 facing **+x**. The physical facing is right because forge used its own `inward(side)`, but the two write-ups are mirrored on the east-west axis and one is wrong | forge | cast + forge | an east-west mirror already cost this project real time once; settle which convention is the true one and correct the other document |

## From the browser playthrough

A quest was completed end to end twice, once with the model and once offline.
These are what it found on the way. Numbered by what a player hits first.

Rows 39, 40, 41, 42, 45 and 46 landed in `app` and were checked in a browser:
five walkers out of fifteen with somebody left in every shop, a `collect` step
pinned and routed from indoors and out, and `?sidecar=` surviving a refresh.

| # | Defect | Box | Detail |
|---|---|---|---|
| 43 | A timed quest is an invisible real-time stopwatch | forge + play + hud | a timer is ~1.5 to 2 real minutes, one model reply is 8 to 19 s of it, and nothing on screen says a quest is timed or how long is left. One expired mid-playthrough and the first sign was an empty journal |
| 44 | Every carried thing is the same beige cube | scene + furnish | box, envelope, stained glass, ledger and cash all render identically |
| 47 | "It belongs to somebody, and they are standing right there" is shown as the hint while the player is across town | forge | `src/quests/recipes/hot-parcel.ts`; the hint reads as if the player were in the room |
| 48 | A conversation opens with a blank panel and the NPC says nothing until the player speaks first | app + talk | decide whether a greeting is worth a model call; `@gb/talk` would own the line |
| 49 | `TalkPatch.acted` cannot be cleared | hud | `acted` appends within a panel and only a **new** `speaker` resets it, so a per-turn line is impossible from outside. `app` announces what the speaker did instead, which leaves `acted` with no consumer: either take `acted: null` to clear it, or drop the field |
| 50 | "Nothing yet. Find someone to talk to." reads as if the player had never had a job | hud | `src/surfaces/objectives.ts`; true after finishing one and being offered two more |
| 51 | **A room can be cut in half by its own furniture, and a chair can sit on the doorstep** | forge | measured over 121 interiors in 15 generated cities: 5 put a prop on the spot 1.2 m inside the street door, and 8 of 365 stationed people plus 7 of 242 items end up in a pocket of floor the player cannot walk to. `g/Golden Wheel Coffee` seats tables at x=1.60 and x=4.00 with chairs at 0.45, 2.85 and 5.15, leaving aisles of 0.40 to 0.50 m against a 0.70 m body, so a row of tables seals the room. Identical with `@gb/scene`'s `Greybox` and with `@gb/furnish`, so it is the layout and not the drawing: the plan has to reserve an aisle a body fits down and keep the doorstep clear |

## From the wider roads

| # | Defect | Found by | Box | Detail |
|---|---|---|---|---|
| 52 | One flat car cap for a whole city | scene+traffic+crowd agent | app | `game/app/src/street.ts:118` passes `maxCars: 12` for the entire town. A four-lane avenue holds twice the cars a street does, so the number that made a street look right leaves an avenue empty. It wants to scale with the lane network, not with the city |
| 53 | `@gb/hud`'s `QuestStep` widening breaks `game/app/tests/contract.test.ts` under `tsc -p game/app` | scene agent, then confirmed live | app | `done` becomes optional, and the app fixture types it as required. This is the migration the hud agent owes; it lands with hud's report, not separately |

## From the panel

Rows 49 and 50 landed in `@gb/hud`, along with the journal's third step state
and the abandon control. What they leave for their callers:

| # | Work | Box | Detail |
|---|---|---|---|
| 54 | Push `acted` per turn | app | `acted` is now the line for the turn in front of the player: sending it replaces, `acted: null` clears, omitting keeps. Push it when `@gb/talk` emits `did`. The assertion at `game/app/tests/contract.test.ts:1132` that app never sends `acted` goes with it |
| 55 | Send `state` on each `QuestStep` | app | `'upcoming' \| 'open' \| 'done'`. `done` still reads, so nothing breaks until app moves |
| 56 | Bind `Game.abandon` to `HudIntent.abandon` | app | The hud asks twice on its own; do not add a second confirm. After `QuestLog.abandon`, push `quests` without that quest, the hud drops nothing itself |
| 57 | Publish a per-quest step list carrying each step's state | quest | The three states are derivable today only by walking `QuestLog.toJSON()`'s `open[]` and `done[]` against the quest doc's step order. Publishing it saves every caller that walk and stops them disagreeing |

## From the things you carry

Row 44's furnish half landed: all 25 archetypes are built shapes, three casts
each, one shared material, no draw added.

| # | Defect | Found by | Box | Detail |
|---|---|---|---|---|
Row 58 is closed. Scene did not read furnish's published `contact(prop)` and
gave a measured reason: scene cannot import furnish (furnish depends on scene),
and one number per prop kind fixes 20 of 42 cases and cannot fix the rest, since
it cannot say which of a bar counter's two tops a thing is over. A ray at the
point the thing is going gets 42 of 42 with nothing published at all. Over 88
placements in 8 towns: resting on nothing 87 to **0**, not even over its own
piece 60 to **0**.

## From the journal and the greeting

`@gb/quest` publishes `QuestLog.journal()`, and `@gb/talk` speaks first. Row 57
is closed. What they leave:

| # | Work | Box | Detail |
|---|---|---|---|
| 59 | There is a fourth step state, `dropped` | hud | A step on a branch nobody took: the far side of a `choice`, and the rivals an `any-of` beat. `QuestStepState` has three. Either render it or declare hud never receives one; until then app throws those steps away and a quest that split reads as if the untaken side never existed |
| 60 | `QuestEntry.title` against `Objective.questTitle` and `JournalEntry.questTitle` | hud | Two names for one string across one boundary, renamed by hand at every caller |
| 61 | Push `opening.line` and `opening.moves` when a conversation opens | app | `game/app/src/talking.ts`, around the `Conversation.open` call at line 70. Talk's half of row 48 is done and costs 0.007 ms; until app pushes it the panel is still blank |
| 62 | Read `log.journal()` instead of walking `toJSON()`'s `open[]` and `done[]` | app | `game/app/src/reporting.ts`. hud's field is `title`, quest publishes `questTitle`, so the mapper renames until row 60 lands. Drop `dropped` steps until row 59 lands. `game/bundle` keeps using `toJSON()` for the save file, which is what it is for |

## From the narrator fan-out

Rows 51 and 47 are closed in forge; rows 59 and 60 are closed in hud.

| # | Work | Box | Detail |
|---|---|---|---|
| 63 | `Scribe.namePlaces` has no caller | scribe | A facade no longer costs a model call, so the plural naming method is dead. Also `InstanceRequest`, `InstancePost` and `InstanceStock` now carry an `index` (the caller's own numbering, so an offline narrator can reproduce its draws); scribe still compiles without it |
| 64 | Forge plans a 1.6x0.9 table, furnish draws 1.0x1.0 | forge + furnish | Still open, deliberately. Forge over-reserves, which is the safe direction. It needs the two boxes to agree one number, not a change in either alone |

| # | Work | Box | Detail |
|---|---|---|---|
| 65 | `game/app/tests/contract.test.ts:634` asserts the glass at `x = 10.1`; it is now **9.2** | app | "Beside them" follows the anchor's own facing (45 cm to their right) instead of world +x. Same 0.45 m, one constant. Caused by scene's fix and the only break outside its folder |

## From the choice pass

| # | Work | Box | Detail |
|---|---|---|---|
| 66 | Never announce or render a `step-opened` change whose `hidden` is true | app | `objectives()` and `journal()` filter hidden steps; the change stream cannot, because the app has to know the step is on the board. The flag is there so the caller stays quiet. Switching to `journal()` alone does not close the spoiler if app announces changes |
| 67 | `drive.ts` emits `chose` from the quest document rather than from a published objective | forge | The objective now publishes the option keys, so the harness can answer with the same list a player is shown |

| 68 | Route the panel's `decide` intent into the engine's `chose` event | app | `{ kind: 'decide', questId, stepId, optionId }` maps field for field onto `log.handle({ kind: 'chose', ... })`. Then push the new `journal()` and `objectives()`; the hud marks nothing itself. The last leg of the choice blocker |

## From the topic pass

Row 33 is closed, and so is the free-text decider. `@gb/talk` credits a topic
only when the NPC is put to that subject through the menu, never by a
conversation that wanders onto it. The one-line fix the audit imagined (forward
the first open topic on every `talked` event) fails both of its tests.

| # | Work | Box | Detail |
|---|---|---|---|
| 69 | `Member.gesture()` has no caller, so NPCs talk with their arms still | app | Not talk's to make: talk holds no body, has no three.js and no `@gb/cast` dependency, and pulling cast in would put a renderer inside a headless box. App owns both ends already. `member.gesture(...)` on a `said` piece for `conversation.npcId`, `stopGesture()` on `over`. Two lines, nothing new needed from either contract |

| 70 | A thing left somewhere is not drawn there | scene | The put-down credits and the item leaves the player's hands, and nothing appears on the surface. A `Pickup` handle's batch matrix is baked at `put()` time, and `PropSurface`/`Pickups` are not exported, so there is no published way to place an item at an anchor after the build |
| 71 | `JournalEntry` has no `kind`, so nothing marks the main line | quest, then hud | Forge generates it correctly. App cannot add it without reintroducing the hand mapper it just deleted |
| 72 | A `complete` step is a journal line reading like a task | quest or forge | `journal()` lists every step in document order. Either the journal filters flow-control steps as a rule, or forge's recipes are writing task-sounding text into a `complete` objective |

| 73 | An openable door looks the same as a door that never opens | world + forge, then prefab | Prefab can carry a second door layer (0.7 MB) and pick between them inside `orient`, which already rewrites the geometry per plot, so the choice costs nothing beyond the layer. It needs one flag: `plot.opens` on `@gb/world`'s `Plot`, set in the same forge pass that decides which plots get interiors. With most buildings shut, a door you can actually use should read as one from the pavement |

## From the pavement

`@gb/crowd` published `SceneCast.members()`, the same shape and key as
`CastDressing.members()`, so one lookup reaches a person at a post indoors and a
passer-by on the street. It also fixed two live bugs found on the way: a body
parked mid-gesture came back still talking with its hands and wore that down the
street on the next walker, and somebody who joined the player got two bodies
because `follow` spawned a companion without retiring the street walker.

| # | Work | Box | Detail |
|---|---|---|---|
| 74 | Gesture calls for a person stopped in the street | app | `bodies.members().get(npcId)?.gesture(...)` on the turn, `stopGesture()` when it ends. **Look it up every frame; never cache the `CastMember`** — bodies are recycled, and a cached member is a stranger's arms. `Street.populate` types its parameter as the port, which has no `members()`, so keep the concrete `SceneCast` on the field you call from |
| 75 | Pass `at: { x, z }` from `walkers()` when a passer-by becomes a companion | app | Otherwise they teleport to the player instead of stepping off the pavement where they stood |
| 76 | Treat `held === false` and `members().get(id) === undefined` as the conversation ending | app | A held walker is still retired past `retireRadius`, deliberately: an app-leaked hold would otherwise pin a walker forever. Walking 70 m away with a panel open ends the person, not just the hold |

## From the save

`@gb/play` now carries `where`, `tracked` and `moved`. A thing put down survives
a reload, and cannot be in a hand and on a shelf at once: `take(itemId)` forgets
the spot, so the app cannot fail to hold the invariant up.

| # | Work | Box | Detail |
|---|---|---|---|
| 79 | Call `player.place(itemId, { interiorId, anchorId })` on the put-down | app | The same two ids the `stashed` event already carries. It replaces the `drop` call rather than joining it: it takes the thing out of the inventory and clears its stolen mark itself |
| 80 | Dress a room from `player.placed()` on resume, and skip the world file's own placement for any item id it names | app | `room.leave(itemId, anchorId)` is already published by `@gb/scene`, so this is app-side only. An old save returns `[]` and the world file is the fallback as before. A save naming a room this city has not got loads; recover it with `player.place(itemId, null)`, which puts the thing back where the city file had it |
| 81 | Place everyone in `player.companions()` beside `player.where` on resume | app | The fact of companionship is saved; only the metres were missing, and those are now derivable from the player's own place. Without it a companion resumes at their post across town and either walks the city to catch up or snaps to the player on the first frame |
| 82 | A save written while the clock is paused opens frozen forever | app | `P` pauses by setting the rate to 0, and the rate it was running at lives in app memory rather than in the save. Reload and time never moves, the sun never sets, nothing on screen says why |

### Decided, so nobody reopens it

**An opening line may reach a street NPC's back, and that is accepted.** The
kerb rule means up to a couple of seconds between the hold and the person
turning to face you. `@gb/crowd` deliberately publishes no "they have turned"
signal and `@gb/app` deliberately does not wait for one: the defect being fixed
was a blank panel, and a two second wait to avoid a cosmetic oddity trades a
real fault for a smaller one. Somebody answering while they finish crossing
reads as calling back over their shoulder. Companions are exempt from the rule
entirely, so this only ever applies to a stranger on the pavement.

## From the road

Row 78 is closed. The braking rule was already in `@gb/traffic` and already fed
by the app; two ways of running somebody over had survived it. A car now stops
at anybody it could not brake for (0.5 m short, not zero, because zero would let
the walking side's push-out shove a body down the street), and stays out of a
junction somebody is standing in the middle of, which used to let one car hold
every arm for 24 seconds. Cost on the case that is actually the game, people on
pavements: 2 to 3.5x cheaper than before, and now scaling with the crowd rather
than crowd times roads.

| # | Work | Box | Detail |
|---|---|---|---|
| 83 | `street.ts` passes `PERSON_CLEAR` (0.34 m) as a person's radius to traffic | app | That is the body-collision capsule, not a person's width in the road. It makes the hazard band 1.24 m either side of a lane centre, so a car passes 0.56 m from somebody's middle without slowing: it clips a shoulder. Leave `radius` out, the port defaults to 0.5, or pass 0.5. One word, and it is the difference between clearing somebody and shaving them |
| 84 | `near()` allocates an array plus one object per person per frame | app | Traffic's contract now permits reusing one array and mutating its entries. Small, and it is the app's frame |

## From the clips

Row 77 is closed. 16 clips became 28, every wrong stance is fixed, and
`GESTURES` went from two talking loops to four (a nod and a head shake), so a
conversation can answer as well as talk. Pack 0.62 MB to 0.99 MB.

The lasting part is a second build-time maker: `tools/anims/blend.mjs` lays one
clip's movement over another's stance, the same sum the runtime gesture layer
does. Measured from the movement's own first frame it adds only the movement, so
a seated body drinks. That is where `sit-drink`, `sleep` and `work-desk` came
from, with no purchase. What it cannot do is invent a limb the source never
moves, or reach a *place*: anything that must reach is a measured pose.

| # | Work | Box | Detail |
|---|---|---|---|
| 85 | A sleep anchor is placed for a body sitting up | forge | `stance.ts` puts it 0.43 m toward the headboard, the seat rule. A lying body is centred on its root, so the anchor belongs at the middle of the mattress; today a sleeper lies at the right height with their head past the headboard. Place against: centred, 0.96 m either side, height carried by the clip |
| 86 | The bed is 6 cm too short | forge + furnish | Pad 1.84 m, a body with boots is 1.90 m end to end |
| 87 | `work-desk` has no reach band | forge | Staff at a counter have one (0.15 m); a seated desk worker has none. The wrists sit at 0.78 m, 0.20 to 0.24 m in front of the root, so the desk edge belongs under them |
| 88 | `METRICS.worktopHeight` is 0.9 and every standing clip on this rig reaches 1.02 | world | A cook's hands ride 12 cm over the hob. Either the worktop rises to counter height or that stance needs a clip nobody sells. Same family as the bar-counter fault |

### Decided: the fabric tile goes on roughness, not colour

`@gb/cast` measured it properly and found only the third objection real. Download
is not the problem: multiplied into a repainted sheet and re-encoded, a sheet
goes 23 KB to 33 KB, about **+0.24 MB across the whole 13 MB character pack**.
The UV objection is answered: the garments are properly unwrapped, 2,365 distinct
UV cells over 3,006 body vertices, so a tile reads as a pattern rather than one
stretched swatch.

The real objection is the map. Multiplied into base colour it is a *printed*
quilt that does not respond to light, which is the cloth the owner said he does
not want. His words are "a sheen that moves, not cloth", and a sheen is a
specular property. So: **roughness (or normal), not base colour**, masked per
fabric region so the face and hands on the shared sheet are not quilted. The
sheets already exist in the same UV layout and `tools/wardrobe/fabrics.mjs`
already names each region, so it is the same one-step multiply.

## From the answer

Row 89 is closed at the talk end. `@gb/talk` publishes
`{ kind: 'answered', answer: 'yes' | 'no' }`, only on turns that have an answer,
so "neither" is the absence of the event and nothing defaults to agreement. The
rule that keeps the three tracks from drifting: **carrying a move out is a yes**,
decided in the one place the model track, the offline reader and a clicked move
all converge. A reported refusal that still picks a move counts as a yes,
because what happened is the ground truth.

| # | Work | Box | Detail |
|---|---|---|---|
| 90 | Play the nod and the shake on `answered` | app | One case in the `TalkEvent` loop. `@gb/cast` needs nothing |
| 91 | The nod may land visibly late with the model up | talk | `answered` arrives at turn settle, because the voice call and the action call run in sequence and one call decides both. Overlapping them is a restructure of the two-track flow inside talk. Only worth doing if it reads late on screen; app must not compensate for it |
| 92 | No clip sits a body on a raised seat | cast | Every `sit-drink` anchor on a bar stool is 33 cm out, four of them in a nine-plot city. The only seated clip has soles on the floor, body underside 0.423, against a 0.75 pad. Lowering the stool is worse (a 0.42 m seat at a 1.1 m bar). `@gb/forge` anchors `sit-drink` on chairs meanwhile |
| 93 | Worktops, hobs, sinks and the lowest shelf ledge rise 10 cm | furnish | `METRICS.worktopHeight` went 0.9 to 1.0, measured: standing palms land at 0.972. Furnish reads `METRICS` directly and its tests measure drawn triangles against it, so they follow; what needs a look is anything drawn **under** a worktop (a cabinet run) and whether a shelf's ledges still fit |
| 94 | Seed the pause from `player.clock.paused` on resume, and call `clock.resume()` when `P` unpauses | app | Closes row 82. The save now carries `rate` (the running rate, always above 0) and `paused` separately; `setRate(0)` still pauses and `setRate(n)` still runs, so the toggle keeps working, but the rate it resumes at has to come from the clock and not from app memory, or a paused save opens frozen with the app believing it is running. An old save with `rate: 0` opens paused at `DEFAULT_RATE` |
| 95 | Pay with `player.pay(amount)` for a `pay` effect | quest | `spend` is the same call and goes once quest has moved. `pay` refuses a price that is not a whole number zero or more (`invalid-amount`) as well as one not held; both deduct nothing |
| 96 | Give each background fact an id | forge | `player.unlock(npcId, factId)` and `unlocked(npcId)` carry fact ids as strings and the codex on screen looks them up in the world. A staged background is a list of `{ id, text }` per person, with the id stable across regeneration of the same seed |
| 97 | Sell through `player.buy(itemId, price)` | app | One call: it pays and takes, and refuses (`already-carried`, `invalid-amount`, `not-enough-money`) with nothing moved. The price is the world's or the counter's to state; play holds no prices |
| 98 | Record what a conversation changes in the person | talk | `player.remember(npcId, fact, 'told' \| 'seen')` for a sentence the person now holds (12 per person, oldest dropped, 200 characters each), `player.warm(npcId)` / `cool(npcId)` for how the turn went, `player.unlock(npcId, factId)` when a background fact is earned, and `player.discover({ npc })` when a conversation opens. `player.memories(npcId)` and `disposition(npcId)` are what to put in front of the model for that person; nothing spreads to anyone else |
| 99 | Note places entered with `player.discover({ place: interiorId })` | app | On walking through a door. `discovered()` then lists places and people in the order first found, for the codex |
| 100 | A codex window from `player.discovered()` | hud | `{ places, people: [{ npcId, unlocked }] }`: the ids are the world's, so names come from the world file and a person's fact texts from their staged background (row 96); `player.disposition(npcId)` gives the standing to show per person |

## Checked and closed

About fifty handovers landed and were verified in the code rather than taken on
trust. Nine more were **wrong**, and those are the interesting ones:

- `sidecar`'s timeouts were reported unwired. They are wired, proved against a
  real server with eleven mutation checks. The report was stale when filed.
- "Crowds can no longer cross a street" was inferred from a constant and
  disproved by measuring the running city: 47 of 50 walkers stood on a roadway
  cell. The real defect was *where* they crossed.
- `kitbash` was asked for a merged shadow stand-in worth 3.3 ms. `scene`'s
  batching made it unnecessary; adding it would duplicate geometry for nothing.

The lesson in all three: a claim about another box is a hypothesis until
somebody measures it.
| 94 | `mountain` is not in the world contract's cell vocabulary | world | nav | `nav` prices `mountain` impassable (`WALK_COST` infinite) and its contract says so; `game/world/CONTRACT.md` names `BUILDING_KINDS` and `ROAD_KINDS` but no `CellKind` list, so nothing outside nav can read that a mountain is impassable. Publish the cell kinds with a one-word meaning each |
| 95 | Emit `companion-arrived { npcId, place }` when a companion's body enters a plot or interior | app | An escort is credited by that event alone; `arrived` with the companion flag set moves nothing. Hypothesis, unmeasured: app sends only `arrived` today, so every escort stalls until this lands |
| 96 | Drive an escort in the harness with `companion-arrived` for the step's `npcId` at its `place` | forge | `companion-join` followed by the player's `arrived` leaves the step open now, by design: the table under "What credits a step" in quest's contract names the one event per kind |
| 97 | Re-pick every `time-limit` against game seconds at 24x | forge | Quest's contract, "Timers": 24 game seconds per real second, a day is one real hour. Budget 600 per conversation and 3000 per walk, nothing under 3600. A value picked for the 240x clock is now ten times shorter in real time |
| 98 | Push `journal()` on every `clock` event, and after `quest-failed` | app | `timer.remaining` on a timed page moves only when the page is re-read; the failed page stays in the journal with `status: 'failed'` and `failReason`, so push the list with it in rather than without it |
| 99 | Draw the countdown and the failure reason on a journal page | hud | `timer: { remaining, total }` in game seconds (divide by 24 for real seconds) on a timed page while it runs; `failReason` (`fail-step`, `time-limit`, `npc-lost`, `item-lost`) in plain words on a failed one, which today reads as an absence |
| 100 | Send `talked` with `topic` when a conversation covered a talk step's published `topic` | app | The objective carries `topic`; a topic step is credited by the same one and nothing else. Until app sends it, generators keep emitting no topics |
| 101 | Push the conversation as turns, with `does` apart from `says` | app, talk | hud | `TalkPatch` takes `turns: [{ who: 'you' \| 'them', says, does? }]` to replace the transcript whole, and `reply`, `replyChunk`, `does` (string, or `null` to clear) edit the speaker's current turn. `acted` reads as `does` meanwhile (`game/app/src/talking.ts:128,141` and `game/app/tests/contract.test.ts:1530` send it). When `@gb/talk`'s tool carries `does` and `says`, hand `does` to `hud.show({ talk: { does } })` before the reply streams and the panel draws it as stage direction |
| 102 | Route the settings intents and the way out | app | hud | `HudIntent` has `lock-time { locked }`, `skip-time`, `weather { weather }` and `exit`. Map them onto the same calls `P`, `T`, `K` and `N` make today. `N` is the hud's key now (`HUD_KEYS.leave`): it reports `exit` and stops at the capture listener, so the app's own `N` binding never fires; drop it and act on the intent. Push `settings: { hour, minute, locked, weather, weathers }` on every clock tick and weather change so the tab reads right |
| 103 | `window: 'items'` is `window: 'inventory'`; the purse corner is gone | app | hud | `HudWindowName` is `quests \| map \| inventory \| codex \| settings \| controls`. Money and what is carried are read in the inventory only, so keep pushing `money` and `carrying`. The codex (row 100) takes `codex: { entries: [{ id, kind: 'place' \| 'person' \| 'history', title, text }] }`: app turns `player.discovered()` ids into names and a line each, the hud draws words only |
| 104 | Drive the loader from scribe's progress port | app | hud | `hud.show({ loading: { title, stages: [{ id, label, state: 'waiting' \| 'running' \| 'done', done?, total? }] } })` on every progress event, `loading: null` when the city is ready. Scribe publishes `stage` (`city`, `instances`, `quests`) with `done` and `total`; the history is the premise call before them. Name the stages in the player's words: writing the history, laying out the city, writing the places, writing the quests |
| 105 | Announce a busy model apart from a failure | app, sidecar | hud | `hud.announce({ kind: 'model-busy', retryIn: seconds })` on a 429 or a backoff, drawn as a wait with the seconds counting down and kept up for the whole wait; `hud.announce({ kind: 'error', text })` on a real failure, drawn warned. Never the same notice for both |
| 106 | The controls tab lists what the game pushes: put G, T, K and P on it | app | hud | The hud lists its own keys (J, M, I, X, O, ?, N, Esc, Enter, Tab). `patch.controls` must carry the game's: G (the way to the tracked quest), T (turn the time of day), K (change the weather), P (hold the clock), and the rest of `game/app/src/controls.ts`. Do not list N or I there: the interface owns them |
| 107 | Call `land.setTime` every frame with the fractional hour, and carry the environment off `land.light` between prefilters | app | `land.setTime(clock.secondsOfDay / 3600)` in the frame loop, not on the hour turn: every value the land writes is now a smooth function of the real hour (measured under a hundredth of a light unit a frame at 1/900 h). Between prefilters set `environmentRotation.y = land.light.sunYaw - yawAtFilter` and `environmentIntensity = base * land.light.skyBrightness / brightnessAtFilter`; refilter on the hour and on a weather change. `skyBrightness` is the dome's mean radiance in its own units, 1.59 at the temperate noon, 0.019 at midnight |
| 108 | Give the day its own grade and exposure | app | The dome at noon is not flat: zenith `(0.10, 0.33, 0.95)`, horizon `(1.30, 1.79, 1.94)`, a five to one gradient, and the sun casts at 3.1 with the shadow map at full strength from 08:00 to 16:00 (temperate). What `daylight_cartoonish.png` shows on top of that is exposure and grade, which is a hypothesis this box cannot measure. The day is now short and low (07:25 to 16:35, noon 24 degrees, warm morning, cold afternoon) so the grade has nine hours to cover, not twelve |
| 109 | `DAY_PHASES` and the `T` key's four stops sit off the sun | play, app | Sunrise is 07:25 and sunset 16:35 on the temperate theme (06:32 to 17:28 arid, 07:44 to 16:16 maritime), so `dawn` at 05:00 to 06:59 is full night and a jump to `dusk` at 17:00 lands after the sun is down. `land.light.sunrise` and `land.light.sunset` publish the hours if the phases or the stops want to follow the sky |
| 110 | The verge now meets the pavement at 0.15 m, the road at zero, and rises away from both | scene, nav | A kerb scene draws against a `mountain` cell down to zero is buried inside the verge and can go; the `mountains` stand-in ring is unaffected. The verge is a bank of slope under 0.1, walkable, which is row 21's disagreement with nav restated with numbers |
| 125 | Light a downward-facing surface: a ceiling fill | scene, app | Measured off furnish's probe: it lays 0.079 (corpo) and 0.045 (home) on an upward face and 0.0084 and 0.0056 on a downward one, so a matte ceiling lit by it alone reads 0.0006 and 0.0015 linear, black, and the probe cannot give more without becoming a light (its picture averages under a tenth by contract). Floors and walls on screen are lit by the sun, the sky and the moon ambient at ten to twenty times that, and none of it reaches a downward normal: the prefiltered sky's lower half is black by design (land contract line 88) and `Land.skyLight` is taken down (app contract line 84). A fill on downward normals at about a third of the ambient (a hemisphere ground term, or the environment's lower half painted with the ground's bounce) is what makes a ceiling read; furnish lifted the corpo lid to 0x4a4d52 (0.076 linear, from 0.020) so a fill can show it. Hypothesis, unmeasured in the game frame: the same fill lights soffits and the undersides of balconies outdoors |
| 126 | Publish the interior's `finish` so furnish stops reading the building kind | world | Furnish dresses a room in `finishOf(interior.kind)`: `home` for apartment, house and hotel, `corpo` for the rest (`game/furnish/src/style/finish.ts`, exhaustive over `BUILDING_KINDS`). PLACES section 2's `finish` (`domestic`, `civic`, `industrial`, `corporate`, `worn`) replaces that table the day the interior carries it |
| 127 | The mattress is 1.970 m of level pad in corpo and 1.934 m in home, measured off the drawn triangles | forge | Forge's contract line 62 says 1.837 m and a 4.2 cm overhang at each end; a 1.92 m body now lies inside the pad in both languages, so that text is stale. Row 86 is closed on furnish's side and its test holds the pad at 1.92 m or more |
| 128 | `docs/PIPELINE.md` line 203 says interior props are still the Fantasy MegaKit and the Dungeon Pack | docs | Measured by grep over `game/furnish`: every one of the 24 props, 25 carried things and 7 shelf things is drawn through `Solid.block`; the one model file the box reads (`interior-kit.glb`) carries four tiling images and no mesh. The row is stale and the feature in PENDING ("Theme-appropriate props indoors") is done |
| 129 | Give each car a `footprint` in the crowd's `Hazards` feed | app | `@gb/crowd` 0.8.0 keeps walkers out of cars: `{ x, z, vx, vz, radius: 2.25, footprint: { length: METRICS.vehicle.carLength, width: METRICS.vehicle.carWidth, heading: car.heading } }` per `@gb/traffic` car; the heading is the car's own `rotation.y`, either nose convention. Without the footprint a car is a 2.25 m circle, which still keeps people out of it but pushes them off the kerb lane's side. Include the player's parked car (`@gb/drive`) at speed zero so nobody walks through it and no companion is placed in it. `near()` is now asked once a frame at about 80 m plus the kerb looks, so one reused array is fine |
| 130 | Somebody indoors who agrees to come along: `crowd.follow({ npc, door: plotId })` | app | `plotId` is `world.interior(npc.station.interiorId).plotId`. The body appears on that plot's doorstep (`entrance.cell`) and walks over to the player. No `at` needed; `at` still wins when given. A plot with no doorstep on the pavement sets off from the player |
| 131 | Where a walker is heading, for the conversation | app, talk | `crowd.destination(npcId)` is `{ plotId, arrived }` or undefined (nowhere in particular, or a companion). `world.plot(plotId).name` is the place; `arrived` means they are standing at its door. Ask it when the conversation opens. The errand text is the generator's (`life.errand` on the `Npc`, forge); the crowd publishes only the fact |
| 132 | `held === false` is the one end signal, and it now fires when the player walks off | app | Once the player has been within `talkRadius` (5 m, `crowd.options.talkRadius`) of a held walker, going further than that ends the hold the same frame, and the walker goes on their way. If the app talks to people from further off than 5 m, pass a larger `talkRadius` or the hold ends at once. Indoors, the crowd has no body: `new Leash(crowd.options.talkRadius)`, `reset()` on open, `gone(player.x - post.x, player.z - post.z)` each frame, `talking.end()` when it is true |
| 125 | Read `turn` instead of `said`, and draw `does` apart from `says` | hud, app | `@gb/talk` publishes `{ kind: 'turn', does?, says }` for every spoken turn, `does` being a few words of stage direction ("wipes the counter") and `says` the speech. `said` still carries the same words for the move across and goes once nothing reads it. `TalkPatch` needs a place for `does` that does not read as dialogue |
| 126 | One `Sessions` per playthrough, `does` to the gesture layer, `learned` to the codex | app | `new Sessions()` from `@gb/talk` once per playthrough and pass it as `sessions` on every `Conversation.open`, so walking back up to somebody carries on their own transcript and nobody hears another's. On a `turn` event hand `does` to the gesture layer (prose, may map to nothing). `open` now returns `learned` (fact ids earned by meeting) and turns publish `learned { npcId, factId }`: refresh the codex on both |
| 127 | A background fact's id is its index in `npc.background`, as a string | hud | `'0'`, `'1'`, ... counted from 0, which is what `player.unlocked(npcId)` and `learned.factId` carry. The codex draws `npc.background[Number(id)].fact` |
| 128 | Measure whether one `Conversation` or one npc id is held across openings | app | Reproduced inside talk with the sidecar up on 2026-08-25: two `open` calls in two buildings sent two briefs naming the right person, room and spot each time, and talk keeps nothing across speakers. So the stale-context report ("answers as if in the previous building") is not talk's lifetime. Hypothesis, unmeasured: the caller reuses a `Conversation` or the npc id it opened last. Print `conversation.npcId` on every E press against the person in reach |
| 129 | Write `life.reason` and `life.errand` as one sentence the person could say out loud, first person | forge, scribe | Talk says `reason` as the greeting's middle beat exactly as written (first letter capitalised, full stop added), so "I'm covering the day shift while Rook is away" works and "she covers the day shift" does not. The city built for talk's live measurement (seed `talk-live`, 14 people, 2026-08-25) carried 0 `life` and 0 `background`: row 113 is still open, and until it lands every person answers off `personality` and `knowledge` alone |
| 130 | `Anchor.doing`, the free phrase from PLACES.md stage 1 | world | Talk fills "what you are doing" from the anchor kind today and prefers `life.reason` for the greeting; once the schema carries `Anchor.doing` talk reads it for the stance line, for the speaker and for everybody else in the room |
| 133 | Push `compass: { facing, goal }` from the body's yaw and the guide | app | hud draws a strip along the top: `facing` in radians clockwise from north, `goal: { label, bearing, distance, line }` for the tracked quest with `bearing` in the same unit (the compass point of the route's first stretch, as `G` answers it), `distance` in metres along the walk, `line` the quest's `kind`. Push it on every turn of the player and every re-resolve of the guide; `compass: null` with no city and indoors, where the route is measured from the door |
| 134 | Mark the plan's goals with `line`, pin every live quest, and name the plots that earn it | app | `MapMark` on a goal takes `line: 'main' \| 'side'` (left out reads as side) and the hud draws the two apart, so pin the open steps of every quest with work, not only the tracked one. `MapPlot` takes `label` (read on hover) plus `named: true` for the ones written on the plan: places in `player.discovered().places`, quest targets, and landmarks; and `prominence: 'background' \| 'notable' \| 'landmark'` from the charter once `@gb/world` publishes it (PLACES.md stage 1), left out reads as background |
| 135 | The codex is pushed as places, people and history, never as `entries` | app | `codex: { places: [{ id, name, text }], people: [{ id, name, role, disposition, facts }], history?: [{ id, title, text }] }` from `player.discovered()`: `disposition` is `player.disposition(npcId)`, `facts` is every staged fact of the person (row 96) as `{ id, text }` for the ids in `unlocked` and `{ id }` for the rest, so the hud can draw the locked ones as locked. Replaces the `entries` shape in rows 100 and 103 |
| 136 | Take `lights?(plot, size): LightEmitter[]` on the `Dressing` seam and light walls from it | scene | `@gb/prefab` publishes `PrefabDressing.lights(plot, size)`, asked after `building` for that plot: `kind` (`entrance`, `screen`, and `@gb/kitbash`'s `sign`, `strip`, `doorlamp` for the signs it hung), `position` metres in the building's own frame 20 cm off the lit face, `colour` packed `0xRRGGBB`, `intensity` candela at full dark, `radius` metres (0.1 lux, at most 16). Scale by `city.night`; the pack has no point lights of its own and the emissive pass carries the look alone today (PENDING 447-477, 205-229). `@gb/kitbash`'s `lightsFor` is the same shape, so one type serves both dressings |
| 137 | The door columns were the pack's own tubes, not the kit's; closed | kitbash | Measured on pack 1.5.0: `corpo-a-6x10x2` carried a cyan tube at x 0 from 0 to 4 m through the middle of its door, `shop-b-8x12x2` magenta tubes at x plus or minus 1.0 on a door 2.2 m wide. Pack 1.6.0 has no tube below the parapet on any of 512 models. Kitbash's door lamps are the only lit thing beside a prefab door now; nothing to do there |
| 138 | `sit-drink` now sits at `stoolHeight`: put its anchors back on bar stools | forge | `Sitting_Stool_Loop` and the three clips posed from it put the hips on a 0.75 pad with the chair clip's 2.7 cm of give and the chair clip's root-to-hips offset (0.33 m behind the root), so a stool anchor is placed exactly like a chair anchor 0.30 m up. A `sit-drink` anchor left on a chair floats its body 0.30 m; a bar's `sit` anchors stay chairs. Cast contract, "Sitting on a stool", measured on all twelve dressed characters |
| 139 | The stool's rail: soles rest 0.37 m under the pad, 0.38 m off the floor | furnish | The seated feet tuck back under the seat (ankles 0.18 m ahead of the hips, knees at 56 degrees) and want a rail at 0.38 m to stand on; a bar stool drawn with its rail there reads as sat on. Cast contract, "Sitting on a stool" |
| 140 | Where the new browse and work-bench clips reach | forge | `Crouch_Idle_Loop` (on `browse` and `lean`) puts the head 0.21 m ahead of the root at 0.84 m and the hips 0.28 m behind it; `Farm_Harvest` (on `browse`) dips a hand to 0.28 m at 0.31 m ahead of the root; `Kneel_Fix_Loop` (on `work-bench`) works both hands at the root at knee height and kneels from 0.5 to 1.0 m behind it. A browse anchor closer than 0.25 m to its shelf face, or a bench with less than 1.0 m of floor behind its anchor, puts a body through furniture. Cast contract, "Reaching a work surface" |
| 141 | Draw walks from `walkFor(npcId)` and pace them with `member.pace(metresPerSecond)` | crowd | `WALKS` is `Walk_Loop` and `Walk_Formal_Loop`, drawn per id so a street is not in step; `GAITS` carries every moving clip's authored ground speed (walks 0.98, carry 0.65, push 0.30, jog 5.9, sprint 8.9 m/s) and `pace` scales the clip toward the body's real speed, held between 0.7 and 1.4. `Push_Loop` comes with a trolley in front (the handle at 1.17 m, the cage 0.58 to 1.28 m ahead of the root): give it to the odd courier at 0.3 m/s. Cast contract, "Moving along" and "Things in hands" |
| 142 | Call `member.attend(point)` when a conversation opens on a stationed person and `member.resume()` when it closes | app | A bent-over or leaning body comes up to the relaxed idle and turns to the point inside its object (the object's position and heading are never touched); a seated body stays seated at its own height and turns its head and chest, or stands up through `Sitting_Exit` when the point is behind it; a sleeper stays lying. `lookAt` alone leaves a desk worker bent over the desk with the face turned. Cast contract, "Being spoken to" |
| 143 | `stoolHeight` now carries a stance | world | Contract line "One height carries no stance at all": `Sitting_Stool_Loop` sits the hips on a 0.75 pad (underside 0.723, the same give as the chair) with the soles 0.37 m under it. Add the row to the reach table: `stoolHeight`, sat on a stool with the feet on a rail, hips on the pad, soles at 0.38 |
| 144 | Hero bodies wear the plain bodies' clothes until outfits are cut for them | cast | Pass 2. `chooseCharacter` hands `hero-male` a `male` outfit and `hero-female` a `female` one (`tests/wardrobe.test.ts`); both hero files in `wardrobe.json` are the Superhero bodies the plain kinds already use, so a hero body needs its own body file and outfits before it looks like anything else |
| 145 | `BODY_KINDS` names four bodies; the shipped pack has two | world | Measured on `Universal Base Characters[Standard].zip`: `Superhero_Male_FullBody` and `Superhero_Female_FullBody` are the only bodies in it (glTF for Godot-UE and FBX for Unity, the same two), and the "four" are those two meshes with a Light and a Dark skin sheet each under `Textures/`. `game/cast/wardrobe.json` already builds `male` and `female` from those two files, so `hero-male` and `hero-female` are the `male` and `female` mesh under another name: cast dresses them off the plain rails and they look the same. Contract line 196 ("the four bodies of the shipped pack") is stale; by its own rule (every value maps to something the game can render) the two hero kinds either stay as names for the plain mesh or come out of the closed list. Cast compiles either way: `RAIL` in `game/cast/src/wardrobe.ts` is exhaustive over `BODY_KINDS` |
| 146 | Writing `hero-male` or `hero-female` in `populate` spawns, dresses and animates, and changes nothing on screen | forge | Cast contract, "The bodies": a hero base dresses from the plain rail of the same sex (guard, works, courier and the other nine outfits), same mesh, same heights. Write them for the heavy roles only if world keeps the kinds (row 145); a bouncer looks heavier the day a pack with a second build is on disk, and cast then cuts a rail for it |
| 147 | `tests/support/stub-cast.ts` fails `pnpm run typecheck` against `CastMember` 0.8 | crowd | `StubMember` lacks `holding`, `pace`, `attend`, `resume`, `attending` (TS2420 at line 19, TS2739 at line 65). The full shape is the contract's Outputs row for `spawn`; `pace` and `attend` are rows 141 and 142 |
| 148 | Keep everybody in `questTargets(log.objectives())` at their post when sending a third of the town out | app | `@gb/forge` publishes `questTargets(objectives)`: every `npcId` on an open line of the board. Measured on the 8x8 harness town with the harness's copy of the app's rule (roster order, a third out, never the last one out of a room): 43 of 43 quests completable at their posts, 43 of 43 with those people kept in, 23 of 43 with nobody kept and 21 jobs sent to an empty room. Re-read the set whenever the board changes, which is when a step opens |
| 149 | Send a `clock` reading before a quest is taken, and on every tick after | app | The quest log counts a timer from the last `clock` it heard. Measured in the harness: a log that heard no clock before `start` failed a 15,300 s escort on its first tick (the reading jumped from nothing to 29,400); one told the clock first finished it. The harness sends `clock { seconds: state.clock.totalSeconds }` right after `QuestLog.create` and after every verb |
| 150 | A counter sells what it owns: build the buy from `item.ownerNpcId` and `item.value` | app, hud | Every item lying in a place with a `serve` anchor belongs to the person on it (`ownerNpcId`) and carries `value`, whole credits, the price that counter sells it for (`src/prices.ts`: a cup 3, a crate 40, a gem 300, moved up to 30% by the seed). An item with no owner is not for sale. Taking an owned item without paying is the theft the quests already use. Measured on a 5x5 neon town: 34 items, 34 priced, 19 sellers |
| 151 | Fill `life` and `background` on the people `describeNpc` and `writeInstances` write, and keep the singular path's names unique | scribe | `NpcProfile.life` is `@gb/world`'s `Life` (history, interests, manner, cares, avoids, reason, errand; `reason` and `errand` first person, one sentence talk says out loud) and `NpcProfile.background` its staged facts (`met`, `talked`, `quest`, `told`). `namePlace` and `describeNpc` are now handed `premise` (the story as `premiseLines` renders it). Measured on 2026-08-25 through the sidecar, a `Scribe` asked only its single-place questions on a 2x2 town: 16 people, 0 with a life, and two named "Kaelen" (the singular `describeNpc` has no roster; the plural path's uniqueness does not reach it). The offline narrator writes both fields for everybody; `src/narrator/lives.ts` and `background.ts` are the reference shape |
| 152 | Hand `brief` and `asks` to the narrator | forge | `writePremise({ theme, seed, brief?, asks? })`: scribe puts the owner's `brief` in the history prompt verbatim and `asks.tone`, `asks.mainQuest` and `asks.style` beside it; and `WorldSummary.asks?` (`summarise` reads it off `world.asks()`), which the quest writer reads for `mainQuest` (the main line's call), `sideQuests` (each side errand's call) and `tone` (every call). Both are optional on scribe's side already; a summary without `asks` asks nothing of the model |
| 153 | Name the shut buildings through `namePlaces` when the narrator has it | forge | `Scribe.namePlaces(requests)` takes `{ kind, theme, index, street?, premise? }` per plot (`index` is the plot's own number, `street` the road its door is on when the plan knows it, `premise` as `premiseLines` renders it) and hands back one sign per request in request order, twenty to a model call, with the history in front of the model and no head word twice across the city (the model's own signs and the ones the offline composer mends alike). Measured on one live 1x1 town: 9 signs, 9 distinct heads, five shapes (The X Y 3, possessive 3, family firm 1, number 1, plain trade 1), 7.8 s for a batch of 5. The offline composer stays the fallback for a sign the model repeats or a batch it will not write |
| 154 | The loader's stage ids are now `history`, `city`, `places`, `quests` | app, hud | `ScribeStage` renamed: the history is its own stage (1 answer), `city` is the name and then every sign batch (one bar that grows: 0/1, 1/1, then 1/41 ... 41/41), `places` the instances, `quests` the quests. Every stage ends with `done === total` and each event carries `what` |
| 155 | A forced `tool_choice` is not enforced on the local path | host | Measured on 2026-08-25 against llama-server through the sidecar with the quest tool (both the 10,779-character compacted schema and the 37,854-character expanded one) and with a 400-character flat schema: of 13 calls, 6 came back as `finish_reason: stop` with a ```json block in `content` and no `tool_calls`, and the ones that did call the tool wrote `next` as a string against a schema that says array. Which way a call goes is fixed by the seed (the same seed always gives the same shape), so it is a sampling draw and not the schema. Hypothesis: the engine is not handed a grammar for the forced tool. Scribe now retries prose on the next attempt's seed; a grammar on the host would make every attempt count |
| 156 | Build the mix, the storeys, the rooms and the stock off `world.charters()`, and declare the charters before the first plot | forge | PLACES stage 2. `World.found({ charters })` or `world.recordCharters(list)` before `addPlot`: a plot whose word no charter declares is refused (`unknown-reference`), and a file that carries `charters` is read against those alone, so the presets a town uses go in the list beside the invented ones (`SHIPPED_CHARTERS` is the fourteen, resolved). Three things the charter shape does not carry, measured while transcribing: hall sizing (`foyer` for restaurant and office, `lobby` for clinic and hotel) is not a field, so key it on the hall's `use` or the storeys; `STOCK`'s pool order is not reproducible through `HOLDING_ARCHETYPES` (bar's `bottle, glass, ledger, cash` becomes drink plus papers plus valuables, eight archetypes), so the golden hash of invariant 2 moves on items unless the preset's pool is drawn another way; a bar's `Cellar` and a shop's `Back room` keep their labels through the charter room's `kind` (`roomKindOf(spec)`), the rest cut to `ROOM_USE_KIND[use]`. Every preset is `access: open`, which is every door today |
| 157 | Read `built`, `signage` and `blade` off `world.charter(plot.kind)` | kitbash | `RECIPES`, `SIGNAGE` and `TRADE_WORD` are typed on `BuildingKind` and `plot.kind` is now a word: `src/compose/plan.ts` and `src/sign/plan.ts` fail `pnpm run typecheck` (TS7053, TS2345). `ResolvedCharter.built` is the `Recipe` shape exactly (`street`, `flank`, `upper` as `{ plain, window, rhythm }`, `crown?`, `fascia`, `door`, every piece in `KIT_PIECES`), `signage` is the `Signage` shape, `blade` the word. The fourteen presets carry today's rows verbatim |
| 158 | Read `tint` off the charter and pass `built`, `signage`, `blade` and `tint` through the `Dressing.building` seam | scene | `src/dressing.ts` `BUILDING_TINT` indexes `Partial<Record<BuildingKind, number>>` by a word and fails typecheck (TS7053). `world.charter(plot.kind).tint` is the same packed colour, presets carry today's fourteen |
| 159 | Match looks on `charter.suits`, not on a kind enum | prefab | `src/catalogue.ts` fails typecheck (TS2345: a word is not a `BuildingKind`). `suits` is sorted lowercase tags; every preset's list holds its own word (`bar`, `house`) plus its frontage, material, sprawl and prominence, so a look tagged with the fourteen words keeps matching |
| 160 | Type `PlaceRequest.kind` and the premise prompt on the word, and ask the model for charters against `CharterSchema` | scribe | `tools/measure.ts` fails typecheck (TS2322: `kind: string` into `PlaceRequest`); `src/premise.ts` joins `BUILDING_KINDS`, which is now the preset word list only. `charterContract.jsonSchema()` is the tool schema for a charter: twelve enums, two clamped numbers, bounded text |
| 161 | Dress rooms from `finish` and `room.use`, and keep today's picture while doing it | furnish | `src/dressing.ts` and `tests/contract.test.ts` fail typecheck (TS2345: `interior.kind` is a word). `world.charter(interior.kind).finish` is `domestic` for house, apartment and hotel and `corporate`, `civic` or `industrial` for the other eleven, so `home` for `domestic` and `corpo` for the rest is today's table; `roomUseOf(room, charter)` names the routine for a file that left `Room.use` out. Closes row 126 |
| 162 | Read `anchor.doing` for the stance line when it is there | talk | `Anchor.doing` is optional free text, 300 characters, on every anchor in the file; the forge writes it when a charter's room wants a phrase. Closes row 130 |
| 163 | `MapPlot.prominence` comes from `world.charter(plot.kind).prominence` | app, hud | `background`, `notable` or `landmark` (`PROMINENCES`); the presets mark station and chapel `landmark`, bar, clinic, hotel and market `notable`. Closes the world half of row 134 |
