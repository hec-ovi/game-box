# Pending

## The definitive list (2026-08-23, evening)

Everything below is checked against the code, not against a report. Ordered by
what a player notices.

### Blockers: things that lose work or contradict the direction

1. **A refresh with the model on wipes the playthrough.** Nothing pins the
   sampler, so the city regenerates differently, the hash changes, resume
   refuses and the save is cleared. The host takes a temperature; nothing sets
   one. Boxes: `host`, `sidecar`, `bundle`.
2. **Neon lights nothing.** There is no `PointLight`, `SpotLight` or
   `RectAreaLight` anywhere in the game, so a wall beside a burning sign is lit
   by moonlight. The whole art direction is "neon is the light source". Boxes:
   `kitbash`, `scene`.
3. **No loader.** `@gb/scribe` publishes a progress port, tested, and nothing
   passes it, so minutes of model work sit behind one static line instead of
   "generating the city, generating locations, generating the main quest". Box:
   `app`.

### Features asked for, no code

4. **Packs.** The blocker is gone (a world file records what it was built from
   and every plot is pinned), but nothing packages a pack or applies one.
5. **Open place kinds.** A city should contain a jail or a university because
   the premise called for one, with neither word in the engine. In design; the
   evidence is `docs/PLACES-SURVEY.md`.
6. **Minigames**, and a score that survives.
7. **Lip sync.**
8. **Real windows and balconies.** The pane is a 1.5 cm opaque emissive slab;
   balconies are filtered out of the building pack.
9. **Streaming or level of detail.** Everything loads at open.
10. **The second wave** (his own notes, section below): usable terminals and
    computers, security cameras, hacking and passwords, doors with steel bars,
    access cards, credits and buying, quest-unlocked cars and items, subway
    fast travel, an apartment of your own.

### Small and known, with a measurement behind each

11. **No clip sits a body on a raised seat**, so bar stools are 33 cm out (four
    in a nine-plot city). `@gb/forge` anchors `sit-drink` on chairs meanwhile.
    Box: `cast`.
12. **The bed is 6 cm too short**: pad 1.837 m against a 1.92 m body with boots.
    Boxes: `furnish`, then `forge` follows.
13. **Worktops rise 10 cm** now that `worktopHeight` is measured at 1.0. What
    needs a look: anything drawn under a worktop, and whether a shelf's ledges
    still fit. Box: `furnish`.
14. **Play the nod and the shake** on `@gb/talk`'s new `answered` event. One
    case in the event loop. Box: `app`.
15. **`Game`'s constructor still has no test** without a headless seam; it has
    cost two shipped crashes. In flight.

### Red when the day ended (2026-08-23, 19:05)

Four tests, all one cause: `METRICS.worktopHeight` went 0.9 to 1.0 and the
geometry drawn against it moved. `@gb/furnish` was mid-pass on exactly this when
the day ended, so some of it may already be gone.

- `game/furnish/tests/heights.test.ts` — with furnish; the assertion is also
  unsatisfiable for a second reason (7 is now the reachable maximum).
- `game/scene/tests/blockers.test.ts` and `pickups.test.ts` (x2) — downstream of
  furnish's geometry. Needs a scene pass **after** furnish lands, not before.

`game/bundle/tests/published-schema.test.ts` was the fifth and is fixed: the
schema embeds `@gb/world`'s shapes and went stale when the premise field landed.
Regenerated and pushed.

Everything else: 954 of 959 green, `tsc --noEmit` clean, isolation clean across
22 boxes and 712 files.

### OpenRouter: verified working, two things to settle (2026-08-23, 19:40)

The endpoint is live. `stealth/ox-alpha` served a reply in 1.26 s at zero cost,
key authenticating, provider Stealth. The 404 that came first was an account
data-policy setting, not our code: every model returned it, and
https://openrouter.ai/settings/privacy cleared it.

Two probes did not pass and neither is settled:

- **A forced tool call came back empty.** `tool_choice` naming the function
  returned `content: null` with no `tool_calls` array. The owner says the model
  does support tool calls, so the probe was probably wrong, not the model:
  likely candidates are needing `stream: true` (the whole pipeline streams),
  the reasoning field carrying the call, or a shape difference from
  llama-server. **This is the first thing to check next session**, because every
  generated thing in the project is a forced tool call whose parameters are the
  validating contract's JSON Schema. Nothing works through OpenRouter until it
  does.
- **`seed` plus `temperature: 0` did not reproduce.** Three identical requests
  gave three different answers. So the hosted path is not automatically the
  easy answer to determinism, and the honest fallback stands: `Bundle.resume`
  tolerating a regenerated city rather than clearing the save.

`.env` exists at the repo root, gitignored, holding `OPENROUTER_API_KEY`,
`GAME_BOX_LLM_UPSTREAM` and `GAME_BOX_PORT`. Nothing loads it yet: the host
reads `process.env` directly, so it needs exporting or Node 22's `--env-file`.
The agent wiring OpenRouter into `host/` has that plus keeping the key out of
every error path.

### Running right now

`prefab` assigning twelve facade materials across eight looks and regenerating
the entrance door; `scribe` writing the model-backed premise; `cast` putting the
generated fabric on roughness; `forge` moving to world's `Premise` and
correcting a false contract claim; `app` building the headless seam; and a
twelve-agent design for open place kinds.


Everything known to be unfinished, by box. Delete a line when it is done.

## What to weigh work against

Flexibility and stability at scale come first. A change that makes the city
easier to regenerate, easier to grow, or safe at fifty blocks is worth more
than any single piece of surface detail. Polish a street lamp only when the
street it stands on is solid.

Concretely, in order:
1. Generating a new city, with new places and new quests, has to be easy and
   has to give a different place each time.
2. It has to hold together as the city gets bigger.
3. It has to export and reopen as the same world for somebody else.
4. Then the way it looks.

## Bugs on screen

| What | Box | Diagnosis |
|---|---|---|
| A white container frames the whole screen | unknown | Reported 2026-08-23. Not yet diagnosed. |
| Pavement lies on top of the road at junctions | `forge` | Junctions are painted after the bands, so 51 of 54 junction arm cells are pavement sitting on the roadway, 204 m2 in the small city and 1,524 m2 at 7x7. North-south streets only, because the row pass runs last. Cars also drive through a 15 cm kerb at every junction. This is PLAN task 3 and is the screenshot he keeps sending. |
| Street NPCs still do not talk | `app` | The crowd fixed its half: walkers carry real `Npc` ids now and `Crowd.person(id)` resolves them. The app needs one line to use it. |
| A car that touches you holds you in place | `app`, and `traffic` behind it | Once your centre is inside the car's rectangle every candidate position reads solid, so nothing can move you. Fixed in `walk.ts` by letting any step through that does not bury you deeper. The deeper fault is that a car should not drive onto you at all: `traffic` is given the player as an obstacle and still overlaps. |
| You can see under the pavement where it meets the verge | `scene` and `land` disagree | `scene` treats a `mountain` cell as 24 m tall when deciding kerbs, so it draws no kerb face there; `land` now lays that cell flat at ground level. About 172 cell-edges of 15 cm gap around the outer ring, and now on the road out of town too. |
| Cars drive out of town and vanish in plain sight | `traffic` | A car that runs out of graph is retired. The exit road now reaches the map edge, so it happens about 10 m past the last building. Traffic already defers retiring a stuck car until the player cannot see it; the same rule fits. |
| `nav` calls a mountain cell impassable, `land` calls it walkable verge | `nav` and `land` disagree | Does not block walking out, since the corridor is street and pavement the whole way, but the two boxes describe the same cells differently. |
| NPC clothing is medieval | `cast` | The only clothing we ship is Quaternius Modular Character Outfits **Fantasy**: Peasant and Ranger, two genders. |

## Next up

- **Two boxes hold the same prop sizes and they have drifted.** `@gb/forge`'s `PROP_SPECS` and `@gb/furnish`'s disagree. Worst is `table`: forge plans 1.6 x 0.9, furnish draws 1.0 x 1.0, so a chair approached along the table's width sits about 0.4 m off its edge. Also stove, fridge, sink, cabinet, bar-stool and sofa depth. Furnish's contract already claims its specs are "what `@gb/forge` places from", which is not true today. Forge cannot simply read furnish's, because that would put `three` in the headless generator's runtime. The likely answer is a small shared box holding cells, contact height and `onSurface` with no renderer dependency, which both read. This is the same "two boxes holding one number" fault that caused the floating arms and the low seats, so it is worth fixing properly rather than syncing the copies.
- **`@gb/forge` still serialises the narrator.** Peak concurrency 1 across a whole build, four of five llama slots idle, and the descriptive calls are 85% of model wall clock. `@gb/scribe`'s wave runner already fans out and will use the full width the moment forge issues `namePlace` and `describeNpc` / `describeItem` with `Promise.all`. Must reassemble by index, never by arrival, or determinism goes.

- **The vocabulary of places, for a cyberpunk city.** He named what he wants: "a hospital, a police station, an office, a corporate office, a nightclub". Today `BUILDING_KINDS` is house, apartment, bar, cafe, restaurant, shop, market, office, workshop, warehouse, clinic, hotel, station, chapel. Some of that is a market town rather than a city: a chapel is doubtful, a clinic wants to become a hospital, and there is no police station, no corporate tower and no nightclub. One coherent task across four boxes: the enum in `@gb/world`, the weights and staples and interior programmes in `@gb/forge`, a dresser per new kind in `@gb/furnish`, and a trade word for the sign in `@gb/kitbash`. A place is worth adding only if it changes what happens there, so each new kind needs its own rooms, its own staff role, and a reason a quest would send you.

- **A TV that plays something.** `tv` is already in the prop vocabulary and `@gb/furnish` already generates its geometry; what it lacks is a screen with moving pictures. Queued behind that box's wall and floor pass. Approach to weigh when it starts: a generated animated screen (a broadcast, a ticker, glitch, colour bars) costs no download, carries no licence question and suits a cyberpunk room, against a real video file which would have to be CC0 or ours and would sit in a world file that people hand to each other. A screen is also emissive, so it will bloom and light the room, which is worth more than the picture itself.

## Small, found by agents, nobody assigned

- `work-desk` is one anchor kind covering two stances: seated at an office chair, and standing at a workshop bench. `CLIP_FOR_ANCHOR` maps one clip per kind, so one of the two is playing the wrong animation today. Splitting it is an `ANCHOR_KINDS` value in `@gb/world` plus a clip in `@gb/cast`, and it breaks cast's exhaustive map, so it needs both boxes.
- A till and a coffee machine cannot stand on a counter: `Furniture` carries only a position and a rotation, so the planner could only put them on the floor, and it now omits them. Needs a lift field in `@gb/world` and `@gb/scene` drawing at the host prop's contact height.
- The bar counter is 1.100 while the rail clip's hands are at 1.02 to 1.04, so forearms pass through its front face. The 1.0 service counter is correct. Either the bar counter drops to 1.0 or it needs its own lean clip.

- `@gb/quest`: a `talk` step with a `topic` is only credited by a `talked` event carrying the same topic, but `objectives()` does not publish `topic`, so no caller can ever complete one. Publish it or drop the match. `forge` works around it by emitting no topics.
- `@gb/quest`: an `any-of` needs both branches reachable through `next` from the start AND pointing back at the any-of step. Neither the contract nor its two error messages say so; it cost an agent three attempts to find the shape.
- `@gb/nav`: `tests/contract.test.ts:125` does `plotsOfKind('bar')[0]!` on a generated town, so it assumes a building kind exists. Seeded staples nearly broke it; forge now keeps a bar in every town as a documented invariant, but the test should not lean on that.
- Quests never pay in items, because nothing removes a rewarded item from the shelf it lies on and paying in goods would duplicate it. Revisit when the app owns pickup.

## Traps found, worth knowing

- **`material.onBeforeCompile` does nothing under `WebGPURenderer`**, on either backend. It fails silently, so a material looks untouched rather than broken. Use `contextNode` with TSL instead. Only `furnish` had it; it is fixed.
- **The root `.gitignore` `build/` rule swallows any `src/build/` folder.** It had kept part of `kitbash` out of the repo entirely. Anchoring `/build/`, `/dist/` and `/target/` at the root is the general fix and nobody owns it yet.
- **New files written by an agent do not get committed** if it is told to stage explicit paths. Seventeen source files across cast, play and traffic were left untracked and a fresh clone could not build. Brief agents to run `git status --untracked-files=all` before finishing.
- **`THREE.Points` draws as single device pixels on a real WebGPU adapter.** r185 maps `Points` to `point-list` topology, which has no point size. Fine on the WebGL2 fallback this machine uses, so the stars are only at risk if we ever run on true WebGPU; the cure is `Points2` / `InstancedPointsNodeMaterial`.
- **A far plane does not buy depth precision.** Resolution at distance is `(d^2/n)(1 - n/f)/2^bits`; once far is much larger than near, moving far changes almost nothing. The near plane is the lever.
- **`@gb/kit`'s `Rng.int(min, max)` is half-open** and the contract does not say so. One word would save the next caller an off-by-one.

## Features asked for, not started

| What | Box | Note |
|---|---|---|
| Interior surfaces should carry metre UVs | `scene` | Ground meshes already do; interiors get 0-to-1 planes, which is why furnish needs a shader rule at all. `Dressing.surface(part)` passes no size. |
| Theme-appropriate props indoors | `furnish` | Fantasy Props MegaKit and Dungeon Pack are wrong for a modern city. |
| NPC daily routines | `crowd` | People go somewhere for a reason at a given hour. |
| Head turns to the player on click | `cast` | Asked for early; lip sync and gestures after. |
| Grow the city while playing | `app` + `scene` | `Forge.extend(world, count)` exists and is tested. Nothing consumes it. The scene cannot yet accept new plots without a rebuild. |
| Premise layer: why this town exists | new box | Offered, not approved. Buildings, people, quests and routines would follow from it. |

## Decisions taken this session

- The world is a **modern city**. Cars, streets and the Downtown City kit already suit it; clothing and interior props do not.
- **Buildings come from `glb-buildings`** (the user's own MIT toolkit) at world-creation time only, never at play time. 2.5 to 9 minutes of model time per building.
- **A capped library, not one building per plot.** Around 20 models chosen by role (corner block, mid-rise office, low retail, warehouse, tower, apartment slab), repeated across plots with rotation, mirroring, storey count and colour sheet for variation. SynthCity ships 15 and reads as a metropolis.
- **Per-draw cost is the budget, not draw count.** SynthCity holds thousands of draws because each is one mesh, one shared material, ~400 triangles. Our GLB buildings are 13 to 18 meshes and 11 to 15 materials each, which is the thing to fix. `join()` and `palette()` from gltf-transform collapse a building to one mesh and one material at build time; both are already installed.
- **Fog carries the horizon.** SynthCity's far plane is 1000 with fog eating the rest. Its aerial scale is out of reach for us and does not need to be matched.
- **No CC0 modern wardrobe exists on our rig.** 24 candidates checked, zero usable: every pack is either a different skeleton (62 joints against our 65, incompatible spine and finger topology), a fused mesh with clothing painted on, or not redistributable. The fallback is to cut the fantasy hardware off the four outfits we own and repaint the atlases.

## Decided, not built

- **AI buildings**: the full costed plan is in [PLAN-buildings.md](PLAN-buildings.md). Twelve looks authored offline, replayed into ~48 models, one packed `buildings.glb`, three fields per plot in the world file. Step zero is a five-minute measurement of material slots per building, because every draw-call figure rests on it.

## Blocked or waiting

- **Rust to Node switchover.** The Node service is proven: CORS passes, llama upstream answers correctly. The Rust binary is still the one bound to 8976. Once the user restarts on Node, delete `Cargo.toml`, `Cargo.lock`, `api/ llm/ stt/ tts/ models/`, `target/`, and update `game/sidecar/tests/contract.test.ts` and `docs/INDEX.md`.
- **Outfits pack version.** We vendor v2.0; v2.1 shipped 2026-07-05 and may carry 12 outfits on the free tier rather than 4. Re-run `fetch-assets` and count before doing any clothing work, because a front-opening longcoat would change the approach.

## The plan

[PLAN.md](PLAN.md) is the measured plan: what already works, why every seed
gives the same city, and thirteen box-scoped tasks in dependency order.

## A second wave he wrote down (2026-08-23)

Found as his own notes in the repo, captured verbatim into
`docs/REQUIREMENTS.md`. None of it is started. Grouped by the box that would
own it, roughly in the order a player would meet it:

- **Things you can use, not just carry** (`furnish` + `app`): real computers and
  terminals, in types — tablet, monitor, desktop, laptop — that both the player
  and NPCs can use. Security cameras.
- **Locks and ways past them** (`forge` + `quest` + `app`): hacking a machine,
  or typing a password the quest gave you. Doors with steel bars. Access cards
  for a specific place, an NPC's home included. The inventory carries access
  as well as objects.
- **The first agent has to plan for it** (`forge`): an instance brief says
  "a house with N people, an access door and a terminal", so the quest writer
  downstream can build a line on it. Locks nobody planned cannot be written into
  a quest.
- **Money and rewards that persist** (`play` + `quest`): credits as a reward,
  things to spend them on, and quests that unlock a car or an item you keep.
- **Fast travel** (`scene` + `app` + `hud`): a subway entrance you walk up to
  and click, the map opens, you pick a station and load in there.
- **A place of your own** (`forge` + `play`): a house instance for the player,
  things bought and put in it, and more houses to buy.

Weight: this is a second game layer on top of the one being finished, and most
of it needs the quest writer to know about locks and money before it can write
a line that uses them. The cheapest first step is the `forge` instance brief,
because everything else is unwritable until a generated place can contain a
locked thing.

## Packs: adding to a city after it is finished (2026-08-23)

> "city grow we do not want to grow it while we play, we do want to allow
> "DLC" so once we finish a city, we can add more things, but thats different
> from dynamically grow while you play"

Not live growth. A city is generated, played, and later added to as a separate
authored step; the result is a world file anyone can open, the same as the
original. `Forge.extend` is the mechanism and it is built and tested; what is
missing is everything around it.

What a pack has to guarantee, and none of it is guaranteed today:

- **The base city does not change.** Adding a pack must leave every existing
  street, building, interior, person and quest byte-identical. Anyone who played
  the original recognises it.
- **The design travels in the world file.** This is handover 21 and it is now
  the blocking one: the catalogue lives in code, so a city opened against a
  newer catalogue is re-skinned. A pack cannot be safe until a world file
  carries the design it was built with.
- **Ids continue rather than restart.** `world.toJSON()` carries `idCounters`;
  extend has to mint from where the base left off so a pack's people and things
  can never collide with the base's.
- **A pack's quests can use the base's places and people.** Otherwise a pack is
  a separate town rather than more of this one.
- **It is deterministic.** Same base plus same pack gives the same world on
  every machine, which is what makes a pack shareable at all.
- **Something applies it.** A command, and later a way in from the game.

Order: the design in the world file first, because a pack built before that is
a pack that can silently rewrite the city it is added to.

## More animation clips (2026-08-23)

He noticed the animation packs carry far more than we pull from them, and he is
right: people sitting in a bar could be drinking coffee, talking, doing
different idles, and today they are not.

**The machinery is already finished.** `clipForAnchor(kind, npcId)` picks from a
shelf of clips per anchor kind, hashed off the person's id, so the same person
always does the same thing and a city stays identical between openings. Adding a
clip is a name in `CLIPS_FOR_ANCHOR` plus the build tool pulling it. No code
design, no new seam.

**What we ship today, and it is thin.** Eight of the eleven anchor kinds have
exactly one clip:

| anchor | clips today |
|---|---|
| stand | 3 (idle, folded arms, on the phone) |
| lean | 3 (wall, wall crossed, wall smoking) |
| browse | 2 |
| sit, sit-drink, serve, cook, work-desk, work-bench, sleep, guard | **1 each** |

And three of the singles are the wrong clip rather than a thin one:

- **`sleep` plays a seated idle.** Somebody in bed is sitting up.
- **`sit-drink` has no drinking in it.** It is the same seated idle as `sit`.
- **`cook` is a plain standing idle.** Nothing about a stove.

Gestures are two clips, both talking, so the only thing anyone ever does over
their base pose is talk.

**Where the clips come from.** The rig is Quaternius Universal Base Characters,
65 joints, Unreal naming (`pelvis`, `spine_01`, `clavicle_l`, `calf_l`). Any
Quaternius Universal Animation Library pack binds with no retargeting, and
`tools/check-rig.mjs` is the gate: same joints, same order, or the file is
refused. Mixamo needs retargeting and is not the cheap path.

**Cost.** `anims.glb` is 0.62 MB for every clip in the game, no meshes, loaded
once and shared by everyone. It is a fixed catalogue like the textures, so more
clips are bytes paid once and never per world.

Worth doing as one pass: fix the three wrong ones, then widen the singles, then
add gestures worth layering (drinking, checking a phone, gesturing at something).
