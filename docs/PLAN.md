# game-box: the polish plan

## 1. What already works

Do not spend a day on any of these. Seven probes measured them.

- **The quest engine.** `@gb/quest` runs a quest end to end from real events: 300 generated quests across 30 cities, 0 rejected, 300 driven to `complete`, rewards applied in `@gb/play`. Counts, alternates, optional and hidden steps, choice, join, any-of, escort, stash, gating, timers, failure modes, save and resume are all implemented and tested. The engine is not the problem; what feeds it is.
- **Determinism.** Same seed, same brief, byte-identical world. Verified twice, independently.
- **Offline generation and its scale.** 7x7 blocks (224 plots, 408 people, 50 quests) builds in 0.74 s and packs to 99 KB gzipped. 12x12 in 2.2 s. Zero rejected quests at every size. Generation is not the scale wall.
- **Interiors.** 251 distinct layouts out of 252, 23 room programmes, 45 furniture sets across 72 houses. The healthiest generator in the repo.
- **Facades.** 195 distinct kit compositions across 252 plots, and the same seed under two themes gives 0 of 20 identical facades.
- **Companion following inside the city.** 203-cell route across a 7x7 city: worst gap 3.43 m, 0 frames inside a wall, 0 teleports, 50 ms of CPU total. Enter and leave a building regroups correctly with no body leak.
- **Crowd, traffic, land, ground and street paint are all flat in cost.** They cost the same at 50 blocks as at 4.
- **HUD mechanics.** Escape order, focus return, tab trap, close affordances, one stylesheet, zero `border-radius` measured live in Chrome on all 11 nodes. The look is consistent; the surfaces are missing.
- **Prompt discipline and the two-track dialogue.** Every prompt is its own `.md`, both bundles in sync byte for byte, no `max_tokens` anywhere, no ids ever on the wire, redaction correct.
- **The gate.** 362 tests in 52 files, isolation ok (20 boxes, 341 files), `tsc --noEmit` clean, `host/` 26 tests green. Zero deep imports, zero TODOs.

## 2. Verdict on "the city is always the same"

He is right, and it is not a determinism bug. Two things are true.

**The street skeleton has no seed in it at all.** `layStreets(world, brief)` takes no `Rng`. Across 12 seeds the street grid is **1 distinct value**, and the road graph is **1 distinct value** across 8. Comparing seeds `town` and `zeta` cell by cell on a 51x51 grid: of the 1817 cells that are street, sidewalk or mountain in either city, **0 differ**. Same rectangular grid, same block sizes, same crossings, same mountain ring, same single road out. A seed only decides which cells inside a block get a building.

**The theme changes two strings.** Same seed under "quiet coastal town", "dusty western mining town" and "dense neon port city", with the theme text and the `style` prefix substituted out: all three worlds hash to `d7eeb65cb263`. Not the city name, not the plot mix, not one place name, NPC, item or quest. `KIND_WEIGHTS` in `forge.ts:37` is a fixed constant, and `STAPLES = ['bar','shop']` puts a bar then a shop on sites 0 and 1 in 12 of 12 seeds.

Two more numbers that make every city read the same at street level. At the default `blockCells: 14`, `sitesInBlock` cuts a ring of depth 6 out of 14, leaving a middle of 2, below `MIN_FRONT` of 3, so the east and west strips are never cut: **0 buildings face east or west in any default city**. Every door is on an east-west street, and about 28% of the buildable ring is thrown away. And quest count is `blocksX * blocksY + 1` regardless of seed (12 seeds at 2x2, all exactly 5 quests), in one step shape, `talk > goto > collect > deliver > complete`, 300 out of 300.

**What has to change for a new seed to feel like a new place**, in order of how much it buys:

1. A seeded street plan: fork an `Rng` in `layStreets`, jitter band spacing per column and per row, drop or offset an occasional street to make long blocks and short ones, promote one block to a plaza or park, seed the number and side of the roads out.
2. Block internals that face all four ways: pick `blockCells` from the seed inside a range that keeps the middle strip above `MIN_FRONT` (15, 17 and 20 all produce roughly 40 west and 38 east frontages), and change the app's hardcoded 14.
3. A theme-driven plot mix: `KIND_WEIGHTS` becomes a function of theme plus a seeded perturbation, and `STAPLES` becomes a seeded pick from a per-theme staple set placed at seeded sites.
4. Seeded quest recipes instead of one template (task 4).
5. Wider name and knowledge vocabulary offline: 550 NPCs currently share 163 names and 4 knowledge templates, and every patron in a city says the same sentence.

## Progress

| Task | Box | State |
|---|---|---|
| 1 | `world` | done, `005b8f8` |
| 2 | `quest` | done, `3c3f0a9` |
| 3 | `forge` | done, seeded streets and the junction fix |
| 5 | `hud` | done, `d38fa8f` |
| 6, 7, 18 | `app` | running |
| 11 | `nav` | done, 56 s to 13 ms |
| 15 | `scribe` | done, `c4187bb` |
| 16 | `sidecar` | done, `f82e6a6` |
| 17 | `talk` | done, `0822ed7` |
| shadows | `land` | done, sun casts at 9.77 cm per texel |
| cars | `traffic` | done, `9620356` |
| 4 | `forge` | running |
| 8, 9 | `app` | waits for 6 |
| 10 | `crowd` | running, plus a crossing regression forge uncovered |
| 12 | `cli` | done, `08a3066` |
| 13 | `forge` | folded into 3 |
| 14 | `scene`, `kitbash` | done, 1,069 draws to 46 |
| 19 | repo | not started |
| clothing | `cast` | running |
| props and prop heights | `furnish` | running |

Done outside the plan: the world lit by the sky and the shadow map enabled
(`51bf9ae`), the page reset and the stray `e` (`1641353`), walking out of
anything standing in you, six boxes that could not run their own tests.

## 3. The work

Each task is one box and one agent. Sizes assume that agent reads the contract, writes the tests, and updates `CONTRACT.md` and `docs/INDEX.md` in the same commit.

**Phase 0, unblocks the rest.**

1. **`@gb/world`.** Publish `questView(world)` (the five-question adapter both `forge` and `bundle` hand-roll today), and replace `METRICS.street.laneCells: 2` with `roadwayCells: 3` so the registry agrees with the 3-cell roadway that `forge` and `traffic` actually use. Additive plus one deleted field. 2 h. No deps. This is the one task that touches three folders (world, then `forge/src/layout/bands.ts` and `traffic/src/settings.ts` read the new field); land world first.
2. **`@gb/quest`.** `objectives()` carries the whole target: `toNpcId` for `deliver`, plus `count`, `optional`, `hint`, `markerLabel` (measured today: a deliver step's objective is `{questId, questTitle, stepId, text}` and nothing else, so two of the four generated step kinds point nowhere). Add `abandon(questId)`. Make `next` required in the quest **draft** contract, so a model omitting it gets `invalid-arguments` and hits the existing retry loop instead of passing validation and being silently dropped downstream (`schema.ts:54`, the single root cause of 0 accepted model quests in two independent runs). Additive except the draft contract. 0.5 d. No deps.

**Phase 1, the city.**

3. **`@gb/forge` (layout).** Seed the street plan and the block shapes per section 2 items 1 and 2, expose `exits` through the CLI, and fix the junction painting: paint every sidewalk band first, then every roadway band, then delete the crossings loop. That is the pavement over the road, exactly: 51 of 54 junction arm cells are sidewalk sitting on the roadway in the default city (204 m2), 1524 m2 at 7x7, only on north-south streets because the row pass runs last, and 12 of 247 road-graph centreline cells are sidewalk so cars drive through a 15 cm kerb at every junction. Breaking for generated output (every seed yields a new city; already-exported bundles still open). 1.5 d. Depends on 1.
4. **`@gb/forge` (narrator and quest writing).** Theme-driven `KIND_WEIGHTS` and staples; replace the single quest template with seeded recipes that use the engine that already exists (escort, optional and hidden steps, counts, choice, `failWhen`, `hint` and `markerLabel`), pay through `rewardFor(difficulty)` instead of `rng.int(15,60)`, gate side quests behind main-line flags so `kind: 'main'` means something, and widen the offline name and knowledge vocabulary. Also stop emitting a first `talk` step on the giver you are standing in front of. Additive to the box, breaking for generated output. 2 d. Depends on 2, 3.

**Phase 2, the interface.**

5. **`@gb/hud`.** Replace `journalOpen` and `helpOpen` with one `window: 'quests'|'map'|'items'|'controls'|null` behind a tab strip in the existing `HudWindow` shell. This kills the measured two-modals-at-once state (journal `[540,370,520x160]` drawn entirely inside help `[545,203,510x495]`, both `aria-modal`), gives the map and inventory a home with no new chrome, and leaves one focus and scrim path. Add `trackedQuestId`: the objectives panel shows the tracked quest plus a "4 more" line, which fixes the 887 px overflow measured at 720 px tall. Render `count` as "2/5" and mark `optional`. Add `max-height` and `overflow-y: auto` to `.gb-objectives` and `.gb-purse`. Breaking on the patch shape (only `app` consumes it). 2 d. Depends on 2.
6. **`@gb/app` (structure).** Split `game.ts` (570 lines, next largest src file in the repo is 374) into targeting, interaction, the building stage, conversation, companions and HUD reporting, and add the missing `src/index.ts` that `package.json` already claims. Pure refactor. 1 d. No deps. **Tasks 6 to 10 are the same box and run in sequence, not in parallel.**
7. **`@gb/app` (boot, new city, export).** One panel from the first frame: theme, seed, blocks, Generate, and Export. Kills the measured 11.2 s cold and 4.7 s warm white screen with no text, moves city creation out of the URL bar, and stops throwing away the packed document `main.ts:48` already builds. `Bundle.pack` and the WebCrypto `contentHash` work in the browser today. 1 d. Depends on 5, 6.
8. **`@gb/app` (guide, map data, inventory).** Feed the HUD map tab the grid and plot rects, wire `i`, and route to the tracked objective with `nav.pathToDoor` plus `waypoints`, which `@gb/nav` already answers and nothing consumes. Re-request pointer lock when the last window closes. 1 d. Depends on 5, 6, 2.
9. **`@gb/app` (companions).** Bridge `did: follow_player` and quest `companion-join` to `crowd.follow`, so an NPC who agrees in dialogue actually walks (today they only get a HUD line, and because `#showIndoors` never runs the NPC is duplicated: one behind the counter, one walking with you). Pass city coordinates, not interior-local ones, when recruiting indoors (measured: recruiting at interior 3.56, 1.20 puts the companion on a mountain cell 26.6 m away). Make crowd walkers resolvable as talk targets: `world.npc(walker.id)` resolves for 0 of 6 walkers because the crowd names them `walker_N` and the world names them `npc_900000+`, so there are zero talk targets in the street. 1 d. Depends on 6.
10. **`@gb/crowd`.** Stop the follower teleporting onto the player's face out of town (measured: 5 teleports on a 159 m walk east, each landing 0.00 m from the player at y=0 while the ground is at -0.42 to -5.36 m). Take walkability and foot height from a ground source the app can point at `@gb/land` outside the grid, and make `Escort.#spotFor` fail to a hold rather than to the player's own position. 1 d. Depends on 9.

**Phase 3, size and the model.**

11. **`@gb/nav`.** Reuse the search scratch space its contract already promises (`new MinHeap(width*height)` per call is a 167 KB `Float64Array` on a 146x146 city; 200 paths grew the heap 8.8 MB), and publish a one-pass `reachableFrom(start)` flood fill. 0.5 d. No deps.
12. **`@gb/cli`.** Use the flood fill (`gb check` is O(plots x cells) today: 0.31 s at 12 plots, 9.20 s at 705, 142.96 s at 2851, predicted before it was run), expose `--exits`, and reopen what it wrote so it stops exiting 0 on an unopenable bundle. 0.5 d. Depends on 11.
13. **`@gb/world` and the forge brief.** Fail closed on the grid bound: `blocks 24x1 --cells 40` builds a 1093-cell grid, seals it, writes 4.9 MB and exits 0, then `gb check` says `world.grid.width: Too big`. Same class: `brief.theme` allows 200 chars, `world.theme` allows 60. Either the brief refuses the combination or `World.create` enforces its own documented precondition. Clamp `?blocks=` in the app while in there. 0.5 d. No deps.
14. **`@gb/scene` and `@gb/kitbash`.** Batch the city. Measured at 7x7: 962 meshes, 2.78 M triangles, 116 MB of attributes, 658 meshes in the frustum at spawn, over exactly **20 materials** and 962 unique geometries. A `BatchedMesh` per material, or one merge pass, collapses roughly 950 draws to under 20. Culling gives back 35% of the geometry at street level and it is charged twice, in the main pass and in the shadow pass, which is why `BatchedMesh` beat a merge: a merge submits everything, always. (Measured after the fact; the 32% figure here was wrong.) Add a headless mesh and triangle ceiling test; every number above was measured in Node with no browser. Also give the streetlamp instanced mesh per-district chunks (1028 triangles each, one bounding volume, 28% of the frame's triangles at 144 blocks). 2 d. No deps.
15. **`@gb/scribe`.** Run the descriptive calls against the five llama slots instead of one at a time (the 1x1 city took 2131.8 s over 37 serial calls while four slots sat idle), keep a name registry (13 people produced 4 Vidals, 3 Carmens, 2 Martas), drop the 12-quest cap that disagrees with the offline narrator, move the three inline prompt fragments at `scribe.ts:105-107`, `:121` and `:128-130` into `.md` files, fix the "Write 1 quests" / "This is quest 2 of 3" contradiction, and rewrite `write-quests.md` to name the step kinds, the difficulty bands, escort, optional, hidden, counts and failure rules. Shrink the 41,994-char tool schema. Widen `Narrator` so `describeNpc` and `namePlace` get the city name and the names already used. 2 d. Depends on 2.
16. **`@gb/sidecar`.** An `AbortSignal` and a timeout on every call. There is not one `AbortController` in `sidecar`, `talk`, `scribe` or `app`, so a stalled model hangs a conversation turn or a whole build forever. 0.5 d. No deps.
17. **`@gb/talk`.** Fire `talked` when the conversation credits it, not inside `open()` at `conversation.ts:54`. Replace the six-word offline keyword decider (`script.ts:9-16`, where "give me the job" matches `hand_over` and nothing happens) with something that reads the menu. Stop speaking raw knowledge strings and HUD objective text as dialogue. Put theme, clock reading and player standing into the NPC brief, and fix the "the list above" referent in `npc.md:14` that now points at the interpolated situation block. 1 d. Depends on 2.
18. **`@gb/bundle` and `@gb/app`.** Call `Bundle.save` and `Bundle.resume`, which exist, are contracted and are tested, and appear nowhere outside their own test. Refresh currently loses the playthrough. 0.5 d. Depends on 7.
19. **Repo hygiene.** Section 4, as one commit. 3 h.

## 4. What to cut

- `/mobil.html` (11 KB lecture page on the MOBIL model) and `/package/src/core/Raycaster.js` (a lone vendored three.js file). Zero references, not gitignored.
- `game/app/src/spike-glb.ts` (78 lines, says in its own header to delete it) and its call at `game/app/src/game.ts:89`. Its models live in gitignored `assets/dist/spike/`, so a fresh clone logs four load failures.
- `METRICS.street.laneCells` and `METRICS.street.sidewalkCells` (0 readers, and the value contradicts the 3-cell roadway that forge and traffic both use), `METRICS.furniture.chairSeatHeight`, `METRICS.vehicle.parkingLength` (0 readers each).
- The private `viewOf` in `game/bundle/src/bundle.ts:121`, byte-identical to the exported one in `game/forge/src/forge.ts:297`. Both become `questView` from `@gb/world`.
- Declared dependencies nothing imports: `@gb/play`, `@gb/quest`, `@gb/world` in `game/cli/package.json`; `@gb/world` in `game/hud/package.json`, which contradicts hud's own contract.
- Three copies of `nodeNames()` (`game/furnish/tools/build-kit.ts`, `game/kitbash/tools/build-kit.ts`, `game/traffic/tools/build-cars.ts`) and two of `multiply()`/`apply()` (`furnish/tools/measure.ts`, `kitbash/tools/measure.ts`). Tool-side, so a shared file under root `tools/` is the honest home.
- The identical `canonical()`, `floats()`, `counting()` in `game/furnish/src/kit/geometry.ts` and `game/kitbash/src/kit/geometry.ts`. These dequantize meshopt geometry so meshes can weld; fixing one silently leaves the other wrong. The five parallel `GLTFLoader` plus `MeshoptDecoder` setups (`app/src/pack.ts:66`, `cast/src/cast.ts:52`, `traffic/src/car-pack.ts:67`, `furnish/src/kit/load.ts`, `kitbash/src/kit/load.ts`) point at the same gap: one small `@gb/glb` box that nobody cut.
- Contract drift. `game/forge/CONTRACT.md` claims street proportions come from `METRICS` (forge imports `METRICS` twice, neither for streets). `game/app/CONTRACT.md` names 10 dependencies against 18 declared and prints a `Game.start` signature that does not match `game.ts:238`. `game/land/CONTRACT.md:131` says "`scene.background` is no longer used", which is correction-style wording. `game/app/package.json` exports `./src/index.ts`, which does not exist.
- Two gate holes that let the above through: `tools/check-isolation.mjs` does not check that a declared `exports` target exists on disk, and does not flag a declared workspace dependency nothing imports.
- Dead export surface: 195 of 327 names exported from box entries have no reference outside their own box (`kitbash` 37 of 44, `traffic` 22 of 28, `quest` 20 of 33). Trim per box as each task above touches it, not as a sweep.
- **The Rust tree, as its own commit.** `host/` matches all 14 Rust schemas structurally, and exactly one code coupling remains: `game/sidecar/tests/contract.test.ts:11` reads a path into `api/`. Repoint it at `host/schema/api/chat-request.json`, then remove `Cargo.toml`, `Cargo.lock`, `api/ llm/ stt/ tts/ models/` (22 files, 1657 LOC) and `target/` (3.1 GB), and update `game/sidecar/CONTRACT.md:17,36`, `docs/INDEX.md` (Sidecar table and the `gb-llm, gb-stt <- gb-api` edge) and `README.md:41,42,63,81`, none of which mention `host/` today.
- One test to add rather than cut: `game/scribe/tests/contract.test.ts:112` feeds the fake model a hand-written perfect draft, and `:150` asserts plots and npcs but never that a quest survived validation. 362 tests are green while `--model` produces zero quests.

## 5. The two things most likely to go wrong

**The forge reseed lands while three agents are inside forge, and nothing reproduces.** Tasks 3 and 4 change every generated city, every fixture built from one, and every number any other probe measured. What has to be true: one owner holds tasks 3 and 4 end to end, nobody else edits `game/forge` while they run, the determinism test (two builds of one seed, byte-identical) is written and green before the first seeded line, and every checked-in bundle or fixture is regenerated in the same commit as the change that invalidated it. If task 3 and task 4 land from different agents in different commits, the accept-rate numbers in task 4 cannot be trusted.

**The model path stays unusable after the schema fix.** `next` being optional explains the 0-of-3 rejections, but it does not explain 170 s per quest call, a 41,994-char tool schema, or a model writing `talk` steps that mean "take the parcel". What has to be true: quest calls run concurrently across the five llama slots, the tool schema drops below roughly 4k tokens, `write-quests.md` names the step kinds and the reward bands, and the acceptance gate is a headless run over several seeds asserting zero rejected quests. The contingency, decided now rather than after another 35-minute build: if a 1x1 city still yields zero accepted quests in two consecutive runs after task 15, stop making the model an author and make it an editor. The offline narrator emits a structurally valid quest; the model rewrites its title, objectives, hints and dialogue and touches no `next`, no ids and no reward. That keeps the good writing (the probe's "Puerto Lanín" output is genuinely shippable) and takes the flow risk to zero.

## 6. Not in this plan

- **AI-generated buildings** (`docs/PLAN-buildings.md`). Costed and decided, but it is an art pipeline, not a polish pass, and task 14 has to land first or the draw-call budget it rests on is meaningless.
- **LOD and occlusion culling.** Batching collapses roughly 950 draws to under 20 at 49 blocks. Measure again after task 14; below 144 blocks LOD may never be needed.
- **Cities above 12x12.** 576 blocks is 12,031 draws, 31 M triangles, 1.43 GB of geometry and 13.9 ms per frame in the cull pass alone, before drawing anything. Task 13 clamps it rather than chasing it. "50 blocks" is the target the user named and it is reachable.
- **Interior crowds and NPC daily routines.** `@gb/crowd`'s own contract names the prerequisite: interiors need a second navigation source, and `@gb/nav` has none. That is a nav box change and a real one; it does not fit alongside eighteen other tasks.
- **`Forge.extend` and growing the city while playing.** Implemented, tested, unreachable. The scene cannot accept new plots without a rebuild, so it depends on task 14's batching landing first.
- **Outdoor objectives** ("meet me on the docks"). `PlaceSchema` is `{plotId} | {interiorId}` only and `arrived` fires solely from entering a building, so this is a world schema change plus a quest change plus an app change. Worth doing, after the map and guide exist and can point at one.
- **Restyling the HUD.** The look is consistent, square-cornered and coherent in the screenshots. The gap is missing surfaces, not pixels. No icon-grid inventory either: there is no item art to put in it.
- **Voice, STT and TTS.** Untouched by anything the user asked for here.
- **Rebuilding the quest engine, the interior generator, the facade kit, crowd or traffic.** All measured healthy. Section 1 exists so nobody opens them.
