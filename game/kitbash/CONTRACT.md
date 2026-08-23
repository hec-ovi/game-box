# @gb/kitbash contract

contractVersion: 0.4.0

## Purpose

Builds a plot into a building made of Downtown City MegaKit pieces on a 2 m grid: the footprint it was given, the height its storeys ask for, its door on the wall the entrance faces, and a front that reads as the kind of place it is. Its windows look into furnished rooms and light up after dark, and it lines the pavements with street lamps. It also surfaces the ground the buildings stand on, out of the same kit's textures.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new KitDressing(kit, rest?)` | a `KitLibrary`, and the `Dressing` behind it (defaults to `@gb/scene`'s `Greybox`) | |
| `KitDressing.building(plot, size)` | a `@gb/world` `Plot`, `{ width, depth, height }` in metres | the size matches the plot: `width / rect.w` is the world's cell size |
| `KitDressing.streetlights(world, spacing?)` | a `@gb/world` `World`, metres between lamps (default `LAMP_SPACING`, 20) | the grid painted, so pavements and roads are where they will be |
| `KitDressing.setTime(hours)` | hours, 0 to 24, wrapping | cheap enough for every frame; a non-finite reading is ignored |
| `loadKit(scenes)` | one `THREE.Object3D`, or the array `GLTFLoader` hands back as `gltf.scenes` | a scene holding the packed kit, one named node per piece, one per ground surface and one per street piece |
| `placeholderKit()` | nothing | |
| `nightLook(hours)` | hours, wrapping | |
| `lampSpots(world, spacing?)` | as `streetlights` | |

`KitDressing` also carries `prop`, `character`, `pickup` and `surface` from the `Dressing` seam and passes every one of them straight to `rest`: the Downtown kit is a street kit, with no furniture and no people in it.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `building(plot, size)` | `THREE.Object3D` | origin at the centre of its base; one mesh per kit material, never one per piece; a child named `door` at the middle of the doorway, looking out |
| `streetlights(world)` | `THREE.Object3D` named `kit:streetlights` | one `kit:streetlights:posts:<n>` per district holding that district's lamps as an instanced mesh, and one `kit:streetlights:halo` holding every glow in one additive quad buffer. Districts run row-major, so the same town chunks the same way every run. A pack with no lamp in it gives the group empty |
| `setTime(hours)` | nothing | every window and every lamp in the city moves to that hour |
| `ground(kind)` | `THREE.Material` | the surface that kind of cell is made of, tiling at a real-world size; the same kind is always the same instance. A kit whose pack has no ground surfaces in it hands the question to `rest` |
| `loadKit` / `placeholderKit` | `KitLibrary` | `parts(piece)` gives geometry per material, in metres in the piece's own frame, `material(name)` gives the one shared instance, `has(piece)` answers for street furniture, `ground` holds the tiling surfaces when the pack carries them, and `night` is the city's clock reading |
| `KitLibrary.night` | a `CityNight` | `level` (0 by day, 1 in the dark) and `lit` (the share of rooms with the lights on) as node uniforms, plus `hours` and `setTime` |
| `nightLook(hours)` | `{ level, lit }` | what any hour of the day means, as plain numbers |
| `lampSpots(world, spacing?)` | `LampSpot[]` | where every lamp stands, in metres, and the way it faces |
| `PIECES`, `PIECE_IDS`, `KIT_MATERIALS`, `MODULE`, `RELIEF`, `GLASS`, `FAKE_INTERIOR`, `isGlazed` | the catalog, measured from the kit's own files, and the two material names windows hang on | |
| `FURNITURE`, `FURNITURE_IDS`, `LAMP`, `LAMP_POST`, `LAMP_LENS` | the street pieces and the materials they are painted with | |
| `ROOM_ATTRIBUTES`, `Room` | the room a pane looks into, and the vertex attributes it rides on: `roomOffset` (from this vertex to the middle of its room's window wall), `roomSize`, `roomLook` | |
| `GROUND_TEXTURES`, `GROUND_LOOKS` | the three tiling surfaces with the metres one tile covers, and what each cell kind takes from them | every kind in `@gb/world`'s `CELL` has a look |
| `RECIPES` | `Record<BuildingKind, Recipe>` | every kind in `BUILDING_KINDS` has one |

## Errors (closed set)

- `kit-incomplete`: `loadKit` was handed a scene with no node, or nothing drawable, for some catalog piece. Thrown as `KitIncomplete`, carrying `missing`, the piece ids it could not find. Street furniture is not in it: a pack without the lamp loads, it just has no lamps to place.
- `kit-unmergeable`: pieces sharing a material would not weld into one mesh, because their geometry does not agree attribute for attribute. Thrown as `KitUnmergeable` from `building`, carrying `material` and the `pieces` on it. A library from `loadKit` or `placeholderKit` cannot raise it, because both bring every part to one shape; a `KitLibrary` built by hand out of foreign geometry can.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, and `Greybox` as the layer behind it.
- `@gb/world` contract: `Plot`, `World`, `BUILDING_KINDS`, `METRICS`, `cellCentre`.
- `@gb/kit` contract: `Rng`, for determinism.
- `three`, `three/webgpu` and `three/tsl`: the window and lamp materials are node materials, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself.
- The art: Quaternius Downtown City MegaKit and the lamp from Quaternius' Modular Street Pack, both CC0, packed by `tools/build-kit.ts` into `assets/dist/downtown-kit.glb` (19 wall pieces, 3,403 triangles, 3 ground surfaces and 1 street lamp, 0.77 MB). The pack is meshopt-compressed and quantized, and its dedup step folds the kit's 10 material names into the 6 that have distinct textures. The ground surfaces are the kit's own textures, so the road costs nothing over the buildings: asphalt and its relief are one copy shared with the kit's own road piece, and only the paving and the earth are new (70 KB of the pack).

## Windows

A pane is any surface on the kit's `MI_Glass` material: that name is the hook the whole feature hangs on. Every glazed module is given a room at plan time and the room rides on the pane as three vertex attributes (`roomOffset`, `roomSize`, `roomLook`). The one glass material raymarches that box in the fragment shader and shades the floor, the back wall, a door, a sofa and a table it meets, so a facade has depth through it instead of a flat decal. No geometry, no texture, no draw: the technique is three's own `examples/jsm/generators/city/SkyscraperGenerator.js` (MIT).

- A room runs across one to three modules of one storey, so neighbouring windows share an interior and light up together.
- A pane carries where it sits inside its own room, never where the room is. Everything the raymarch uses is an offset or a direction, so the numbers stay true whichever frame the pane is drawn in: `@gb/scene` puts every building in the city into shared buffers, which moves the vertices and leaves the distance from a pane to the middle of its own window wall alone.
- Every room carries a key, 0 to 1. It is lit while the city's lit share is above its key, so the same rooms come on in the same order every night, none of them flickers, and a room with a low key stays lit through the small hours while a high one only burns in the evening.
- The kit paints a flat grey plane behind its own glass (`MI_FakeInterior`). The pane draws a real room, so that plane is never packed into a building, which is a mesh and about 33 triangles a building saved.

## Invariants

- One world unit is one metre. Wall pieces are 2 m across and 3 m tall; the ground floor is `METRICS.building.groundFloorHeight` and closes with the kit's own metre-tall band, and storeys above stretch their module the 7% it takes to reach `METRICS.building.storeyHeight`.
- A building's walls stand on the plot boundary. Window and trim relief reaches up to `RELIEF` (0.05 m) past it on each face, and nothing else does.
- A building is exactly as tall as the height it was given: the roof deck sits 0.2 m below the wall top, so the walls read as a parapet round it.
- The door is on the wall the entrance cell sits against, in the module nearest the doorstep `@gb/scene` puts on the pavement.
- Same seed, same city, always. Every draw comes from a `@gb/kit` `Rng` on the plot's id, kind and style, forked per feature (`rhythm`, `rooms`), so adding a feature later cannot move the windows a city already has. Where the lamps stand is read off the grid and draws nothing at all.
- This box holds no clock. It remembers the hour it was told and renders it; whoever owns the clock calls `setTime`. Moving the city through the evening is two uniform writes, about 0.25 us, however many buildings and lamps are standing.
- The kit loads once. Buildings clone geometry out of the library, and every piece sharing a material is welded into one mesh, so a building arrives as as many meshes as it has materials on it (4 or 5 out of the packed kit), not as many as it has pieces (28 to 146). Lit windows add none of their own. `@gb/scene` then puts every building on one material into one buffer, so a whole town is a draw per material; what this box owes that arrangement is indexed meshes on shared materials, which is exactly what the weld produces.
- Lamps stand on pavement cells that touch a road, at the kerb, half a metre back from the edge so the pavement stays walkable. A kerb is read as a run and its lamps are spread evenly along it, at least one however short the run is: a stretch of street with no lamp on it is a stretch you cannot see.
- The lamps are cut into districts of `DISTRICT` (48 m) and each district's posts are one instanced draw with a bounding volume of its own, because a kit lamp is 1,028 triangles and one volume over the whole town can never be culled: standing on one street you would pay for the lamps on every other, in the shadow pass as well as the frame. The haloes stay in one buffer for the city, because two triangles a lamp is not worth a draw to cull. One material for every post and one for every halo, whatever the size of the town, and both go out with the daylight.
- A piece is taken in the frame the pack gives it, transforms above the mesh baked in: the pack carries a piece's dequantization on its node, so that transform is scale, not placement.
- Every part is brought to one shape as it loads: float position, normal and UV, indexed, nothing else. Kit exports are uneven (quantized positions, a second UV set, vertex colours, meshes with no UVs at all) and two geometries only weld when they agree attribute for attribute.
- The catalog is measured, not guessed: `tools/measure.ts` reads the kit's glTF files, and a test fails if the numbers in `src/catalog/pieces.ts` drift from them, or if the shipped pack does not hold its pieces at them.
- The ground tiles at a real-world size. `@gb/scene` lays ground UVs out in metres, so a surface that should repeat every `tile` metres is set to `repeat = 1 / tile`: asphalt and earth every 4 m, paving every 2 m, which lays the pavement in half-metre flags whatever the cell size is.
- Cells share surfaces, and a kind is always the same material instance: a city has thousands of cells and six materials for them. The pavement and the ground a building stands on are one and the same.
- Colour comes from the tint over a shared texture, not from a texture each: the same earth is a park greened down and bare land untinted, and the kit's warm marble is the pavement's concrete grey.
- Water has no colour map: it is its own colour, roughened by the road's relief so the light breaks up on it.
- The mountain ring takes a plain rock colour and no texture, because `@gb/scene` builds it from blocks whose faces are UV'd 0 to 1 rather than in metres: nothing tiles on them at a real size.
- The ground borrows the kit's textures without changing them: the maps come off the pack cloned, so tiling the road at 4 m leaves the kit's own road piece painted the way it was authored.
- The ground is all or nothing. A pack missing any of the three surfaces gives none of them, and `ground` falls through to the dressing behind it, because half a textured street is worse than the greybox.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.

## What it costs

Measured headless in Node on 350 buildings and 445 lamps round 49 blocks of a 157 by 147 town, with the shipped pack, and again in Chrome on the WebGL2 fallback with the camera standing at the spawn:

| | meshes | draws at the spawn | triangles at the spawn |
|---|---|---|---|
| buildings, in `@gb/scene`'s batches | 5 | 5 | 1,925,087 of 2,941,704 |
| 445 street lamps | 44 | 30 | 309,430 of 457,462 |

A building is 8,405 triangles over 4.2 kit materials. It costs no draw of its own: `@gb/scene` puts every building on one material into one buffer, so a town of any size is a draw per material. What this box owes that arrangement is indexed meshes on shared materials, which is what welding a building's pieces per material already produces.

Chunking the lamps into 48 m districts turned two uncullable draws carrying 457,462 triangles into 44 draws of which 30 are reached from the spawn, carrying 309,430. Halving the district to 24 m buys 11,000 triangles for 69 more draws, and doubling it to 96 m costs 63,000 for 30 fewer, so 48 m is where it settles.

Windows and their rooms add no draw and no triangle: they ride on the panes the buildings already had (about 194 triangles of glass a building) as three vertex attributes.

`setTime` is 0.25 us: two uniform writes.

## Standing it up

```ts
const dressing = new KitDressing(loadKit(gltf.scenes))
scene.add(buildCity(world, dressing).root)
scene.add(dressing.streetlights(world))
// every frame, or whenever the hour changes
dressing.setTime(player.clock.hour + player.clock.minute / 60)
```

## How to modify this blackbox safely

Changing what a kind of ground looks like is a change to `src/ground/surfaces.ts` alone; a new tiling surface is an entry there plus the kit textures it is made of in `tools/ground-surfaces.ts`, then a rebuild. Changing what a kind of building looks like is a change to `src/catalog/recipes.ts` alone, and what an hour of the day means to `src/night/clock.ts` alone. Adding a kit piece means adding it to `src/catalog/pieces.ts` with bounds from `node tools/print-catalog.ts`, then rebuilding the pack with `node tools/build-kit.ts`; a piece of street furniture goes in `src/catalog/furniture.ts` and `tools/street-furniture.ts` instead, because it is placed whole rather than as a wall module. How wide a lamp district is lives in `src/street/districts.ts` alone. The pack builder refuses to finish if a piece is not in the output under a name `loadKit` looks for. Wall pieces have to be authored the way the kit authors them (outer face on z = 0, body into negative z, width centred on x, base on y = 0), and the pack has to leave them there, or the composition rules put them in the wrong place; `tests/pack.test.ts` holds the shipped pack to the catalog's own numbers. Run `pnpm --filter @gb/kitbash test`.
