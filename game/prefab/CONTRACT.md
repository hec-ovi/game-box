# @gb/prefab contract

contractVersion: 0.1.0

## Purpose

Dresses a plot with a whole building out of one committed pack: the footprint it was given, the height its storeys ask for, its door on the wall the entrance faces, and a front that reads as the kind of place it is. Every building in the city is drawn with one material, so a town of any size is one draw.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new PrefabDressing(library, rest)` | a `Library`, and the `Dressing` behind it | `rest` answers for anything the pack has no shape for, so it should be a real kit rather than a greybox |
| `PrefabDressing.building(plot, size)` | a `@gb/world` `Plot`, `{ width, depth, height }` in metres | the size matches the plot, and the world's cell size is 2 m |
| `loadPrefab(night)` | a `@gb/kitbash` `CityNight` | the pack's four files are served beside the box; in a bundler they are followed from `src/load.ts` |
| `Library.of({ catalogue, scenes, atlas, night })` | a `Catalogue`, the pack's parsed scenes, two `DataArrayTexture`s, a `CityNight` | for tests and for anyone loading the pack themselves |
| `Catalogue.parse(value)` | [pack/buildings.json](pack/buildings.json) | any untrusted JSON |
| `catalogue.design(plot, size)` | as `building` | |
| `catalogue.covers(demand)` | any list of `Bucket`s | |
| `bucketOf(plot, size)` | as `building` | |
| `orient(geometry, turns, mirror)` | a pack geometry, 0 to 3 quarter turns | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `building(plot, size)` | `THREE.Object3D` | origin at the centre of its base, facing north unturned; one mesh on the one prefab material, plus the signs the dressing behind would have hung. A plot the catalogue has no shape for comes back from `rest` untouched |
| `loadPrefab(night)` | `Library` | the pack, checked against its own manifest |
| `Library.geometry(id)` | `THREE.BufferGeometry` | the model in its own frame, door on the south wall, one metre to one unit |
| `Library.material` | `THREE.Material` | the single material every prefab building in the city is drawn with, named `MATERIAL_NAME` |
| `Catalogue.models` | `ModelSpec[]` | every model in the pack, sorted by id |
| `catalogue.design(plot, size)` | `{ model, mirror }`, or undefined | which building this plot gets. Undefined means the catalogue has nothing this shape |
| `catalogue.bucket(bucket)` | `ModelSpec[]` | every model of that shape, in id order |
| `catalogue.covers(demand)` | `{ ok: true }` or `{ ok: false, missing }` | which shapes the catalogue has no building for |
| `catalogue.kindsCovered()` | `BuildingKind[]` | every trade some look claims |
| `bucketOf(plot, size)` | `Bucket` | `{ front, depth, storeys }` in metres, read in the door's frame |
| `everyBucket()`, `FRONTS`, `DEPTHS`, `STOREYS` | the shapes a catalogue is expected to hold | |
| `heightOf(storeys)` | metres | the height `@gb/scene` puts the plot at |
| `orient(geometry, turns, mirror)` | `THREE.BufferGeometry` | the model turned onto its plot, wound to face out |
| `turnsFor(facing)` | 0 to 3 | quarter turns that put a south door on that wall |
| `prefabMaterial(atlas, night)` | `THREE.Material` | the material, for anyone building a library by hand |
| `PROUD`, `HEIGHT_TOLERANCE`, `GLOW`, `LAYER_ATTRIBUTE`, `MATERIAL_NAME` | metres, a multiplier and two names | how far trim may reach past the plot, how exact a wall has to be, how hard a lit face burns, and the two names the pack is written with |

## Errors (closed set)

- `invalid-catalogue`: the manifest failed its schema. Thrown as `InvalidCatalogue`, carrying `violations`.
- `pack-changed`: one of the pack's three binary files does not hash to what the manifest says. Thrown as `PackChanged` from `loadPrefab`, carrying `file`, `expected` and `found`. The pack is committed bytes; a pack edited under the game refuses to load rather than quietly drawing a different city than the seed says.
- `library-incomplete`: the mesh file is missing a model the manifest names. Thrown as `LibraryIncomplete`, carrying `missing`.

A plot the catalogue has no shape for is not an error: `building` hands it to the dressing behind.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, and `storeyHeight`.
- `@gb/kitbash` contract: `CityNight`, so one clock lights the prefabs and the kit together, and `SIGN`, which names the material every sign in the city is drawn with.
- `@gb/world` contract: `Plot`, `BUILDING_KINDS`.
- `@gb/kit` contract: `Rng` for the pick, `contract` for the manifest.
- `three`, `three/webgpu` and `three/tsl`: the building material is a node material, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself.
- The art: [pack/](pack/), built offline from the looks in [looks/](looks/) by `tools/build-buildings.ts` through the repo owner's own `glb-buildings` CLI (MIT). The producer is not a dependency of the game: it is shelled out to from `tools/`, and nothing it uses reaches the runtime.

## The pack

Four committed files, and they are the whole art supply.

- `pack/buildings.glb`, 2.9 MB: 512 models, one mesh each, all on one material, welded, quantized and meshopt-packed.
- `pack/buildings-colour.png` and `pack/buildings-emissive.png`, 132 kB and 6 kB: fourteen 256 px layers stacked into a strip each, the colour a face is painted and the part of it that glows. A strip's rows already sit in the order an array texture wants them, so the runtime decodes one image and hands the bytes straight to the GPU.
- `pack/buildings.json`, 158 kB: the manifest. Pack id, version, the producer commit, the sha256 of all three files, and one entry per model: its shape, the trades it suits, its triangle count and where its door is.

It is bytes, not a recipe. Rebuilding it on another machine is a new version, never a no-op, because the producer and its dependencies decide the exact numbers; on one machine it is byte for byte reproducible, and the build tool proves that by hashing what it wrote.

## What a wall wears

Two tiers, and the split is the whole reason a building is 217 triangles.

**Above the street level it is a picture on a flat face.** A wall is a few hundred small panes, mostly dark, a handful alight in warm and cool, in runs rather than scattered evenly, because a lit floor and a lit corner are what a building at night actually looks like. None of it is geometry: a whole storey is eight triangles and the windows are in the image.

**The street level is specific.** A lit shop window, a door, a fascia band over it, tubes across the frontage. It is the only part anybody stands in front of, and on the one building in eight that opens it is where the way in is.

Both pictures are **drawn from code**, in `tools/windows.ts`, rather than generated with an image model. A window grid is a few lines of arithmetic; it tiles by construction, so there is no seam to hide and no prompt to re-run; and it comes out the same on every machine, which is what the pack's byte-for-byte promise needs. `@gb/kitbash` draws its sign letters the same way and for the same reasons. They are handed to the producer through `add-texture`, which is the verb that names the file, pairs the glow map and records the grid the picture holds.

A wall picture holds four bays by two floors, 12 by 6.4 m, at 256 pixels: about 21 pixels a metre, so a window mark is half a dozen pixels across. A shopfront holds two bays by one floor, 6 by 3.2 m, at the same size, because it is seen from a metre away.

Four families, one picture each, and a look belongs to one of them. That is what stops a street being one building repeated.

## How a catalogue is made

A model writes a **look** by hand, offline, once: a small JSON saying what a building of that kind wears, with no reference to how big it is. Eight of them live in [looks/](looks/) and they are about fifteen lines each.

`tools/build-buildings.ts` replays every look at every shape the city cuts. That is 8 looks by 64 shapes, 512 models, in about two minutes of wall clock and no model time at all. Each one is driven through the `buildings` CLI verb by verb, the way its own skill says to drive it, in a throwaway home of its own.

What comes back is measured before it is allowed in, and the refusals are named:

- `wrong-height`: the walls are not exactly `4 + (storeys - 1) * 3.2` m tall, to the millimetre.
- `overhangs`: something reaches more than `PROUD` past the plot, in any direction.
- `faces-wrong-way`: the door is not on the south wall, which is the wall the runtime turns onto the street.
- `absolute-path`: a texture or a buffer points at a file on the machine that built it.
- `placed-crooked`: a band is turned or scaled rather than lifted.
- `unknown-finish`: the model wears something the pack has no layer for, which is how a balcony, a screen, a pipe or a mast is kept out.

The `cyber` style stands a lattice mast and its guys on every roof, taller than any building the forge cuts. Anything rising past the relief budget is left out before the model is measured, so the mast comes off without touching the producer.

Then the whole pack is read back the way the game reads it and measured again, because welding and quantization happen after the gates and the promise is about the committed bytes.

Run it with `node tools/build-buildings.ts`. It needs `glb-buildings` beside the checkout, or `GLB_BUILDINGS` pointing at it.

## Invariants

- One world unit is one metre. A model is baked at its plot's exact footprint and height and is never scaled, so its windows are the size they were drawn.
- A building is exactly as tall as the city says its plot is. Only lit trim reaches past that, and only by `PROUD` (0.2 m): a neon tube and the bracket it stands on, sideways at the shopfront and upwards at the parapet. Plots in a block abut, so a building already shares its relief with the one next door; `@gb/kitbash` reaches 5 cm with its window trim and 8 cm with a flat sign, and this is the same arrangement one step louder. Nothing hangs out over the street the way a kit blade sign does.
- **Same seed, same city, forever, whether or not a model is running.** The pick is a pure function of the plot and the committed pack: an `Rng` on the plot's own id, kind and style, forked per feature, drawing from no shared stream. Nothing on this path but the world file, the pack and three.js. Not the language model, not the sidecar, not the producer, not `@gltf-transform`.
- The pick chooses from members sorted by id, so what order the manifest happens to list them in can never reach a street.
- Growing the catalogue re-skins the buildings in the shapes it touches. The pack carries a version and a hash and is committed, which is what makes that a reviewed change rather than a surprise. A world file names nothing here, so nothing in a shared file can disagree with what it draws.
- Every model declares which trades it suits, and the pick filters on that before it draws. Where nothing in a shape claims the trade, the whole shape answers, so coverage stays provable and a chapel is never left bare.
- The catalogue covers every shape the forge can cut up to four storeys: four street frontages by four depths by four storey counts, sixty-four shapes, eight looks in each. A taller plot, a cell size that is not 2 m, or a footprint outside that range is handed to the dressing behind, which is why `@gb/kitbash` stays load-bearing.
- Turning a model onto its plot is a swap and a sign flip, never a sine, so the same model lands on the same coordinates on every machine. Mirroring happens in the model's own frame before the turn, so the door stays put and only the facade swaps hands, and every triangle is wound back so it still faces out.
- One material for every prefab building in the city. Which picture a face wears rides on its vertices as a layer index into an array texture, so `@gb/scene` puts the whole town into one buffer and draws it once. An array rather than an atlas because the producer's wall pictures tile across a wall, and only a layer of its own lets the sampler wrap one without bleeding into the picture next door.
- Nothing glows in daylight. The lit windows and the neon are the emissive map times the city's own night level, which is the same `CityNight` the kit's windows and lamps read, so one `setTime` moves the whole street.
- Signage stays where it was written. `@gb/kitbash` puts every sign in the city on one material and publishes its name; this lifts those meshes off the kit's building and hangs them on the prefab, so a prefab street still has names over its doors and the town's signage is still one draw.
- The pack is checked on the way in: all three binary files have to hash to what the manifest says and the mesh has to hold every model it names, or nothing loads. It is committed art, and the one thing standing between an edited pack and a city that quietly draws something else.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.

## What it costs

Measured in Chrome on the WebGL2 fallback at 1568 by 764, standing in a street canyon of a 4 block city (154 plots, 4 by 4 blocks, density 1, 21:30, soaked), against the same city dressed in the Downtown kit alone:

| | the kit | the pack |
|---|---|---|
| batches the buildings draw in | 6 | 1, plus the shared sign batch |
| triangles in the building buffers | 1,434,828 | 30,352 |
| building vertex buffers | 86.8 MB | 2.7 MB |
| triangles submitted at the camera | 862,297 | 152,905 |
| draw calls at the camera | 41 | 37 |
| scene build | 738 ms | 579 ms |
| textures the buildings add | none of its own | 9.8 MB, two 14-layer array textures with their mips |

A prefab building is 217 triangles against a kit building's 9,300, and more than half of those 217 are the neon tubes. The kit stays loaded for the ground, the street surfaces, the lamps, the signage and any plot the catalogue has no shape for, so its 0.77 MB pack and its textures are still resident: the pack **adds** 9.8 MB of texture and **removes** 84 MB of vertex buffer.

The frame at that camera is the same to within noise in both, because at 154 buildings the frame is the post chain and the street lamps rather than the walls. What changes is what the number does as the city grows: the buildings stop being the thing that grows.

## Standing it up

```ts
const library = loadKit(gltf.scenes, world.theme)
const kit = new KitDressing(library, new Greybox())
const dressing = new PrefabDressing(await loadPrefab(library.night), kit)
scene.add(buildCity(world, dressing).root)
scene.add(kit.streetlights(world))
// every frame, or whenever the hour changes: one call moves both
kit.setTime(player.clock.hour + player.clock.minute / 60)
```

## How to modify this blackbox safely

Adding a look is a new file in `looks/` and a rebuild; it grows every shape at once and changes what some plots already draw, so bump the pack version with it. Changing what a look wears is that one file, and what a wall or a shop window is made of is `tools/windows.ts` alone. Changing which shapes the catalogue covers is `src/bucket.ts` and a rebuild, and the coverage test will tell you what the forge is actually cutting. How far trim may stand off a plot is `src/fit.ts` alone, how hard a lit face burns is `GLOW` in `src/material.ts`, and which producer material lands on which layer is `tools/layers.ts`. The pack's four files are committed art: never hand-edit them, because the manifest's hash is what the loader checks. Run `pnpm --filter @gb/prefab test`.
