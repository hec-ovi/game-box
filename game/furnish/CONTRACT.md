# @gb/furnish contract

contractVersion: 0.6.0

## Purpose

Dresses the inside of a building: every piece of furniture the generator can place and every thing a player can pick up off it, built from parameters to the cells of floor the room planner claims and to the height a body meets it at, and walls that are a run of bays rather than one flat surface, in one of two interior languages, on floors and walls laid in a pattern and a finish that tile at real-world size.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new FurnishDressing(kit, rest?, style?, choices?)` | a `FurnishLibrary`, the `Dressing` behind it (defaults to `@gb/scene`'s `Greybox`), `'corpo'` or `'home'` (defaults to `'corpo'`), and which entry of each surface pool to paint with (defaults to the first) | |
| `FurnishDressing.as(style)` | `'corpo'` or `'home'` | |
| `FurnishDressing.room(interior)` | a `@gb/world` `Interior` | its rooms tile the interior and every door sits on a room edge, which is what `@gb/forge` builds |
| `FurnishDressing.prop(prop)` | a `@gb/world` `FurnitureProp` | |
| `FurnishDressing.pickup(item)` | a `@gb/world` `Item` | |
| `FurnishDressing.surface(part)` | `'floor'`, `'wall'` or `'ceiling'` | |
| `loadFurnish(scenes, seed?)` | one `THREE.Object3D`, or the array `GLTFLoader` hands back as `gltf.scenes`, and the town's seed | a scene holding the packed interior surfaces |
| `furnishKit(seed?)` | the town's seed | |

`FurnishDressing` also carries `building`, `character` and `ground` from the `Dressing` seam and passes each of them straight to `rest`: this box answers for the inside of a building and nothing else.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `room(interior)` | `FurnishRoom` | that interior's own room: `dressing` to build it with and `decor` to add to what came back. See **Standing a room up** |
| `FurnishRoom.dressing` | `Dressing` | paints this interior's own floor, walls and ceiling, drawn from its id, so the shop is not the same room as the flat above it |
| `FurnishRoom.decor` | `THREE.Mesh` | every bay of every wall of the interior, one indexed mesh on the one shared material, in the interior's own coordinates. One draw, whatever the bay count |
| `FurnishRoom.bays` | `PlacedBay[]` | `kind`, `roomId`, `side`, the `face` the wall stands on, the stretch it claims (`from`, `to`) along the wall's own axis, that stretch in `cells`, and how far it stands off the wall (`depth`) |
| `FurnishRoom.contacts` | metres | every height in that room a body can put something down on, exactly: niche sills and shelf ledges |
| `prop(prop)` | `THREE.Mesh` | one indexed mesh on the one shared material, origin at the centre of its base, front looking north, inside the cells it declares and no further. Geometry is shared with every other copy of that prop in that language |
| `pickup(item)` | `THREE.Mesh` | the thing itself at the size it really is: one indexed mesh on the same shared material, origin at the centre of its base, front looking north, inside the box its archetype publishes. Geometry is shared with every other item of that archetype in that cast |
| `surface(part)` | `THREE.Material` | the floor, walls or ceiling of a room in this dressing's language, pattern and finish, tiling at the real-world size of its image whatever size the room is. The same look is always the same instance. A pack with no surfaces in it hands the question to `rest` |
| `as(style)` | `FurnishDressing` | the same library and the same material in the other language |
| `loadFurnish` / `furnishKit` | `FurnishLibrary` | `geometry(prop, style)` gives the built mesh's buffer, `contact(prop)` how high off the floor a body meets it, `heightOf(prop, style)` how tall it stands measured off the triangles, `item(item)` and `itemGeometry(archetype, cast)` the buffer for a thing you pick up, `castOf(item)` which cast it drew, `material` the one shared instance, `seed` the town's, and `surfaces` the tiling floor and walls when the pack carries them |
| `ITEM_SPECS` | `Record<ItemArchetype, ItemSpec>` | **what a thing you pick up is**: `width`, `depth` and `height` in metres, and the matter its casts are made of. Covers all 25 of `@gb/world`'s `ITEM_ARCHETYPES` |
| `ITEM_CASTS` | `number` | how many ways one archetype is drawn: 3 |
| `castIndex(seed, itemId)` | `number` | which cast that item drew |
| `itemCast(seed, archetype, index)` | `ItemCast` | one cast: its body, fittings and mark, its moulding, its proportions and whether its one bright detail is lit |
| `MATTER` | `Record<Matter, Look>` | what a carried thing can be made of: paper, board, glass, ceramic, timber, steel, leather, cloth, plastic, and the three that emit |
| `PROP_SPECS` | `Record<FurnitureProp, PropSpec>` | **what `@gb/forge` places from**: `cells` the footprint in 10 cm room cells, `contact` the surface a body meets, `height` for a piece nobody touches, `staffContact` for a piece worked from both sides, `onSurface` for a piece that belongs on a worktop |
| `footprintOf(prop)` | `{ width, depth }` | the same footprint in metres |
| `CELL` | metres | one room cell: 0.1 |
| `BAY_SPECS`, `BAY_TASTE` | the eight kinds a bay can be, how wide each may be in cells, how far it stands off the wall and how low, and how often each language reaches for it | |
| `WALL` | metres | every height a wall is divided at: the head of the field, the rail over it, the niche sill and head, the shelf ledges and their pitch |
| `WALL_CONTACTS` | metres | every height the vocabulary can offer to stand something on |
| `SIDES` | `'north' \| 'south' \| 'east' \| 'west'` | which wall of a room a bay is on |
| `FURNISH_STYLES`, `PALETTES` | the two interior languages and the eleven surfaces each paints | |
| `variantOf(style, prop, seed)` | `Variant` | the shape one prop kind takes from that seed: edge profile, corner radius, what holds it up, whether a strip is lit. `'wall'` is a kind like any other |
| `SOLID_MATERIAL` | the name of the one material every prop and every bay draws with | |
| `SURFACE_LOOKS`, `lookOf(style, part, choice)` | the pool each part draws from per language, and one entry of it | four floors, three walls and one ceiling per language, so a town of any size is at most eight materials a language |
| `SURFACE_TEXTURES` | the two grain images, the metres one tile of each covers, and each one's own average brightness | |
| `Pattern` | the rhythm a surface is laid in: plain, rectangular tiles, chequer, hexagons, triangles or planks, and how big one unit of it is | |
| `surfaceChoices(seed, style, interiorId)` | which entry of each pool that interior draws | |
| `tilingOf(material)`, `mapsOf(material)` | `MetreTiling` and `SurfaceMaps`, or nothing | how big the grain is laid, and which of the pack's images it came from |

## Errors (closed set)

None. Nothing here loads a model, so nothing can arrive missing: the furniture, the items and the walls are generated. A pack with no interior surfaces in it gives none of them and `surface` falls through to the dressing behind.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, `Greybox` as the layer behind it, and the shell `buildInterior` puts a room in.
- `@gb/world` contract: `FURNITURE_PROPS`, `ITEM_ARCHETYPES`, the `Interior` document a room's walls are read off, and `METRICS`, which is the one place a contact height and a wall thickness live.
- `@gb/kit` contract: `Rng`, forked per language, per prop, per archetype and cast, per room and per wall.
- `three`, and its node renderer (`three/webgpu`, `three/tsl`).
- Two tiling images, packed by `tools/build-kit.ts` into `assets/dist/interior-kit.glb` (25 KB). One is the Downtown kit's concrete, CC0; the other is ours, generated from `tools/textures/prompts/wall-plastic-home.md` and committed at `assets/gen/`. `assets/dist` is not in the repository, so a fresh clone runs `node tools/fetch-assets.mjs` and then `node game/furnish/tools/build-kit.ts` before an interior has real surfaces. Furniture and wall bays need neither step.

## Standing a room up

Two lines beyond what a room already took, because a wall's bays are geometry and `@gb/scene` builds the shell:

```ts
const room = dressing.room(interior)
const built = buildInterior(world, interior, room.dressing)
built.root.add(room.decor)
```

`room.dressing` in place of the plain one is what gives that interior its own floor and walls; `room.decor` is what makes the walls a run of bays instead of one surface. Leave either out and the room still builds, one flatter than the other.

## Invariants

### The furniture

- One world unit is one metre. A prop claims a rectangle of 10 cm room cells and every triangle of it is inside that rectangle, so nothing overhangs into the piece beside it, into a walkway, or through the wall behind it. Handles, leaves and tap spouts included.
- **Height is a contract, not a measurement.** The geometry is drawn with its top face at the number: a table slab runs to exactly `tableHeight`, a seat pad to exactly `seatHeight`, a bar rail to exactly `barCounterHeight`. Nothing is fitted, scaled or nudged, so a seat cannot come out 7 cm low. The tests measure the drawn triangles and allow ten microns, which is what a float32 position buffer holds, and one of them breaks a prop by 5 mm to prove the measurement catches it.
- The heights all come from `METRICS.furniture` in `@gb/world`: bar counter, service counter, worktop, table, stool, seat and mattress. This box writes none of them down.
- A prop declares a `contact` or a `height`, never both, and the plant declares neither because nobody touches it and its own proportions are the point.
- The contact surface is read off the triangles, never off the bounding box, because the top of a chair is its backrest and the top of a bed is its headboard. `rest` (a seat, a mattress) is the widest level plate that looks up; `work` (a counter, a desk, a hob, the run beside a sink) is the highest one covering at least a quarter of the piece's own footprint. Nothing draws a lid under something that sits on it, or that hidden plate would be the widest one on the piece.
- The bar counter is the only piece worked from both sides, so it is the only one with two heights. The customer's drink stands on the raised rail at `barCounterHeight`; the bartender's forearms rest on the shelf behind it at `serviceCounterHeight`, which is where `@gb/cast`'s lean clip holds a body's hands (1.02 to 1.04). Both are drawn. `staffContact` publishes the second one.
- Every prop's origin is the centre of its base and its front looks north, which is where `@gb/scene` points a prop at rotation zero.

### The things you pick up

- **A carried thing is drawn at its real size.** `ITEM_SPECS` holds `width`, `depth` and `height` in metres for all 25 of `@gb/world`'s `ITEM_ARCHETYPES`: an envelope is 220 by 110 by 8 mm, a keycard is a credit card, a crate is 440 mm across. Getting the relative sizes right is most of what makes one readable against another, and it is the whole of the fault this covers: every carried thing used to be the same box.
- **The box is a promise.** Every triangle of every cast lands inside its archetype's `width` by `depth` by `height`, so a hand, a shelf or a counter can size the slot from the table without asking which cast it drew. Handles, spouts, aerials and stamps included.
- **It stands on the centre of its own base**, the same rule a prop stands by, with its lowest triangle at zero to ten microns and its middle over its own footprint. Put one down at the drawn top of a counter and it sits on the counter, neither floating nor sunk.
- Its front looks north, which is the side `@gb/scene` points a prop's front at, so what is printed on a thing faces the same way as the front of the counter it stands on.
- **Variation is per archetype and cast, not per item.** Each archetype is built in `ITEM_CASTS` casts: the body is a different matter in each, and a stream forked per archetype and per cast decides the moulding, the proportions and whether the one detail that can emit does. Which cast an item drew comes from its id, so a cheap ledger from one shop and a stained one from the next are two different ledgers, and the same ledger is the same on the second visit.
  Fixed handful is the point: vary per item and a city of four thousand items is four thousand buffers; vary per cast and it is 25 by 3 whatever the size of the city.
- **Items paint from matter, not from the room's language.** The furniture takes its colour from the interior it stands in, because a desk belongs to its office; a thing you carry across town does not. So there is one set of buffers, not one per language, and an envelope looks the same in the bar and in the flat at the other end of the errand.
- A carried thing is never a mirror. Indoors there is nothing to reflect, so metal reads as a pale colour at a low roughness with metalness held under two thirds, the same reasoning that keeps an interior surface off metal.
- **What is printed on a thing is geometry, not a texture.** A stamp, a label, a stencil or a chip is a patch standing off a face that was set back by the same amount, so it reaches the published box exactly and no two faces are left sharing a plane.

### The walls

- **A wall is a run of bays.** Every room is a rectangle and `@gb/scene` stands a wall on each of its edges, half a wall thickness inside it. That face is divided at its doorways, and each stretch left is cut into an even rhythm of bays: whole 10 cm cells, all within one cell of each other, so a wall reads as a rhythm rather than a row of different-sized boxes.
- A bay is `plain` (the base wall shows), `panel` (a slab standing 3 cm proud with a seam either side), `niche` (a surround with a lit strip under its head and things standing on its sill), `shelf` (two or three ledges between cheeks, with things on them), `frame` (a poster on a raised mount), `grille` (louvres over a dark back), `strip` (a light line up the wall in its own channel) or `window` (a pane onto the city, in a frame). Which one goes where is a weighted draw over that language's taste, filtered by what fits; the vocabulary and the taste are `src/walls/bays.ts` and the placement is `src/walls/plan.ts`, so either can be retuned without touching a triangle.
- **Nothing recesses.** The wall `@gb/scene` builds is solid, so a bay stands off its face and never into it, and what reads as a recess is the surround round it standing proud. The deepest bay is 14 cm, well inside the 35 cm the player's own radius already holds them off a wall, so no bay is collision and none of them is published as a blocker.
- **A bay never lands in a doorway.** The run is cut at every door on that wall at the width `@gb/scene` cuts the hole (the door width plus 20 cm) with 15 cm of reveal either side, so furniture cannot be sealed in behind a bay and a doorway is never half a panel.
- **A bay never fights the furniture in front of it.** A piece of furniture in that room is taken as the box around it, however it is turned; if it overlaps the bay and stands closer to the wall than the bay reaches, then the bay is only allowed when its lowest projecting part is above the top of that piece. So a shelf can run over a sofa and cannot run through a wardrobe. The one exception is `panel`, which is 3 cm and disappears behind anything standing against the wall.
- The furniture heights that rule reads are measured off the triangles that were built (`heightOf`), not off what a prop declares, for the same reason a contact height is.
- **A shelf you can put something on is a contact surface.** Every niche sill and every shelf ledge is drawn with its top face on the number exactly, the same contract a worktop is held to, and `FurnishRoom.contacts` publishes the ones that room actually has. The two that a body reaches for come from `METRICS.furniture`: a niche sill is at `serviceCounterHeight` and the lowest ledge is a `worktopHeight`.
- **The things standing in a niche or on a shelf are decoration.** A cup, a bottle, a canister, a box, a tray, a stack. They are not `@gb/world` furniture, nothing can pick one up and nothing collides with one. Each is a whole number of cells across and exactly one deep, so they land on the same lattice as the bay and fit the shallow shelf a wall can afford.
- Over the field of bays runs a rail with a lit channel under it, over every stretch of wall with nothing standing that high in front of it. That is the room's own light: emissive faces above 1, so the app's bloom finds them. There is no light object anywhere in this box.
- Same seed, same walls, vertex for vertex, and two seeds give two different rooms. Every draw comes from an `Rng` forked per language, per interior, per room and per wall, then per bay, so retuning the taste cannot move the furniture and retuning what stands in a niche cannot change which bay is a niche.

### What everything is made of

- **One primitive.** Every piece and every bay is an extrusion of a rectangle with a radius on each corner, between two heights, with an edge treatment at each end. A full corner radius makes it a cylinder and an inset at one end makes it a taper, so a worktop, a leg, a plinth, a cushion, a light strip, a wall panel, a shelf ledge and a cup all come out of the same call. There is no second primitive and no model file.
- **One material.** Colour, emission, roughness and metalness ride on the vertices, so the whole catalog, both languages, every carried thing and every wall in town draw with one `MeshStandardNodeMaterial`. A room of 21 pieces, 3 items and 80 bays is 25 meshes on 1 material, all indexed and all agreeing attribute for attribute, which is what `@gb/scene`'s `BatchedMesh` path needs to collapse an interior the way it collapsed the city.
- Light is architecture, not a lamp: a lit trim, a screen, a chilled case, a niche strip and a wall rail are emissive faces authored above 1.
- **Variation is per prop kind, not per instance.** One draw from a stream forked per language and per prop decides the edge profile, the corner radii, what holds the piece up and whether a strip is lit, and the wall is a kind like any other. So the chairs in a room match and every bay in a building is moulded the same way, which is what a real room looks like and what keeps geometry shared.
- A wall bay is drawn at two points per rounded corner rather than the catalog's four. A bay's radius is capped by how thin it is, so a 6 mm fillet at four steps is triangles nobody can see: it is the whole difference between a moulded room costing 35,000 triangles and costing 19,000.
- The two languages differ in palette and in taste, never in size: corpo is square in plan with chamfered edges, thin metal frames and cool white strips; home is radiused, moulded, on plinths, with warm coves. A corpo chair and a home chair put a body in the same place.

### The surfaces

- **Pattern and finish are two choices, not one.** A pattern is the rhythm a surface is laid in (rectangular tiles, a chequer, hexagons, triangles, planks, or plain); a finish is its colour, its gloss, how hard the joints read and how much one tile differs from the next. A hexagonal floor can be polished or matte and a plank floor can be near-black and glossy, so two short lists multiply out into far more rooms than one long list of finished floors would.
- **The pattern is arithmetic, never an image.** It is computed from where the point is in the room, in metres, so it costs nothing to store and it cannot jog where a structured texture is cut to tile. The two images the pack carries are stochastic only: concrete grain and moulded plastic grain.
- The image is grain, not a multiplier. Each one publishes its own average brightness in linear light and the material divides by it, so a look that asks for a mid grey wall gets a mid grey wall rather than a fifth of one. `node game/furnish/tools/print-grain.ts` measures it off the source and says if the table has drifted.
- **No interior surface is metal.** A metal with nothing to reflect is black, and indoors there is nothing: `scene.environment` is the prefiltered night sky and the strips in the room are emissive geometry no probe has seen. A near-black glossy floor is a dark colour at a low roughness, which still catches the room's own light, rather than a mirror that comes out as a hole in the floor.
- Each part is a short pool rather than one entry, and an interior draws one from its id, so no two rooms in a town are the same room. The pools are fixed length (four floors, three walls, one ceiling per language), so a town of five hundred buildings costs the same handful of materials as a town of five.
- Texture density is set in metres, per axis, never in tiles per surface. `@gb/scene` builds a room from a plane and a box per wall whose UVs run 0..1 across whatever size the room is, so tiling off those UVs lays one image over a whole wall. The materials read the world position instead (`src/surfaces/tiling.ts`): u and v each come from that axis's length in metres, so a 3 m wall and a 12 m wall show the same size grain, a 6 m by 3 m wall is not stretched 2:1, and there is no seam where one wall meets the next. The pattern reads the same coordinate, so it agrees with the grain about which way is which.
- One tile of the concrete is 2 m of wall and one of the moulded panel is 1.5 m. Those numbers are in `SURFACE_TEXTURES` and nowhere else.
- The coordinates are hung on `material.contextNode`, which is what the game's renderer reads. `WebGPURenderer` runs no `onBeforeCompile` on either of its backends, WebGPU or the WebGL2 one it falls back to, so an interior surface is a `MeshStandardNodeMaterial` and its tiling is a TSL context, not a shader patch.
- The surfaces are all or nothing. A pack missing either image gives none of them, and `surface` falls through, because a real floor under flat-colour walls looks worse than flat colour throughout. The bays are generated and stand either way.

## What it costs

Fixed, whatever size the town is. Both languages of the furniture catalog, 48 shapes, are 22,282 triangles and 1.70 MB of buffers; all 25 archetypes in all 3 casts are 20,624 triangles and 1.70 MB. Both are built together in about 35 ms in Node. A second bar and a thousand more items add objects, not buffers. A room's walls are that room's own geometry, built when it is entered and thrown away with it.

Measured headless in Node on a generated town, whole rooms, shell and pickups included:

| room | pieces | items | bays | corpo | corpo + walls | home + walls | greybox |
|---|---|---|---|---|---|---|---|
| bar | 24 | 3 | 73 | 42 draws, 11,344 tris, 6 mats | 43 draws, 16,192 tris | 43 draws, 26,596 tris | 42 draws, 688 tris, 7 mats |
| cafe | 17 | 1 | 72 | 35 draws, 7,270 tris, 7 mats | 36 draws, 12,734 tris | 36 draws, 21,850 tris | 35 draws, 808 tris, 8 mats |
| workshop | 13 | 3 | 53 | 43 draws, 6,270 tris, 8 mats | 44 draws, 9,558 tris | 44 draws, 18,898 tris | 43 draws, 1,312 tris, 9 mats |
| apartment | 11 | 2 | 86 | 36 draws, 5,028 tris, 7 mats | 37 draws, 10,644 tris | 37 draws, 22,572 tris | 36 draws, 820 tris, 8 mats |
| restaurant | 9 | 3 | 64 | 33 draws, 3,892 tris, 6 mats | 34 draws, 7,932 tris | 34 draws, 19,524 tris | 33 draws, 580 tris, 7 mats |

`node game/furnish/tools/print-cost.ts` prints the table. **One draw for the walls, whatever the bay count**: 53 bays and 86 bays both cost the same one mesh, and a finer rhythm or a bigger vocabulary buys triangles, never draws. Home is about twice corpo because every corner of every bay is moulded.

Giving the items shapes cost a room **no draw and one material fewer**: they were already an object each, they now draw with the furniture's material instead of the layer behind, so every room in the table lost a material.

In Chrome on the WebGL2 fallback, standing in a 9.6 by 15.6 m corpo workshop of 88 bays at 1516 by 784:

| | draws | triangles |
|---|---|---|
| the room as it was | 37 | 4,437 |
| plus the bays its walls are made of | 38 | 12,645 |

And one of every archetype standing on a run of counters at 1720 by 623:

| | draws | triangles |
|---|---|---|
| 25 items, one mesh each | 61 | 14,925 |
| the same 25 in one `BatchedMesh` | 13 | 14,701 |

Every item geometry is indexed, on the one shared material and agreeing attribute for attribute, so a batch takes all of them: 25 draws become 1, and 500 would too. `npx vite --port 5311` and `/game/furnish/tools/preview/index.html` is the page those numbers come from.

## How to modify this blackbox safely

A prop's footprint or its contact height is `src/catalog/specs.ts` alone, and both are read by `@gb/forge`, so a change there is a change to what the planner claims. What a prop looks like is one file per family under `src/props/`, one exported builder per prop kind, all of them drawing through `Solid.block` in `src/build/solid.ts`, or through `src/build/bar.ts`, which is the same block laid on its side; nothing else may make geometry.

A carried thing is the same shape of code one folder over. How big it is and what it is made of is `src/items/specs.ts` plus `src/items/matter.ts`; how much a cast may swing is `src/items/cast.ts`; what one looks like is one file per family under `src/items/` (`paper.ts`, `vessel.ts`, `pack.ts`, `tool.ts`), one exported builder per archetype. Look at the result before believing it: `npx vite --port 5311`, then `/game/furnish/tools/preview/index.html`, which stands one of every archetype on a counter and prints the draws and triangles (`?view=hand|near|far`, `?cast=`, `?some=`, `?batch=1`, `?labels=1`).

A wall is four files and they do not overlap: `src/walls/bays.ts` is the vocabulary and the heights, `src/walls/runs.ts` reads a room out of the world document as four walls with their doorways and their furniture, `src/walls/plan.ts` decides which bay goes where, and `src/walls/draw.ts` draws one. `src/walls/things.ts` is what stands in a niche. Retuning how often a wall carries a shelf is the taste table in `bays.ts` alone; changing what a shelf looks like is `draw.ts` alone.

What the two languages are made of is `src/style/palette.ts`, and how much a variant may swing is the taste table in `src/style/variant.ts`. What a floor or a wall is laid in is `src/surfaces/surfaces.ts` plus the sources named in `tools/pack.ts`; the pattern itself is `src/surfaces/pattern.ts`, and the tiling rule is written twice in `src/surfaces/tiling.ts`, once for the GPU and once for the CPU the tests measure, so both change together. A new generated surface follows `tools/textures/README.md`, lands in `assets/gen/`, and needs its average brightness in `SURFACE_TEXTURES` (`node game/furnish/tools/print-grain.ts`).

Run `pnpm --filter @gb/furnish test`.
