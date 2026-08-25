# @gb/furnish contract

contractVersion: 0.10.0

## Purpose

Dresses the inside of a building: every piece of furniture the generator can place and every thing a player can pick up off it, built from parameters to the cells of floor the room planner claims and to the height a body meets it at, walls that are a run of bays rather than one flat surface, and a television playing a schedule computed from the clock, in one of two interior languages, on floors and walls laid in a pattern and a finish that tile at real-world size.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new FurnishDressing(kit, rest?, style?, choices?, slot?)` | a `FurnishLibrary`, the `Dressing` behind it (defaults to `@gb/scene`'s `Greybox`), `'corpo'` or `'home'` (defaults to `'corpo'`), which entry of each surface pool to paint with (defaults to the first), and which of the town's screenings its televisions are on (defaults to the first) | |
| `FurnishDressing.as(style)` | `'corpo'` or `'home'` | |
| `FurnishDressing.room(interior)` | a `@gb/world` `Interior` | its rooms tile the interior and every door sits on a room edge, which is what `@gb/forge` builds |
| `FurnishDressing.prop(prop)` | a `@gb/world` `FurnitureProp` | |
| `FurnishDressing.contactHeight(prop)` | a `@gb/world` `FurnitureProp` | |
| `FurnishDressing.pickup(item)` | a `@gb/world` `Item` | |
| `FurnishDressing.surface(part)` | `'floor'`, `'wall'` or `'ceiling'` | |
| `loadFurnish(scenes, seed?)` | one `THREE.Object3D`, or the array `GLTFLoader` hands back as `gltf.scenes`, and the town's seed | a scene holding the packed interior surfaces |
| `furnishKit(seed?)` | the town's seed | |

`FurnishDressing` also carries `building`, `character` and `ground` from the `Dressing` seam and passes each of them straight to `rest`: this box answers for the inside of a building and nothing else.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `room(interior)` | `FurnishRoom` | that interior's own room, in the language its building's finish gives it: `dressing` to build it with and `decor` to add to what came back. See **Standing a room up** |
| `FurnishRoom.style` | `FurnishStyle` | the language the room came out in: `finishOf(interior.kind)`, whatever language the dressing that made it was in |
| `FurnishRoom.dressing` | `Dressing` | paints this interior's own floor, walls and ceiling, drawn from its id, so the shop is not the same room as the flat above it |
| `FurnishRoom.decor` | `THREE.Mesh` | every bay of every wall of the interior, one indexed mesh on the one shared material, in the interior's own coordinates. One draw, whatever the bay count |
| `FurnishRoom.bays` | `PlacedBay[]` | `kind`, `roomId`, `side`, the `face` the wall stands on, the stretch it claims (`from`, `to`) along the wall's own axis, that stretch in `cells`, and how far it stands off the wall (`depth`) |
| `FurnishRoom.contacts` | metres | every height in that room a body can put something down on, exactly: niche sills and shelf ledges |
| `prop(prop)` | `THREE.Mesh` | one indexed mesh on the one shared material, origin at the centre of its base, front looking north, inside the cells `@gb/world` claims for it and no further. Geometry is shared with every other copy of that prop in that language |
| `contactHeight(prop)` | metres, or nothing | how high the top of that piece is drawn: the number a till or a coffee machine is lifted by to stand on it, and the number the planner writes as `Furniture.lift`. Nothing for a piece nobody stands anything on |
| `pickup(item)` | `THREE.Mesh` | the thing itself at the size it really is: one indexed mesh on the same shared material, origin at the centre of its base, front looking north, inside the box its archetype publishes. Geometry is shared with every other item of that archetype in that cast |
| `surface(part)` | `THREE.Material` | the floor, walls or ceiling of a room in this dressing's language, pattern and finish, tiling at the real-world size of its image whatever size the room is, carrying the room's own probe so a polished one reflects something. The same look is always the same instance. A pack with no surfaces in it hands the question to `rest` |
| `as(style)` | `FurnishDressing` | the same library and the same material in the other language |
| `loadFurnish` / `furnishKit` | `FurnishLibrary` | `geometry(prop, style, slot?)` gives the built mesh's buffer on one of the town's screenings, `screenings(prop, style)` how many a piece has, `contact(prop)` how high off the floor a body meets it, `staffContact(prop)` the second surface of a piece worked from both sides, `heightOf(prop, style)` how tall it stands measured off the triangles, `item(item)` and `itemGeometry(archetype, cast)` the buffer for a thing you pick up, `castOf(item)` which cast it drew, `material` the one shared instance, `seed` the town's, and `surfaces` the tiling floor and walls when the pack carries them |
| `finishOf(kind)` | `FurnishStyle` | which language a kind of building is dressed in: `home` for an apartment, a house and a hotel, `corpo` for everything worked in. Exhaustive over `BUILDING_KINDS` |
| `ContactKind` | `'work' \| 'rest'` | which surface of a piece a body meets, as `@gb/world`'s `PropSpec` names it |
| `ITEM_SPECS` | `Record<ItemArchetype, ItemSpec>` | **what a thing you pick up is**: `width`, `depth` and `height` in metres, and the matter its casts are made of. Covers all 25 of `@gb/world`'s `ITEM_ARCHETYPES` |
| `ITEM_CASTS` | `number` | how many ways one archetype is drawn: 3 |
| `castIndex(seed, itemId)` | `number` | which cast that item drew |
| `itemCast(seed, archetype, index)` | `ItemCast` | one cast: its body, fittings and mark, its moulding, its proportions and whether its one bright detail is lit |
| `MATTER` | `Record<Matter, Look>` | what a carried thing can be made of: paper, board, glass, ceramic, timber, steel, leather, cloth, plastic, and the three that emit |
| `BAY_SPECS`, `BAY_TASTE` | the eight kinds a bay can be, how wide each may be in cells, how far it stands off the wall and how low, and how often each language reaches for it | |
| `WALL` | metres | every height a wall is divided at: the head of the field, the rail over it, the niche sill and head, the shelf ledges and their pitch |
| `WALL_CONTACTS` | metres | every height the vocabulary can offer to stand something on, each one once: a shelf's lowest ledge and a niche's sill are two metres and land on the same number whenever the worktop and the service counter agree |
| `SIDES` | `'north' \| 'south' \| 'east' \| 'west'` | which wall of a room a bay is on |
| `FURNISH_STYLES`, `PALETTES` | the two interior languages and the eleven surfaces each paints | |
| `variantOf(style, prop, seed)` | `Variant` | the shape one prop kind takes from that seed: edge profile, corner radius, what holds it up, whether a strip is lit. `'wall'` is a kind like any other |
| `SOLID_MATERIAL` | the name of the one material every prop and every bay draws with | |
| `SURFACE_LOOKS`, `lookOf(style, part, choice)` | the pool each part draws from per language, and one entry of it | four floors, three walls and one ceiling per language, so a town of any size is at most eight materials a language |
| `SCREEN_SLOTS` | `number` | how many different things a town has on: 6 |
| `screenSlot(seed, interiorId)` | `number` | which of them the screens in that interior are showing |
| `screeningOf(seed, slot)` | `Screening` | one of them: a `station` (1 to `STATIONS`) and a `phase`, how far into that station's schedule the set is |
| `STATIONS`, `PROGRAMMES`, `SPOT`, `SPOTS`, `CYCLE`, `SWITCH` | the schedule: four stations, four kinds of programme, ten second spots, twenty-four of them before a station comes round, and four tenths of a second of static at every change |
| `spotAt(seconds, phase)`, `programmeAt(station, spot)` | `Spot`, `number` | which spot a set is in at a given second, and which programme kind that station runs in it |
| `pictureAt(u, v, station, phase, seconds)` | `Rgb` | what one point of one screen is emitting, in the renderer's working space. The twin of what the material runs |
| `SCREEN_LIGHT` | `number` | how hard the brightest part of a screen emits: 1.5, over 1 so the app's bloom finds it |
| `screenAverage()` | `Rgb` | what a screen averages over the glass and a whole schedule, measured off `pictureAt` |
| `SCREEN_ATTRIBUTE` | the name of the fifth vertex attribute: where on the glass a vertex is, and what is on it |
| `SurfaceLibrary.probe(style)` | `THREE.DataTexture` | what a room in that language has to reflect and what its surfaces are lit by: the colour its strips emit, what its screens average, and its own floor, walls and ceiling lit by that light, as one 64 by 32 equirectangular picture. Already hung on every surface material; published so a caller can look at it |
| `SURFACE_TEXTURES` | the four grain images, the metres one tile of each covers, and each one's own average brightness | |
| `Pattern` | the rhythm a surface is laid in: plain, rectangular tiles, chequer, hexagons, triangles or planks, and how big one unit of it is | |
| `surfaceChoices(seed, style, interiorId)` | which entry of each pool that interior draws | |
| `tilingOf(material)`, `mapsOf(material)` | `MetreTiling` and `SurfaceMaps`, or nothing | how big the grain is laid, and which of the pack's images it came from |

## Errors (closed set)

Both are a `FurnishError` carrying `code`, and both are a name this box has no shape for:

- `unknown-prop`: `geometry` or `heightOf` asked for a prop, or a language, the catalog was not built with. `heightOf` refuses rather than answering 0, because 0 is "every bay clears it" and would run a shelf through a wardrobe.
- `unknown-item`: `itemGeometry` asked for an archetype or a cast the items were not built with.

Nothing else can fail. Nothing here loads a model, so nothing can arrive missing: the furniture, the items and the walls are generated. A pack with no interior surfaces in it gives none of them and `surface` falls through to the dressing behind, which is a fall-through and not an error.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, `Greybox` as the layer behind it, and the shell `buildInterior` puts a room in.
- `@gb/world` contract: `PROP_SPECS`, `PROP_CELL` and `footprintOf`, the one table of what a piece of furniture claims and where a body meets it, which this box builds to and `@gb/forge` places from; `FURNITURE_PROPS`, `ITEM_ARCHETYPES` and `BUILDING_KINDS`; the `Interior` document a room's walls and its finish are read off; and `METRICS`, which is the one place a contact height and a wall thickness live.
- `@gb/kit` contract: `Rng`, forked per language, per prop, per archetype and cast, per room and per wall.
- `three`, and its node renderer (`three/webgpu`, `three/tsl`).
- Four tiling images, packed by `tools/build-kit.ts` into `assets/dist/interior-kit.glb` (48 KB). Three are ours, generated from our own prompts and committed at `assets/gen/`: board-formed concrete for a corpo wall, polished concrete for its floor, moulded plastic for a home. The fourth is the Downtown kit's street concrete, CC0, which floors a flat and is the only one carrying relief of its own. `assets/dist` is not in the repository, so a fresh clone runs `node tools/fetch-assets.mjs` and then `node game/furnish/tools/build-kit.ts` before an interior has real surfaces. Furniture and wall bays need neither step.

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

- One world unit is one metre. A prop claims the rectangle of 10 cm room cells `@gb/world`'s `PROP_SPECS` gives it and every triangle of it is inside that rectangle, so nothing overhangs into the piece beside it, into a walkway, or through the wall behind it. Handles, leaves and tap spouts included.
- **Height is a contract, not a measurement.** The geometry is drawn with its top face at the number: a table slab runs to exactly `tableHeight`, a seat pad to exactly `seatHeight`, a bar rail to exactly `barCounterHeight`. Nothing is fitted, scaled or nudged, so a seat cannot come out 7 cm low. The tests measure the drawn triangles and allow ten microns, which is what a float32 position buffer holds, and one of them breaks a prop by 5 mm to prove the measurement catches it.
- **The sizes are `@gb/world`'s, and this box writes none of them down.** `PROP_SPECS` is the one table of cells, contact and height, so the planner and the renderer cannot drift, and every height in it is a `METRICS.furniture` number: bar counter, service counter, worktop, table, stool, seat and mattress. A worktop, a service counter and the bar counter are all 1.0, and everything drawn under one (a cabinet run, a stove's oven and doors, a sink's bowl and its cupboard) is drawn down from the top, so a worktop that moves takes its carcass with it.
- A prop declares a `contact` or a `height`, never both, and the plant declares neither because nobody touches it and its own proportions are the point.
- **A till and a coffee machine stand on a counter, and the number they are lifted by is the drawn top.** `contactHeight(prop)` publishes the contact height a host was drawn to, `@gb/forge` writes it as `Furniture.lift` and `@gb/scene` draws the piece there: the lifted piece's base lands on the host's top plate to the micron, and its footprint fits inside the host's, which the tests hold for both hosts in both languages.
- The contact surface is read off the triangles, never off the bounding box, because the top of a chair is its backrest and the top of a bed is its headboard. `rest` (a seat, a mattress) is the widest level plate that looks up; `work` (a counter, a desk, a hob, the run beside a sink) is the highest one covering at least a quarter of the piece's own footprint. Nothing draws a lid under something that sits on it, or that hidden plate would be the widest one on the piece.
- The bar counter is the only piece worked from both sides, so it is the only one with two surfaces. The customer's drink stands on the rail at the front at `barCounterHeight`; the bartender's forearms rest on the shelf behind it at `serviceCounterHeight`, which is where `@gb/cast`'s lean clip holds a body's hands (1.02 to 1.04). `@gb/world` holds the two level at 1.0, so the rail and the shelf are two slabs side by side on one carcass, each drawn on its own number, the rail in the top look and the shelf in the board look. `staffContact` publishes the second one, and no triangle between them is degenerate: 194 triangles corpo, 260 home, none of zero area.
- **A bed is as long as the body that lies on it.** `@gb/cast`'s lying clip is centred on its own root and reaches 0.96 m either way, so the mattress has to draw 1.92 m of level pad. That is what makes the bed 2.1 m deep: 10 cm of headboard at the back and 1.97 m of mattress in front of it. Measured off the drawn pad, the level surface at `mattressHeight` runs 1.970 m in corpo and 1.934 m in home, where the moulded edge rounds off the last centimetres, both over the 1.92 m the test holds them to. Centring the sleeper shares the overhang between the head and the foot; the length is the mattress's.
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
- The field of bays ends at 2.4 m and a shelf's ledges are pitched off `worktopHeight`, so the two numbers are not free of each other: the highest ledge keeps a whole pitch of clear air under the head of the field, which leaves the lit channel over the wall to itself.
- **The things standing in a niche or on a shelf are decoration.** A cup, a bottle, a canister, a box, a tray, a stack. They are not `@gb/world` furniture, nothing can pick one up and nothing collides with one. Each is a whole number of cells across and exactly one deep, so they land on the same lattice as the bay and fit the shallow shelf a wall can afford.
- Over the field of bays runs a rail with a lit channel under it, over every stretch of wall with nothing standing that high in front of it. That is the room's own light: emissive faces above 1, so the app's bloom finds them. There is no light object anywhere in this box.
- Same seed, same walls, vertex for vertex, and two seeds give two different rooms. Every draw comes from an `Rng` forked per language, per interior, per room and per wall, then per bay, so retuning the taste cannot move the furniture and retuning what stands in a niche cannot change which bay is a niche.

### The screens

- **A television plays something, and it is arithmetic, not a file.** A world file is handed to other players, so a video in it would be bytes in every copy for ever and a licence nobody can answer for. What is on the glass is computed from where the point is on it and what second it is: a news desk, a market board, an advert cutting on a beat, a camera on a yard, and a burst of static at every change of spot. No image, no audio, no download.
- **It is a schedule, not a loop.** Ten second spots, twenty-four of them before a station comes round, and which programme kind a station runs in a given spot comes from a hash of the station and the spot number. Four stations times twenty-four spots is ninety-six different ten second pieces, and inside a spot the picture moves on its own: a ticker crawls, columns rise and fall, an advert cuts every one and a quarter seconds, somebody walks across a camera feed.
- **What a set is showing is seeded, and it is not the technique.** A screening is a station and a phase; `screening.ts` draws `SCREEN_SLOTS` of them from the town's seed and gives each interior one from its id, so the bar and the flat above it are on different channels at different moments, and the same bar is on the same one on the second visit. Retuning who watches what is that file alone and cannot reach what a screen looks like.
- **A screen costs no draw and no triangle.** The glass was already a face of the television. What is new is a fifth vertex attribute, four normalized bytes: where on the picture the vertex is, which station, and the phase. Everything that is not a screen carries zeroes and takes the flat emission its look asked for, and the picture runs inside a branch, so a room full of furniture pays only the four bytes.
- Every buffer in the box carries that attribute, props, carried things and wall bays alike, because a `BatchedMesh` takes geometries only while they agree attribute for attribute: one buffer without it would quietly cost a room its draws.
- **A second screening is one attribute rewritten, not a second television.** A piece with a screen is built once and tuned `SCREEN_SLOTS` times; the tuned copies share every position, normal, colour and index with the piece they came from. Six screenings of the set cost 14 KB. A piece with no screen in it is built once, because there is nothing to tune.
- **The picture is written twice**, the way the surface tiling is: `picture.ts` in TypeScript, where the tests read it and the room's light is measured off it, and `glass.ts` as nodes, where the renderer runs it. Both run the same hash, three's own PCG word hash written out in integers so the two agree bit for bit, and both read one table of colours. Change one and change the other.
- Both sides bound the clock before they use it. `time` runs for as long as the game is open and a float32 second past a few thousand has no frames left in it, so everything works in seconds within one cycle.
- **A screen is a small light and the probe says so.** The room's probe carries what the screens really average over a whole schedule, at the radiance they really emit, over the solid angle a metre of glass really covers from two metres away. That comes to about a fiftieth of the room's light, because two square metres of cove at 3.2 against half a square metre of glass at a quarter is fifty to one, and it lifts a floor by about a hundredth. What it does buy is the reflection: a patch of whatever is on, in a floor polished enough to give it back. A pool of light on the floor in front of the set would need a light object, and there is none in this box.

### What everything is made of

- **One primitive.** Every piece and every bay is an extrusion of a rectangle with a radius on each corner, between two heights, with an edge treatment at each end. A full corner radius makes it a cylinder and an inset at one end makes it a taper, so a worktop, a leg, a plinth, a cushion, a light strip, a wall panel, a shelf ledge and a cup all come out of the same call. There is no second primitive and no model file.
- **One material.** Colour, emission, roughness and metalness ride on the vertices, so the whole catalog, both languages, every carried thing and every wall in town draw with one `MeshStandardNodeMaterial`. A room of 21 pieces, 3 items and 80 bays is 25 meshes on 1 material, all indexed and all agreeing attribute for attribute, which is what `@gb/scene`'s `BatchedMesh` path needs to collapse an interior the way it collapsed the city.
- Light is architecture, not a lamp: a lit trim, a screen, a chilled case, a niche strip and a wall rail are emissive faces authored above 1.
- **Variation is per prop kind, not per instance.** One draw from a stream forked per language and per prop decides the edge profile, the corner radii, what holds the piece up and whether a strip is lit, and the wall is a kind like any other. So the chairs in a room match and every bay in a building is moulded the same way, which is what a real room looks like and what keeps geometry shared.
- A wall bay is drawn at two points per rounded corner rather than the catalog's four. A bay's radius is capped by how thin it is, so a 6 mm fillet at four steps is triangles nobody can see: it is the whole difference between a moulded room costing 35,000 triangles and costing 19,000.
- The two languages differ in palette and in taste, never in size: corpo is square in plan with chamfered edges, thin metal frames and cool white strips; home is radiused, moulded, on plinths, with warm coves. A corpo chair and a home chair put a body in the same place.
- **Which language a room gets is the building's finish, not the caller's choice.** `room(interior)` reads `finishOf(interior.kind)`: the places people live in (an apartment, a house, a hotel) are `home`, and everything worked in is `corpo`. A dressing made in either language hands back the same room for the same building, so a flat is moulded and warm whichever dressing the app happens to hold. `prop` and `surface` on an unbound dressing stay in that dressing's own language, which is what the preview and the tests use. The table is exhaustive over `BUILDING_KINDS`, so a new kind of building says which it is before it compiles.

### The surfaces

- **Pattern and finish are two choices, not one.** A pattern is the rhythm a surface is laid in (rectangular tiles, a chequer, hexagons, triangles, planks, or plain); a finish is its colour, its gloss, how hard the joints read and how much one tile differs from the next. A hexagonal floor can be polished or matte and a plank floor can be near-black and glossy, so two short lists multiply out into far more rooms than one long list of finished floors would.
- **The pattern is arithmetic, never an image.** It is computed from where the point is in the room, in metres, so it costs nothing to store and it cannot jog where a structured texture is cut to tile. The four images the pack carries are stochastic only: two concretes, moulded plastic, and the street concrete under a flat.
- **A floor image goes on a floor.** A wall photograph laid flat runs its weathering sideways, which is what a corpo floor used to do. The images are shot per surface and routed per look, and a test fails if the pack carries one no look reaches, because a packed image nobody uses is bytes inside every copy of every world file.
- **Relief on a wall is geometry, not a normal map.** A wall here is a run of bays standing 3 to 14 cm off it, so the three generated images are colour only: a normal derived from a colour map puts highlights where the picture has no feature.
- The image is grain, not a multiplier. Each one publishes its own average brightness in linear light and the material divides by it, so a look that asks for a mid grey wall gets a mid grey wall rather than a fifth of one. Measured over all four, a surface lands within 5% of the colour its look names and the clamp either side touches under a twenty-fifth of one per cent of samples. That is what lets the probe be painted from the colours alone. A test holds every number against its image, and `node game/furnish/tools/print-grain.ts` prints them.
- **No interior surface is metal.** A near-black glossy floor is a dark colour at a low roughness, not a mirror, because a mirror indoors would come out as a hole in the floor.
- **A polished floor reflects the room, and the room is a picture we paint.** `scene.environment` after dark is the prefiltered night sky, which is nearly black, and the lit channel under the wall rail and the strips up the bays are emissive geometry nothing else has ever seen, so a glossy floor gave back nothing. `src/surfaces/probe.ts` paints what is really in the room as a 64 by 32 equirectangular picture, the same answer `@gb/scene` gave the wet street: structured up and down, where it has to be right, and only loosely round the compass, where nobody can tell. A floor only reflects rays above the horizon, so the band that matters is the channel at the top of the wall and that is what is drawn brightest.
- **The rest of the picture is the room's own surfaces, lit, and nothing in it is a hand-set bounce.** The light goes in first: the channel, the strips, the screen. Then the floor is painted as its colour times what that light lays on an upward face, the wall as its colour times what the light and the floor lay on a sideways face, and the ceiling last, lit by all three; each irradiance is integrated off the picture as painted so far. So a ceiling looking straight down samples a lit floor rather than black, and changing the light moves every surface with it. Measured: straight down the picture reads 0.0063 (corpo) and 0.0043 (home) in linear light, which is the floor's colour times the 0.079 and 0.045 the picture lays on it; a face looking down is lit by 0.11 (corpo) and 0.12 (home) of what a face looking up is.
- **The probe is something to reflect, not a light**, and that is why it cannot light a ceiling on its own. An environment lights a surface as well as reflecting in it, so a bright one floods a room that already has its own lights. The channel peaks at about 1 and is 14 degrees tall; the whole picture averages under a tenth, which lifts a mid surface by nothing you can see. A floor at a grazing angle reflects most of what hits it, which is where the band shows. What lights the floor and the walls on screen is the scene's sun, sky and moon ambient, at ten to twenty times what this picture lays down, and none of it reaches a face looking down: a matte ceiling lit by this picture alone comes to 0.0006 (corpo) and 0.0015 (home) in linear light, which is black. A ceiling reads when the scene puts a fill on downward faces; the picture is then what the ceiling reflects, and its colours are chosen so a fill can show them.
- One probe per interior language, painted from the average of that language's floor, wall and ceiling **pools** and the colour its strips emit, so it is two pictures for a town of any size and every room shares them the way it shares its materials. Changing which image a surface wears does not move it: the image is divided by its own average, so the surface still averages the colour the probe was painted from.
- Each part is a short pool rather than one entry, and an interior draws one from its id, so no two rooms in a town are the same room. The pools are fixed length (four floors, three walls, one ceiling per language), so a town of five hundred buildings costs the same handful of materials as a town of five: at most sixteen, eight a language.
- A ceiling is a shade darker than the walls of its language and no darker: corpo's lid is 0x4a4d52 against walls near 0x53565a, home's 0x968a8d against 0x6b6064. A lid at a fifth of that reads black under any light a bounce can give it.
- Texture density is set in metres, per axis, never in tiles per surface. `@gb/scene` builds a room from a plane and a box per wall whose UVs run 0..1 across whatever size the room is, so tiling off those UVs lays one image over a whole wall. The materials read the world position instead (`src/surfaces/tiling.ts`): u and v each come from that axis's length in metres, so a 3 m wall and a 12 m wall show the same size grain, a 6 m by 3 m wall is not stretched 2:1, and there is no seam where one wall meets the next. The pattern reads the same coordinate, so it agrees with the grain about which way is which.
- One tile is 2 m of board-formed concrete, 3 m of polished floor, 1.5 m of moulded panel and 2 m of street concrete. Those numbers are in `SURFACE_TEXTURES` and nowhere else, and no test can check them: how much real wall a photograph covers is a fact about the photograph, and `tools/textures/tile.mjs` draws the scale sheet that answers it.
- The coordinates are hung on `material.contextNode`, which is what the game's renderer reads. `WebGPURenderer` runs no `onBeforeCompile` on either of its backends, WebGPU or the WebGL2 one it falls back to, so an interior surface is a `MeshStandardNodeMaterial` and its tiling is a TSL context, not a shader patch.
- The surfaces are all or nothing. A pack missing either image gives none of them, and `surface` falls through, because a real floor under flat-colour walls looks worse than flat colour throughout. The bays are generated and stand either way.

## What it costs

Fixed, whatever size the town is. Both languages of the furniture catalog, 48 shapes in every screening they can carry, are 22,218 triangles and 1.81 MB of buffers; all 25 archetypes in all 3 casts are 20,624 triangles and 1.80 MB. Both are built together in about 30 ms in Node. The two probes are 16 KB each, prefiltered once per renderer and never again. A second bar and a thousand more items add objects, not buffers. A room's walls are that room's own geometry, built when it is entered and thrown away with it.

The pack is 48 KB on disk, five webp layers across four surfaces. Every layer is resized to 512, which is 1.40 MB resident with its mips, so the interior surfaces hold 6.99 MB of texture whatever size the town is. Two more images than the box carried before cost 24 KB of world file and 2.80 MB resident, and no draw and no triangle: a room in the preview is 11 draws and 121 triangles either way.

Screens cost bytes and nothing else. Against the same catalog without them: no triangle and no draw anywhere moved, and the buffers went 1.70 MB to 1.81 MB and 1.70 MB to 1.80 MB, +220 KB in all, +6.5%. That is the four byte attribute on every vertex in the box (206 KB) plus the six screenings of the television (14 KB).

Measured headless in Node on a generated town of nine blocks, whole rooms, shell and pickups included, each room in the language its building's finish gives it:

| room | finish | pieces | items | bays | furnished | furnished + walls | greybox |
|---|---|---|---|---|---|---|---|
| cafe | corpo | 17 | 2 | 72 | 39 draws, 8,734 tris, 8 mats | 40 draws, 13,582 tris | 39 draws, 1,348 tris, 9 mats |
| restaurant | corpo | 14 | 1 | 76 | 36 draws, 6,960 tris, 6 mats | 37 draws, 13,344 tris | 36 draws, 700 tris, 7 mats |
| office | corpo | 14 | 2 | 57 | 38 draws, 7,598 tris, 6 mats | 39 draws, 12,246 tris | 38 draws, 928 tris, 7 mats |
| clinic | corpo | 10 | 2 | 84 | 26 draws, 6,798 tris, 6 mats | 27 draws, 14,078 tris | 26 draws, 580 tris, 7 mats |
| hotel | home | 8 | 3 | 58 | 32 draws, 5,580 tris, 7 mats | 33 draws, 17,708 tris | 32 draws, 856 tris, 8 mats |

`node game/furnish/tools/print-cost.ts` prints the table. **One draw for the walls, whatever the bay count**: 57 bays and 84 bays both cost the same one mesh, and a finer rhythm or a bigger vocabulary buys triangles, never draws. Home walls are about twice corpo because every corner of every bay is moulded.

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

A prop's footprint or its contact height is `@gb/world`'s `PROP_SPECS`, which `@gb/forge` places from and this box builds to, so a change there is a change to both at once and the tests here measure the drawn triangles against it. **`footprintOf(prop)` is the whole answer to how much floor a piece needs**: 16 of the 24 fill their declared rectangle to the millimetre and none of them exceeds it, the widest shortfall being a coffee machine at 0.433 m in the 0.5 m it claimed, so a planner sizes a slot from the table and never from the triangles. What a prop looks like is one file per family under `src/props/`, one exported builder per prop kind, all of them drawing through `Solid.block` in `src/build/solid.ts`, or through `src/build/bar.ts`, which is the same block laid on its side; nothing else may make geometry, and nothing in the box is loaded from a model file: the one `.glb` it reads carries four tiling images. Which language a kind of building is dressed in is `src/style/finish.ts` alone.

A carried thing is the same shape of code one folder over. How big it is and what it is made of is `src/items/specs.ts` plus `src/items/matter.ts`; how much a cast may swing is `src/items/cast.ts`; what one looks like is one file per family under `src/items/` (`paper.ts`, `vessel.ts`, `pack.ts`, `tool.ts`), one exported builder per archetype.

Look at the result before believing it. `npx vite --port 5311`, then `/game/furnish/tools/preview/index.html`, which draws on the renderer the game uses and prints the draws and triangles the frame really costs. `?show=counter` stands one of every archetype on a counter (`?view=hand|near|far`, `?x=`, `?cast=`, `?some=a,b,c`, `?batch=1`, `?labels=1`); `?show=room` puts the surfaces on a plain room with the lit channel round it, and `?probe=0` takes the probe back off them.

A wall is four files and they do not overlap: `src/walls/bays.ts` is the vocabulary and the heights, `src/walls/runs.ts` reads a room out of the world document as four walls with their doorways and their furniture, `src/walls/plan.ts` decides which bay goes where, and `src/walls/draw.ts` draws one. `src/walls/things.ts` is what stands in a niche. Retuning how often a wall carries a shelf is the taste table in `bays.ts` alone; changing what a shelf looks like is `draw.ts` alone.

What the two languages are made of is `src/style/palette.ts`, and how much a variant may swing is the taste table in `src/style/variant.ts`. What a floor or a wall is laid in is `src/surfaces/surfaces.ts` plus the sources named in `tools/pack.ts`; the pattern itself is `src/surfaces/pattern.ts`, and the tiling rule is written twice in `src/surfaces/tiling.ts`, once for the GPU and once for the CPU the tests measure, so both change together. What a polished floor reflects is `src/surfaces/probe.ts` alone, and the two light numbers in it are a calibration: raise them and the probe stops being a reflection and starts being a light that floods the room. The surfaces in it are not dials at all: each is its pool's colour times what the picture lays on it, so they follow the light. The screen's entry is not a dial either: it is the radiance `screenAverage()` measured, so retuning the picture moves the light on its own. A new generated surface follows `tools/textures/README.md`, lands in `assets/gen/`, is named in `tools/pack.ts`, and needs its average brightness and how many metres one tile covers in `SURFACE_TEXTURES` (`node game/furnish/tools/print-grain.ts` prints the first). Adding one changes what the pack has to carry, so `node game/furnish/tools/build-kit.ts` runs again: a pack missing any node gives no surfaces at all and every room falls back to flat colour.

A screen is four files under `src/screens/` and they do not overlap: `schedule.ts` is what is on and when, `screening.ts` is which set is on which station, `picture.ts` is what the glass shows and `glass.ts` is the same picture as nodes. `light.ts` measures the first for the probe. Retuning the schedule is `schedule.ts` alone and retuning who watches what is `screening.ts` alone; changing what a programme looks like means changing `picture.ts` and `glass.ts` together, and `node game/furnish/tools/print-screen.ts <path>` writes a contact sheet of every station across a whole cycle off the TypeScript side, so a programme can be worked on without a GPU. `?show=screens` in the preview stands three sets on three screenings in a dark room, which is the only way to see whether the glass reads as something playing.

Run `pnpm --filter @gb/furnish test`.
