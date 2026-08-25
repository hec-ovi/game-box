# @gb/kitbash contract

contractVersion: 0.8.0

## Purpose

Builds a plot into a building made of Downtown City MegaKit pieces on a 2 m grid: the footprint it was given, the height its storeys ask for, its door on the wall the entrance faces, and a front that reads as the kind of place it is. Its windows look into furnished rooms and light up after dark, its walls carry lit signs with its own name on them sized to the fascia and a lamp either side of the door, it says where every one of those lights is so the scene can light the walls from them, and it lines the pavements with street lamps it draws from code. It also surfaces the ground the buildings stand on, out of the same kit's textures, and takes the whole kit, that ground included, to the tone the town's theme asks for.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new KitDressing(kit, rest?)` | a `KitLibrary`, and the `Dressing` behind it (defaults to `@gb/scene`'s `Greybox`) | |
| `KitDressing.building(plot, size)` | a `@gb/world` `Plot`, `{ width, depth, height }` in metres | the size matches the plot: `width / rect.w` is the world's cell size |
| `KitDressing.lights(plot, size)` | as `building` | |
| `KitDressing.streetlights(world, spacing?)` | a `@gb/world` `World`, metres between lamps (default `LAMP_SPACING`, 20) | the grid painted, so pavements and roads are where they will be |
| `KitDressing.setTime(hours)` | hours, 0 to 24, wrapping | cheap enough for every frame; a non-finite reading is ignored |
| `loadKit(scenes, theme?)` | one `THREE.Object3D`, or the array `GLTFLoader` hands back as `gltf.scenes`; the city's theme text (default `DEFAULT_THEME`) | a scene holding the packed kit, one named node per piece and one per ground surface |
| `placeholderKit(theme?)` | the city's theme text | |
| `nightLook(hours)` | hours, wrapping | |
| `lampSpots(world, spacing?)` | as `streetlights` | |
| `signsFor(plot, size, cellSize?)`, `lightsFor(plot, size, cellSize?)` | as `building` | |
| `flavourOf(theme)` | the city's theme text | |

`KitDressing` also carries `prop`, `character`, `pickup` and `surface` from the `Dressing` seam and passes every one of them straight to `rest`: the Downtown kit is a street kit, with no furniture and no people in it.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `building(plot, size)` | `THREE.Object3D` | origin at the centre of its base; one mesh per kit material, never one per piece, plus one more for every sign on it; a child named `door` at the middle of the doorway, looking out |
| `streetlights(world)` | `THREE.Object3D` named `kit:streetlights` | one `kit:streetlights:posts:<n>` per district holding that district's lamps as an instanced mesh, and one `kit:streetlights:halo` holding every glow in one additive quad buffer. Districts run row-major, so the same town chunks the same way every run. A town with no kerb in it gives the group empty |
| `setTime(hours)` | nothing | every window and every lamp in the city moves to that hour |
| `ground(kind)` | `THREE.Material` | the surface that kind of cell is made of, tiling at a real-world size; the same kind is always the same instance. A kit whose pack has no ground surfaces in it hands the question to `rest` |
| `loadKit` / `placeholderKit` | `KitLibrary` | `parts(piece)` gives geometry per material, in metres in the piece's own frame, `material(name)` gives the one shared instance, `ground` holds the tiling surfaces when the pack carries them, and `night` is the city's clock reading |
| `KitLibrary.night` | a `CityNight` | `level` (0 by day, 1 in the dark) and `lit` (the share of rooms with the lights on) as node uniforms, plus `hours` and `setTime` |
| `nightLook(hours)` | `{ level, lit }` | what any hour of the day means, as plain numbers |
| `lampSpots(world, spacing?)` | `LampSpot[]` | where every lamp stands, in metres, and the way it faces |
| `PIECES`, `PIECE_IDS`, `KIT_MATERIALS`, `MODULE`, `RELIEF`, `GLASS`, `FAKE_INTERIOR`, `isGlazed` | the catalog, measured from the kit's own files, and the two material names windows hang on | |
| `STREETLIGHT` | the lamp the box draws: the column, the arm, the head, the strip and the two fittings, in metres | |
| `ROOM_ATTRIBUTES`, `Room` | the room a pane looks into, and the vertex attributes it rides on: `roomOffset` (from this vertex to the middle of its room's window wall), `roomSize`, `roomLook` | |
| `GROUND_TEXTURES`, `GROUND_LOOKS`, `PAVEMENT_TONES` | the three tiling surfaces with the metres one tile covers, what each cell kind takes from them, and how much of the kit's own pavement each kind of town keeps | every kind in `@gb/world`'s `CELL` has a look, and every `Flavour` has a share |
| `RECIPES` | `Record<BuildingKind, Recipe>` | every kind in `BUILDING_KINDS` has one |
| `signsFor(plot, size)` | `Sign[]` | every lit rectangle on the building, in metres in its own frame: what it is (`kind`: `sign`, `strip` or `doorlamp`), the wall it belongs to and whether it is flat on it or hung off it (`wall`, `mount`), where it is, which way it looks, its colours and the cells written on it. What `building` will actually hang there. A hung sign is one entry, drawn on both sides |
| `lightsFor(plot, size)`, `lights(plot, size)` | `LightEmitter[]` | one per sign, in the same order and the same frame: `kind`, `position` just off the lit face, `colour` (what burns, packed `0xRRGGBB`), `intensity` in candela at full dark, and `radius`, the metres past which it is not worth drawing (where it falls to 0.1 lux, at most 16). Nothing draws them here: the scene that owns the lights does |
| `SIGN` | the material name, how far a panel stands off the wall and hangs over the street, how much wall a hung one's bracket takes, and how hard a tube burns | |
| `DOORLAMP`, `LETTER_SHARE` | the door lamp's line: its width, where it starts and how far past the door head it reaches; and the share of the fascia's height one letter may take | |
| `SIGNAGE`, `TRADE_WORD` | how loud each trade is, and the short word its blade spells | every kind in `BUILDING_KINDS` has both |
| `GLYPH_KEYS`, `MARKS`, `SOLID`, `cellUv`, `cellAt` | the atlas: every cell it holds, and where each one is | `cellAt` is the inverse of `cellUv`, so a sign can be read back off its own geometry |
| `SIGN_ATTRIBUTES` | the three vertex attributes a sign rides on: `signInk`, `signPanel`, `signGlow` | |
| `flavourOf(theme)`, `TONES`, `DEFAULT_THEME` | which of seven kinds of town a theme names, what each is made of, and the one assumed when nobody says | every `Flavour` has a `Tone` |

## Errors (closed set)

- `kit-incomplete`: `loadKit` was handed a scene with no node, or nothing drawable, for some catalog piece. Thrown as `KitIncomplete`, carrying `missing`, the piece ids it could not find.
- `kit-unmergeable`: pieces sharing a material would not weld into one mesh, because their geometry does not agree attribute for attribute. Thrown as `KitUnmergeable` from `building`, carrying `material` and the `pieces` on it. A library from `loadKit` or `placeholderKit` cannot raise it, because both bring every part to one shape; a `KitLibrary` built by hand out of foreign geometry can.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, and `Greybox` as the layer behind it.
- `@gb/world` contract: `Plot`, `World`, `BUILDING_KINDS`, `METRICS`, `cellCentre`.
- `@gb/kit` contract: `Rng`, for determinism.
- `three`, `three/webgpu` and `three/tsl`: the window and lamp materials are node materials, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself.
- The art: Quaternius Downtown City MegaKit, CC0, packed by `tools/build-kit.ts` into `assets/dist/downtown-kit.glb` (19 wall pieces, 3,403 triangles and 3 ground surfaces, 0.76 MB). The street lamps are not art: they are cut from primitives here. The pack is meshopt-compressed and quantized, and its dedup step folds the kit's 10 material names into the 6 that have distinct textures. The ground surfaces are the kit's own textures, so the road costs nothing over the buildings: asphalt and its relief are one copy shared with the kit's own road piece, and only the paving and the earth are new (70 KB of the pack).

## Windows

A pane is any surface on the kit's `MI_Glass` material: that name is the hook the whole feature hangs on. Every glazed module is given a room at plan time and the room rides on the pane as three vertex attributes (`roomOffset`, `roomSize`, `roomLook`). The one glass material raymarches that box in the fragment shader and shades the floor, the back wall, a door, a sofa and a table it meets, so a facade has depth through it instead of a flat decal. No geometry, no texture, no draw: the technique is three's own `examples/jsm/generators/city/SkyscraperGenerator.js` (MIT).

- A room runs across one to three modules of one storey, so neighbouring windows share an interior and light up together.
- A pane carries where it sits inside its own room, never where the room is. Everything the raymarch uses is an offset or a direction, so the numbers stay true whichever frame the pane is drawn in: `@gb/scene` puts every building in the city into shared buffers, which moves the vertices and leaves the distance from a pane to the middle of its own window wall alone.
- Every room carries a key, 0 to 1. It is lit while the city's lit share is above its key, so the same rooms come on in the same order every night, none of them flickers, and a room with a low key stays lit through the small hours while a high one only burns in the evening.
- The kit paints a flat grey plane behind its own glass (`MI_FakeInterior`). The pane draws a real room, so that plane is never packed into a building, which is a mesh and about 33 triangles a building saved.

## Signs

A street reads by its signage. The buildings are near silhouette after dark and what you actually see is the lit rectangles on them, so signage is the feature that makes a facade look inhabited rather than modelled.

Every plot gets its own name over the door and a lamp either side of it, whatever its trade. A trade gets more: a blade down the front spelling what kind of place it is, a box hanging out over the pavement, a strip of marks somewhere up the wall, a board high on it and a tube up the corner. How much of that it gets is `SIGNAGE`, by kind: a bar carries six or seven, a house carries three.

- **The letters are drawn from code.** `src/sign/glyphs.ts` holds a stroke font on a 4 by 6 grid, A to Z, 0 to 9, a little punctuation, and eight marks that spell nothing. `src/sign/atlas.ts` rasterises each of them into one 512 by 512 single-channel sheet as a round-capped tube with a soft shoulder, 256 KB before mips. Nothing is downloaded: a world file has to carry its own signage, and a font is a licence.
- **It is a font, not a sheet of finished signs.** A sign is a run of quads, one per letter, each pointing at its own cell. A thousand buildings with a thousand different names read the same fixed-size texture, so the atlas does not grow with the city.
- **Every letter is sized off the fascia.** The ground floor's fascia is the kit's own metre-tall closer over the shopfront, and the tallest letter on the building is `LETTER_SHARE` of its height: 0.5 m on a 4 m ground floor. The nameplate sits in that band, and the blade, the strip, the board and the box over the street take their panel sizes from the same letter, so nothing on a wall is bigger than the wall has room for.
- **A sign claims its wall before it is drawn.** Every panel takes the patch it stands on, with 12 cm of air round it, and a later one landing on a held patch is not drawn; a hung box claims the width of its bracket. Each of the small lit things offers both ends of its wall and the first free one is taken. Measured on a town of 160 plots and 785 signs: no two of them overlap, where before the claim 96 pairs did.
- **The door has a lamp, not a column.** Two warm lines, `DOORLAMP.width` (5 cm) wide, from 35 cm above the pavement to 15 cm past the door head, standing 22 cm outside either edge of the door, burning at 0.9 of their own colour. A lamp is bounded by the door it lights and never past white; anything taller or brighter beside a door is not this box's.
- **The name comes from the world.** `plot.name` goes over the door and `TRADE_WORD[plot.kind]` goes down the blade, so a sign is wayfinding rather than decoration: the name tells you which place it is, the blade tells you what it is. A name that will not fit is shrunk first and cut short only when shrinking would make it a smear.
- **Colour is per sign, seeded per building.** `src/sign/palette.ts` is cyan and teal heavy with magenta, amber, crimson, lime and violet against them. A building draws one hue and its later signs draw against that one, so no two signs on a facade wear the same colour and a run of buildings is not one long stripe.
- **A panel is opaque and so are the letters on it.** A letter quad paints the panel colour where the letter is not, so panel and letters are one surface with no blending and nothing to sort. The colours ride on the vertices (`signInk`, `signPanel`, `signGlow`), which is what lets one material draw every sign in the city.
- **Nothing glows in daylight.** The emissive is the ink through the letter, the panel behind it, times the city's own night level, so at noon a sign is a painted panel lit by the sun and `setTime` brings the tubes up with everything else. The halo round a lit tube is the app's bloom pass, never geometry.
- **Every sign is a light.** `lightsFor` answers one emitter per sign, strip and door lamp: its colour is whatever burns, its candela is the lit area times the emissive (20 cd a square metre for a tube, 120 for a lamp), and it sits 20 cm off a flat panel so it reaches the wall round it. The scene draws them; this box only says where they are.

## The street lamps

A street lamp is cut from primitives here rather than loaded, so there is no licence to chase, every kit lights its streets, and no two lamps on a street have to be the same lamp.

- **The shape is modern.** A slim tapered column on a shoe, an arm out over the road rising as it goes, and a flat head with a lit panel under it. Nothing on it is ornament. `STREETLIGHT` holds every dimension.
- **There are two kinds, and one street carries both.** Most lean a head over the road. The rest have no arm at all: one lit line up the road-facing side of the column, which is the whole lamp.
- **They vary, and it costs no draw.** The city has one lamp buffer with every fitting in it. Each vertex carries which surface it is on (`lampPart`) and which fitting it belongs to (`lampGroup`); each lamp carries the fittings it has as a bitmask and how cool its light is (`lampVariant`), and where it stands (`lampBase`). A fitting this lamp does not have has its vertices collapsed onto the lamp's own base in the vertex shader, so it rasterises nothing. Height varies on the instance matrix, which is free.
- **Two fittings hang off the shaft**: a camera on a stub bracket with a status light on the front of it, and a service box on the side away from the road. Between a quarter and a half of the lamps carry each. They are what makes a row of lamps read as a street somebody maintains rather than a row of the same object.
- **The light is cool and it is authored just under clipping.** Cool white to faintly cyan, per lamp. The panel burns at `LOOK.glow` and the app's bloom pass makes the glow, exactly the way the signage is authored: a lamp on a wet road is two bright things, itself and its reflection, and a halo built into the geometry blows out both. The mast carries a little neutral spill so the column is a pale grey line after dark rather than a black one.
- **The halo is the wet air, not the glow.** One additive quad a lamp, sized to the thing that is lit: a small disc under a head, a tall sliver beside a strip. One draw for the city.
- **Same seed, same street.** The variation comes off the city's own seed through a `@gb/kit` `Rng` forked per axis (`form`, `camera`, `box`, `tint`, `scale`), so retuning how many lamps carry a camera cannot move the ones that lean over the road. Where the lamps stand draws no numbers at all: it is read off the grid.

## The tone of the town

The kit is authored bright: red brick and pale concrete. `flavourOf(theme)` reads the city's theme as one of seven kinds of town and `TONES` says what that town is made of. A neon city takes the walls down to near black so the only colour on the street is what is lit; a farming village keeps its ochre.

- The tint multiplies the kit's own maps rather than replacing them, so the brick keeps its bond and the concrete keeps its pitting. Only the value and the hue move.
- Enough distance is kept between brick, trim, concrete and dark trim that a facade still reads as having parts. A flat black building is as wrong as a white one.
- Grime is one generated 256 by 256 two-channel sheet, blotches in one channel and rain streaks in the other, sampled twice in world space along the wall and up it, weighted toward the pavement where the traffic throws its dirt. Two texture fetches, because a facade fills the screen and four octaves of noise a fragment would not be free.
- The ground is toned by the same theme. The kit's asphalt is 0.042 linear and its marble slabs, tinted grey, are 0.221, so the roadway already sits where `@gb/scene`'s wet film paints it and the pavement is the one that reads pale after dark: with the walls at 0.01 and nothing but lamps and signs lighting them, a pale pavement is the brightest thing in the street. `PAVEMENT_TONES` takes it to 0.091 in a neon town and 0.111 in an industrial one, and leaves the other five at the kit's own concrete, because a pale pavement under a sun is what a pavement looks like. The kerbs go with it: they are the same material.
- The window shader and the plane behind the glass are left alone: they are somebody else's materials. The lamps are ours and carry their own colours, so a tone never reaches them.
- The theme has to be handed in. `loadKit(scenes, world.theme)` is the whole of it; without it every city is `DEFAULT_THEME`.

## Invariants

- One world unit is one metre. Wall pieces are 2 m across and 3 m tall; the ground floor is `METRICS.building.groundFloorHeight` and closes with the kit's own metre-tall band, and storeys above stretch their module the 7% it takes to reach `METRICS.building.storeyHeight`.
- A building's walls stand on the plot boundary. Window and trim relief reaches up to `RELIEF` (0.05 m) past it on each face, a flat sign stands `SIGN.stand` (0.08 m) off it, and a sign hanging over the street reaches `SIGN.stand + SIGN.reach` (1.23 m). Nothing else does.
- Every sign lies on the wall it names: a flat one looks the way the wall does and stands `SIGN.stand` off its plane, a hung one starts there and reaches out at a right angle. No two signs on one wall overlap, no letter is taller than `LETTER_SHARE` of the fascia, and a door lamp is no wider than `DOORLAMP.width`, no taller than the door head plus `DOORLAMP.overhead`, and never brighter than its own colour. All four are measured over a generated town in `tests/signs.test.ts`.
- Every sign has a light, in the same order `signsFor` lists them, so the two can be read side by side.
- A building is exactly as tall as the height it was given: the roof deck sits 0.2 m below the wall top, so the walls read as a parapet round it.
- The door is on the wall the entrance cell sits against, in the module nearest the doorstep `@gb/scene` puts on the pavement.
- Same seed, same city, always. Every draw comes from a `@gb/kit` `Rng` on the plot's id, kind and style, forked per feature (`rhythm`, `rooms`, `signs`), so adding a feature later cannot move the windows a city already has. Where the lamps stand is read off the grid and draws nothing at all.
- This box holds no clock. It remembers the hour it was told and renders it; whoever owns the clock calls `setTime`. Moving the city through the evening is two uniform writes, about 0.25 us, however many buildings and lamps are standing.
- The kit loads once. Buildings clone geometry out of the library, and every piece sharing a material is welded into one mesh, so a building arrives as as many meshes as it has materials on it (4 or 5 out of the packed kit) plus one for its signs, not as many as it has pieces (28 to 146). Lit windows add none of their own. `@gb/scene` then puts every building on one material into one buffer, so a whole town is a draw per material; what this box owes that arrangement is indexed meshes on shared materials, which is exactly what the weld produces.
- Every sign in the city is drawn with one material, so `@gb/scene` puts the lot in one batch and the whole town's signage is one draw. What varies between signs rides on the vertices: two colours and two glow strengths, the same trick the panes use for their rooms. A sign geometry is indexed, single-material and the same shape as every other one, which is what a batch takes.
- A sign stays on its own building: never over the parapet, never in the pavement, and never wider than the wall it is on. What will not fit is not drawn rather than shrunk into a smear.
- The signage runs off the front, which is the wall the entrance is on and so the wall that faces a street. A blade may go on a flank, because a corner building has two fronts and a flat panel that ends up behind a neighbour costs two triangles; nothing that hangs over the street ever does, because that would hang it inside the building next door.
- The letters and the grime are drawn from code into two small fixed textures, 256 KB and 128 KB, which do not grow with the city. Nothing is downloaded, so a world file carries its own signage and its own weather.
- The kit is tinted, never repainted. A tone multiplies the pack's own maps, and the materials somebody else owns (the glass, the plane behind the glass) are handed through untouched, because the window shader is built on the kit's own.
- Lamps stand on pavement cells that touch a road, at the kerb, half a metre back from the edge so the pavement stays walkable, which leaves the whole width of the shoe between the column and the kerb line. A kerb is read as a run and its lamps are spread evenly along it, at least one however short the run is: a stretch of street with no lamp on it is a stretch you cannot see. The arm reaches out over the roadway, 1 m past the kerb and 6.2 m up, which is clear of anything that drives under it.
- The lamps are cut into districts of `DISTRICT` (48 m) and each district's posts are one instanced draw with a bounding volume of its own, because one volume over the whole town can never be culled: standing on one street you would pay for the lamps on every other, in the shadow pass as well as the frame. The haloes stay in one buffer for the city, because two triangles a lamp is not worth a draw to cull. One material for every post and one for every halo, whatever the size of the town, and both go out with the daylight.
- A piece is taken in the frame the pack gives it, transforms above the mesh baked in: the pack carries a piece's dequantization on its node, so that transform is scale, not placement.
- Every part is brought to one shape as it loads: float position, normal and UV, indexed, nothing else. Kit exports are uneven (quantized positions, a second UV set, vertex colours, meshes with no UVs at all) and two geometries only weld when they agree attribute for attribute.
- The catalog is measured, not guessed: `tools/measure.ts` reads the kit's glTF files, and a test fails if the numbers in `src/catalog/pieces.ts` drift from them, or if the shipped pack does not hold its pieces at them.
- The ground tiles at a real-world size. `@gb/scene` lays ground UVs out in metres, so a surface that should repeat every `tile` metres is set to `repeat = 1 / tile`: asphalt and earth every 4 m, paving every 2 m, which lays the pavement in half-metre flags whatever the cell size is.
- Cells share surfaces, and a kind is always the same material instance: a city has thousands of cells and six materials for them. The pavement and the ground a building stands on are one and the same.
- Colour comes from the tint over a shared texture, not from a texture each: the same earth is a park greened down and bare land untinted, and the kit's warm marble is the pavement's concrete grey. A town's tone scales that tint rather than replacing it, so a dark street still has flags, joints and wear on it.
- Water has no colour map: it is its own colour, roughened by the road's relief so the light breaks up on it.
- The mountain ring takes a plain rock colour and no texture, because `@gb/scene` builds it from blocks whose faces are UV'd 0 to 1 rather than in metres: nothing tiles on them at a real size.
- The ground borrows the kit's textures without changing them: the maps come off the pack cloned, so tiling the road at 4 m leaves the kit's own road piece painted the way it was authored.
- The ground is all or nothing. A pack missing any of the three surfaces gives none of them, and `ground` falls through to the dressing behind it, because half a textured street is worse than the greybox.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.

## What it costs

Measured headless in Node on 350 buildings round 49 blocks of a 157 by 147 town, with the shipped pack, and again in Chrome on the WebGL2 fallback with the camera standing at the spawn:

| | meshes | draws at the spawn | triangles at the spawn |
|---|---|---|---|
| buildings, in `@gb/scene`'s batches | 5 | 5 | 1,925,087 of 2,941,704 |
| every sign in the city, in one more batch | 1 | 1 | 2,088 of 31,312 |

A building is 8,405 triangles over 4.2 kit materials. It costs no draw of its own: `@gb/scene` puts every building on one material into one buffer, so a town of any size is a draw per material. What this box owes that arrangement is indexed meshes on shared materials, which is what welding a building's pieces per material already produces.

### What the street lamps cost

A lamp is 146 triangles: the column, the arm, the head, the lit panel, the strip, the camera and the service box are all in the one buffer, and the fittings a lamp does not carry are collapsed to nothing in the vertex shader. The kit lantern it replaced was 1,028.

Measured headless in Node on a 157 by 157 town of 196 plots, 392 lamps and 49 districts, with the camera at the spawn:

| | meshes | draws at the spawn | triangles at the spawn |
|---|---|---|---|
| 392 street lamps, 49 districts and their haloes | 50 | 35 | 41,226 of 58,016 |

And in Chrome on the WebGL2 fallback at 1568 by 764, standing in a street canyon of a 16 block town (64 plots, 91 by 91 cells, 128 lamps) at 21:30 with the road soaked and the signs lit, before and after:

| | lamp draws in frame | lamp triangles in frame | the whole frame |
|---|---|---|---|
| the kit lantern, 1,028 triangles each | 6 | 39,320 | 32 draws, 608,462 triangles |
| the lamp drawn here, 146 triangles each | 6 | 5,804 | 32 draws, 574,946 triangles |

Same draws, a seventh of the triangles, and the variation came with it. Chunking the posts into 48 m districts is what lets the frustum throw most of a town away; one volume over the whole town could never be culled, in the shadow pass as well as the frame.

Windows and their rooms add no draw and no triangle: they ride on the panes the buildings already had (about 194 triangles of glass a building) as three vertex attributes.

Signage is one draw for the city and about 1% of its triangles. A building carries 4.9 signs (two of them the door lamps) and 40.5 quads, 81 triangles, against the 8,405 the walls cost: a house has three signs on it and a bar has seven. The one draw is the whole design. A sign per building as its own mesh would have been 350 draws and would have undone the batching; instead every letter is a quad on one shared material, the colours ride on the vertices, and the count is one however large the town is. Measured on the same street, hiding the sign batch takes the frame from 22 draws and 440,080 triangles to 21 and 437,342.

The tone costs nothing extra: it is the same materials with a tint and two texture fetches on them, so the buildings draw with exactly the materials they drew with before.

`setTime` is 0.25 us: two uniform writes.

## Standing it up

```ts
const dressing = new KitDressing(loadKit(gltf.scenes, world.theme))
scene.add(buildCity(world, dressing).root)
scene.add(dressing.streetlights(world))
// every frame, or whenever the hour changes
dressing.setTime(player.clock.hour + player.clock.minute / 60)
```

## How to modify this blackbox safely

Changing what a kind of ground looks like, or how dark a kind of town wants its pavement, is a change to `src/ground/surfaces.ts` alone; a new tiling surface is an entry there plus the kit textures it is made of in `tools/ground-surfaces.ts`, then a rebuild. `node tools/measure-ground.ts` prints what the pack's own maps are worth in linear light and what each cell kind lands at per town, which is where the ground numbers come from and how to re-aim them after a repack. Changing what a kind of building looks like is a change to `src/catalog/recipes.ts` alone, and what an hour of the day means to `src/night/clock.ts` alone. Adding a kit piece means adding it to `src/catalog/pieces.ts` with bounds from `node tools/print-catalog.ts`, then rebuilding the pack with `node tools/build-kit.ts`; the lamps are not in the pack at all. Every dimension and colour of a lamp lives in `src/street/lamp/design.ts`, what is cut from them in `src/street/lamp/model.ts`, how the lamps in a city differ in `src/street/lamp/variants.ts`, the shader in `src/street/lamp/material.ts` and the glow in `src/street/lamp/halo.ts`, each of them on its own; a new fitting is an entry in `GROUP`, a few shapes in `model.ts` and a chance in `variants.ts`, and nothing else has to know. How wide a lamp district is lives in `src/street/districts.ts` alone. How loud a trade is and what its blade spells live in `src/sign/trade.ts`, where the name, the blade and the box over the street go in `src/sign/plan.ts`, the strip, the tube and the board in `src/sign/accents.ts`, the door lamp in `src/sign/doorlamp.ts`, how a letter is sized off the fascia in `src/sign/fascia.ts`, how a wall is claimed in `src/sign/claims.ts`, how a panel lands on its wall in `src/sign/place.ts`, what light a sign throws in `src/sign/light.ts`, the colours in `src/sign/palette.ts`, the letters in `src/sign/glyphs.ts` and what a kind of town is made of in `src/look/tones.ts`, each of them on its own. A new letter is an entry in `glyphs.ts` and nothing else: the atlas lays out whatever is in it, up to 96 cells, and fails loudly past that. The pack builder refuses to finish if a piece is not in the output under a name `loadKit` looks for. Wall pieces have to be authored the way the kit authors them (outer face on z = 0, body into negative z, width centred on x, base on y = 0), and the pack has to leave them there, or the composition rules put them in the wrong place; `tests/pack.test.ts` holds the shipped pack to the catalog's own numbers. Run `pnpm --filter @gb/kitbash test`.
