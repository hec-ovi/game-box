# @gb/furnish contract

contractVersion: 0.1.0

## Purpose

Dresses the inside of a building: every piece of furniture the generator can place, as a real model at the size the room planner kept clear for it, on a floor and between walls that tile at real-world size.

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
| `surface(part)` | `THREE.Material` | the floor, walls or ceiling of a room, tiling in metres whatever size the room is; the same part is always the same instance. A pack with no surfaces in it hands the question to `rest` |
| `loadFurnish` / `placeholderFurnish` | `FurnishLibrary` | `parts(prop)` gives geometry per material, already fitted and turned, `material(name)` gives the one shared instance, and `surfaces` holds the tiling floor and walls when the pack carries them |
| `PROP_ART` | `Record<FurnitureProp, PropArt>` | what each prop is made of and the box it ends up in |
| `PIECES`, `PIECE_IDS` | the source models and which way each one faces, measured from the packs' own files |
| `SURFACE_LOOKS`, `SURFACE_TEXTURES` | the three interior surfaces and the metres one tile of each covers |

## Errors (closed set)

- `furnish-incomplete`: `loadFurnish` was handed a scene with no node, or nothing drawable, for some catalog model. Thrown as `FurnishIncomplete`, carrying `missing`, the model ids it could not find. Nothing partial is returned: the caller keeps the dressing behind and the rooms stay grey rather than half dressed.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, and `Greybox` as the layer behind it.
- `@gb/world` contract: `FURNITURE_PROPS` and `METRICS`.
- `three`.
- The art: KayKit Furniture Bits and KayKit Dungeon Pack, both CC0, packed by `tools/build-kit.ts` into `assets/dist/interior-kit.glb` (20 models, 8,449 triangles, 215 KB). The pack is meshopt-compressed and quantized. Its images are the two packs' 1024 palette atlases and four 512 maps for the interior surfaces, which are the Quaternius Downtown kit's stone and concrete: the KayKit atlases are swatches of flat colour with no pattern in them, so nothing in either furniture pack tiles.

## Invariants

- One world unit is one metre. A prop fills the footprint `w` by `d` that `@gb/forge` keeps clear for it, exactly, so nothing overhangs into the piece beside it or through the wall behind it. Where a height is load-bearing it comes from `METRICS.furniture` (a counter at 1.1 m, a table and a stool at 0.75 m); otherwise the model keeps its own proportions and stands as tall as it comes.
- Filling a shallow footprint with a chunky kit means squeezing a piece in depth: that is the axis a player never sees, because furniture stands against a wall and is read from the front. What the eye gets, the stretch across the front face, stays under 1.5 for everything except the bar stool (2.5, its legs drawn out to reach the counter), the shelf (1.9) and the standing lamp (1.7).
- Every prop's origin is the centre of its base and its front looks north, which is where `@gb/scene` points a prop at rotation zero.
- A chair's seat lands at 0.35 m, not the 0.45 m `METRICS.furniture.chairSeatHeight` names: the kit's chairs are chunky, and one fitted into the half-metre square the planner clears sits that low. A stool's seat, a table top and a counter top are exactly the heights `METRICS` gives.
- Which way a model faces is measured, not assumed. `tools/measure.ts` reads the triangles: an open piece gives its back away by area, a closed one by detail (doors and handles against a flat panel), a seat by the mass above mid height. Both KayKit packs came back the same, front on +z, and a test fails if a piece stops agreeing with the catalog.
- The kit loads once and nothing is fitted at play time. Turning, scaling, rebasing and welding all happen as the pack loads, so placing a chair is `new THREE.Mesh` over geometry that is already right.
- A prop is one draw. A furnished bar of 27 pieces is 45 draws and 11,074 triangles against the greybox's 45 draws and 724, on the two atlas materials the packs have between them; `node game/furnish/tools/print-cost.ts` prints the table.
- Interior surfaces tile by where they are in the world, not by the mesh's UVs. `@gb/scene` builds a room from a plane and a box per wall, whose UVs run 0..1 across whatever size the room is, so a shared material cannot tile off them: the shader reads the world position instead (`src/surfaces/tiling.ts`), which puts the same half-metre flagstone in a small room and a large one and leaves no seam where one wall meets the next.
- The surfaces are all or nothing. A pack missing either texture gives neither, and `surface` falls through, because a real floor under flat-colour walls looks worse than flat colour throughout.
- The kit is medieval and the vocabulary is a modern town, so seven props are stand-ins and the catalog says so: a larder cupboard for the fridge, a stone block for the stove, a water barrel for the sink, a strongbox for the till, a keg for the coffee machine, a carved cabinet for the jukebox, a framed panel for the screen. Every one of them is a model of about the right silhouette, scaled. Nothing is a barrel pretending to be a bed.
- This is one theme's worth of art. It suits a bar, a house, a market or a workshop; it does not suit a clinic, an office or a station, and there is no second set yet. A second kit is a second pack plus a second catalog behind the same seam, picked by the world's theme where the app loads the art.

## How to modify this blackbox safely

Changing what a prop is made of is a change to `src/catalog/props.ts` alone, then a rebuild. A new source model needs an entry in `src/catalog/pieces.ts` with its `front` taken from `node game/furnish/tools/print-catalog.ts`, which prints every model's size and the evidence for the way it faces, then `node game/furnish/tools/build-kit.ts`; the pack builder refuses to finish if a model is not in the output under the name the loader looks for. Changing what a room is made of is `src/surfaces/surfaces.ts` plus the textures named in `tools/surfaces.ts`. Run `pnpm --filter @gb/furnish test`.
