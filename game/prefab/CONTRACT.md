# @gb/prefab contract

contractVersion: 0.10.0

## Purpose

Dresses a plot with the whole building its world file names, out of one committed pack, and picks one when the file names none: the footprint it was given, the height its storeys ask for, its entrance on the wall the door faces, lit if you can walk in, and a front that reads as the kind of place its charter says it is. Its windows are cut out of the wall in the shader and look into photographed rooms that light up after dark, through a pane of glass that reflects the sky and the street; the flats carry balconies over the pavement; the commercial fronts carry lit screens over the street, clear of the door; and it says where the light each building throws comes from. It also says where the model really put its entrance and the band over it, and seats the signage the kit wrote for the plot on those, so a door lamp lights the door that is drawn and a nameplate lies on the board it is written on. Near the player a building is its walls and its glass, one material each; far off it is its shell on a third, so a town of any size is three draws.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new PrefabDressing(library, rest)` | a `Library`, and the `Dressing` behind it, which may also publish `Signage` | `rest` answers for anything the pack has no shape for, so it should be a real kit rather than a greybox. Its `signs(plot, size, charter)`, which `@gb/kitbash` publishes, is where the city's signage comes from: a dressing without one leaves prefab buildings unsigned |
| `PrefabDressing.building(plot, size, charter)` | a `@gb/world` `Plot`, `{ width, depth, height }` in metres, the plot's `ResolvedCharter` | the size matches the plot, the world's cell size is `METRICS.cellSize`, and the charter is `world.charter(plot.kind)` |
| `PrefabDressing.shell(plot, size, charter)` | the same | for every plot at open; `lights` is never asked after it |
| `PrefabDressing.lights(plot, size, charter)` | the same | after `building` for that plot, which is what decides whether the kit hung signs on it |
| `PrefabDressing.face(plot, size, charter)` | the same | |
| `StreetFace.of(geometry, wall, plane, finishes)` | a geometry `orient` has turned, the plot's `Facing`, metres from the origin out to the wall (the model's own half depth), the pack's finishes | for anyone reading a face of their own |
| `Fixtures.on(face, signs)` | a `StreetFace` and the `@gb/kitbash` `Sign[]` that box wrote for the plot | the signs in the order `signsFor` lists them, which is the order `lightsFor` answers in |
| `loadPrefab(night)` | a `@gb/kitbash` `CityNight` | the pack’s six files are served beside the box; in a bundler they are followed from `src/load.ts` |
| `Library.of({ catalogue, scenes, atlas, night })` | a `Catalogue`, the pack's parsed scenes, a `PrefabAtlas`, a `CityNight` | for tests and for anyone loading the pack themselves |
| `new InteriorWindows(rooms, night, finishes)` | the room strip as a `DataArrayTexture`, a `CityNight`, the pack's list of finishes | the finishes in the order the two facade strips stack them |
| `new WallScreens(screens, finishes)` | the screen strip as a `DataArrayTexture`, the same list of finishes | |
| `glassMaterial(finishes, night)` | the finishes, a `CityNight` | |
| `shellMaterial(atlas, night, tints)` | a `PrefabAtlas`, a `CityNight`, `screenTints(screens)` | |
| `new Panes(finishes)`, `.of(geometry)` | the finishes, a pack geometry in its own frame | |
| `new Bays(finishes)`, `.windowed(layer)`, `.layout(layer, frame)` | the finishes, then a layer node and a `surfaceFrame()` | `layout` inside a branch `windowed` opened, with the frame read outside it |
| `new BuildingLights(finishes, tints)`, `.of(geometry, facing, lit, rooms)` | the finishes, `screenTints(screens)`, a geometry `orient` has turned, the plot's `Facing`, whether its door opens, its `design.rooms` | |
| `screenTints(screens)` | the screen strip | its bytes are in memory, which a loaded `DataArrayTexture`'s are |
| `windowsOn(finish)`, `glassShareOf(kind)`, `stretchOf(finish)` | a finish name, a `WindowKind`, a finish name | |
| `wallFinish(picture)`, `baseFinish(picture)`, `pictureFor(rooms)` | a picture name from `finishes/`, a `design.rooms` | |
| `Catalogue.parse(value)` | [pack/buildings.json](pack/buildings.json) | any untrusted JSON |
| `Catalogue.read(manifest)` | the same file's own bytes | any untrusted bytes. The hash it takes of them is the pack's identity |
| `catalogue.design(plot, size, suits)` | as `building`, though only `width` and `depth` are read, and the charter's `suits` | |
| `designFor(catalogue, plot, size, suits)` | a `Catalogue`, and as `design` | |
| `catalogue.covers(demand)` | any list of `Bucket`s | |
| `catalogue.suits(charters)` | any list of `{ word, suits }`, such as `world.charters()` | |
| `bucketOf(plot, size)` | as `design` | |
| `orient(geometry, turns, mirror, rooms?)` | a pack geometry, 0 to 3 quarter turns, whole pictures to slide the rooms along | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `building(plot, size, charter)` | `THREE.Object3D` | origin at the centre of its base, facing north unturned; the walls on `Library.material`, the glass in their windows on `Library.glass`, plus the signs the dressing behind would have hung. The model is the one `plot.design` names, or the pick when it names none, and a plot with an interior wears the entrance you can walk through. A plot the catalogue has no shape for, and a pin this pack cannot honour, come back from `rest` untouched |
| `shell(plot, size, charter)` | `THREE.Object3D` | the same building from far off, in the same box: its walls alone on `Library.shell`, the same entrance, the same pictures on the same faces, no glass and no signs. It reads no street face, because nothing is seated on a shell. The same plots fall back, to the `rest`'s `shell` where it has one and its `building` where not |
| `lights(plot, size, charter)` | `LightEmitter[]` | what the building throws, in its own frame: `kind` `entrance` for the lit lobby of a door you can walk through, `screen` once per panel, and `@gb/kitbash`'s own (`sign`, `strip`, `doorlamp`) for every sign `building` hung, seated where that sign was seated. `position` is metres just off the lit face, `colour` is what burns packed `0xRRGGBB`, `intensity` is candela at full dark, `radius` the metres past which it is not worth drawing (0.1 lux, at most 16). A plot handed to `rest` has nothing of its own here |
| `face(plot, size, charter)` | `StreetFace`, or undefined | the street face this plot is actually drawn with, in the building's own frame: `wall`, `plane` (metres out to the wall), `door` and `band` as `Plate`s (`position` the middle of the outward face, `width` across the wall, `height`), and `reliefUnder(across, up)`, how far the model's own face stands off the wall over a patch of it. Undefined for a plot the dressing behind answers for |
| `Signage` | `signs?(plot, size, charter)`: `THREE.Mesh` or nothing | the seam this reads off the dressing behind: that plot's signage as one mesh on one material, in the building's own frame, which is what gets seated on the face the pack drew |
| `Fixtures.on(face, signs)`, `laidOn(sign, face)` | `Fixtures`, boolean | `holder(point)` says which sign a point in the building's frame belongs to, `seat(mesh)` carries a sign mesh onto that face, and `lit(emitters)` moves the lights with it; `laidOn` is which signs it will move, being the ones the kit laid flat on the wall the entrance is on |
| `BuildingLights.of(...)`, `screenTints(screens)` | `LightEmitter[]`, `ScreenTint[]` | the same emitters off one geometry; the mean colour and brightness of each screen picture, in strip order |
| `Library.tints` | `ScreenTint[]` | the same, read once when the pack loads |
| `loadPrefab(night)` | `Library` | the pack, checked against its own manifest |
| `Library.geometry(id)` | `THREE.BufferGeometry` | the model in its own frame, door on the south wall, one metre to one unit |
| `Library.material`, `Library.glass`, `Library.shell` | `THREE.Material` each | the three materials every prefab building in the city is drawn with: the walls near the player (`MATERIAL_NAME`), their glass (`GLASS_MATERIAL_NAME`), and the walls from far off (`SHELL_MATERIAL_NAME`) |
| `Library.panes(id)` | `THREE.BufferGeometry`, or undefined | the model's glass in its own frame: every upright face on a windowed layer, `PANE.stand` off the wall, carrying the wall's uv and layer |
| `Panes.of(geometry)` | the same | for anyone deriving the glass of a geometry of their own |
| `Bays.layout(layer, frame)` | `BayLayout` | which bay the fragment is in, where in it, the bay's metres, and the share of the fragment that is pane; what the room, the glass and the shell all cut their windows from |
| `Catalogue.models` | `ModelSpec[]` | every model in the pack, sorted by id |
| `catalogue.design(plot, size, suits)` | `{ model, mirror, rooms }`, or undefined | which building this plot gets, which way round, and where along the wall its rooms start, drawn from the models whose `tags` share a word with `suits`, or from the whole shape when none does. Undefined means the catalogue has nothing this shape. This is the pick, which is what a world file records |
| `designFor(catalogue, plot, size, suits)` | the same | what the plot is actually drawn with: `plot.design` if it carries one, the pick if not, undefined if the pin cannot be honoured |
| `catalogue.identity` | a `@gb/world` `AssetPackRef` | pack, version, and the sha256 of the manifest, for the `world.catalogues()` a city is pinned against. No hash when the catalogue came from a parsed value rather than bytes |
| `catalogue.bucket(bucket)` | `ModelSpec[]` | every model of that shape, in id order |
| `catalogue.covers(demand)` | `{ ok: true }` or `{ ok: false, missing }` | which shapes the catalogue has no building for |
| `catalogue.suits(charters)` | `{ ok: true }` or `{ ok: false, missing }` | the words no look claims, whose plots draw from the whole shape |
| `TAG` | a RegExp | what a tag is: lowercase, a letter first, at most 24 characters, the word shape a charter's `suits` are written in |
| `bucketOf(plot, size)` | `Bucket` | `{ front, depth, storeys }` in metres, read in the door's frame |
| `everyBucket()` | `Bucket[]` | every shape `@gb/world`'s `PLOT_BAND` cuts, in metres at `METRICS.cellSize`: 64 of them |
| `heightOf(storeys)` | metres | the height `@gb/scene` puts the plot at |
| `orient(geometry, turns, mirror, rooms?)` | `THREE.BufferGeometry` | the model turned onto its plot, wound to face out, its uv slid a whole number of pictures along |
| `turnsFor(facing)` | 0 to 3 | quarter turns that put a south door on that wall |
| `prefabMaterial(atlas, night)`, `glassMaterial(finishes, night)`, `shellMaterial(atlas, night, tints)` | `THREE.Material` each | the three materials, for anyone building a library by hand |
| `WALL`, `BASE`, `wallFinish`, `baseFinish` | two prefixes and the two names one picture lands under | `wall:<picture>` has windows cut into it, `base:<picture>` is the same pixels with none; the rest of the name is the committed picture |
| `BASE_TILE`, `stretchOf(finish)` | metres one base repeat covers, and the v stretch the shader reads a finish with | 1 for everything but a base |
| `SCREEN`, `SCREEN_PICTURES`, `SCREEN_SIZE`, `DISPLAY_FINISH`, `pictureFor(rooms)` | how a screen is built, the pictures it draws from, their size, the finish a panel wears, and which picture a plot's panels carry | `pictureFor` is the fold the shader takes of `design.rooms`, so the two agree |
| `DOOR_FINISH`, `OPEN_DOOR_FINISH` | two finish names | the entrance of a building nobody can walk into, and of one you can |
| `PACK_MANIFEST` | a URL | the committed manifest, for a headless caller that needs the pack's identity without a renderer |
| `PANE` | `stand`, `roughness`, `reflectance` | metres the glass stands off the wall, how sharp its reflection is, what it reflects face on |
| `BALCONY` | `finish`, `reach`, `above` | the balustrade's layer, metres a balcony may hang over the pavement, and the clear height under the lowest one |
| `ROOM_TINTS` | eight colours | what a lit room burns in, near and far |
| `PROUD`, `HEIGHT_TOLERANCE`, `GLOW`, `LAYER_ATTRIBUTE`, `MATERIAL_NAME`, `GLASS_MATERIAL_NAME`, `SHELL_MATERIAL_NAME` | metres, a multiplier and four names | how far trim may reach past the plot, how exact a wall has to be, how hard a lit face burns, the attribute the pack is written with and the three names its batches carry |

## Errors (closed set)

- `invalid-catalogue`: the manifest failed its schema. Thrown as `InvalidCatalogue`, carrying `violations`.
- `pack-changed`: one of the pack's five binary files does not hash to what the manifest says. Thrown as `PackChanged` from `loadPrefab`, carrying `file`, `expected` and `found`. The pack is committed bytes; a pack edited under the game refuses to load rather than quietly drawing a different city than the seed says.
- `library-incomplete`: the mesh file is missing a model the manifest names. Thrown as `LibraryIncomplete`, carrying `missing`.

A plot the catalogue has no shape for is not an error: `building` hands it to the dressing behind.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, `shell` included, and `storeyHeight`. Scene batches every plot's shell at open into `city:<material>` and the near buildings' `building` into `detail:<material>`, one draw each.
- `@gb/kitbash` contract: `CityNight`, so one clock lights the prefabs and the kit together; `SIGN`, which names the material every sign in the city is drawn with and how far a panel stands off its wall; `signsFor` and `Sign`, what that box hangs on a plot and where; `DOORLAMP`, the line a door lamp is drawn to; `lightsFor` and `LightEmitter`, the emitters of the signs this box hangs and the shape its own are published in.
- `@gb/world` contract: `Plot`, `ResolvedCharter` (its `suits` are what a look is matched on; the tests read the fourteen `SHIPPED_CHARTERS`), `AssetPackRef` and `PlotDesign` (the pin a plot carries), `plot.interiorId`, which is exactly the set of doors that open, and `PLOT_BAND`, `plotShape` and `METRICS.cellSize`, which are the shapes the catalogue holds and how a plot is read in its door's frame.
- `@gb/kit` contract: `Rng` for the pick, `contract` for the manifest.
- `three`, `three/webgpu` and `three/tsl`: the three materials are node materials, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself. The glass reflects `scene.environment`, which the app owns.
- The art: [pack/](pack/), built offline by `tools/build-buildings.ts` from the looks in [looks/](looks/), the wall pictures in [finishes/](finishes/), the rooms in [rooms/](rooms/) and the screens in [screens/](screens/), through the repo owner's own `glb-buildings` CLI (MIT). The producer is not a dependency of the game: it is shelled out to from `tools/`, and nothing it uses reaches the runtime.

## The pack

Six committed files, and they are the whole art supply.

- `pack/buildings.glb`, 2.9 MB: 512 models, one mesh each, 212 triangles on average, balconies included, all on one material, welded, quantized and meshopt-packed. The glass is not in it: the runtime derives every pane from the walls.
- `pack/buildings-colour.png` and `pack/buildings-emissive.png`, 1.2 MB and 20 kB: twenty-three 256 px layers stacked into a strip each, the surface a face is painted and the part of it that glows.
- `pack/buildings-rooms.png`, 896 kB: fourteen 256 px rooms in the same shape, the pictures every window in the city looks into.
- `pack/buildings-screens.png`, 574 kB: six 256 px pictures in the same shape, what the lit panels on the walls carry.
- `pack/buildings.json`, 159 kB: the manifest. Pack id, version, the producer commit, the sha256 of all five binaries, what each atlas layer paints, and one entry per model: its shape, the tags it suits, its triangle count and where its door is. Its own sha256, taken over these bytes, is the pack's identity, and it covers the other five through the hashes it lists.

A strip's rows already sit in the order an array texture wants them, so the runtime decodes one image and hands the bytes straight to the GPU with no copying in between.

Every picture is stored losslessly. sharp turns palette quantisation on the moment `effort` is set, and a palette is 256 colours for a whole strip, so adding one finish re-quantised every other finish and moved the pixels of every wall in the city. It costs about half a megabyte of download over the whole pack and nothing on the GPU, where a layer is uncompressed whatever the file was.

It is bytes, not a recipe. Rebuilding it on another machine is a new version, never a no-op, because the producer and its dependencies decide the exact numbers; on one machine it is byte for byte reproducible, and the build tool proves that by hashing what it wrote.

## What a world file names, and what this box picks

A city is generated once and added to later, and everything in it that was there
before has to come back the same. The catalogue lives in code, so the pick is a
function of the pack: grow the pack and the same plot gets a different building.
That is what a `plot.design` is for.

- **A plot with a `design` is drawn from it and nothing else.** `design.model`,
  `design.mirror` and `design.rooms` are read straight out of the world file.
  Nothing is picked, no `Rng` is touched, and the shape of the plot is not even
  consulted. Same file, same street, in this version of the art and every later
  one.
- **A plot without one is picked for.** That is every city exported before the
  pin existed. The pick reads the plot, its charter's `suits` and the pack, so
  a city with no charters of its own is picked for against the presets.
- **A pin this pack cannot honour falls back to the dressing behind.** Three
  ways it happens: `design.pack` names a catalogue that is not this one, the
  pack has been grown and no longer holds that model, or the shape is not one
  this catalogue covers. All three draw a kit building, and none of them picks
  a different prefab. A kit building on a prefab street reads as a fallback; a
  quietly substituted model reads as the city the file describes, which is the
  failure worth being loud about.

Writing the pin is the job of whoever holds both the world and the catalogue,
because the generator never sees the art. It is two calls: `catalogue.identity`
into `world.recordCatalogues`, then `catalogue.design(plot, size, suits)` into
`world.recordDesign` for every plot, in that order, since a design has to name
a catalogue the city has already recorded.

## What a wall wears

Two tiers, and the split is the whole reason a building is a couple of hundred triangles.

**Above the street level a bay is a bay of curtain wall.** Three panes by two, in a surround, with an office or a flat behind them. A whole storey is still eight triangles: the wall picture is only the pier and the spandrel, and the opening, the mullions and the room are all cut out of it in the fragment shader.

**The street level is specific.** One wide pane in a heavy surround with a shop behind it, an entrance and a fascia band over it. It is the only part anybody stands in front of, and on the one building in eight that opens it is where the way in is. Nothing lit stands beside the door but the lamps `@gb/kitbash` hangs there; the only tube on a building is the one round its parapet.

The wall pictures are **committed art**, in [finishes/](finishes/), read by `tools/finishes.ts`, plus the one surround every look wears at street level. What a picture carries is the surface around the window, which is the part a photograph is better at than arithmetic: panel courses, casting marks, staining, wear. A wall picture covers four bays by two floors at 256 pixels, which is about 21 pixels a metre, and a mullion is three centimetres, so a drawn one would be a fifth of a texel; the opening, the bars and the room are all cut out of it in the shader instead.

**A look names the picture it wears, and the picture lands on two layers.** `looks/<id>.json` carries a `facade` field naming a file in `finishes/`; the pack stacks it as `wall:<picture>`, which `windowsOn` cuts bays out of, and as `base:<picture>`, the same pixels on the walls a band is composed on (the street level round the door, the parapet storey a board hangs on, the roof), where a window in the middle of every bay is exactly where the door and the board land. Two looks naming one picture land on one pair and pay for it once, which is what `tower-a` and `corpo-a` do. The base is a large share of what is seen: on the 12 m fronts it is 94% of a two storey `block-c` or `lodge-d`, 54% of a three storey one and 39 to 53% of `yard-c`, so a base that was one plain producer wall for the whole catalogue read as one building repeated, and a base that is the look's own picture reads as the look.

**The base is read at the wall's scale.** The producer lays a wall picture over four bays of 3 m and two floors of 3.21 m and tiles a base square by the metre, so the base is told `BASE_TILE.across` and the shader stretches its v by `across / down` on the way in. One `uniformArray` lookup per fragment, and the same courses run the same size above the fascia and below it.

Which picture suits which look was decided with eyes on the running city, at night on a wet street and again in daylight, not from the file names:

| look | picture | why |
|---|---|---|
| `corpo-a` | `facade-a-3` | the flattest, cleanest blue-grey panel. A corporate slab is machine-made and has no wear story, and it carries a lit board that wants a quiet wall behind it |
| `tower-a` | `facade-a-3` | shared: glazing and base cover all but 1.8% of its street face |
| `bar-b` | `facade-b` | the most saturated oxide. The bar is the amber look, and warm steel under an amber tube is one temperature all the way up |
| `shop-b` | `facade-b-3` | the calmest steel, on the one of the two that shows the most wall, so a magenta shopfront has something quiet to sit on |
| `block-c` | `facade-c-2` | the even mid-dark concrete. A block of flats is 52% wall on its street face, the most of any look, and reads as one quiet mass |
| `yard-c` | `facade-c` | the lightest, with the heaviest board marks. The working shed is the plainest thing on the street and its amber parapet needs something to sit against |
| `lodge-d` | `facade-d` | the tighter, greener glazed tile, on a small quiet front |
| `stack-d` | `facade-d-2` | the larger, bluer tile, which pairs with its cyan seams |

The glazed tile is the only regular grid in the set, and it went to the two looks that carry no lit screen, because a tile grid and a lit board are two grids fighting. The four looks that do carry one are all on the composite or the steel.

`facade-a`, `facade-a-2`, `facade-b-2`, `facade-c-3` and `facade-c-4` are committed and not in the pack: each sits within a point or two of a picture already in it, and a layer is 0.70 MB.

Each one tiles. A wall runs several pictures across and several up, so a seam would repeat over the whole building; the pack test measures the join against what one step inside the picture costs and refuses anything worse.

They are handed to the producer through `add-texture`, which is the verb that names the file, pairs the glow map and records the grid the picture holds. That grid is what fixes the uv scale the shader reads a bay off, so the two have to agree; both take it from the same `WindowKind`.

## Windows: the glass, and the rooms behind it

A window is three things on two materials, and none of them is in the picture.

**The opening is cut out of the wall.** `src/bays.ts` says, for any fragment on a windowed layer, which bay it sits in, where in that bay, how many metres the bay spans and how much of the fragment is pane rather than surround or mullion. The bay is read off the uv, the metres off the surface's own derivatives, so a bay is the size it really is however the producer stretched the picture onto that wall, and a mirrored building comes out right. It costs no geometry, no vertex and no fetch.

**The room is on the wall, behind the opening.** `src/interior.ts` marches the view ray through the box behind each bay and samples a photographed room on whichever face of it the ray meets, on the wall's own material. The technique is interior mapping. `@gb/kitbash` does the same for the kit's modelled panes and carries the room on the vertices, because it has vertices to carry it on; here a storey is eight triangles and there are none to carry anything.

**The glass is a pane in front of it.** `src/panes.ts` copies every upright face on a windowed layer out of the model and pushes it `PANE.stand` (2 cm) off the wall, keeping its uv and its layer, so `src/glass.ts` cuts the same bays the wall does and the pane lands exactly over the opening. Outside the opening the pane draws nothing. What it draws inside is what a thin sheet of glass does: reflect the environment by its Fresnel share and let the rest through. The reflection is the standard model's own off `scene.environment` and whatever lights reach the pane; the composite is premultiplied by hand (source one, destination one minus alpha), so the pane's light is added as it is and the room behind is scaled by what the pane lets through. Face on that is 96% of the room and a trace of sky; along the street it is mostly sky, which is what a shop window does. After dark the sky is nearly black and the pane catches the street instead, a fixed cool tone at the same grazing share, so a facade seen along the pavement is a smear of wet road under neon rather than a black wall. Every pane in the city is one material, `GLASS_MATERIAL_NAME`, on the building's second mesh, and `@gb/scene` batches them as it batches the walls: one draw for all the glass near the player. Caps and chamfers on a glazed band get no pane, because a pane is upright.

- **The bay is the room.** The picture tiles, so the bay index runs on along the wall and never repeats with the picture: the pattern of which windows are lit does not repeat every twelve metres the way a painted one did.
- **Fourteen rooms, in two banks.** Eight for above the street (two offices, a server room, two flats, a bedroom, a corridor, a store room) and six for the pavement (a bar, a noodle counter, a shop, a clinic, a workshop, a lobby). A window under `4.6` m looks into the street bank. Each is seen small, through glass, at an angle, after dark, and never twice side by side, and each is tinted by one of `ROOM_TINTS` and mirrored or not: 96 different shopfronts and 128 different upper rooms out of fourteen pictures.
- **The room is as deep as it is wide.** A shopfront opening is 2.6 m wide and its box runs 3 m back, the shallow end of a real shop floor; a curtain wall bay opens 2.1 m and runs 2.4 m. The photograph carries the room's own depth past the back wall, so a box deeper than its opening read as a tunnel down which every room was the same dark side walls.
- **Which room a bay looks into is a pure function of where the bay is.** The bay index is hashed for the room, its light colour, whether it is mirrored and its key. There is no `Rng` and no frame state on this path, so a building draws the same rooms on every machine and every run. Two plots that drew the same model start at different bays: `catalogue.design` gives each plot a whole number of pictures to slide its uv along, which the picture tiles through and the hash does not.
- **A room is lit while the city's lit share is above its key**, the same rule `@gb/kitbash` uses, so the same rooms come on in the same order every night and none of them flickers. A shopfront takes about a third of the key an office does, because a street of shops is lit and a street of offices is not.
- **The picture belongs on the back wall, and folds round its edges.** A side wall reads the picture along the depth of the room, the floor and the ceiling read it back from the glass, and each meets the back wall on the row or column it shares with it, so a side wall is shelves and fittings seen sideways rather than one column of the picture drawn out across the whole depth. All four are taken well down, because they are out of the light.
- **The grid melts rather than aliases.** The opening and the mullions are feathered by how much of the picture one pixel covers, and once that is more than a mullion the bay fades to the share of itself that is glass, which is what a mip of a drawn one would have done.
- **A band under 1.6 m gets no windows.** A one storey building carries a 0.8 m parapet on the same finish as its wall, and a window squashed into that is not a window.

**From far off, the shell.** `@gb/scene` draws every building as its `shell` at open and asks for the whole `building` only near the player. The shell is the walls alone on `SHELL_MATERIAL_NAME` (`src/shell.ts`): the same pictures, the same bays, the same windows lit in the same order by the same hash and in the same tint, but each a flat lit rectangle rather than a room, and each screen the mean colour of the picture the plot carries. No raymarch, no room fetch, no pane in front, no sign on it. The skyline keeps its lit windows and its boards, and what a far building costs a fragment is the wall fetch.

The room pictures are generated, not drawn: a prompt each in [rooms/prompts/](rooms/prompts/), one image through the Grok route in `tools/textures/README.md`, cropped and sized by `tools/draw-rooms.ts` and committed as `rooms/*.png`. They are ours, from our own prompts, so they travel inside a world file. Nothing in the build calls a model: it stacks the committed pictures. `draw-rooms` takes whatever raw images are in the folder it is pointed at, so a new room arrives on its own and the ones already committed are not redrawn to take it.

## Balconies

> "When possible, real windows looking outside the city, from balcony as well"

Three of the eight looks are homes (`block-c`, `lodge-d`, `stack-d`), and a home has a balcony: one on every upper storey of the street face, centred on a bay, so the window behind it is the one you would step out of. It is the one thing on a building that reaches past its plot by more than a tube's relief.

- **Generated from the look's own numbers, in this repo.** A look says `balcony: { wide, deep, guard }` in metres and `tools/balconies.ts` builds four boxes per storey: a slab in the look's own wall picture, a balustrade across the front and a rail down either side in the balustrade picture. They are not composed through the producer, because a band anything is composed on loses its window grid for the whole storey, and a balcony with a blank wall behind it is a shelf. So the wall stays the windowed wall, untouched, and the balcony stands in front of it.
- **The balustrade is a layer of its own**, `BALCONY.finish`, taken off the swatch the producer draws it on: a rail and the balusters under it, filling the height and repeating every 2 m along. The slab is the look's base, read at the wall's scale, so it is the building's own concrete.
- **It hangs over the pavement, and only there.** `BALCONY.reach` (1.4 m) past the plot on the wall the door is on, from `BALCONY.above` (4 m, the ground storey) up. Everywhere else a model is held to `PROUD`. A parapet storey stepped back off the street hangs its balcony off its own face, which is that much less over the pavement. Measured over the pack: 288 balconies on the 288 upper storeys of the three looks' 144 models, the furthest 1.2 m past the plot, the lowest slab on the 4 m line; the other five looks carry none.
- **A floor the player can see.** The slab is 15 cm thick on the storey line, so from across the street the balcony reads as a floor with a rail round it and from under it as a soffit, and the pane behind it is the same glass as every other window.

## The entrance

A door is the surface a player stands closest to, and since only about one building in eight opens, most of them are a door nobody will ever use and still the nearest thing on the street. It is a photograph, `finishes/door.png`, ours from our own prompt: at 256 pixels stretched over a 2.2 m door that is about a hundred pixels to the metre, five times the wall's, and the frame, the push bar, the kick plate and the reveals are detail arithmetic cannot invent.

- **A pair of shut glazed leaves in a dark metal frame**, with a fanlight over them, a meeting stile down the middle, a pull either side of it, a push bar across both leaves, a kick plate at the foot, a threshold plate at the pavement and an entry panel with three lit marks on the wall beside the frame.
- **It reads shut.** Most of the city does not open, so a door that looked like a way in would undo the one feature that says which buildings do.
- **It is symmetric on purpose,** and it is stored that way: the committed picture is its own mirror, to the byte. Half the plots in a city draw their model mirrored, and hardware that swapped hands with the building would read as two different doors. A pair also covers the range the looks ask for, 1.4 m to 2.6 m wide, where one leaf at the top of that range is a cupboard door.
- **The reveals wear the wall.** The producer wraps the leftmost twenty-fifth of the picture round the four edges of the plate, and the picture carries a plain dark wall margin wider than that, so an edge comes out wall-coloured rather than carrying a slice of glass.
- **The door you can use has its lights on, and it is the same photograph.** The pack carries the entrance twice, on two layers. `tools/doors.ts` lifts the glass towards a warm lobby, dark at the head and lit at the sill so the light reads as coming from inside, burns the fanlight and the threshold about three times as hard, and turns the reader's marks green. Nothing outside the glass, the threshold and the reader is touched, so the frame, the bar, the pulls and the kick plate are the same pixels in both, and the pack test holds them to that. It has to carry by day as well, when nothing in the city glows, which is why the lit lobby is a lighter surface and not only a stronger glow.
- **Which one a building wears comes from `@gb/world` and nowhere else.** `plot.interiorId` is exactly the set of doors that open, checked in both directions by that box, so there is no second field to disagree with. The dressing moves the plot's door faces onto the lit layer on the copy of the geometry `orient` has already made for it: no geometry, no draw, no second material, and a plot without an interior is untouched. Nothing is ever baked onto the lit layer, so growing the pack cannot put a lobby light on a building that has no way in.
- **The lamps beside it are `@gb/kitbash`'s.** That box hangs a pair of door lamps on every plot, bounded by the door they light, and this box hangs them on the prefab with the rest of the signage, seated on the door the pack drew rather than the one the plot asks for (below). Nothing of the pack's own stands beside a door: the only tube on a building is the one round its parapet, and the pack test holds every model to that.

## Where the signage lands

`@gb/kitbash` writes a plot's signage against the plot's own arithmetic: a door
snapped to the kit's 2 m module, that door's width (0.95 m) and head (2.10 m),
and a wall plane on the plot boundary with a flat panel `SIGN.stand` (8 cm) off
it. A pack model has its own: every one of the 512 centres its entrance on the
front, 1.2 to 2.4 m wide with its head at 2.3 to 2.9 m, and stands its fascia
band, its screen plates and its parapet tube exactly 8 cm proud, which is the
plane a flat sign lands on. Hung as written, the lamps stand beside the drawn
door and the nameplate is coplanar with the board it is written on.

So `face(plot, size, charter)` reads the street face off the geometry the plot
is drawn with, and `Fixtures` seats what is hung on it. Two anchors move and
nothing else does:

- **A door lamp is seated on the drawn door.** The pair straddles it at
  `DOORLAMP.beside` (22 cm) outside its frame and runs from `DOORLAMP.foot`
  (35 cm) to the drawn head plus `DOORLAMP.overhead` (15 cm). Which side each
  lamp is on is kept, so the pair does not swap hands.
- **Anything laid flat stands `SIGN.stand` off the face the model really has
  under it**, which is the outermost surface over its own patch: the band under
  a nameplate, the parapet under a board, the plain wall under a strip. A face
  standing further out than `PROUD` is a balcony and not wall, so a strip
  running past one is not pushed out over the pavement. A plate written on the
  band and hanging off its edge is slid back inside it by up to 8 cm, which is
  less than the air the kit leaves round a claimed panel.

A hung box moves out with its bracket and is never slid: it is read along the
street rather than off the wall it hangs from. What is not laid on that wall at
all stays exactly where the kit wrote it: a blade on a flank, because that wall
is the kit's own and so is its arithmetic, and the lit box over a subway
entrance, which stands out on the doorstep in front of the wall and would go
through the stairs if it were carried back onto it. `laidOn` is that line.

A town's signage is one welded buffer per building, which is what keeps it one
draw, so a vertex is carried by the sign whose patch it stands in; `signsFor`
is what `building` hangs and `lightsFor` answers one emitter per sign in the
same order, so the meshes and the lights take the same seats.

Measured with `node tools/measure-fixtures.ts` on a 4 by 4 block town of 170
plots, every one on the pack, 340 door lamps and 375 flat plates, against the
same town dressed by the kit alone:

| | written | seated |
|---|---|---|
| lamp off 22 cm outside the drawn door frame | 0.125 to 1.165 m, 0.625 median | 0 |
| lamp head against the drawn head plus 15 cm | 0.200 to 0.800 m short | 0 |
| plate standing off the face under it | -0.120 to 0.080 m | 0.080 m, every one |
| plates in the same plane as that face | 63 of 375 | 0 |

The plate written on a fascia band is the one thing still not right: 52 of them
land on a band and 18 are a 0.758 m plate on a 0.600 m band, because the kit
sizes a letter to its own metre-tall fascia. The band is published for it to
size against instead.

## The screens on the walls

> "You will also see displays like projected over those buildings. Those are basically images with some kind of effect. You will see, like, pixels or something like that."

A screen is a flat plate the producer stands on the wall, twelve triangles, on the same material as the wall behind it, and its whole face is the lit picture. Everything that makes it read as a screen rather than a poster is in `src/display.ts`.

- **No frame.** The face is picture edge to edge: no housing, no rim, no bezel. The plate's four edges are 11 cm deep and wear the plate's own dark colour, which is the only part of a screen that is not picture and is seen only edge on; a face narrower than any panel is one of them, and the shader draws nothing on it.
- **The picture fills the panel at its own aspect.** A panel's uv spans exactly one picture each way (measured on every plate in the pack: u and v both run 0 to 1), and the picture is cropped to the panel's shape, centred, never stretched: a wide board shows the middle band of a square picture and a tall banner the middle column.
- **The lamp grid is weaker than the picture.** Lamps 3 cm apart with the dark between them at 0.55 of a lamp, so up close the picture is dots and the dots never beat the picture. It is arithmetic off the surface's own derivatives, feathered by a pixel's footprint, and past the point where one pixel covers a pitch it melts to the share of the pitch that is lamp, divided back out so the panel holds the brightness it was authored at however far away it is read from.
- **Two shapes, authored per look, and neither over or beside the door.** A `board` across the parapet storey, read from the far pavement, and a `banner` at the street level, read from the pavement. An advert claims wall at least one city cell (`CLEAR`, 2 m) from the entrance: a banner stands at the left margin and ends 2 m short of the door, and is left off a front too narrow to hold 0.7 m of it that way; a board hangs only where the parapet storey starts 2 m above the door head, which is three storeys and up, and leaves the entrance and the sign `@gb/kitbash` writes over it a whole storey of wall to themselves. Measured over the pack: 112 banners, the nearest 2.10 m from a door; 64 boards, all on three and four storey models, the lowest 4.99 m above a door head. Four of the eight looks carry one or both: the corpo slab, the tower, the shop and the bar. A board is measured against the parapet's own face, so a look that steps its top storey back has that much less wall to hang one on.
- **A board costs its storey's windows.** The producer swaps a band's bay-and-floor picture for the plain wall as soon as anything is composed on it, because a window drawn in the middle of every bay is exactly where a composed element lands. So a parapet storey with a board on it wears the look's base, which is that same picture with no windows cut into it.
- **Which picture a panel carries is the plot's own uv shift.** `catalogue.design` already gives every plot a whole number of wall pictures to slide along; a panel's own uv spans exactly one picture, so the whole number read back in the shader is that shift, exactly, and it is the same for every fragment of the panel. Folded onto the count of pictures, in the shader and in `pictureFor` alike, so a plot's screen is a pure function of the plot, two plots on one model need not carry the same one, no screen changes halfway across itself, and the light it throws is the colour of what it shows.
- **Five are committed pictures, one is drawn.** The pictures live in [screens/](screens/), ours from our own prompts, so they travel inside a world file; the sixth is a composition in `tools/screens.ts`, a ground with the bright mass the eye lands on and one hard graphic against it. Both go through the same exposure, normalised to what a picture's brightest half a percent reaches, so a row of adverts where one is twice as bright as the next cannot happen. The drawn one also gets a broad key light and its ground pushed well under the highlight, which a photograph already has. Nothing on them spells anything: text out of an image model garbles, and the words in this city are `@gb/kitbash`'s, which draws every letter over every door from a stroke font.
- **No hologram.** Additive, semi-transparent, nothing behind it: that is a plate with no wall behind it, which the transparent pass draws as a lit rectangle again, and a fourth material for the town. The bright board plus the app's bloom carries the reference, which is itself a lit panel with a halo the renderer made.
- **These screens and `@gb/furnish`'s televisions are deliberately separate.** One is a panel on an exterior wall on the city's single building material, the other is a prop inside a room on the furniture's; they share a look, not a code path, and merging them would put an interior box's pictures on the outside of every building in the town. If they should ever change picture together, the answer is one clock both of them read, published by whoever owns the clock, not one box reaching into the other.

## The light a building throws

There are no point lights in this box: the walls glow through the emissive pass and the app's bloom, and what a lit thing should throw onto the street is published for whoever owns the lights. `lights(plot, size, charter)` answers, in the building's own frame, the same `LightEmitter` shape `@gb/kitbash` publishes for its signs, with two kinds of its own:

- `entrance`: the lobby of a door you can walk through, 20 cm off the door, warm (`0xffdbaa`), 9 candela a square metre of glass. A door nobody can walk through throws nothing.
- `screen`: one per plate, 20 cm off its face, the mean colour of the picture that plot's panels carry (`pictureFor(design.rooms)` into `Library.tints`), 20 candela a square metre times the picture's own brightness times `SCREEN.glow`.

Plus the kit's `lightsFor` for every sign `building` hung there, so a prefab building's name, its door lamps and its screens light the pavement from one list. `radius` is where the light falls to 0.1 lux, at most 16 m. Positions are measured off the geometry the plot is drawn with, after `orient`, so a mirrored building turned onto an east wall lights the east pavement.

## How a catalogue is made

A model writes a **look** by hand, offline, once: a small JSON saying what a building wears, with no reference to how big it is, and `tags` saying what it suits. Eight of them live in [looks/](looks/) and they are about fifteen lines each.

**A tag is a word a charter could carry in its `suits`,** and that is all the pack knows about it. A look tagged `bar` and `narrow` is picked for any plot whose charter suits either, whether the charter is the preset `bar` or a word the premise invented; the fourteen presets each carry their own word plus their frontage, material, sprawl and prominence. The manifest checks a tag's shape (`TAG`) and never its membership: what kinds of place exist is the world file's to say, and a pack that refused a word it had not heard of would drop a whole city to the kit over one look.

`tools/build-buildings.ts` replays every look at every shape the city cuts, which is `@gb/world`'s `PLOT_BAND` at its cell size: 8 looks by 64 shapes, 512 models, in about two minutes of wall clock and no model time at all. Each one is driven through the `buildings` CLI verb by verb, the way its own skill says to drive it, in a throwaway home of its own.

What comes back is measured before it is allowed in, and the refusals are named:

- `wrong-height`: the walls are not exactly `4 + (storeys - 1) * 3.2` m tall, to the millimetre.
- `overhangs`: something reaches more than `PROUD` past the plot, in any direction, or rises past it; a balcony is allowed `BALCONY.reach` over the pavement above the ground storey and nothing else is.
- `faces-wrong-way`: the door is not on the south wall, which is the wall the runtime turns onto the street.
- `absolute-path`: a texture or a buffer points at a file on the machine that built it.
- `placed-crooked`: a band is turned or scaled rather than lifted.
- `unknown-finish`: the model wears something the pack has no layer for, which is how a pipe, a mast or a composed window is kept out.

The `cyber` style stands a lattice mast and its guys on every roof, taller than any building the forge cuts. Anything rising past the relief budget is left out before the model is measured, so the mast comes off without touching the producer. The balconies go on at the same point, after the producer and before the gates, so they are measured with everything else.

Then the whole pack is read back the way the game reads it and measured again, because welding and quantization happen after the gates and the promise is about the committed bytes.

Run it with `node tools/build-buildings.ts`. It needs `glb-buildings` beside the checkout, or `GLB_BUILDINGS` pointing at it. `node tools/measure-city.ts` then says what a forged town costs on the result.

Tags are manifest metadata and touch none of the five binaries, so changing what a look suits is `node tools/retag-buildings.ts`: it rewrites every model's `tags` from the looks, keeps everything else as read, and refuses a `looks/` folder whose looks are not exactly the ones the pack was baked from. Both tools write the manifest through `tools/manifest.ts`, which holds the pack name and `VERSION`.

## Invariants

- One world unit is one metre. A model is baked at its plot's exact footprint and height and is never scaled, so its windows are the size they were drawn.
- A building is exactly as tall as the city says its plot is. Only lit trim reaches past that, and only by `PROUD` (0.2 m): a neon tube and the bracket it stands on, sideways at the shopfront and upwards at the parapet. Plots in a block abut, so a building already shares its relief with the one next door; `@gb/kitbash` reaches 5 cm with its window trim and 8 cm with a flat sign, and this is the same arrangement one step louder. The one thing that hangs out over the street is a balcony, by `BALCONY.reach` on the door's wall above the ground storey, and the pack test holds every model to that line. A sign seated on trim goes out with it: a plate on a face standing `PROUD` proud sits at 0.28 m, measured, which is a quarter of what a kit box hanging over the street already reaches.
- **Same seed, same city, forever, whether or not a model is running.** The pick is a pure function of the plot and the committed pack: an `Rng` on the plot's own id, kind and style, forked per feature, drawing from no shared stream, so dressing one plot can never move another. Nothing on this path but the world file, the pack and three.js. Not the language model, not the sidecar, not the producer, not `@gltf-transform`.
- The pick chooses from members sorted by id, so what order the manifest happens to list them in can never reach a street.
- **A pinned plot is drawn from its pin, and growing the catalogue moves nothing.** `plot.design` is read, never re-derived: no pick, no `Rng`, no look at the plot's shape. A city pinned against one version of the pack draws the same 123 buildings against a pack with a whole new look in it, where picking again moves 53 of them. A plot with no pin is picked for exactly as before, so every city exported before the pin renders as it always did.
- **A pin that cannot be honoured falls back; it never picks again.** Another pack's name, a model this copy no longer holds, or a shape the catalogue does not cover all hand the plot to the dressing behind. A kit building on a prefab street reads as a fallback, and a substituted prefab reads as the city the file describes, which is the failure worth being loud about.
- **What a pack is called is a fact about its bytes.** `catalogue.identity` is the pack name, its version and the sha256 of the manifest as read, so a reader comparing packs is comparing what it actually loaded. The manifest names the hash of all five binaries, so that one string covers the whole pack.
- Every picture the pack ships is stored losslessly, so adding a finish leaves every other finish pixel for pixel where it was. A palette is shared by the whole strip, and a shared palette makes one new door a change to every wall in the city.
- Every model declares what it suits as tags, and the pick keeps the models that share a word with the charter's `suits` before it draws. Where nothing in a shape claims the charter, the whole shape answers, so coverage stays provable and a word no look has heard of is never left bare. `suits(charters)` says which words that is, so a pack can be asked before a city is built against it.
- The catalogue covers every shape `@gb/world`'s `PLOT_BAND` cuts: frontage 3 to 6 cells by depth 5 to 8 by storeys 1 to 4, sixty-four shapes, eight looks in each, read in the door's frame through `plotShape`. A taller plot, a cell size that is not `METRICS.cellSize`, or a footprint outside that band is handed to the dressing behind, which is why `@gb/kitbash` stays load-bearing.
- Turning a model onto its plot is a swap and a sign flip, never a sine, so the same model lands on the same coordinates on every machine. Mirroring happens in the model's own frame before the turn, so the door stays put and only the facade swaps hands, and every triangle is wound back so it still faces out.
- Three materials for every prefab building in the city, and a building is never on more than two at once: near the player its walls and its glass, far off its shell. Which picture a face wears rides on its vertices as a layer index into an array texture, so `@gb/scene` puts the whole town into one buffer per material and draws each once. An array rather than an atlas because the producer's wall pictures tile across a wall, and only a layer of its own lets the sampler wrap one without bleeding into the picture next door.
- **The glass is the wall's own faces, and never in the pack.** Every pane is derived at load from the upright faces on the windowed layers, `PANE.stand` off the wall with the wall's uv, so the pane and the opening can never disagree, and the mesh file stays the walls alone.
- **The shell lights the same windows.** Near and far read one hash of one bay index, so a window that is lit on the skyline is lit when you walk up to it, in the same colour.
- Which layers have windows in them, and which one is a screen, come from the manifest's own list of finishes, so the runtime reads what the pack says rather than assuming it. A layer that is neither costs two comparisons and no texture fetch, and no layer is ever both.
- **A wall layer is a committed picture, and a look names one.** Two looks naming one picture share a layer, and a picture nothing names is not in the pack, so the strips never carry a wall nobody wears.
- **The entrance is one picture in two states.** Both layers come from `finishes/door.png`; only the glass, the threshold and the reader are relit, so the frame, the push bar, the pulls and the kick plate are the same pixels in the door that opens and the door that does not. The picture is its own mirror to the byte, because half the plots draw their model mirrored.
- **Nothing lit stands beside a door, and no advert sits over or beside one.** The only tube on a model is the one round its parapet; a banner ends at least one city cell short of the door and a board starts at least one above its head. Both are measured over every model in the pack test.
- **A base is its wall.** `base:<picture>` holds the same bytes as `wall:<picture>`, byte for byte in the strip, and is read at the wall's scale; only the windows differ.
- **A screen is the picture and nothing else.** Every plate's face spans exactly one picture in uv, the picture is cropped to the face and never stretched, and no frame is drawn round it.
- Everything the bay grid, the room raymarch, the pane and the screen use is an offset, a direction or a size in the surface's own frame, so `@gb/scene` batching a building into a shared buffer moves the vertices and leaves the room and the picture where they were.
- Nothing glows in daylight. The rooms, the screens, the neon and the street in the glass are the night level times what is behind the pane, which is the same `CityNight` the kit's windows and lamps read, so one `setTime` moves the whole street. By day the glass reflects the sky the app lights the city with.
- A panel's own uv spans exactly one wall picture, which is what makes the whole number the runtime reads back the plot's shift and nothing else. The pack test holds every plate's face to exactly that span, because a uv outside it would tear a second screen across one board and a uv short of it would leave part of the plate unlit.
- Signage keeps its material, its wall and its order. `@gb/kitbash` puts every sign in the city on one material and hands the plot's over as one mesh; this hangs it on the prefab, so a prefab street still has names over its doors and the town's signage is still one draw. What moves is where a fixture sits on the wall, and only onto the face the model really drew: a door lamp onto the drawn door, a plate onto the surface under it.
- **Nothing laid on a wall shares a plane with it.** Every flat sign stands `SIGN.stand` off the outermost face the model has over its own patch, so a nameplate on a fascia band, a board on a parapet and a strip on plain wall are each a real offset in front of a real surface rather than a depth trick. Measured over a generated town in `tests/fixtures.test.ts`.
- **A door lamp is bounded by the door that is drawn.** Both lamps straddle the drawn entrance at `DOORLAMP.beside` outside its frame and reach from `DOORLAMP.foot` to its head plus `DOORLAMP.overhead`, whatever the plot's own arithmetic put there. Measured over a generated town in `tests/fixtures.test.ts`, alongside the light each one throws.
- A shell stands in the same box as the building it stands in for, wearing the same pictures on the same faces, so the town keeps its shape as you walk up to it. Measured over a forged town in `tests/shell.test.ts`.
- Nothing a building only needs near the player is done for a shell: the street face is read the first time something is seated on it, and the whole town is opened without reading one.
- The pack is checked on the way in: all five binary files have to hash to what the manifest says and the mesh has to hold every model it names, or nothing loads. It is committed art, and the one thing standing between an edited pack and a city that quietly draws something else.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.

## What it costs

Measured headless in Node with `node tools/measure-city.ts`, a forged 4 by 4 block town (170 plots, every one on the pack), the way `@gb/scene` batches it:

| | walls | glass | shell |
|---|---|---|---|
| triangles a building | 203 | 14 | 203 |
| batches for the town | 1, near the player | 1, near the player | 1, every plot |

A prefab building averages 212 triangles in the pack (the balconies are 48 a storey on three looks) against a kit building's 10,855, measured over the same forged 20 block town. The pane is 14 more a building, derived, and the shell is the same 203 again in the far batch, where a building costs one instance. The kit stays loaded for the ground, the street surfaces, the lamps, the signage and any plot the catalogue has no shape for, but its wall materials are never drawn.

The shader bill near the player is two branches on every wall fragment and, on the fragments that are glass or screen, about thirty instructions and one texture fetch; the pane over an opening is the bay arithmetic again, one Fresnel and the standard model's environment lookup, blended. Far off it is the wall fetch and the bay arithmetic, with no fetch behind it.

### What a city costs to open

Measured headless in Node on forged towns at density 1 and four storeys, dressed the way the game dresses one, this box over `@gb/kitbash`, with the shell path and with the shell hidden so every plot is dressed whole at open (`node tools/bench-city.ts --blocks 50 --mode lod|whole`):

| blocks | plots | | open | in the dressing | shells | near buildings | draws | resident |
|---|---|---|---|---|---|---|---|---|
| 2 | 48 | shell | 77 ms | 21 ms | 48, 9,708 triangles | 22, 5,922 | 4 | 246 MB |
| 2 | 48 | whole | 77 ms | 20 ms | none | 48, 13,200 | 3 | 242 MB |
| 20 | 3,489 | shell | 704 ms | 195 ms | 3,489, 705,660 | 56, 15,660 | 4 | 517 MB |
| 20 | 3,489 | whole | 1,298 ms | 500 ms | none | 3,489, 950,724 | 3 | 604 MB |
| 50 | 20,233 | shell | 3,315 ms | 931 ms | 20,233, 4,098,780 | 50, 13,908 | 4 | 1,536 MB |
| 50 | 20,233 | whole | 7,474 ms | 3,065 ms | none | 20,233, 5,523,676 | 3 | 2,010 MB |

A 50 by 50 block city is 20,233 plots, every one of them on the pack. It opens in 3.3 seconds and stands as 4.1M triangles in four draws: one batch holding the whole town's shells, and the walls, the glass and the signage of the 50 buildings inside `DETAIL_RADIUS`. Of the open, 0.9 s is this box and the rest is `@gb/scene` batching, laying the ground and strewing the streets.

What the shell path buys at that size is the 2.3x on the open, 1.4M fewer triangles standing, the room raymarch and the pane gone from every building but the near ones, and the emitters of 20,183 buildings never made at all. The same town dressed by the kit alone, which is what the plots the pack has no shape for fall back to, is 215.9M triangles and 27 GB (`--dressing kit`): the pack is what makes a city this size drawable.

**A layer is 0.35 MB resident with its mips, and a finish is one layer in each of the two facade strips.** The pack is 23 finishes (7 wall pictures twice, 2 doors, the screen plate, the glazing, 4 tubes, the balustrade), 14 rooms and 6 screens: 66 layers, 23.1 MB. On disk the six files are 5.9 MB.

## Standing it up

```ts
const library = loadKit(gltf.scenes, world.theme)
const kit = new KitDressing(library, new Greybox())
const prefab = await loadPrefab(library.night)
const dressing = new PrefabDressing(prefab, kit)
// every plot's shell at open, the walls and glass of the near ones as the player moves
scene.add(buildCity(world, dressing).root)
scene.add(kit.streetlights(world))
// after a plot is built: where its light comes from, for whoever draws the lights
const emitters = dressing.lights(plot, size, world.charter(plot.kind)!)
// every frame, or whenever the hour changes: one call moves both
kit.setTime(player.clock.hour + player.clock.minute / 60)
```

Once, when a city is made, whoever holds both the world and the catalogue writes
the design into the file. The catalogue first, because a design has to name one
the city has recorded:

```ts
const catalogue = prefab.catalogue // headless: await Catalogue.read(await readFile(PACK_MANIFEST))
world.recordCatalogues([catalogue.identity])
for (const plot of world.plots()) {
  const size = { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: heightOf(plot.storeys) }
  const design = catalogue.design(plot, size, world.charter(plot.kind)!.suits)
  if (design) world.recordDesign(plot.id, { pack: catalogue.pack, ...design })
}
```

The size is the one `@gb/scene` hands `building`, and it has to be, or the pin
names a model of a different shape than the plot it stands on. `design` reads
`width` and `depth` and never `height`, because the storey count already comes
off the plot, so a headless caller with only the footprint gets the same answer;
the recipe carries `height` anyway so it is the same object `building` takes.
`@gb/bundle` takes the same `catalogue.identity` as its `requires`.

## How to modify this blackbox safely

Adding a look is a new file in `looks/` and a rebuild; it grows every shape at once and changes what some plots already draw, so bump the pack version with it. Giving a look balconies is one `balcony` field and a rebuild. Changing what a look suits is its `tags`, `node tools/retag-buildings.ts` and a version bump, with no producer run. Changing what a look wears is that one file: its `facade` field names a picture in `finishes/`, and naming one another look already wears costs nothing while naming a new one adds two layers, the wall and its base. A picture nothing names is not in the pack. Which shapes the catalogue covers is `@gb/world`'s `PLOT_BAND`, read by `src/bucket.ts`; a change there is a rebuild, and the coverage test will tell you what the forge is actually cutting. How far trim may stand off a plot is `src/fit.ts` alone, how hard a lit face burns is `GLOW` in `src/pack.ts`, which producer material lands on which layer is `tools/layers.ts`, and the scale a base is read at is `BASE_TILE` in `src/wall.ts`, which the producer is told and the shader stretches to.

How a window is laid out and how deep the room behind it runs are the two `WindowKind`s in `src/windows.ts`, and `tools/finishes.ts` reads the same two into the grid the producer is told, so a change to a grid moves the picture with it and a rebuild is needed; a change to `deep` does not. How the bay is cut is `src/bays.ts`, read by the room, the glass and the shell alike. How bright a room burns and how dark its folded faces are is `src/interior.ts`; what colours it is lit in is `ROOM_TINTS` in `src/rooms.ts`, which the shell reads too. How far the glass stands off the wall, how sharp its reflection is and what it reflects face on are `PANE` in `src/glass.ts`, and what it catches of the street after dark is `STREET` beside it; none of that needs a rebuild, because the panes are derived at load in `src/panes.ts`. What a far building keeps is `src/shell.ts`, and what a town of them costs to open is `node tools/bench-city.ts`, which loads the pack the way every headless tool and test here does, through `tools/headless.ts`. A balcony is `balcony` in a look, built by `tools/balconies.ts` and held to `BALCONY` in `src/balcony.ts`, and the pack test measures every one; changing any of it is a rebuild. What a building throws onto the street is `src/lights.ts` alone: the lobby's colour and candela, a screen's candela, and how far off a face an emitter stands. What the street face is read as, and how the fascia band is told apart from a balcony slab, is `src/face.ts`; where a fixture the kit wrote is seated on it is `src/fixtures.ts` alone, and `node tools/measure-fixtures.ts` prints what a forged town lands at. Neither needs a rebuild: both read the geometry the plot is drawn with. Adding or replacing a room is a new prompt in `rooms/prompts/`, one image through the Grok route in `tools/textures/README.md`, an entry in `ROOM_PICTURES` in `src/rooms.ts` inside the run its bank covers, `node tools/draw-rooms.ts <folder of raw images>` to crop and size whatever raw images are in that folder, and a rebuild. A bank is a run of the strip, so a room added to the upper bank moves the street bank's `first` with it.

What an entrance looks like is `finishes/door.png` and, over it, `DOOR` and `ENTRANCES` in `tools/doors.ts`, and a rebuild. `DOOR` is where the glass, the threshold and the reader sit in that picture, so replacing the picture means re-reading those rectangles off its own row and column profiles; `ENTRANCES` is the only thing that tells the two doors apart, and adding a third would be a name in `Layers.of` and an entry beside them. A replacement picture has to be its own mirror and has to read shut, and the pack test holds it to the first. The screen plate is painted with `Picture` in `tools/paint.ts`, which also relights a photograph through `lift` and holds the one conversion between what a glow map stores and what the runtime multiplies it back by. A screen is three places and they do not overlap: what a panel is made of and how the lamp grid behaves are `SCREEN` and the constants beside it in `src/display.ts`, which needs no rebuild; what the pictures show is the compositions in `tools/screens.ts`, which does; and where a screen goes is `BOARD`, `BANNER`, `CLEAR` and `displays()` in `tools/stack.ts` plus the `displays` list in a look, which does. A name in `SCREEN_PICTURES` is drawn if `POSTERS` in `tools/screens.ts` has a composition for it and read from `screens/<name>.png` if it does not, so replacing a drawn one with a picture is deleting its composition and dropping the file in.

A new finish goes at the **end** of `Layers.of` in `tools/layers.ts`. The layer index rides on the vertices of every model in the pack, so a finish inserted anywhere else renumbers the whole mesh; appended, the mesh comes out of a rebuild byte for byte identical and only the two strips and the manifest change. The wall layers and their bases are first and come from the looks, so giving a look a picture no other look wears renumbers everything after it, which is a rebuild and a version bump rather than a hazard. How every picture is written is `PNG` in `tools/paint.ts`, and it is lossless on purpose: turn palette quantisation back on and one new finish moves the pixels of every other one.

The pack's six files are committed art: never hand-edit them, because the manifest's hash is what the loader checks. Rebuild with `node tools/build-buildings.ts`, which is byte for byte reproducible on one machine, or retag with `node tools/retag-buildings.ts` when only the tags moved, and bump `VERSION` in `tools/manifest.ts` whenever the bytes change. Run `pnpm --filter @gb/prefab test`.
