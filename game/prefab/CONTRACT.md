# @gb/prefab contract

contractVersion: 0.2.0

## Purpose

Dresses a plot with a whole building out of one committed pack: the footprint it was given, the height its storeys ask for, its door on the wall the entrance faces, and a front that reads as the kind of place it is. Its windows are cut out of the wall in the shader and look into photographed rooms that light up after dark. Every building in the city is drawn with one material, so a town of any size is one draw.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new PrefabDressing(library, rest)` | a `Library`, and the `Dressing` behind it | `rest` answers for anything the pack has no shape for, so it should be a real kit rather than a greybox |
| `PrefabDressing.building(plot, size)` | a `@gb/world` `Plot`, `{ width, depth, height }` in metres | the size matches the plot, and the world's cell size is 2 m |
| `loadPrefab(night)` | a `@gb/kitbash` `CityNight` | the pack’s five files are served beside the box; in a bundler they are followed from `src/load.ts` |
| `Library.of({ catalogue, scenes, atlas, night })` | a `Catalogue`, the pack's parsed scenes, a `PrefabAtlas`, a `CityNight` | for tests and for anyone loading the pack themselves |
| `new InteriorWindows(rooms, night, finishes)` | the room strip as a `DataArrayTexture`, a `CityNight`, the pack's list of finishes | the finishes in the order the two facade strips stack them |
| `windowsOn(finish)`, `glassShareOf(kind)` | a finish name, a `WindowKind` | |
| `Catalogue.parse(value)` | [pack/buildings.json](pack/buildings.json) | any untrusted JSON |
| `catalogue.design(plot, size)` | as `building` | |
| `catalogue.covers(demand)` | any list of `Bucket`s | |
| `bucketOf(plot, size)` | as `building` | |
| `orient(geometry, turns, mirror, rooms?)` | a pack geometry, 0 to 3 quarter turns, whole pictures to slide the rooms along | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `building(plot, size)` | `THREE.Object3D` | origin at the centre of its base, facing north unturned; one mesh on the one prefab material, plus the signs the dressing behind would have hung. A plot the catalogue has no shape for comes back from `rest` untouched |
| `loadPrefab(night)` | `Library` | the pack, checked against its own manifest |
| `Library.geometry(id)` | `THREE.BufferGeometry` | the model in its own frame, door on the south wall, one metre to one unit |
| `Library.material` | `THREE.Material` | the single material every prefab building in the city is drawn with, named `MATERIAL_NAME` |
| `Catalogue.models` | `ModelSpec[]` | every model in the pack, sorted by id |
| `catalogue.design(plot, size)` | `{ model, mirror, rooms }`, or undefined | which building this plot gets, which way round, and where along the wall its rooms start. Undefined means the catalogue has nothing this shape |
| `catalogue.bucket(bucket)` | `ModelSpec[]` | every model of that shape, in id order |
| `catalogue.covers(demand)` | `{ ok: true }` or `{ ok: false, missing }` | which shapes the catalogue has no building for |
| `catalogue.kindsCovered()` | `BuildingKind[]` | every trade some look claims |
| `bucketOf(plot, size)` | `Bucket` | `{ front, depth, storeys }` in metres, read in the door's frame |
| `everyBucket()`, `FRONTS`, `DEPTHS`, `STOREYS` | the shapes a catalogue is expected to hold | |
| `heightOf(storeys)` | metres | the height `@gb/scene` puts the plot at |
| `orient(geometry, turns, mirror, rooms?)` | `THREE.BufferGeometry` | the model turned onto its plot, wound to face out, its uv slid a whole number of pictures along |
| `turnsFor(facing)` | 0 to 3 | quarter turns that put a south door on that wall |
| `prefabMaterial(atlas, night)` | `THREE.Material` | the material, for anyone building a library by hand |
| `PROUD`, `HEIGHT_TOLERANCE`, `GLOW`, `LAYER_ATTRIBUTE`, `MATERIAL_NAME` | metres, a multiplier and two names | how far trim may reach past the plot, how exact a wall has to be, how hard a lit face burns, and the two names the pack is written with |

## Errors (closed set)

- `invalid-catalogue`: the manifest failed its schema. Thrown as `InvalidCatalogue`, carrying `violations`.
- `pack-changed`: one of the pack's four binary files does not hash to what the manifest says. Thrown as `PackChanged` from `loadPrefab`, carrying `file`, `expected` and `found`. The pack is committed bytes; a pack edited under the game refuses to load rather than quietly drawing a different city than the seed says.
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

Five committed files, and they are the whole art supply.

- `pack/buildings.glb`, 3.0 MB: 512 models, one mesh each, all on one material, welded, quantized and meshopt-packed.
- `pack/buildings-colour.png` and `pack/buildings-emissive.png`, 208 kB and 5 kB: fourteen 256 px layers stacked into a strip each, the surface a face is painted and the part of it that glows.
- `pack/buildings-rooms.png`, 319 kB: twelve 256 px rooms in the same shape, the pictures every window in the city looks into.
- `pack/buildings.json`, 159 kB: the manifest. Pack id, version, the producer commit, the sha256 of all four binaries, what each atlas layer paints, and one entry per model: its shape, the trades it suits, its triangle count and where its door is.

A strip's rows already sit in the order an array texture wants them, so the runtime decodes one image and hands the bytes straight to the GPU with no copying in between.

It is bytes, not a recipe. Rebuilding it on another machine is a new version, never a no-op, because the producer and its dependencies decide the exact numbers; on one machine it is byte for byte reproducible, and the build tool proves that by hashing what it wrote.

## What a wall wears

Two tiers, and the split is the whole reason a building is 217 triangles.

**Above the street level a bay is a bay of curtain wall.** Three panes by two, in a surround, with an office or a flat behind them. A whole storey is still eight triangles: the wall picture is only the pier and the spandrel, and the opening, the mullions and the room are all cut out of it in the fragment shader.

**The street level is specific.** One wide pane in a heavy surround with a shop behind it, a door, a fascia band over it and tubes across the frontage. It is the only part anybody stands in front of, and on the one building in eight that opens it is where the way in is.

The wall pictures are **drawn from code**, in `tools/walls.ts`: a panel field with grain in it, a joint up each bay, a slab edge under each floor and the darker reveal a window is set back into. That is all a picture can usefully hold at this scale. A wall picture covers four bays by two floors at 256 pixels, which is about 21 pixels a metre, and a mullion is three centimetres, so a drawn one would be a fifth of a texel. Four families, one picture each, and a look belongs to one of them.

They are handed to the producer through `add-texture`, which is the verb that names the file, pairs the glow map and records the grid the picture holds. That grid is what fixes the uv scale the shader reads a bay off, so the two have to agree; both take it from the same `WindowKind`.

## Windows, and the rooms behind them

A window is not in the picture. `src/interior.ts` marches the view ray through the box behind each bay and samples a photographed room on whichever face of it the ray meets, so a facade has depth through it from the pavement instead of a lit rectangle. The technique is interior mapping. `@gb/kitbash` does the same for the kit's modelled panes and carries the room on the vertices, because it has vertices to carry it on; here a storey is eight triangles and there are none to carry anything.

- **It costs no geometry, no draw and no vertex.** What a fragment needs is where it sits in the picture, which the uv already says, and how many metres wide a bay is, which the surface's own derivatives already say. The metre scale is read off the surface rather than assumed, so a bay is the size it really is however the producer stretched the picture onto that wall, and a mirrored building comes out right.
- **The bay is the room.** The picture tiles, so the bay index runs on along the wall and never repeats with the picture: the pattern of which windows are lit does not repeat every twelve metres the way a painted one did.
- **Twelve rooms, in two banks.** Six for above the street (offices, flats, a corridor, a store room) and six for the pavement (a bar, a noodle counter, a shop, a clinic, a workshop, a lobby). A window under `4.6` m looks into the street bank. Each is seen small, through glass, at an angle, after dark, and never twice side by side, and each is tinted by one of eight light colours and mirrored or not, so twelve pictures cover a city.
- **Which room a bay looks into is a pure function of where the bay is.** The bay index is hashed for the room, its light colour, whether it is mirrored and its key. There is no `Rng` and no frame state on this path, so a building draws the same rooms on every machine and every run. Two plots that drew the same model start at different bays: `catalogue.design` gives each plot a whole number of pictures to slide its uv along, which the picture tiles through and the hash does not.
- **A room is lit while the city's lit share is above its key**, the same rule `@gb/kitbash` uses, so the same rooms come on in the same order every night and none of them flickers. A shopfront takes about a third of the key an office does, because a street of shops is lit and a street of offices is not.
- **The picture belongs on the back wall.** The floor, the ceiling and the side walls sample the row or the column of it they meet, taken well down, so what would have been a smear reads as a surface out of the light. A pane seen along the street catches a fixed cool sheen instead, because at that angle a shop window is a smear of wet road under neon rather than a view of the shop.
- **The grid melts rather than aliases.** The opening and the mullions are feathered by how much of the picture one pixel covers, and once that is more than a mullion the bay fades to the share of itself that is glass, which is what a mip of a drawn one would have done.
- **A band under 1.6 m gets no windows.** A one storey building carries a 0.8 m parapet on the same finish as its wall, and a window squashed into that is not a window.

The room pictures are generated, not drawn: twelve prompts in [rooms/prompts/](rooms/prompts/), one image each through the Grok route in `tools/textures/README.md`, cropped and sized by `tools/draw-rooms.ts` and committed as `rooms/*.png`. They are ours, from our own prompts, so they travel inside a world file. Nothing in the build calls a model: it stacks the committed pictures.

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
- Which layers have windows in them comes from the manifest's own list of finishes, so the runtime reads what the pack says rather than assuming it. A layer with no windows costs one comparison and no texture fetch.
- Everything the room raymarch uses is an offset or a direction in the bay's own frame, so `@gb/scene` batching a building into a shared buffer moves the vertices and leaves the room where it was.
- Nothing glows in daylight. The rooms and the neon are the night level times what is behind the glass, which is the same `CityNight` the kit's windows and lamps read, so one `setTime` moves the whole street.
- Signage stays where it was written. `@gb/kitbash` puts every sign in the city on one material and publishes its name; this lifts those meshes off the kit's building and hangs them on the prefab, so a prefab street still has names over its doors and the town's signage is still one draw.
- The pack is checked on the way in: all four binary files have to hash to what the manifest says and the mesh has to hold every model it names, or nothing loads. It is committed art, and the one thing standing between an edited pack and a city that quietly draws something else.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.

## What it costs

Measured in Chrome on the WebGL2 fallback at 1568 by 764, standing in a street of a 4 block city (174 plots, 4 by 4 blocks, density 1, 21:30, wet), against the same city dressed in the Downtown kit alone. The last column is the same pack with painted windows, before the rooms went in:

| | the kit | the pack | painted windows |
|---|---|---|---|
| batches the buildings draw in | 5 | 1, plus the shared sign batch | 1 |
| triangles in the building buffers | 2,209,476 | 37,848 | 37,848 |
| the scene's vertex and index buffers | 141.9 MB | 5.8 MB | 5.8 MB |
| triangles submitted at the camera | 1,524,999 | 94,681 | 94,681 |
| draw calls at the camera | 55 | 51 | 51 |
| textures resident | 119.6 MB over 50 | 66.3 MB over 32 | 62.1 MB over 31 |
| textures the buildings bring | none of their own | 13.8 MB | 9.8 MB |

The rooms cost **4.0 MB of texture and nothing else**: no draw, no triangle, no vertex attribute, no batch, and the mesh file did not change a byte. Twelve 256 px layers with their mips, on top of the two 14-layer strips the facades already carried. That is the ceiling worth holding: a room layer is 0.35 MB with its mips, so two dozen rooms would be 8.4 MB and the buildings would be paying more for their interiors than for their walls.

A prefab building is 217 triangles against a kit building's 12,700, and more than half of those 217 are the neon tubes. The kit stays loaded for the ground, the street surfaces, the lamps, the signage and any plot the catalogue has no shape for, but its wall materials are never drawn, so the resident texture comes down even though the pack brings 13.8 MB of its own.

The shader bill is one branch on every prefab fragment and, on the fragments that are glass, about thirty instructions and one texture fetch. Everything a facade used to be is still one fetch of the wall picture.

The frame at that camera is the same to within noise in the last two columns, because at this many buildings the frame is the post chain and the street lamps rather than the walls. What changes is what the number does as the city grows: the buildings stop being the thing that grows.

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

Adding a look is a new file in `looks/` and a rebuild; it grows every shape at once and changes what some plots already draw, so bump the pack version with it. Changing what a look wears is that one file, and what the wall around a window is made of is `tools/walls.ts` alone. Changing which shapes the catalogue covers is `src/bucket.ts` and a rebuild, and the coverage test will tell you what the forge is actually cutting. How far trim may stand off a plot is `src/fit.ts` alone, how hard a lit face burns is `GLOW` in `src/material.ts`, and which producer material lands on which layer is `tools/layers.ts`.

How a window is laid out and how deep the room behind it runs are the two `WindowKind`s at the top of `src/interior.ts`, and `tools/walls.ts` reads the same two, so a change to a grid moves the picture with it and a rebuild is needed. How bright a room burns, how dark its side walls are and what colours it is lit in are the constants beside them, and none of those needs a rebuild. Adding or replacing a room is a new prompt in `rooms/prompts/`, one image through the Grok route in `tools/textures/README.md`, `node tools/draw-rooms.ts <folder of raw images>` to crop and size it, an entry in `ROOM_PICTURES` in `src/rooms.ts` with its bank, and a rebuild.

The pack's five files are committed art: never hand-edit them, because the manifest's hash is what the loader checks. Run `pnpm --filter @gb/prefab test`.
