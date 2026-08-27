# @gb/kitbash contract

contractVersion: 0.15.0

## Purpose

Builds a plot into a building made of Downtown City MegaKit pieces on a 2 m grid: the footprint it was given, the height its storeys ask for, its door on the wall the entrance faces, and the front its charter was resolved to, so a kind of place the engine has never heard of is built from its file alone. Its windows look into furnished rooms and light up after dark, its walls carry lit signs with its own name on them sized to the fascia and a lamp either side of the door, it says where every one of those lights is so the scene can light the walls from them, and it lines the pavements with street lamps it draws from code. From far off it is its shell: the same walls, the same windows and the same roof, with the rooms behind the panes, the signs and the fixtures left out, so the city can batch the plots round the player and dress only the ones on the street. A tower's shell is its shopfront in kit pieces with one course of wall stretched up the rest, so what a skyline costs to build stops growing with its storeys. A station gets a subway entrance drawn into it on its doorstep, stairs down into the pavement under a lit box, and a private place a camera over its door, both cut from primitives on the kit's own materials. It also surfaces the ground the buildings stand on, out of the same kit's textures, and takes the whole kit, that ground included, to the tone the town's theme asks for.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new KitDressing(kit, rest?)` | a `KitLibrary`, and the `Dressing` behind it (defaults to `@gb/scene`'s `Greybox`) | |
| `KitDressing.building(plot, size, charter)` | a `@gb/world` `Plot`, `{ width, depth, height }` in metres, and the plot's `PlotCharter`: `built`, `signage`, `blade`, `access` and `transit` off `world.charter(plot.kind)` (a whole `ResolvedCharter` fits) | the size matches the plot: `width / rect.w` is the world's cell size |
| `KitDressing.shell(plot, size, charter)` | as `building` | for a plot coming within `SHELL_RADIUS` of the player; `lights` is never asked after it |
| `KitDressing.signs(plot, size, charter)` | as `building` | |
| `KitDressing.lights(plot, size, charter)` | as `building` | after `building` for that plot |
| `KitDressing.streetlights(world, spacing?)` | a `@gb/world` `World`, metres between lamps (default `LAMP_SPACING`, 20) | the grid painted, so pavements and roads are where they will be |
| `KitDressing.setTime(hours)` | hours, 0 to 24, wrapping | cheap enough for every frame; a non-finite reading is ignored |
| `loadKit(scenes, theme?)` | one `THREE.Object3D`, or the array `GLTFLoader` hands back as `gltf.scenes`; the city's theme text (default `DEFAULT_THEME`) | a scene holding the packed kit, one named node per piece and one per ground surface |
| `placeholderKit(theme?)` | the city's theme text | |
| `nightLook(hours)` | hours, wrapping | |
| `lampSpots(world, spacing?)` | as `streetlights` | |
| `signsFor(plot, size, charter, cellSize?)`, `lightsFor(plot, size, charter, cellSize?)`, `fixturesFor(plot, size, charter, cellSize?)` | as `building` | |
| `fixtureParts(fixtures)` | a `Fixtures` | |
| `flavourOf(theme)` | the city's theme text | |

`KitDressing` also carries `prop`, `character`, `pickup` and `surface` from the `Dressing` seam and passes every one of them straight to `rest` (`surface(part, size)` with its size): the Downtown kit is a street kit, with no furniture and no people in it.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `building(plot, size, charter)` | `THREE.Object3D` | origin at the centre of its base; one mesh per kit material, never one per piece, plus one more for every sign on it, the subway entrance and the camera welded into those same meshes; a child named `door` at the middle of the doorway, looking out |
| `shell(plot, size, charter)` | `THREE.Object3D` | the same building from far off, in the same frame: the same walls, panes and roof, one indexed mesh per kit material, the panes on `FAR_GLASS` rather than `GLASS`. Over `MASSING.storeys` the storeys above the shopfront are the plain course stretched across each wall with the same panes flat on it. No signs, no subway entrance, no camera, no `door` child |
| `signs(plot, size, charter)` | `THREE.Mesh`, or nothing where the plot carries no sign | the signage `building` hangs on that plot, welded into one mesh on `SIGN.material`, in the building's own frame, for a dressing that draws its buildings some other way and wants the city's names on them |
| `streetlights(world)` | `THREE.Object3D` named `kit:streetlights` | one `kit:streetlights:posts:<n>` per district holding that district's lamps as an instanced mesh, and one `kit:streetlights:halo` holding every glow in one additive quad buffer. Districts run row-major, so the same town chunks the same way every run. A town with no kerb in it gives the group empty |
| `setTime(hours)` | nothing | every window and every lamp in the city moves to that hour |
| `ground(kind)` | `THREE.Material` | the surface that kind of cell is made of, tiling at a real-world size, on four maps: colour, relief, roughness and occlusion. The same kind is always the same instance. A kit whose pack has no ground surfaces in it hands the question to `rest` |
| `loadKit` / `placeholderKit` | `KitLibrary` | `parts(piece)` gives geometry per material, in metres in the piece's own frame, and refuses a piece it has nothing drawable for, `material(name)` gives the one shared instance, `ground` holds the tiling surfaces when the pack carries them, and `night` is the city's clock reading |
| `KitLibrary.night` | a `CityNight` | `level` (0 by day, 1 in the dark) and `lit` (the share of rooms with the lights on) as node uniforms, plus `hours` and `setTime` |
| `nightLook(hours)` | `{ level, lit }` | what any hour of the day means, as plain numbers |
| `lampSpots(world, spacing?)` | `LampSpot[]` | where every lamp stands, in metres, and the way it faces |
| `PIECES`, `PIECE_IDS`, `KIT_MATERIALS`, `MODULE`, `RELIEF`, `GLASS`, `FAR_GLASS`, `FAKE_INTERIOR`, `isGlazed` | the catalog, measured from the kit's own files, and the material names windows hang on: the kit's own glass near the player, the flat one from far off, and the plane the kit paints behind both | |
| `STREETLIGHT` | the lamp the box draws: the column, the arm, the head, the strip and the two fittings, in metres | |
| `ROOM_ATTRIBUTES`, `Room` | the room a pane looks into, and the vertex attributes it rides on: `roomOffset` (from this vertex to the middle of its room's window wall), `roomSize`, `roomLook` | |
| `GROUND_TEXTURES`, `GROUND_LOOKS`, `PAVEMENT_TONES` | the three tiling surfaces with the metres one tile covers, the millimetres one texel of its colour map covers and the roughness its wear image runs between; what each cell kind takes from them; and how much of the kit's own pavement each kind of town keeps | every kind in `@gb/world`'s `CELL` has a look, and every `Flavour` has a share |
| `RECIPES` | `Record<Frontage, Record<Openness, Recipe>>` | what a front is made of by how it meets the street and how open its upper storeys are: eighteen rows, six `FRONTAGES` by three `OPENNESS`. `Recipe` is the `built` shape a `ResolvedCharter` carries, so a resolver writes a row into the file and a building is drawn from the file. Thirteen of the fourteen `SHIPPED_CHARTERS` carry their row verbatim; the chapel keeps its own upper window. A `blank` front glazes nothing: its window slot holds the wall piece |
| `PlotCharter` | `Pick<ResolvedCharter, 'built' \| 'signage' \| 'blade' \| 'access' \| 'transit'>` | everything this box reads off a charter |
| `signsFor(plot, size, charter)` | `Sign[]` | every lit rectangle on the building, in metres in its own frame: what it is (`kind`: `sign`, `strip`, `doorlamp` or `subway`), the wall it belongs to and whether it is flat on it or hung off it (`wall`, `mount`), where it is, which way it looks, its colours and the cells written on it. What `building` will actually hang there. A hung sign is one entry, drawn on both sides. A `subway` box names the front wall and stands on the doorstep in front of it, over the entrance's back wall |
| `fixturesFor(plot, size, charter)` | `Fixtures` | `subway` (a `SubwayEntrance`: `position` the middle of the doorstep cell in the building's frame, `rotationY` turning its mouth onto the street, `cellSize`) when the charter's `transit` is `subway`, else absent; `cameras` (`CameraMount[]`: `wall`, `position` where the bracket meets the wall, `rotationY` looking out of it), one over the door when `access` is `private` and the front has room, else empty. What `building` draws into its walls |
| `fixtureParts(fixtures)` | `Fixture[]` | the geometry of those fixtures in the building's frame, one buffer per kit material (`piece`, `material`, `geometry`), in the same shape as a kit part, for a dressing that builds its own buildings and wants the same entrance on them |
| `SUBWAY`, `wellOf(cellSize)`, `CAMERA` | the entrance's numbers and the well it cuts on a cell of that size; the camera's numbers | every material named is in the shipped pack |
| `lightsFor(plot, size, charter)`, `lights(plot, size, charter)` | `LightEmitter[]` | one per sign, in the same order and the same frame: `kind`, `position` just off the lit face, `colour` (what burns, packed `0xRRGGBB`), `intensity` in candela at full dark, and `radius`, the metres past which it is not worth drawing (where it falls to 0.1 lux, at most 16). Nothing draws them here: the scene that owns the lights does |
| `SIGN` | the material name, how far a panel stands off the wall and hangs over the street, how much wall a hung one's bracket takes, how far a letter stands off its panel, and `climb`, how far above the fascia signage reaches | |
| `NEON`, `TRANSIT`, `DOORLIGHT`, `luminanceOf` | the nine colours a sign is lit in, the warm white every station's box burns and the lamp at a door, each as its ink and the strength that makes it emit what its role asks for; and how bright a packed colour is in the renderer's working space | every one of the nine emits the same luminance, so no colour in the palette is the one that never glows |
| `MASSING` | `storeys`, the height above which a shell is drawn as one stretched course, and `layer`, how far a flat pane stands off it | |
| `Standing` | `position`, `rotationY`: where a fixture stands and the turn that points its own +Z out | |
| `DOORLAMP`, `LETTER_SHARE` | the door lamp's line: its width, where it starts and how far past the door head it reaches; and the share of the fascia's height one letter may take | |
| `MOST_ACCENTS` | 4: the door lamps, a strip, a tube and a board are all the small lit things a wall has room for | |
| `GLYPH_KEYS`, `MARKS`, `SOLID`, `cellUv`, `cellAt` | the atlas: every cell it holds, and where each one is | `cellAt` is the inverse of `cellUv`, so a sign can be read back off its own geometry |
| `SIGN_ATTRIBUTES` | the three vertex attributes a sign rides on: `signInk`, `signPanel`, `signGlow` | |
| `flavourOf(theme)`, `TONES`, `DEFAULT_THEME` | which of seven kinds of town a theme names, what each is made of, and the one assumed when nobody says | every `Flavour` has a `Tone` |

## Errors (closed set)

- `kit-incomplete`: `loadKit` was handed a scene with no node, or nothing drawable, for some catalog piece. Thrown as `KitIncomplete`, carrying `missing`, the piece ids it could not find.
- `kit-unknown-piece`: `parts` was asked for a piece the library has nothing drawable for. Thrown as `KitUnknownPiece`, carrying `piece`, from `parts` and so from `building`; a wall is never built with a hole where the piece should be. A library from `loadKit` cannot raise it for a piece in the catalog, because `loadKit` refuses to finish without every one; a `KitLibrary` built by hand can.
- `signage-out-of-range`: the charter's `signage` has a chance outside 0 to 1 or `accents` outside 0 to `MOST_ACCENTS`, which the world's schema never writes. Thrown as `SignageOutOfRange`, carrying `signage`, from `building`, `lights`, `signsFor` and `lightsFor` before a letter is placed, because a fifth accent would stack a second board on the first.
- `kit-unmergeable`: pieces sharing a material would not weld into one mesh, because their geometry does not agree attribute for attribute. Thrown as `KitUnmergeable` from `building`, carrying `material` and the `pieces` on it. A library from `loadKit` or `placeholderKit` cannot raise it, because both bring every part to one shape; a `KitLibrary` built by hand out of foreign geometry can.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, `shell` included, and `Greybox` as the layer behind it. Scene batches the `shell` of every plot within `SHELL_RADIUS` (256 m) of the player into `city:<material>` and the near buildings' `building` into `detail:<material>`, one draw each, and builds them a few a frame as the player walks; past that ring a plot is a flat box in the skyline.
- `@gb/world` contract: `Plot`, `World`, `METRICS`, `cellCentre`; `ResolvedCharter` with its `built` (courses in `KIT_PIECES`), `signage` (`Signage`), `blade`, `access` (`ACCESS_KINDS`) and `transit` (`TRANSITS`), which the world resolves once and this box only reads; `Frontage` and `Openness`, the two axes `RECIPES` is keyed on. A plot whose charter carries `transit: subway` is where fast travel boards, and its `entrance.cell` is the doorstep the entrance stands on.
- `@gb/kit` contract: `Rng`, for determinism.
- `three`, `three/webgpu` and `three/tsl`: the window and lamp materials are node materials, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself.
- The art: Quaternius Downtown City MegaKit, CC0, packed by `tools/build-kit.ts` into `assets/dist/downtown-kit.glb` (19 wall pieces, 3,403 triangles and 3 ground surfaces, 1.05 MB). The street lamps are not art: they are cut from primitives here. The pack is meshopt-compressed and quantized, and its dedup step folds the kit's 10 material names into the 6 that have distinct textures. The colour and the relief of the ground are the kit's own textures, so asphalt costs nothing over the buildings: it is one copy shared with the kit's own road piece.
- The wear: three occlusion-and-roughness images under `assets/gen`, derived from each ground surface's own colour map by `tools/textures/relief.mjs` and committed. They are ours, from a CC0 source, so they ship inside a world file like anything else generated here.

## Windows

A pane is any surface on the kit's `MI_Glass` material: that name is the hook the whole feature hangs on. Every glazed module is given a room at plan time and the room rides on the pane as three vertex attributes (`roomOffset`, `roomSize`, `roomLook`). The one glass material raymarches that box in the fragment shader and shades the floor, the back wall, a door, a sofa and a table it meets, so a facade has depth through it instead of a flat decal. No geometry, no texture, no draw: the technique is three's own `examples/jsm/generators/city/SkyscraperGenerator.js` (MIT).

- A room runs across one to three modules of one storey, so neighbouring windows share an interior and light up together.
- A pane carries where it sits inside its own room, never where the room is. Everything the raymarch uses is an offset or a direction, so the numbers stay true whichever frame the pane is drawn in: `@gb/scene` puts every building in the city into shared buffers, which moves the vertices and leaves the distance from a pane to the middle of its own window wall alone.
- Every room carries a key, 0 to 1. It is lit while the city's lit share is above its key, so the same rooms come on in the same order every night, none of them flickers, and a room with a low key stays lit through the small hours while a high one only burns in the evening.
- The kit paints a flat grey plane behind its own glass (`MI_FakeInterior`). The pane draws a real room, so that plane is never packed into a building, which is a mesh and about 33 triangles a building saved.
- Near the player the pane is on the kit's own glass; from far off the same pane is on `FAR_GLASS`, flat. Both read the same three attributes, so a window lit on the skyline is the same window lit in the same bulb when you walk up to it.

## The shell

`@gb/scene` asks for a plot's `shell` when it comes within `SHELL_RADIUS` (256 m) of the player and for its whole `building` within `DETAIL_RADIUS` (64 m), so a shell is what most of the city a player can see is drawn as, and it is never read from closer than 64 m. It is the same walls, the same window openings and the same roof, welded per kit material exactly as a building is, so the town keeps its shape, its height and its tint at every distance and the far city is one draw per material.

- **What it leaves out is what is only read from the pavement.** The signs and the light each of them throws, the subway entrance cut into a station's doorstep, the camera over a private door, and the furnished room behind every pane.
- **The panes stay, flat.** A window opening with nothing in it reads as a hole, so a shell keeps the pane and draws it on `FAR_GLASS`. It carries the same three room attributes, so the same window is lit at the same hour in the same bulb as when you walk up to it; what changes is what reads them. A flat lit rectangle costs one attribute and a step, against a ray cast into a box with a floor, a back wall, a door, a sofa and a table in it.
- **A tower is its shopfront with one course stretched over it.** Above `MASSING.storeys` (4) a shell builds the ground storey out of kit pieces and draws every storey over it as the plain module's own outer face carried across the whole wall, the crowning course on the top one. Every vertex takes the UV its own row would have had that far along, so the brick repeats every module the way a wall of modules does instead of smearing over the lot, and at one module wide the face is the kit's own, unchanged. The storeys above a shopfront are one course over and over, and nobody reads them from nearer than 64 m: building that repetition module by module cost 36 ms and 40,000 triangles in a frame that builds one building.
- **A window on a stretched course sits on the wall, not in it.** There is no opening cut in one, so the pane is the kit's own window rectangle drawn `MASSING.layer` (1 cm) proud of the wall rather than 20 cm back in its reveal, on the same centimetre of air `@gb/scene` lifts road paint by. It carries the room its own module's pane carries, in the same place across the wall and at the same size, so the same rooms come on in the same order at every distance. Measured over the fourteen shipped kinds at 20 storeys: every room on the near building is on the shell, the same width and the same height, and the furthest any pane moves is 0.19 m, straight out of its reveal.
- **It is planned as walls, not as a building with its signage thrown away.** `planWalls` is what a shell is built from, so it lays out no signs, no fixtures and no emitters. It is laid out in full even for a tower, because that is what says which modules glaze and which room each of them looks into: the draws are the building's own, so the windows do not move.
- **`lights` is never asked after a shell**, so a far building throws nothing onto the street.

## Signs

A street reads by its signage. The buildings are near silhouette after dark and what you actually see is the lit rectangles on them, so signage is the feature that makes a facade look inhabited rather than modelled.

Every plot gets its own name over the door and a lamp either side of it, whatever its trade. A trade gets more: a blade down the front spelling what kind of place it is, a box hanging out over the pavement, a strip of marks somewhere up the wall, a board high on it and a tube up the corner. How much of that it gets is the charter's `signage`: the chance of a blade, the chance of a hung box, how many small lit accents (the door lamps first, then the strip, the tube, the board) and how hard the nameplate burns. A bar's row carries six or seven, a house's three.

- **The letters are drawn from code.** `src/sign/glyphs.ts` holds a stroke font on a 4 by 6 grid, A to Z, 0 to 9, a little punctuation, and eight marks that spell nothing. `src/sign/atlas.ts` rasterises each of them into one 512 by 512 single-channel sheet as a round-capped tube with a soft shoulder, 256 KB before mips. Nothing is downloaded: a world file has to carry its own signage, and a font is a licence.
- **It is a font, not a sheet of finished signs.** A sign is a run of quads, one per letter, each pointing at its own cell. A thousand buildings with a thousand different names read the same fixed-size texture, so the atlas does not grow with the city.
- **Every letter is sized off the fascia.** The ground floor's fascia is the kit's own metre-tall closer over the shopfront, and the tallest letter on the building is `LETTER_SHARE` of its height: 0.5 m on a 4 m ground floor. The nameplate sits in that band, and the blade, the strip, the board and the box over the street take their panel sizes from the same letter, so nothing on a wall is bigger than the wall has room for.
- **Signage climbs `SIGN.climb` (16 m) above the fascia and no further, whatever the building is.** A blade, a tube and a board were the three things sized or placed off the building's own height, which is fine at four storeys and is a ribbon of neon up a tower: measured at 40 storeys (128.8 m) the corner tube ran 124 m as one lit quad with a point light at 66 m that reaches 16. A sign is read from the pavement and is its own light, and `lightsFor` never draws one past 16 m, so that is the wall signage may use. Measured on a bar's loudest row: at 4 storeys nothing moves (the tallest run is 8.8 m, the top sign at 13.1 m of a 13.6 m wall), and from 6 storeys up every building carries the same signs, the tallest run 15.2 m and the top of the highest sign 19.5 m. So a tower is a shopfront with lit window wall over it, which is what a tower on a street looks like.
- **A sign claims its wall before it is drawn.** Every panel takes the patch it stands on, with 12 cm of air round it, and a later one landing on a held patch is not drawn; a hung box claims the width of its bracket. Each of the small lit things offers both ends of its wall and the first free one is taken. Measured on a town of 160 plots and 785 signs: no two of them overlap, where before the claim 96 pairs did.
- **The door has a lamp, not a column.** Two warm lines, `DOORLAMP.width` (5 cm) wide, from 35 cm above the pavement to 15 cm past the door head, standing 22 cm outside either edge of the door, burning at 0.9 of their own colour. A lamp is bounded by the door it lights and never past white; anything taller or brighter beside a door is not this box's. It throws 10.4 cd, half what the name over it throws at the median.
- **The name and the word come from the world.** `plot.name` goes over the door and the charter's `blade` goes down the blade, so a sign is wayfinding rather than decoration: the name tells you which place it is, the blade tells you what it is, and a place the engine has never heard of spells whatever its charter wrote. A name that will not fit is shrunk first and cut short only when shrinking would make it a smear.
- **Colour is per sign, seeded per building.** `src/sign/palette.ts` is cyan and teal heavy with magenta, amber, crimson, lime and violet against them. A building draws one hue and its later signs draw against that one, so no two signs on a facade wear the same colour and a run of buildings is not one long stripe.
- **A tube is authored as the light it gives off, not as a multiplier on its own colour.** A multiplier is not a brightness: 0x22e2ff carries 0.62 of luminance and 0xff2f52 carries 0.24, so one strength over both left the saturated half of the palette emitting half what the pale half did. The app's bloom gates on luminance against a hard threshold (0.9 after dark), and magenta, crimson and violet, the three the palette calls the hot ones, were the three that never crossed it. So the palette authors the luminance a tube emits and works the strength back from the colour: every one of the nine lands at 1.30 and wears the same halo, over its own colour by 1.65 (warm) to 5.44 (crimson). One number for the whole palette instead of nine.
- **A panel is opaque and so are the letters on it.** A letter quad paints the panel colour where the letter is not, so panel and letters are one surface with no blending and nothing to sort. The colours ride on the vertices (`signInk`, `signPanel`, `signGlow`), which is what lets one material draw every sign in the city.
- **A sign is its panel and its letters, and nothing else is laid over it.** A letter stands `SIGN.layer` (1 cm) off the panel, the lift `@gb/scene` puts road paint on, so the two are separate surfaces at every distance a sign is read from. Nothing thin lies on a panel: a 5 cm bar is 15 px at 5 m and 4 px at 20 m, and a line that thin over a surface a centimetre behind it reads as a dotted rule down the facade rather than as a sign. What is a bar of light (the lamp at a door, a tube up a corner) is a sign of its own and covers its whole panel.
- **A nameplate lit from behind is a surface, not a tube.** A trade that shouts lights one nameplate in three from behind: the panel burns and the letters are dark on it. A lit surface lands under its own colour, at 0.9 of it, the share the lamp at a door burns at; a tube is a few centimetres wide and may run past. So a lit panel emits 0.19 to 0.70 of luminance by its colour and a door lamp 0.61, both under the threshold a halo starts at, and what wears one on a facade is the tubes. The biggest lit panel in a town of 120 plots is 5.3 square metres and throws 96 cd.
- **Nothing glows in daylight.** The emissive is the ink through the letter, the panel behind it, times the city's own night level, so at noon a sign is a painted panel lit by the sun and `setTime` brings the tubes up with everything else. The halo round a lit tube is the app's bloom pass, never geometry.
- **Every sign is a light, and it throws what it looks like it throws.** `lightsFor` answers one emitter per sign, strip and door lamp: its colour is whatever burns, its candela is the lit area times the luminance that surface emits (30 cd a square metre a unit of luminance for a tube, 180 for a lamp), and it sits 20 cm off a flat panel so it reaches the wall round it. It is read off the luminance rather than off the strength on the vertex, because a crimson tube and a cyan one that look equally bright have to throw equally. Over a town of 120 plots: 10,523 cd of signage, a door lamp 10.4 cd and the median nameplate 20.7 cd. The scene draws them; this box only says where they are.

## The subway entrance and the camera

Both are drawn from code on the kit's own materials, like the lamps, so no art is downloaded and both weld into the building they belong to.

- **A station gets its entrance on its doorstep.** `plot.entrance.cell` is the cell the world names as where fast travel boards, so that is where the entrance stands: a stairwell cut into the cell, 1.5 m wide and 1.6 m long on a 2 m cell (`wellOf`), a wall `SUBWAY.well.wall` thick either side standing `SUBWAY.parapet` (0.95 m) over the pavement, a back wall `SUBWAY.back` (1.4 m) against the building, seven steps of `SUBWAY.step` going down to a dark floor `SUBWAY.well.depth` (1.44 m) under the pavement, and a lip `SUBWAY.apron` (6 cm) proud of the pavement out to the edge of the cell. The mouth opens onto the street, so the stairs are walked into from it, and the whole thing turns with the front wall.
- **The lit box is a sign.** Over the back wall sits a housing on `MI_Asphalt` with a `subway` panel on its street face spelling the charter's `blade`, `SUBWAY.sign.height` tall and as wide as the well and its walls. It is one more entry in `signsFor` and rides the sign batch, so it costs no draw, and `lightsFor` answers a light for it like any other sign. Every station in town burns the same warm white (`TRANSIT`), because a station is wayfinding.
- **The steps show once the ground is open.** The scene lays the pavement over the cell, and geometry under y = 0 is behind it; what shows over the pavement today is the balustrade, the back wall and the lit box, which is what a subway entrance looks like from across the street. The well is drawn whole so a ground with the cell left open shows the stairs going down.
- **A private place watches its door.** A charter whose `access` is `private` gets one camera on the front: a bracket `CAMERA.bracket.out` off the wall and a housing on it pitched `CAMERA.pitch` down at the doorstep, `CAMERA.over` (0.45 m) above the door head, past the door lamp on the right of the frame, on the left when the right is taken, and over the door when neither side is free. It claims `CAMERA.claim` of wall like a sign does, after the signs, so a strip or a board is never hung through it and it is never hung through the nameplate. A front with no room at all carries none; on the heights `@gb/scene` builds to, every front has room. `open` and `admitted` places carry none.
- **No draw, no number.** Both fixtures are boxes on kit materials welded into the building's own meshes, so they add triangles and never a mesh the city has to draw apart from the rest. Neither draws from the plot's `Rng`: where they stand is read off the doorstep and the door, so adding either to a city moves nothing already standing.

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
- A building's walls stand on the plot boundary. Window and trim relief reaches up to `RELIEF` (0.05 m) past it on each face, a flat sign stands `SIGN.stand` (0.08 m) off it, a sign hanging over the street reaches `SIGN.stand + SIGN.reach` (1.23 m), a camera reaches 0.38 m off the front, and a station's entrance covers its doorstep cell, one cell past the front and no wider than the cell, down to `SUBWAY.well.depth` under the pavement. Nothing else does.
- Every sign lies on the wall it names: a flat one looks the way the wall does and stands `SIGN.stand` off its plane, a hung one starts there and reaches out at a right angle. No two signs on one wall overlap, no letter is taller than `LETTER_SHARE` of the fascia, and a door lamp is no wider than `DOORLAMP.width`, no taller than the door head plus `DOORLAMP.overhead`, and never brighter than its own colour. All four are measured over a generated town in `tests/signs.test.ts`.
- No two quads of a sign lie in one plane over each other, and every full-cover quad is a sign of its own rather than a bar across a panel. A whole panel alight never burns past its own colour. All three are measured over a generated town in `tests/signs.test.ts`.
- Every sign has a light, in the same order `signsFor` lists them, so the two can be read side by side. The subway box is the last sign in a station's list.
- A camera is hung only where its charter is `private`, an entrance only where it is `transit: subway`, and each stands where the door and the doorstep put it: same plot, same fixtures, whatever else changes. Both are measured over a generated town in `tests/fixtures.test.ts`.
- A building is exactly as tall as the height it was given: the roof deck sits 0.2 m below the wall top, so the walls read as a parapet round it.
- The door is on the wall the entrance cell sits against, in the module nearest the doorstep `@gb/scene` puts on the pavement.
- Same seed, same city, always. Every draw comes from a `@gb/kit` `Rng` on the plot's id, kind (the word in the file, never a digest of its charter) and style, forked per feature (`rhythm`, `rooms`, `signs`), so adding a feature later cannot move the windows a city already has, and editing a charter's table moves nothing but the walls it names. Where the lamps stand is read off the grid and draws nothing at all.
- This box holds no clock. It remembers the hour it was told and renders it; whoever owns the clock calls `setTime`. Moving the city through the evening is two uniform writes, about 0.25 us, however many buildings and lamps are standing.
- A shell stands exactly where its building's walls stand: the same footprint inside `RELIEF`, the same height, the same ground, and nothing on it reaching past the building it stands in for. Its panes carry the same rooms, so the same windows are lit in the same order near and far. A tower's is held to the same three, and to carrying its wall from the shopfront to the parapet with no slit in it, because a stretched course that did not reach its own ceiling would be a line of sky up a building. Measured over a generated town in `tests/shell.test.ts` and over the shipped pack in `tests/pack.test.ts`.
- The kit loads once. Buildings clone geometry out of the library, and every piece sharing a material is welded into one mesh, so a building arrives as as many meshes as it has materials on it (4 or 5 out of the packed kit) plus one for its signs, not as many as it has pieces (28 to 146). Lit windows add none of their own. `@gb/scene` then puts every building on one material into one buffer, so a whole town is a draw per material; what this box owes that arrangement is indexed meshes on shared materials, which is exactly what the weld produces.
- Every tube in the city emits the same luminance whatever colour it burns, so a hue is a colour and never a brightness. What varies is the role: an accent burns a tenth harder than a nameplate and how loud a trade is dims its own. Measured over the palette and over a generated town in `tests/signs.test.ts`.
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
- The ground tiles at a real-world size, on every map it has. `@gb/scene` lays ground UVs out in metres, so a surface that should repeat every `tile` metres is set to `repeat = 1 / tile`: asphalt and earth every 4 m, paving every 2 m, which lays the pavement in half-metre flags whatever the cell size is. Colour, relief, roughness and occlusion all take the same repeat off the same tile, so nothing on a surface slides against anything else on it.
- **The ground is four maps or none.** A cell kind that names a colour map names a normal map and a wear image with it, and `loadGround` refuses a pack missing any of the three, because a colour photograph on a flat plane at one roughness is exactly what a street looks like when it looks glued on. Only water and the mountain ring stand at a plain roughness, and neither is a photograph: water is its own colour roughened by the road's relief, and the mountain is blocks whose faces are not UV'd in metres at all.
- **Nothing the city stands on is metal.** Asphalt, concrete flags and bare earth are dielectrics, so every ground material is `metalness: 0` and the wear image's roughness is read at full strength (`roughness: 1` over it) rather than scaled by a number nobody measured.
- Cells share surfaces, and a kind is always the same material instance: a city has thousands of cells and six materials for them. The pavement and the ground a building stands on are one and the same.
- Colour comes from the tint over a shared texture, not from a texture each: the same earth is a park greened down and bare land untinted, and the kit's warm marble is the pavement's concrete grey. A town's tone scales that tint rather than replacing it, so a dark street still has flags, joints and wear on it.
- Water has no colour map: it is its own colour, roughened by the road's relief so the light breaks up on it.
- The mountain ring takes a plain rock colour and no texture, because `@gb/scene` builds it from blocks whose faces are UV'd 0 to 1 rather than in metres: nothing tiles on them at a real size.
- The ground borrows the kit's textures without changing them: the maps come off the pack cloned, so tiling the road at 4 m leaves the kit's own road piece painted the way it was authored.
- **The wear is ours, and it had to be.** The kit ships an ORM per texture, but its occlusion channel is a flat 255 on the concrete and the marble and a flat 0 on the dirt, so there is no hollow in it to shade. `tools/textures/relief.mjs` reads each ground surface's own colour map, subtracts the wavelengths longer than the family's cut (stain, not shape), and writes the hollow into red and the roughness into green. The roughness is the material we are claiming rather than the one the image was authored as: the kit's marble measures 0.65 to 1.0 as a polished floor, and as a tinted concrete pavement it ships at 0.74 to 0.98.
- The ground is all or nothing. A pack missing any of the three surfaces gives none of them, and `ground` falls through to the dressing behind it, because half a textured street is worse than the greybox.
- This box holds no table of kinds. What a plot is built of, how loud it is and what its blade spells are read off the charter handed in with it, which the world resolved once and wrote into the file; `RECIPES` is published for whoever resolves, and nothing here reads it. A city of invented words builds with no change here.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.

## What it costs

A building is 8,758 triangles over 4.3 kit materials and it costs no draw of its own: `@gb/scene` puts every building on one material into one buffer, so a town of any size is a draw per material, once for the shells round the player and once for the buildings on the street. What this box owes that arrangement is indexed meshes on shared materials, which is what welding a building's pieces per material already produces.

Measured headless in Node on the metro 20 by 20 city (3,489 plots, 547 by 563 cells) dressed by the kit alone, with the shipped pack and the camera standing at the spawn (`node game/prefab/tools/bench-city.ts --blocks 20 --dressing kit`):

| | draws | triangles |
|---|---|---|
| the whole town: five kit materials as shells, five more as detail, the signage and the skyline | 12 | 2,813,878 submitted of 5,127,720 held |

### What the shell saves, and what it cannot

A building against the shell it is drawn as from far off, on the shipped kit over a town of 60 plots of every kind, height and facing (`node tools/measure-shell.ts`):

| | triangles | meshes | to build |
|---|---|---|---|
| `building` | 8,758 | 5.3 | 1.17 ms |
| `shell` | 5,878 | 4.3 | 0.93 ms |

At four storeys and under a shell is the kit's own walls, which is what a building weighs, so what it saves on the way in is the signage mesh, the fixtures, the emitters and the layout of all three; over four it is a shopfront and a stretched course, and the walls go too. What it saves in the frame is the fragment: the far town no longer raymarches a room behind every pane, and only the buildings drawn in detail put an emitter in the city's lights.

What it cannot save is the short plots, which is the ceiling on how large a city this kit can dress. A forged 50 by 50 block town of 20,233 plots dressed by the kit alone, a shell on every one of them, is 210.9M triangles and 26 GB of buffers against 4.1M and 1.5 GB for the same town on `@gb/prefab`'s pack (`node game/prefab/tools/bench-city.ts --blocks 50 --dressing kit --shell all`). The kit dresses the plots the pack has no shape for; the pack dresses the city.

### What a tower costs

A building is a storey of walls repeated, so it grows with its storeys and nothing else does. A shell does not: above four storeys it is a shopfront and one course stretched over it, so what it adds a storey is four quads of wall and the windows on them. Measured on an 8 by 12 m plot (`node game/kitbash/tools/measure-shell.ts`):

| storeys | height | shell triangles | to build |
|---|---|---|---|
| 1 | 4.0 m | 4,359 | 0.48 ms |
| 4 | 13.6 m | 15,879 | 1.80 ms |
| 5 | 16.8 m | 4,647 | 0.75 ms |
| 12 | 39.2 m | 5,151 | 1.04 ms |
| 20 | 64.8 m | 5,727 | 1.33 ms |
| 23 | 74.4 m | 5,943 | 1.41 ms |
| 40 | 128.8 m | 7,167 | 2.08 ms |

72 triangles a storey against the 3,840 a building costs, so a forty storey tower's shell weighs less than half of what the same plot weighs at four, and the height it is raised to hardly shows. The pack is drawn to four storeys, so every plot taller than that comes here.

On the metro 20 by 20 city the game builds (3,489 plots, 106 of them over the band, tallest 24 storeys), against the same city with the stack (`node game/prefab/tools/bench-city.ts --blocks 20`):

| | the stack | stretched |
|---|---|---|
| 415 shells built at open | 323,487 triangles | 135,707 |
| buildings held | 373,729 | 185,949 |
| submitted facing the door | 318,129 | 130,349 |
| open, of it in the dressing | 576 ms, 97 ms | 492 ms, 51 ms |
| 120 m walk, 99th frame | 10.15 to 11.31 ms | 3.58 to 4.19 ms |
| 120 m walk, worst frame | 48.47 to 52.78 ms | 5.60 to 5.76 ms |

The worst frame of that walk was one tall shell being built and copied into the batch, because the streaming builds one building a frame. It is the whole reason a tower's shell is drawn this way.

### What the ground costs

Measured off the shipped pack. The colour and the relief are the kit's own at 1024 px; the wear is ours at 512, because a roughness and a hollow are low frequency next to a colour map and half the resolution is a quarter of the memory.

| surface | tile | colour texel | relief, median tilt / p99 | roughness | deepest hollow |
|---|---|---|---|---|---|
| asphalt | 4 m | 3.91 mm | the kit's own, 0.32 / 33.9 deg | 0.80 to 1.00 | 0.55 |
| paving | 2 m | 1.95 mm | the kit's own, 0.32 / 67.6 deg | 0.74 to 0.98 | 0.45 |
| earth | 4 m | 3.91 mm | the kit's own, 10.5 / 38.7 deg | 0.90 to 0.99 | 0.63 |

The pack goes from 0.76 MB to 1.05 MB and from 15 images to 19: the earth's own normal map, which the kit ships and nothing was reading, and one wear image per surface. Resident that is one more 1024 map and three 512 maps, 5.6 MB and 4.2 MB with their mips, against a city that already carries 69 MB of texture. Nothing new is drawn and no material is added: the ground is the same six materials it always was, with two more slots filled on three of them.

Occlusion is what it says it is. `aoMap` darkens the ambient term, so a joint between two flags holds shadow under the sky and under a room's bounce, and not under a street lamp: what shades a hollow under a lamp is the normal map, which is why the two ship together.

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

A subway entrance is 192 triangles on three kit materials and a camera is 36 on one, welded into the building's own meshes; the box over the entrance is a sign like any other, so a station adds no draw to the town.

Signage is one draw for the city and well under 1% of its triangles. Measured on a town of 350 plots: a building carries 5.1 signs (two of them the door lamps) and 37.2 quads, 74.5 triangles, 26,066 for the town, against the 8,758 the walls cost: a house has three signs on it and a bar has seven. The one draw is the whole design. A sign per building as its own mesh would have been 350 draws and would have undone the batching; instead every letter is a quad on one shared material, the colours ride on the vertices, and the count is one however large the town is.

The tone costs nothing extra: it is the same materials with a tint and two texture fetches on them, so the buildings draw with exactly the materials they drew with before.

`setTime` is 0.25 us: two uniform writes.

## Standing it up

```ts
const dressing = new KitDressing(loadKit(gltf.scenes, world.theme))
// the city builder hands each plot's charter through the Dressing seam:
// dressing.building(plot, size, world.charter(plot.kind)!)
scene.add(buildCity(world, dressing).root)
scene.add(dressing.streetlights(world))
// every frame, or whenever the hour changes
dressing.setTime(player.clock.hour + player.clock.minute / 60)
```

## How to modify this blackbox safely

Changing what a kind of ground looks like, or how dark a kind of town wants its pavement, is a change to `src/ground/surfaces.ts` alone; a new tiling surface is an entry there, the kit textures it is made of in `tools/ground-surfaces.ts`, a wear image derived with `node tools/textures/relief.mjs <colour> assets/gen --surface <family> --metres <tile> --size 512`, then a rebuild. Retuning what a surface is made of (how deep its hollows go, what roughness it runs between) is a row in `tools/textures/relief/surfaces.mjs`, the same derivation and the same rebuild. `node tools/measure-ground.ts` prints what the pack's own maps are worth in linear light and what each cell kind lands at per town, which is where the ground numbers come from and how to re-aim them after a repack. How much of a tall plot's shell is kit pieces, and how far a flat pane stands off a stretched course, is `MASSING` in `src/compose/massing.ts` alone, and the whole of what a stretched storey is made of is that file: it reads the outer face off whatever piece the recipe names, so a new plain course or a new crowning one needs nothing here, as long as its face covers the module top to bottom. Changing what a frontage or an openness is built of is a change to `src/catalog/recipes.ts` alone, and what an hour of the day means to `src/night/clock.ts` alone; what a shipped kind looks like lives in `@gb/world`'s presets, since the file carries it. Adding a kit piece means adding it to `src/catalog/pieces.ts` with bounds from `node tools/print-catalog.ts`, then rebuilding the pack with `node tools/build-kit.ts`; the lamps are not in the pack at all. Every dimension and colour of a lamp lives in `src/street/lamp/design.ts`, what is cut from them in `src/street/lamp/model.ts`, how the lamps in a city differ in `src/street/lamp/variants.ts`, the shader in `src/street/lamp/material.ts` and the glow in `src/street/lamp/halo.ts`, each of them on its own; a new fitting is an entry in `GROUP`, a few shapes in `model.ts` and a chance in `variants.ts`, and nothing else has to know. How wide a lamp district is lives in `src/street/districts.ts` alone. What this box reads off a charter is `src/charter.ts`; the bounds a signage row has to sit in are `src/sign/bounds.ts`; where the name, the blade and the box over the street go is `src/sign/plan.ts`, the strip, the tube and the board in `src/sign/accents.ts`, the door lamp in `src/sign/doorlamp.ts`, how a letter is sized off the fascia in `src/sign/fascia.ts`, how a wall is claimed in `src/sign/claims.ts`, how a panel lands on its wall in `src/sign/place.ts`, what light a sign throws in `src/sign/light.ts`, the colours in `src/sign/palette.ts`, where `TUBE` is the one number that says how hard every tube in town burns and `SURFACE` the one that says how hard a lamp or a lit panel does, the letters in `src/sign/glyphs.ts` and what a kind of town is made of in `src/look/tones.ts`, each of them on its own. Every dimension of the subway entrance lives in `src/fixture/subway/design.ts`, what is cut from them in `src/fixture/subway/model.ts` and where it stands and what its box spells in `src/fixture/subway/plan.ts`; the camera the same way under `src/fixture/camera/`; which charter gets which is `src/fixture/plan.ts` alone, and `src/fixture/shape.ts` is the box builder both draw with, UV'd in metres on any kit material. A new fixture is a design, a model and a plan under `src/fixture/` and a line in `planFixtures` and `fixtureParts`. A new letter is an entry in `glyphs.ts` and nothing else: the atlas lays out whatever is in it, up to 96 cells, and fails loudly past that. The pack builder refuses to finish if a piece is not in the output under a name `loadKit` looks for. Wall pieces have to be authored the way the kit authors them (outer face on z = 0, body into negative z, width centred on x, base on y = 0), and the pack has to leave them there, or the composition rules put them in the wrong place; `tests/pack.test.ts` holds the shipped pack to the catalog's own numbers. Run `pnpm --filter @gb/kitbash test`.
