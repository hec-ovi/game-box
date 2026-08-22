# @gb/kitbash contract

contractVersion: 0.1.0

## Purpose

Builds a plot into a building made of Downtown City MegaKit pieces on a 2 m grid: the footprint it was given, the height its storeys ask for, its door on the wall the entrance faces, and a front that reads as the kind of place it is.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new KitDressing(kit, rest?)` | a `KitLibrary`, and the `Dressing` behind it (defaults to `@gb/scene`'s `Greybox`) | |
| `KitDressing.building(plot, size)` | a `@gb/world` `Plot`, `{ width, depth, height }` in metres | the size matches the plot: `width / rect.w` is the world's cell size |
| `loadKit(scenes)` | one `THREE.Object3D`, or the array `GLTFLoader` hands back as `gltf.scenes` | a scene holding the packed kit, one named node per piece |
| `placeholderKit()` | nothing | |

`KitDressing` also carries `prop`, `character`, `pickup`, `ground` and `surface` from the `Dressing` seam and passes every one of them straight to `rest`: the Downtown kit is a street kit, with no furniture, no people and no ground cover in it.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `building(plot, size)` | `THREE.Object3D` | origin at the centre of its base; one mesh per kit material, never one per piece; a child named `door` at the middle of the doorway, looking out |
| `loadKit` / `placeholderKit` | `KitLibrary` | `parts(piece)` gives geometry per material, in metres in the piece's own frame, `material(name)` gives the one shared instance |
| `PIECES`, `PIECE_IDS`, `KIT_MATERIALS`, `MODULE`, `RELIEF` | the catalog, measured from the kit's own files | |
| `RECIPES` | `Record<BuildingKind, Recipe>` | every kind in `BUILDING_KINDS` has one |

## Errors (closed set)

- `kit-incomplete`: `loadKit` was handed a scene with no node, or nothing drawable, for some catalog piece. Thrown as `KitIncomplete`, carrying `missing`, the piece ids it could not find.
- `kit-unmergeable`: pieces sharing a material would not weld into one mesh, because their geometry does not agree attribute for attribute. Thrown as `KitUnmergeable` from `building`, carrying `material` and the `pieces` on it. A library from `loadKit` or `placeholderKit` cannot raise it, because both bring every part to one shape; a `KitLibrary` built by hand out of foreign geometry can.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, and `Greybox` as the layer behind it.
- `@gb/world` contract: `Plot`, `BUILDING_KINDS`, `METRICS`.
- `three`.
- The art: Quaternius Downtown City MegaKit, CC0, packed by `tools/build-kit.ts` into `assets/dist/downtown-kit.glb` (19 pieces, 3,403 triangles, 0.68 MB). The pack is meshopt-compressed and quantized, and its dedup step folds the kit's 10 material names into the 6 that have distinct textures.

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

## How to modify this blackbox safely

Changing what a kind of building looks like is a change to `src/catalog/recipes.ts` alone. Adding a kit piece means adding it to `src/catalog/pieces.ts` with bounds from `node tools/print-catalog.ts`, then rebuilding the pack with `node tools/build-kit.ts`; the pack builder refuses to finish if the piece is not in the output under a name `loadKit` looks for. Pieces have to be authored the way the wall pieces are (outer face on z = 0, body into negative z, width centred on x, base on y = 0), and the pack has to leave them there, or the composition rules put them in the wrong place; `tests/pack.test.ts` holds the shipped pack to the catalog's own numbers. Run `pnpm --filter @gb/kitbash test`.
