# @gb/furnish contract

contractVersion: 0.3.0

## Purpose

Dresses the inside of a building: every piece of furniture the generator can place, as a real model at the size the room planner kept clear for it, with the surface a body sits or works on where the body expects it, on a floor and between walls that tile at real-world size.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new FurnishDressing(kit, rest?)` | a `FurnishLibrary`, and the `Dressing` behind it (defaults to `@gb/scene`'s `Greybox`) | |
| `FurnishDressing.prop(prop)` | a `@gb/world` `FurnitureProp` | |
| `FurnishDressing.surface(part)` | `'floor'`, `'wall'` or `'ceiling'` | |
| `loadFurnish(scenes)` | one `THREE.Object3D`, or the array `GLTFLoader` hands back as `gltf.scenes` | a scene holding the packed kit, one named node per model and one per interior surface |
| `placeholderFurnish()` | nothing | |

`FurnishDressing` also carries `building`, `character`, `pickup` and `ground` from the `Dressing` seam and passes every one of them straight to `rest`: this box answers for the inside of a building and nothing else.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `prop(prop)` | `THREE.Object3D` | origin at the centre of its base, front looking north, filling the footprint the planner keeps clear and no more; one mesh per material on it, which is one for everything in the catalog. Geometry and material are shared with every other copy of that prop, so a second chair is a new object over the same buffer. A library with no art for a prop hands it to `rest` |
| `surface(part)` | `THREE.Material` | the floor, walls or ceiling of a room, tiling at the real-world size of its image whatever size the room is; the same part is always the same instance. A pack with no surfaces in it hands the question to `rest` |
| `loadFurnish` / `placeholderFurnish` | `FurnishLibrary` | `parts(prop)` gives geometry per material, already fitted and turned, `contact(prop)` how high off the floor a body meets it, `material(name)` the one shared instance, and `surfaces` the tiling floor and walls when the pack carries them |
| `FurnishLibrary.contact(prop)` | metres, or nothing | the drawn height of the seat, mattress, worktop or counter top on that prop, measured off the geometry that was built. Nothing for a prop nobody uses |
| `PROP_ART` | `Record<FurnitureProp, PropArt>` | what each prop is made of, the box it ends up in, and the `Contact` a body meets |
| `PIECES`, `PIECE_IDS` | the source models and which way each one faces, measured from the packs' own files |
| `SURFACE_LOOKS`, `SURFACE_TEXTURES` | the three interior surfaces and the metres one tile of each image covers |
| `tilingOf(material)` | `MetreTiling`, or nothing for a material not built to tile | `metres` is the real-world size of one tile and `perMetre` the density; `uv(point, normal)` is where a point on a surface lands on the image, the same arithmetic the shader runs |

## Errors (closed set)

- `furnish-incomplete`: `loadFurnish` was handed a scene with no node, or nothing drawable, for some catalog model. Thrown as `FurnishIncomplete`, carrying `missing`, the model ids it could not find. Nothing partial is returned: the caller keeps the dressing behind and the rooms stay grey rather than half dressed.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, and `Greybox` as the layer behind it.
- `@gb/world` contract: `FURNITURE_PROPS` and `METRICS`.
- `three`, and its node renderer (`three/webgpu`, `three/tsl`) for the interior surfaces.
- The art: Kenney's Furniture Kit and Mini Market, both CC0, packed by `tools/build-kit.ts` into `assets/dist/interior-kit.glb` (24 models, 5,251 triangles, 200 KB). The pack is meshopt-compressed and quantized. `assets/dist` is not in the repository, so a fresh clone runs `node tools/fetch-assets.mjs` and then `node game/furnish/tools/build-kit.ts` before an interior has any art in it.

## Invariants

- One world unit is one metre. A prop fills the footprint `w` by `d` that `@gb/forge` keeps clear for it, exactly, so nothing overhangs into the piece beside it or through the wall behind it.
- Where a body meets a piece, that surface lands on a stated height and the model's own height follows from it. A chair's seat is at 0.45 m whatever the chair is shaped like, and its back is as far above that as the model says. This is the number floating forearms are made of, and it is the one thing here with its own test.
- A prop declares a `contact` or an `h`, never both: one scale up the vertical cannot satisfy two heights. Neither, and the model keeps its own proportions.
- The contact surface is measured off the triangles, never taken off the bounding box, because the top of a chair is its backrest and the top of a bed is its headboard. `rest` (a seat, a mattress) is the widest level plate that looks up; `work` (a counter, a desk, a hob, the run beside a sink) is the highest one covering at least a quarter of the piece's own footprint.
- The heights themselves: a bar counter at `METRICS.furniture.barCounterHeight`, a table and a desk at `tableHeight`, a stool at `stoolHeight`. A seat at 0.45 m, a service counter at 1 m, a kitchen worktop at 0.9 m and a mattress at 0.5 m are written in `src/catalog/props.ts` because `METRICS.furniture` does not carry them yet; 0.45 is where the sitting clip `@gb/cast` plays puts a body's hips.
- Filling a shallow footprint with a chunky kit means squeezing a piece in depth: that is the axis a player never sees, because furniture stands against a wall and is read from the front. What the eye gets, the stretch across the front face, stays under 1.5 for everything except the standing lamp (1.67, a slim column filling a 35 cm square) and the sink (1.54).
- Every prop's origin is the centre of its base and its front looks north, which is where `@gb/scene` points a prop at rotation zero.
- Which way a model faces is measured, not assumed. `tools/measure.ts` reads the triangles: an open piece gives its back away by area, a closed one by detail (doors and handles against a flat panel), a seat by the mass above mid height. A test fails if a piece stops agreeing with the catalog.
- The kit loads once and nothing is fitted at play time. Turning, scaling, rebasing and welding all happen as the pack loads, so placing a chair is `new THREE.Mesh` over geometry that is already right.
- A prop is one draw. A furnished bar of 21 pieces is 39 draws and 4,180 triangles against the greybox's 39 draws and 652; `node game/furnish/tools/print-cost.ts` prints the table. The Furniture Kit paints with two dozen flat-colour materials and no texture at all, and the pack builder folds them into one palette image, so the whole catalog draws on two materials: that palette and the Mini Market's atlas.
- Nothing is glazed and nothing is metal. The pack builder sets every material opaque, metalness zero and roughness 0.75, because glTF defaults a material to fully metallic and the app now lights interiors from the sky.
- Texture density is set in metres, per axis, never in tiles per surface. `@gb/scene` builds a room from a plane and a box per wall whose UVs run 0..1 across whatever size the room is, so tiling off those UVs lays one image over a whole wall. The materials read the world position instead (`src/surfaces/tiling.ts`): u and v each come from that axis's length in metres, so a 3 m wall and a 12 m wall show the same size stones, a 6 m by 3 m wall is not stretched 2:1, and there is no seam where one wall meets the next.
- One tile of the flagstone image is 2 m of floor: it is drawn four slabs by four, and an interior floor slab is 0.5 m. One tile of the plaster is 2 m of wall or of ceiling: plaster has no repeating unit to measure, so the size is set by its coarsest stain, about 0.6 m of wall, a third of a 2.1 m door. Both numbers are in `SURFACE_TEXTURES` and nowhere else.
- The coordinates are hung on `material.contextNode`, which is what the game's renderer reads. `WebGPURenderer` runs no `onBeforeCompile` on either of its backends, WebGPU or the WebGL2 one it falls back to, so an interior surface is a `MeshStandardNodeMaterial` and its tiling is a TSL context, not a shader patch.
- The surfaces are all or nothing. A pack missing either texture gives neither, and `surface` falls through, because a real floor under flat-colour walls looks worse than flat colour throughout.
- The kit is a modern town's: a fridge is a fridge, a stove is a stove, a till is a till, and the music in a bar is a pair of floor-standing speakers. Two props stand in and the catalog says which: a stack of stock boxes for the crates, and a tall cupboard with doors for the wardrobe, which the Furniture Kit has no model of.
- This is one theme's worth of art. It suits a home, an office, a kitchen, a bar, a cafe and a shop; it does not suit a farm, a workshop floor or a hospital ward, and there is no second set yet. A second kit is a second pack plus a second catalog behind the same seam, picked by the world's theme where the app loads the art.

## How to modify this blackbox safely

Changing what a prop is made of, or how high a body meets it, is a change to `src/catalog/props.ts` alone, then a rebuild. A new source model needs an entry in `src/catalog/pieces.ts` with its `front` taken from `node game/furnish/tools/print-catalog.ts`, which prints every model's size, its level surfaces and the evidence for the way it faces, then `node game/furnish/tools/build-kit.ts`; the pack builder refuses to finish if a model is not in the output under the name the loader looks for. Changing what a room is made of, or how big its texture is laid, is `src/surfaces/surfaces.ts` plus the textures named in `tools/pack.ts`; the tiling rule itself is written twice in `src/surfaces/tiling.ts`, once for the GPU and once for the CPU the tests measure, so both change together. Run `pnpm --filter @gb/furnish test`.
