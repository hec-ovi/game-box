# @gb/furnish contract

contractVersion: 0.4.0

## Purpose

Dresses the inside of a building: every piece of furniture the generator can place, built from parameters to the cells of floor the room planner claims and to the height a body meets it at, in one of two interior languages, on a floor and walls that tile at real-world size.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new FurnishDressing(kit, rest?, style?)` | a `FurnishLibrary`, the `Dressing` behind it (defaults to `@gb/scene`'s `Greybox`), and `'corpo'` or `'home'` (defaults to `'corpo'`) | |
| `FurnishDressing.as(style)` | `'corpo'` or `'home'` | |
| `FurnishDressing.prop(prop)` | a `@gb/world` `FurnitureProp` | |
| `FurnishDressing.surface(part)` | `'floor'`, `'wall'` or `'ceiling'` | |
| `loadFurnish(scenes, seed?)` | one `THREE.Object3D`, or the array `GLTFLoader` hands back as `gltf.scenes`, and the town's seed | a scene holding the packed interior surfaces |
| `furnishKit(seed?)` | the town's seed | |

`FurnishDressing` also carries `building`, `character`, `pickup` and `ground` from the `Dressing` seam and passes every one of them straight to `rest`: this box answers for the inside of a building and nothing else.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `prop(prop)` | `THREE.Mesh` | one indexed mesh on the one shared material, origin at the centre of its base, front looking north, inside the cells it declares and no further. Geometry is shared with every other copy of that prop in that language, so a second chair is a new object over the same buffer |
| `surface(part)` | `THREE.Material` | the floor, walls or ceiling of a room in this dressing's language, tiling at the real-world size of its image whatever size the room is; the same part in the same language is always the same instance. A pack with no surfaces in it hands the question to `rest` |
| `as(style)` | `FurnishDressing` | the same library and the same material in the other language |
| `loadFurnish` / `furnishKit` | `FurnishLibrary` | `geometry(prop, style)` gives the built mesh's buffer, `contact(prop)` how high off the floor a body meets it, `material` the one shared instance, and `surfaces` the tiling floor and walls when the pack carries them |
| `PROP_SPECS` | `Record<FurnitureProp, PropSpec>` | **what `@gb/forge` places from**: `cells` the footprint in 10 cm room cells, `contact` the surface a body meets, `height` for a piece nobody touches, `staffContact` for a piece worked from both sides, `onSurface` for a piece that belongs on a worktop |
| `footprintOf(prop)` | `{ width, depth }` | the same footprint in metres |
| `CELL` | metres | one room cell: 0.1 |
| `FurnishLibrary.contact(prop)` | metres, or nothing | the drawn height of the seat, mattress, worktop or counter top, measured off the geometry that was built. Nothing for a prop nobody uses |
| `FURNISH_STYLES`, `PALETTES` | the two interior languages and the nine surfaces each paints | |
| `variantOf(style, prop, seed)` | `Variant` | the shape one prop kind takes from that seed: edge profile, corner radius, what holds it up, whether a strip is lit |
| `SOLID_MATERIAL` | the name of the one material every prop draws with | |
| `SURFACE_LOOKS`, `SURFACE_TEXTURES` | the three interior surfaces per language, and the metres one tile of each image covers | |
| `tilingOf(material)` | `MetreTiling`, or nothing for a material not built to tile | `metres` is the real-world size of one tile and `perMetre` the density; `uv(point, normal)` is where a point on a surface lands on the image, the same arithmetic the shader runs |

## Errors (closed set)

None. Nothing here loads a model, so nothing can arrive missing: the furniture is generated. A pack with no interior surfaces in it gives none of them and `surface` falls through to the dressing behind.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, and `Greybox` as the layer behind it.
- `@gb/world` contract: `FURNITURE_PROPS` and `METRICS.furniture`, which is the one place a contact height lives.
- `@gb/kit` contract: `Rng`, forked per language and per prop.
- `three`, and its node renderer (`three/webgpu`, `three/tsl`).
- Three tiling images, packed by `tools/build-kit.ts` into `assets/dist/interior-kit.glb` (40 KB). Two are the Downtown kit's concrete and marble, CC0; the third is ours, generated from `tools/textures/prompts/wall-plastic-home.md` and committed at `assets/gen/`. `assets/dist` is not in the repository, so a fresh clone runs `node tools/fetch-assets.mjs` and then `node game/furnish/tools/build-kit.ts` before an interior has real surfaces. Furniture needs neither step.

## Invariants

- One world unit is one metre. A prop claims a rectangle of 10 cm room cells and every triangle of it is inside that rectangle, so nothing overhangs into the piece beside it, into a walkway, or through the wall behind it. Handles, leaves and tap spouts included.
- **Height is a contract, not a measurement.** The geometry is drawn with its top face at the number: a table slab runs to exactly `tableHeight`, a seat pad to exactly `seatHeight`, a bar rail to exactly `barCounterHeight`. Nothing is fitted, scaled or nudged, so a seat cannot come out 7 cm low. The tests measure the drawn triangles and allow ten microns, which is what a float32 position buffer holds, and one of them breaks a prop by 5 mm to prove the measurement catches it.
- The heights all come from `METRICS.furniture` in `@gb/world`: bar counter, service counter, worktop, table, stool, seat and mattress. This box writes none of them down.
- A prop declares a `contact` or a `height`, never both, and the plant declares neither because nobody touches it and its own proportions are the point.
- The contact surface is read off the triangles, never off the bounding box, because the top of a chair is its backrest and the top of a bed is its headboard. `rest` (a seat, a mattress) is the widest level plate that looks up; `work` (a counter, a desk, a hob, the run beside a sink) is the highest one covering at least a quarter of the piece's own footprint. Nothing draws a lid under something that sits on it, or that hidden plate would be the widest one on the piece.
- The bar counter is the only piece worked from both sides, so it is the only one with two heights. The customer's drink stands on the raised rail at `barCounterHeight`; the bartender's forearms rest on the shelf behind it at `serviceCounterHeight`, which is where `@gb/cast`'s lean clip holds a body's hands (1.02 to 1.04). Both are drawn. `staffContact` publishes the second one.
- Every prop's origin is the centre of its base and its front looks north, which is where `@gb/scene` points a prop at rotation zero.
- **One primitive.** Every piece is an extrusion of a rectangle with a radius on each corner, between two heights, with an edge treatment at each end. A full corner radius makes it a cylinder and an inset at one end makes it a taper, so a worktop, a leg, a plinth, a cushion, a door leaf, a light strip, a plant pot and a lamp column all come out of the same call. There is no second primitive and no model file.
- **One material.** Colour, emission, roughness and metalness ride on the vertices, so the whole catalog, both languages, draws with one `MeshStandardNodeMaterial`. A room of 21 pieces is 21 meshes on 1 material, all indexed and all agreeing attribute for attribute, which is what `@gb/scene`'s `BatchedMesh` path needs to collapse an interior the way it collapsed the city.
- Light is architecture, not a lamp. There is no light object anywhere in this box: a lit trim, a screen, a chilled case and a light column are emissive faces authored above 1 so bloom finds them.
- **Variation is per prop kind, not per instance.** One draw from a stream forked per language and per prop decides the edge profile, the corner radii, what holds the piece up, how a front divides and whether a strip is lit. So the chairs in a room match, which is what a real room looks like, and geometry stays shared, which is what keeps memory flat.
- Same seed, same catalog, vertex for vertex. Forking per prop means adding a prop kind cannot change the shape of one already in the world.
- The two languages differ in palette and in taste, never in size: corpo is square in plan with chamfered edges, thin metal frames and cool white strips; home is radiused, moulded, on plinths, with warm coves under the seating. A corpo chair and a home chair put a body in the same place.
- Texture density is set in metres, per axis, never in tiles per surface. `@gb/scene` builds a room from a plane and a box per wall whose UVs run 0..1 across whatever size the room is, so tiling off those UVs lays one image over a whole wall. The materials read the world position instead (`src/surfaces/tiling.ts`): u and v each come from that axis's length in metres, so a 3 m wall and a 12 m wall show the same size stones, a 6 m by 3 m wall is not stretched 2:1, and there is no seam where one wall meets the next.
- One tile of the flagstone image is 2 m of floor, one of the concrete is 2 m of wall, and one of the moulded panel is 1.5 m. Those numbers are in `SURFACE_TEXTURES` and nowhere else.
- The coordinates are hung on `material.contextNode`, which is what the game's renderer reads. `WebGPURenderer` runs no `onBeforeCompile` on either of its backends, WebGPU or the WebGL2 one it falls back to, so an interior surface is a `MeshStandardNodeMaterial` and its tiling is a TSL context, not a shader patch.
- The surfaces are all or nothing. A pack missing any texture gives none, and `surface` falls through, because a real floor under flat-colour walls looks worse than flat colour throughout.

## What it costs

Both languages of the whole catalog, 48 shapes, are 22,282 triangles and 1.70 MB of buffers, built in about 55 ms in Node. That is the whole cost for a town of any size: a second bar adds objects, not buffers.

Measured on a generated town, whole rooms, shell included:

| room | pieces | corpo | home | greybox |
|---|---|---|---|---|
| bar | 21 | 39 draws, 9,388 tris | 39 draws, 10,812 tris | 39 draws, 652 tris |
| shop | 15 | 38 draws, 6,508 tris | 38 draws, 11,100 tris | 38 draws, 1,252 tris |
| apartment | 11 | 36 draws, 4,564 tris | 36 draws, 6,804 tris | 36 draws, 820 tris |

`node game/furnish/tools/print-cost.ts` prints the table. The draw count is unchanged from the greybox because it is one object per piece either way; what changed is that all 21 pieces of the bar are now on one material instead of one per kind, so an interior can be batched per material the way the city is. In Chrome on the WebGL2 fallback a nine-metre room with 20 pieces, a lit ceiling and a window renders in 38 draws.

## How to modify this blackbox safely

A prop's footprint or its contact height is `src/catalog/specs.ts` alone, and both are read by `@gb/forge`, so a change there is a change to what the planner claims. What a prop looks like is one file per family under `src/props/`, one exported builder per prop kind, all of them drawing through `Solid.block` in `src/build/solid.ts`; nothing else may make geometry. What the two languages are made of is `src/style/palette.ts`, and how much a variant may swing is the taste table in `src/style/variant.ts`. Changing what a room is made of, or how big its texture is laid, is `src/surfaces/surfaces.ts` plus the sources named in `tools/pack.ts`; the tiling rule itself is written twice in `src/surfaces/tiling.ts`, once for the GPU and once for the CPU the tests measure, so both change together. A new generated surface follows `tools/textures/README.md` and lands in `assets/gen/`. Run `pnpm --filter @gb/furnish test`.
