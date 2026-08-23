# Pending

Everything known to be unfinished, by box. Delete a line when it is done.

## Bugs on screen

| What | Box | Diagnosis |
|---|---|---|
| Stars paint over walls, cars and people | `land` | `transparent: true` puts them in the transparent pass, drawn after all opaque geometry, and `depthTest: false` makes them ignore what is in front. Same cause for the moon. |
| The moon is a plain white ball | `land` | `MeshBasicMaterial` at `0xdde5f2`, no texture, no glow, 12x8 sphere. |
| A pavement strip runs down open ground with no road beside it | `forge` or `scene`, to be pinned | Sidewalk cells laid where nothing adjoins them. |
| Furniture has no collision indoors | `scene` publishes footprints, `app` consumes | Sizes live in `forge/src/interior/props.ts`, private, so `app` cannot reach them and a copy would drift from what is drawn. |
| Interior wall textures scaled far too large | `furnish` | Tile density is not tied to metres, so one tile covers most of a wall. |
| Too many cars and too many people on screen | `crowd`, `traffic` | Density is set inside each box; no parameter reaches them from the app. |
| NPC clothing is medieval | `cast` | The only clothing we ship is Quaternius Modular Character Outfits **Fantasy**: Peasant and Ranger, two genders. |

## Features asked for, not started

| What | Box | Note |
|---|---|---|
| Road markings, kerb detail, street dressing | `scene` | The "yellow things". Crossings, lane lines, stop bars. |
| Lit windows at night, street lamp glow in one draw | `kitbash` | In progress. |
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

## Blocked or waiting

- **Rust to Node switchover.** The Node service is proven: CORS passes, llama upstream answers correctly. The Rust binary is still the one bound to 8976. Once the user restarts on Node, delete `Cargo.toml`, `Cargo.lock`, `api/ llm/ stt/ tts/ models/`, `target/`, and update `game/sidecar/tests/contract.test.ts` and `docs/INDEX.md`.
- **Outfits pack version.** We vendor v2.0; v2.1 shipped 2026-07-05 and may carry 12 outfits on the free tier rather than 4. Re-run `fetch-assets` and count before doing any clothing work, because a front-opening longcoat would change the approach.

## Throwaway, delete when decided

- `game/app/src/spike-glb.ts` and its one call in `game.ts`, plus `assets/dist/spike/`. A look at glb-buildings models in our own street, behind `?glb=`.
