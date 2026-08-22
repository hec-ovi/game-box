# @gb/kitbash contract

contractVersion: 0.2.0

## Purpose

Builds a plot into a building made of Downtown City MegaKit pieces on a 2 m grid: the footprint it was given, the height its storeys ask for, its door on the wall the entrance faces, and a front that reads as the kind of place it is. It also surfaces the ground the buildings stand on, out of the same kit's textures.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new KitDressing(kit, rest?)` | a `KitLibrary`, and the `Dressing` behind it (defaults to `@gb/scene`'s `Greybox`) | |
| `KitDressing.building(plot, size)` | a `@gb/world` `Plot`, `{ width, depth, height }` in metres | the size matches the plot: `width / rect.w` is the world's cell size |
| `loadKit(scenes)` | one `THREE.Object3D`, or the array `GLTFLoader` hands back as `gltf.scenes` | a scene holding the packed kit, one named node per piece and one per ground surface |
| `placeholderKit()` | nothing | |

`KitDressing` also carries `prop`, `character`, `pickup` and `surface` from the `Dressing` seam and passes every one of them straight to `rest`: the Downtown kit is a street kit, with no furniture and no people in it.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `building(plot, size)` | `THREE.Object3D` | origin at the centre of its base; one mesh per kit material, never one per piece; a child named `door` at the middle of the doorway, looking out |
| `ground(kind)` | `THREE.Material` | the surface that kind of cell is made of, tiling at a real-world size; the same kind is always the same instance. A kit whose pack has no ground surfaces in it hands the question to `rest` |
| `loadKit` / `placeholderKit` | `KitLibrary` | `parts(piece)` gives geometry per material, in metres in the piece's own frame, `material(name)` gives the one shared instance, and `ground` holds the tiling surfaces when the pack carries them |
| `PIECES`, `PIECE_IDS`, `KIT_MATERIALS`, `MODULE`, `RELIEF` | the catalog, measured from the kit's own files | |
| `GROUND_TEXTURES`, `GROUND_LOOKS` | the three tiling surfaces with the metres one tile covers, and what each cell kind takes from them | every kind in `@gb/world`'s `CELL` has a look |
| `RECIPES` | `Record<BuildingKind, Recipe>` | every kind in `BUILDING_KINDS` has one |

## Errors (closed set)

- `kit-incomplete`: `loadKit` was handed a scene with no node, or nothing drawable, for some catalog piece. Thrown as `KitIncomplete`, carrying `missing`, the piece ids it could not find.
- `kit-unmergeable`: pieces sharing a material would not weld into one mesh, because their geometry does not agree attribute for attribute. Thrown as `KitUnmergeable` from `building`, carrying `material` and the `pieces` on it. A library from `loadKit` or `placeholderKit` cannot raise it, because both bring every part to one shape; a `KitLibrary` built by hand out of foreign geometry can.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, and `Greybox` as the layer behind it.
- `@gb/world` contract: `Plot`, `BUILDING_KINDS`, `METRICS`.
- `three`.
- The art: Quaternius Downtown City MegaKit, CC0, packed by `tools/build-kit.ts` into `assets/dist/downtown-kit.glb` (19 pieces, 3,403 triangles, and 3 ground surfaces, 0.76 MB). The pack is meshopt-compressed and quantized, and its dedup step folds the kit's 10 material names into the 6 that have distinct textures. The ground surfaces are the kit's own textures, so the road costs nothing over the buildings: asphalt and its relief are one copy shared with the kit's own road piece, and only the paving and the earth are new (70 KB of the pack).

## Invariants

- One world unit is one metre. Wall pieces are 2 m across and 3 m tall; the ground floor is `METRICS.building.groundFloorHeight` and closes with the kit's own metre-tall band, and storeys above stretch their module the 7% it takes to reach `METRICS.building.storeyHeight`.
- A building's walls stand on the plot boundary. Window and trim relief reaches up to `RELIEF` (0.05 m) past it on each face, and nothing else does.
- A building is exactly as tall as the height it was given: the roof deck sits 0.2 m below the wall top, so the walls read as a parapet round it.
- The door is on the wall the entrance cell sits against, in the module nearest the doorstep `@gb/scene` puts on the pavement.
- The same plot builds the same building every time: the only draw is the window phase, taken from the plot's id, kind and style.
- The kit loads once. Buildings clone geometry out of the library, and every piece sharing a material is welded into one mesh, so a building costs as many draws as it has materials on it (5 or 6 out of the packed kit), not as many as it has pieces (28 to 146).
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

## How to modify this blackbox safely

Changing what a kind of ground looks like is a change to `src/ground/surfaces.ts` alone; a new tiling surface is an entry there plus the kit textures it is made of in `tools/ground-surfaces.ts`, then a rebuild. Changing what a kind of building looks like is a change to `src/catalog/recipes.ts` alone. Adding a kit piece means adding it to `src/catalog/pieces.ts` with bounds from `node tools/print-catalog.ts`, then rebuilding the pack with `node tools/build-kit.ts`; the pack builder refuses to finish if the piece is not in the output under a name `loadKit` looks for. Pieces have to be authored the way the wall pieces are (outer face on z = 0, body into negative z, width centred on x, base on y = 0), and the pack has to leave them there, or the composition rules put them in the wrong place; `tests/pack.test.ts` holds the shipped pack to the catalog's own numbers. Run `pnpm --filter @gb/kitbash test`.
