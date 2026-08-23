# Recommendation: how glb-buildings should enter game-box

## 1. Verdict

The model authors a small set of footprint-agnostic **looks** offline, once, and a build tool replays each look across the footprints and storey counts the city actually uses, producing about 48 finished **models**. The mesh lives in one committed, meshopt-packed `assets/dist/buildings.glb` that ships with the runtime, exactly like `anims.glb` and `downtown-kit.glb` today. The world file carries, per plot, three fields naming which model it got (`{model, mirror, palette}`, about 55 bytes) plus one `requires` entry pinning the pack by id, version and sha256; no mesh, no texture, no building document, no producer byte ever travels in the file.

This is the "Frozen Catalogue" shape, with three grafts described below.

## 2. Why this shape and not the others

**Stock (a shelf of 24 meshes, picked at open time from `plot.id`) is killed by recomputation.** It puts nothing in the world file, which reads as the safest possible answer and is in fact the hole. The pick resolves through `Rng.int(min,max) = min + floor(float()*(max-min))` (`game/kit/src/rng.ts`), so the bucket's **cardinality and order** are silent inputs to what every player sees. Its own contract says growing the shelf is data-only and "no other box notices"; that operation re-skins every already-shared world file in the affected bucket, and the file has no way to say so or to detect it. Second problem, measured: 2 to 3 members per bucket is a variety regression against kitbash's 7 to 8 per-bucket facade recipes in all twelve buckets.

**Pattern Book (a grammar, expanded and built in the browser on every open) is killed by putting a float geometry pipeline on the replay path.** Sub-ULP drift across JS engines is invisible and I would not reject a design over it. What rejects it is `over-plot`: a float bbox compared against kitbash's 0.05 m `RELIEF`, evaluated on the player's hardware, whose failure action is to drop the building and let kitbash answer. A family sitting near that boundary is a glb-buildings building for one player and a Downtown MegaKit building for another, from the same file, with a matching content hash and a matching book sha. It also depends on `buildParts`, a producer API that has been read but never built, and its `textures: false` everywhere makes upper storeys bare coloured boxes, because the producer's `flat`-tier bands put the windows in the image (`boxes/kit/openings.ts`, `boxes/kit/templates.ts`).

**Three things are grafted in from the losers, and they matter:**

- From Pattern Book, **the kind signal and landmarks**. Frozen Catalogue's `pick(rect, storeys, doorAxis, rng)` drops `plot.kind` entirely, so a house, chapel, warehouse and bar on a 6x12 plot become interchangeable, where kitbash's `RECIPES[plot.kind]` gives them brick, brick, industrial metal and a painted shopfront. Fix: every model declares which kinds it suits, `pick` filters the bucket by kind affinity and falls back to the whole bucket when the filter empties. Coverage stays provable per bucket, and the trade signal comes back. Landmarks (8 to 12 hand-authored tall documents on forge-marked sites) are phase 2 and the only thing on this list that gives the city a skyline.
- From Stock, **the build tool's refusal gates and the one-building go/no-go**. Every producer/consumer mismatch is settled once, offline, by refusal rather than trust.
- From Pattern Book, **per-palette colour**. Four palettes come free by building the same look under four project names, since `seedOf(doc.name)` at `writer.ts:343` is the entire variation source. Colour separation reads down a street far better than a 0.3 m setback does.

One judge preferred Stock purely on box scope, and he is right that six boxes is a wider footprint than one. That width buys the single thing Stock cannot: a file that names what it shows. Note that `game/scene` is untouched in both designs, which is the evidence the art cut itself is in the right place, and that backing this out is still deleting one link from the dressing chain and leaving an unread optional field behind.

## 3. How determinism survives

**Three things sit on the replay path, and nothing else:** the world file (JSON, hashed), `assets/dist/buildings.glb` plus `buildings.json` (committed bytes, sha256 in `requires`), and three.js with the game's own code. Not on it: the LLM, the sidecar, `glb-buildings-skill`, `@gltf-transform`, `node:zlib`, the producer's texture packs, any engine's `Math.sin`.

**Same seed, same city, with or without the model.** The model runs before any world exists. `?seed=metro` in the browser with the sidecar down produces byte-identical output to `gb build --seed metro` with it up. This is the property no per-plot LLM design can have at any price, and it is the reason the whole shape is what it is.

**Existing seeds do not move.** The design draw forks off the **root** rng, keyed on the plot rect: `rng.fork(\`design/${site.rect.x},${site.rect.y}\`)`, taken after `world.addPlot` returns. `fork(label)` is `new Rng(seed + '/' + label)` and does not draw from the parent (`game/kit/src/rng.ts:27`), and the root rng in `Forge.build` is used only as a fork factory (`block/N`, `site/N`, `people/N`) and never drawn from directly. So `block`, `site`, `people` and `room` streams are all unmoved. The rect is the right key rather than the site index because it exists before the id is minted, cannot alias (integrity forbids overlapping plots), and is independent of site iteration order. In `extend`, which draws from its own root directly, the design draw hangs off the existing `extend/${i}` fork.

**Existing world files still open and still hash the same.** `design` is optional; zod omits absent optional keys and `stableJson` walks `Object.keys`, so an absent field never enters the serialisation. `schemaVersion` stays 1, no bundle migration, no content hash moves.

**The design is stored, not recomputed, and that is the load-bearing decision.** A v1.1 pack that adds models cannot re-roll a city that already named its models. A pack missing one produces `unknown-model` naming the id and the expected catalogue version, instead of a quietly different street. `pick` also chooses from members **sorted by id**, so manifest file order never reaches a world. The cost is 29 KB compact on a 2.3 MB file.

**No hash ever covers a mesh.** Geometry is committed bytes produced once on one machine. The only per-open geometric transform is the mirrored twin: negate `position.x` and `normal.x`, reverse index winding. Exact in IEEE, no transcendentals. The door pose is read from the manifest, never measured off the mesh, so float geometry stays off the interaction path too.

**The `requires` check, stated precisely** (one judge found a contradiction here in the original proposal, and this resolves it):

- Fatal, refuse to render: the pack id or major version does not match, or any `model` id the file names is absent from the loaded catalogue.
- Warn and log, do not refuse: `sha256` differs. A superset pack legitimately has a different sha and must still open an older world.
- `Bundle.pack` refuses to seal a bundle whose `requires` entry has no `sha256`. That tightens the writer, not the schema, so v1 files stay openable with no migration. It also finally implements the promise standing unimplemented at `game/bundle/CONTRACT.md:45`; today `requires` is read at `bundle.ts:79` and nowhere in `game/app`.

**Residual risk, named rather than smoothed over.** The `sha256` warns rather than refuses, which means **nothing at runtime stops someone editing model 7's geometry while keeping its id**. That is the one hole in the guarantee. Three things mitigate it and none of them is the runtime: the pack is a reviewed committed artefact, the producer commit is pinned in the build script, and `game/prefab`'s test holds every packed model's triangle count and bounding box to the committed manifest so drift fails a test on rebuild. Related and worth stating: the producer has **no golden-hash test** (grep for `createHash|sha256|deterministic` across `boxes/**/*.test.ts` finds nothing about GLB bytes), so byte-identical output is a property verified empirically at one commit, not one the producer's suite guards. And rebuilding the pack on a second workstation may produce different bytes for the same documents (zlib linkage, gltf-transform patch, transcendental drift). That does not matter for players, but it means "rebuild the pack" is always a new version, never a no-op.

## 4. Change list

**NEW `game/blueprint` (additive).** No three.js, no producer code. Names every model the city can use, says which one a plot gets, proves the catalogue covers every plot the forge can make.

```
Catalogue.parse(value)                       -> Catalogue          (schema/catalogue.json)
catalogue.pick(rect, storeys, kind, doorAxis, rng) -> Design       { model, mirror, palette }
catalogue.model(id)                          -> ModelSpec          { id, bucket, kinds, width, depth,
                                                                     height, door {side, along}, prims, tris }
catalogue.covers(demand)                     -> { ok } | { ok:false, missing: Bucket[] }
bucketOf(plot) / demandOf(world)
DesignSchema, BucketSchema                                          (re-exported for @gb/world)
```
Errors, closed: `invalid-catalogue`, `no-model`, `unknown-model`. Depends on `@gb/kit`, `@gb/world`.

**NEW `game/prefab` (additive).** Dresses a plot with the model its design names, out of one shared packed library.

```
new PrefabDressing(library, rest?)           implements @gb/scene Dressing
loadLibrary(scenes, catalogue)               -> Library { geometry(id, mirror), material(slot) }
building(plot, size)                         -> THREE.Object3D
ATLAS_SLOTS, PALETTES
```
`prop`, `character`, `pickup`, `ground`, `surface` pass to `rest`. Errors, closed: `library-incomplete`, `model-mismatch`, `no-design` (falls through to `rest`, so a v1 file still renders). Depends on `@gb/scene`, `@gb/world`, `@gb/blueprint`, `@gb/kitbash` (`RELIEF`), `three`.

**MODIFIED `game/world` (additive, minor `contractVersion`, `schemaVersion` stays 1).** `PlotSchema` gains optional `design`; `addPlot` accepts it at mint time so there is no mutation path.

**MODIFIED `game/forge` (additive).** One fork and one design write in `#raiseOne`. Plus a fix that has to happen anyway: `style` is currently `theme.split(/\s+/)[0] + '-' + kind`, so theme "a modern city" makes every plot `a-bar`, `a-house`. It becomes the catalogue id.

**MODIFIED `game/bundle` (schema additive, writer stricter).** No schema change. `Bundle.pack` populates `requires` and refuses to seal without a `sha256`.

**MODIFIED `game/app/src/pack.ts` (additive wiring, breaking behaviour).** One more chain link: `Cast -> Furnish -> Prefab -> Kitbash -> Greybox`. The behaviour change is the `requires` enforcement above, replacing today's silent fall-through to greybox with a loud refusal.

**NEW, not a box: `tools/build-buildings.ts` and `assets/buildings/*.json` (additive).** Matches the existing `tools/build-kit.ts` precedent. This is what keeps the producer's `esbuild`, `three`, `@gltf-transform/*` and `gltf-validator` out of the game's dependency graph and `pnpm run check:isolation` green. Its closed refusal set: `faces-wrong-way` (bakes the 180 degree yaw, since the producer's front is +Z and `@gb/scene` requires -Z), `wrong-height` (bbox must equal `4 + (storeys-1)*3.2` m to the millimetre, which catches the producer's 4500 mm default ground band and the cyber auto-mast's unasked +9.3 m), `overhangs` (bbox inside footprint + 0.05 m, against the producer's `MAX_PROUD` 3 m and `MAX_ABOVE` 12 m at `boxes/kit/invariants.ts:49,52`), `absolute-path` (any `screens[].image`, which the producer writes as `/home/hec/workspace/...` automatically), `too-many-slots`, `bucket-uncovered`.

**MODIFIED docs (additive):** `docs/INDEX.md` two rows and the dependency edges, `docs/DECISIONS.md` D13, `CHANGELOG.md`, one `assets/registry/sources.json` entry (`glb-buildings`, MIT, already on `fetch-assets.mjs`'s ALLOWED list).

**UNCHANGED:** `game/scene`, `game/kitbash`, `game/cli`, `game/scribe`. `Dressing.building(plot, size)` already carries the plot and the plot now carries the design; that the seam holds without a change is the evidence the cut is right.

## 5. The numbers

Baselines measured on a 589-plot city (11x11 blocks, 14 cells, "a modern city", density 0.8, maxStoreys 3), normalised to 562 where stated.

| | today | after |
|---|---|---|
| generation wall clock | 550-600 ms | 555-605 ms (one fork plus one weighted pick per plot, +3 to 5 ms) |
| model calls at generation time | 0 | 0 |
| world file, compact / gzipped | 2.29 MB / 0.24 MB | 2.32 MB / 0.243 MB (+1.2%) |
| draw calls, buildings | 2,928 (3,068 measured at 589) | 1,124 (562 x 2 atlas slots) |
| triangles, buildings | 5,023,000 (mean 8,938/building) | ~1,570,000 (~2,800/building) |
| VRAM added by buildings | 0 (they use the kit) | ~7.7 MB (4 shared atlas palettes) |
| runtime pack | `downtown-kit.glb` 0.73 MB | plus `buildings.glb` ~3.4 MB |

One-time cost: **12 to 16 looks at the measured local Qwen mean of 7m45s is 1.6 to 2.1 hours**, once, ever, offline, free. Replaying those into 48 models is 48 x 35 ms = 1.7 seconds; atlas, meshopt, quantize and WebP is under a minute. For contrast, 562 bespoke buildings is 58.6 to 86.7 hours locally, roughly $1,100 and 40 hours hosted, 197 MB of mesh with drawn tiles or 1.7 GB with the producer's image packs, and it is not reproducible anyway.

**Two corrections to numbers that have been quoted optimistically:**

1. **VRAM does not drop from 83.9 MB to 7.7 MB.** `game/kitbash` keeps `ground()`, `surface()` and the six street materials, so the downtown kit's 15 1024px WebP images (603 kB in file, 83.9 MB mipped) stay resident. Buildings **add** 7.7 MB; they do not replace 83.9 MB. Trimming the kit pack to the ground and street subset is a separate, worthwhile follow-up.
2. **"2 primitives per model after atlasing" is an estimate, and every draw-call figure scales linearly off it.** The only four bespoke GLBs on this machine are 82 to 113 m cyber towers with 13 to 18 primitives. If a modern 12x12 m building needs 4 slots (opaque, glass, emissive, alpha-tested) the number is 2,248 draws, not 1,124, and it barely beats kitbash. Settling this is a five-minute measurement and it is step 0 below.

Also unmeasured on both sides: `renderer.info.render.calls` at street level in a real browser. Per-object frustum culling means a street camera submits a fraction of the scene total, and it is possible both configurations sit comfortably inside frame budget.

## 6. What this does not solve

**Interiors, categorically.** The producer is exterior-only. Every template in `boxes/kit/templates.ts` is walls plus a bottom cap plus a top cap: no floor slabs, no rooms, no stairs, nothing behind a window. Interiors keep coming from where they come from today: `game/forge`'s `planInterior` sizes the room, `buildInterior` builds it from `Dressing.surface()` and `prop()`, and entering is a teleport into a separate coordinate frame, not a walk through a doorway. Upper storeys remain non-enterable. Nothing here changes that and nothing in the producer can.

**Windows are not holes.** `boxes/kit/openings.ts:1-8` is explicit: "A pane is a shallow box on the wall, it cannot break the shell." Doors are 12-triangle plates. `boxes/spec/document.ts` describing windows as "real openings, a hole, a reveal and a pane" and `docs/ARCHITECTURE.md` saying "cut windows" are both wrong, and worth fixing upstream. It costs nothing here because interiors are swapped, not entered, but do not plan around seeing in.

**The CC0 kit and `game/kitbash` both stay, and stay load-bearing.** Kitbash keeps `ground()`, `surface()` and the six shared street materials, and remains the fallback for any plot the catalogue does not cover (an east or west entrance on a non-square plot, an `extend` square, a raised `maxStoreys`). Only `building()` is taken over, which is the smallest safe cut and is what D13 already describes. Backing the whole thing out is deleting one chain link.

**glb-buildings needs no change for this to ship.** That is a genuine strength of this shape and worth saying plainly. Specifically **not** needed: an `exports` field, a build step, an npm publish. Node refuses type stripping for any realpath under `node_modules` (measured), so publishing would require a `dist/` build, and this design sidesteps the question entirely by shelling out to the CLI in a throwaway `BUILDINGS_HOME` from `tools/`. A batch verb is not worth asking for either: 48 subprocess builds at 0.25 s is 12 seconds.

Three producer asks are worth making anyway, all additive:

1. **A golden-hash test** pinning the sha256 of a fixture document's GLB. Highest value of the three. It is the guard the pack's integrity currently borrows from luck.
2. **A `nameSeed` document field** defaulting to `name`, so the texture seed can be set without renaming the project. The four-palette trick works today by building the same look under four project names, which is a naming hack sitting in committed files.
3. **A strict-footprint option** zeroing `MAX_PROUD` and `MAX_ABOVE` against the document footprint, so an overhang is refused at build time rather than caught by our intake gate. These are module constants with no document field feeding them, so it is a producer contract change or nothing.

Minor, no action required: `boxes/glb/writer.ts:338` sets `asset.generator = 'glb-buildings'` and gltf-transform's `NodeIO.writeBinary` overwrites it, so every built file reports `glTF-Transform v4.4.2` and carries no provenance marker.

**Two other things this leaves open.** Night and emissive: the producer's facade tiles carry lit windows in an emissive map, and about 12% of windows will glow at noon unless the pack builder either strips emissive or the app drives `emissiveIntensity` from one shared day/night value. `game/kitbash/src/night/` is written and exported nowhere; somebody should decide whether that is the mechanism. And `METRICS.street.laneCells = 2` is dead, disagreeing with the 3-cell roadway `game/forge/src/layout/streets.ts` actually paints; a producer reading METRICS for street width gets 4 m instead of 6 m.

## 7. Build order

**Step 0, do this today, and treat it as a real go/no-go. About one hour of wall clock, eight minutes of model time.** Author one document by hand through the CLI: 12 m x 12 m, three storeys, ground band 4000 mm plus two bands of 3200 mm (so total height is exactly 10.4 m), style modern, drawn textures, door centred on side S, no balconies, no masts, no screens. Build it. Then do two things with it. First, `gltf-transform inspect` and count primitives and materials, which settles the 2-versus-4 atlas slot estimate every draw-call number in section 5 rests on. Second, load it through the existing spike viewer (`game/app/src/spike-glb.ts`, `?glb=`) at true scale next to a kitbash building and stand on the pavement. Everything below is contingent on that second look. The only evidence anyone currently has is four spike GLBs that are 82 to 113 m cyber towers, five to ten times taller than any plot the forge emits, judged from a console line. A 10.4 m block at 2,800 triangles with 128 and 256 pixel drawn tiles (roughly 10.7 px/m, against the kit's 1024 maps) is a completely different object and may read as flatter and cheaper than the kit's shopfronts. **If it loses, stop.** The correct spend then is facade work in the producer at small scale, and shrinking the kit's textures, not two new boxes.

**Step 1, one day.** `tools/build-buildings.ts` skeleton with the six refusal gates, run against that one document. Proves the height, overhang, absolute-path and slot gates before anything depends on them.

**Step 2, 1.6 to 2.1 hours of model time, overnight, offline.** Author 12 to 16 looks, footprint-agnostic (bays and bands via `bayCount`, `line`, `place`, never absolute facade columns, since a face is `round(width/0.1)` cells and a window at column 120 overflows an 8 m face with `E_OVERLAP`). Human review of each exemplar before anything is committed.

**Step 3, two days.** `game/blueprint`, including the coverage test that generates cities across the brief's parameter space and asserts `covers(demandOf(world)).ok`. That test is what keeps the catalogue honest as the forge changes.

**Step 4, two days.** `game/prefab` plus the atlas pass in the build tool. All 14 drawn tiles fit one 1024x512 colour atlas and one 512x512 emissive, with room to spare.

**Step 5, half a day.** `game/world` optional field, `game/forge` fork and design write, the `style` fix.

**Step 6, half a day.** `game/bundle` writer sha requirement, `game/app` `requires` enforcement and chain wiring, `docs/INDEX.md`, D13, changelog, `sources.json`.

**Step 7, measure.** Walk the city in the browser, read `renderer.info.render.calls` and a frame time at street level, in both the kitbash and prefab configurations, WebGPU and forced WebGL2. This is the number nobody has, and it decides whether instancing is ever worth chasing.

**Phase 2, optional, 1 to 1.6 hours of model time plus half a day.** Landmarks: mark a handful of forge sites `landmark` with a raised `maxStoreys`, hand-author 8 to 12 tall documents, bind them one to one. This is where the producer's real strength earns its keep and it is the difference between a varied city and a city with a skyline.

Roughly a week and a half of engineering plus one overnight model run, with a hard gate on the first hour.
