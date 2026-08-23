# Pending

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
| You can see under the pavement where it meets the verge | `scene` and `land` disagree | `scene` treats a `mountain` cell as 24 m tall when deciding kerbs, so it draws no kerb face there; `land` now lays that cell flat at ground level. About 172 cell-edges of 15 cm gap around the outer ring, and now on the road out of town too. |
| Cars drive out of town and vanish in plain sight | `traffic` | A car that runs out of graph is retired. The exit road now reaches the map edge, so it happens about 10 m past the last building. Traffic already defers retiring a stuck car until the player cannot see it; the same rule fits. |
| `nav` calls a mountain cell impassable, `land` calls it walkable verge | `nav` and `land` disagree | Does not block walking out, since the corridor is street and pavement the whole way, but the two boxes describe the same cells differently. |
| An NPC in front of you still crowds your step | `crowd` | Personal space is tighter now, but walkers do not steer around the player: the crowd is fed cars as hazards and never the player. |
| NPC clothing is medieval | `cast` | The only clothing we ship is Quaternius Modular Character Outfits **Fantasy**: Peasant and Ranger, two genders. |

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
