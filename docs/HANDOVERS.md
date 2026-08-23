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
| 33 | `talk/src/greet.ts:26` emits `talked` with no topic, so a topic'd step still cannot complete through a real conversation | scene-batch agent | talk | the objective now names the topic; talk must forward it |
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
