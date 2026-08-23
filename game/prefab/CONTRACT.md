# @gb/prefab contract

contractVersion: 0.4.0

## Purpose

Dresses a plot with the whole building its world file names, out of one committed pack, and picks one when the file names none: the footprint it was given, the height its storeys ask for, its entrance on the wall the door faces, lit if you can walk in, and a front that reads as the kind of place it is. Its windows are cut out of the wall in the shader and look into photographed rooms that light up after dark, and the commercial fronts carry lit screens over the street. Every building in the city is drawn with one material, so a town of any size is one draw.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new PrefabDressing(library, rest)` | a `Library`, and the `Dressing` behind it | `rest` answers for anything the pack has no shape for, so it should be a real kit rather than a greybox |
| `PrefabDressing.building(plot, size)` | a `@gb/world` `Plot`, `{ width, depth, height }` in metres | the size matches the plot, and the world's cell size is 2 m |
| `loadPrefab(night)` | a `@gb/kitbash` `CityNight` | the pack’s six files are served beside the box; in a bundler they are followed from `src/load.ts` |
| `Library.of({ catalogue, scenes, atlas, night })` | a `Catalogue`, the pack's parsed scenes, a `PrefabAtlas`, a `CityNight` | for tests and for anyone loading the pack themselves |
| `new InteriorWindows(rooms, night, finishes)` | the room strip as a `DataArrayTexture`, a `CityNight`, the pack's list of finishes | the finishes in the order the two facade strips stack them |
| `new WallScreens(screens, finishes)` | the screen strip as a `DataArrayTexture`, the same list of finishes | |
| `windowsOn(finish)`, `glassShareOf(kind)` | a finish name, a `WindowKind` | |
| `Catalogue.parse(value)` | [pack/buildings.json](pack/buildings.json) | any untrusted JSON |
| `Catalogue.read(manifest)` | the same file's own bytes | any untrusted bytes. The hash it takes of them is the pack's identity |
| `catalogue.design(plot, size)` | as `building` | |
| `designFor(catalogue, plot, size)` | a `Catalogue` and as `building` | |
| `catalogue.covers(demand)` | any list of `Bucket`s | |
| `bucketOf(plot, size)` | as `building` | |
| `orient(geometry, turns, mirror, rooms?)` | a pack geometry, 0 to 3 quarter turns, whole pictures to slide the rooms along | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `building(plot, size)` | `THREE.Object3D` | origin at the centre of its base, facing north unturned; one mesh on the one prefab material, plus the signs the dressing behind would have hung. The model is the one `plot.design` names, or the pick when it names none, and a plot with an interior wears the entrance you can walk through. A plot the catalogue has no shape for, and a pin this pack cannot honour, come back from `rest` untouched |
| `loadPrefab(night)` | `Library` | the pack, checked against its own manifest |
| `Library.geometry(id)` | `THREE.BufferGeometry` | the model in its own frame, door on the south wall, one metre to one unit |
| `Library.material` | `THREE.Material` | the single material every prefab building in the city is drawn with, named `MATERIAL_NAME` |
| `Catalogue.models` | `ModelSpec[]` | every model in the pack, sorted by id |
| `catalogue.design(plot, size)` | `{ model, mirror, rooms }`, or undefined | which building this plot gets, which way round, and where along the wall its rooms start. Undefined means the catalogue has nothing this shape. This is the pick, which is what a world file records |
| `designFor(catalogue, plot, size)` | the same | what the plot is actually drawn with: `plot.design` if it carries one, the pick if not, undefined if the pin cannot be honoured |
| `catalogue.identity` | a `@gb/world` `AssetPackRef` | pack, version, and the sha256 of the manifest, for the `world.catalogues()` a city is pinned against. No hash when the catalogue came from a parsed value rather than bytes |
| `catalogue.bucket(bucket)` | `ModelSpec[]` | every model of that shape, in id order |
| `catalogue.covers(demand)` | `{ ok: true }` or `{ ok: false, missing }` | which shapes the catalogue has no building for |
| `catalogue.kindsCovered()` | `BuildingKind[]` | every trade some look claims |
| `bucketOf(plot, size)` | `Bucket` | `{ front, depth, storeys }` in metres, read in the door's frame |
| `everyBucket()`, `FRONTS`, `DEPTHS`, `STOREYS` | the shapes a catalogue is expected to hold | |
| `heightOf(storeys)` | metres | the height `@gb/scene` puts the plot at |
| `orient(geometry, turns, mirror, rooms?)` | `THREE.BufferGeometry` | the model turned onto its plot, wound to face out, its uv slid a whole number of pictures along |
| `turnsFor(facing)` | 0 to 3 | quarter turns that put a south door on that wall |
| `prefabMaterial(atlas, night)` | `THREE.Material` | the material, for anyone building a library by hand |
| `SCREEN`, `SCREEN_PICTURES`, `SCREEN_SIZE`, `DISPLAY_FINISH` | how a screen is built, the pictures it draws from, their size, and the finish a panel wears | |
| `DOOR_FINISH`, `OPEN_DOOR_FINISH` | two finish names | the entrance of a building nobody can walk into, and of one you can |
| `PACK_MANIFEST` | a URL | the committed manifest, for a headless caller that needs the pack's identity without a renderer |
| `PROUD`, `HEIGHT_TOLERANCE`, `GLOW`, `LAYER_ATTRIBUTE`, `MATERIAL_NAME` | metres, a multiplier and two names | how far trim may reach past the plot, how exact a wall has to be, how hard a lit face burns, and the two names the pack is written with |

## Errors (closed set)

- `invalid-catalogue`: the manifest failed its schema. Thrown as `InvalidCatalogue`, carrying `violations`.
- `pack-changed`: one of the pack's five binary files does not hash to what the manifest says. Thrown as `PackChanged` from `loadPrefab`, carrying `file`, `expected` and `found`. The pack is committed bytes; a pack edited under the game refuses to load rather than quietly drawing a different city than the seed says.
- `library-incomplete`: the mesh file is missing a model the manifest names. Thrown as `LibraryIncomplete`, carrying `missing`.

A plot the catalogue has no shape for is not an error: `building` hands it to the dressing behind.

## Dependencies

- `@gb/scene` contract: the `Dressing` seam this implements, and `storeyHeight`.
- `@gb/kitbash` contract: `CityNight`, so one clock lights the prefabs and the kit together, and `SIGN`, which names the material every sign in the city is drawn with.
- `@gb/world` contract: `Plot`, `BUILDING_KINDS`, `AssetPackRef` and `PlotDesign` (the pin a plot carries), and `plot.interiorId`, which is exactly the set of doors that open.
- `@gb/kit` contract: `Rng` for the pick, `contract` for the manifest.
- `three`, `three/webgpu` and `three/tsl`: the building material is a node material, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself.
- The art: [pack/](pack/), built offline by `tools/build-buildings.ts` from the looks in [looks/](looks/), the wall pictures in [finishes/](finishes/), the rooms in [rooms/](rooms/) and the screens in [screens/](screens/), through the repo owner's own `glb-buildings` CLI (MIT). The producer is not a dependency of the game: it is shelled out to from `tools/`, and nothing it uses reaches the runtime.

## The pack

Six committed files, and they are the whole art supply.

- `pack/buildings.glb`, 3.1 MB: 512 models, one mesh each, all on one material, welded, quantized and meshopt-packed.
- `pack/buildings-colour.png` and `pack/buildings-emissive.png`, 498 kB and 11 kB: sixteen 256 px layers stacked into a strip each, the surface a face is painted and the part of it that glows.
- `pack/buildings-rooms.png`, 896 kB: fourteen 256 px rooms in the same shape, the pictures every window in the city looks into.
- `pack/buildings-screens.png`, 574 kB: six 256 px pictures in the same shape, what the lit panels on the walls carry.
- `pack/buildings.json`, 159 kB: the manifest. Pack id, version, the producer commit, the sha256 of all five binaries, what each atlas layer paints, and one entry per model: its shape, the trades it suits, its triangle count and where its door is. Its own sha256, taken over these bytes, is the pack's identity, and it covers the other five through the hashes it lists.

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
- **A plot without one is picked for, exactly as before.** That is every city
  exported before the pin existed, and they render as they always did.
- **A pin this pack cannot honour falls back to the dressing behind.** Three
  ways it happens: `design.pack` names a catalogue that is not this one, the
  pack has been grown and no longer holds that model, or the shape is not one
  this catalogue covers. All three draw a kit building, and none of them picks
  a different prefab. A kit building on a prefab street reads as a fallback; a
  quietly substituted model reads as the city the file describes, which is the
  failure worth being loud about.

Writing the pin is the job of whoever holds both the world and the catalogue,
because the generator never sees the art. It is two calls: `catalogue.identity`
into `world.recordCatalogues`, then `catalogue.design(plot, size)` into
`world.recordDesign` for every plot, in that order, since a design has to name
a catalogue the city has already recorded.

## What a wall wears

Two tiers, and the split is the whole reason a building is a couple of hundred triangles.

**Above the street level a bay is a bay of curtain wall.** Three panes by two, in a surround, with an office or a flat behind them. A whole storey is still eight triangles: the wall picture is only the pier and the spandrel, and the opening, the mullions and the room are all cut out of it in the fragment shader.

**The street level is specific.** One wide pane in a heavy surround with a shop behind it, an entrance, a fascia band over it and tubes across the frontage. It is the only part anybody stands in front of, and on the one building in eight that opens it is where the way in is.

The wall pictures are **committed art**, in [finishes/](finishes/), read by `tools/finishes.ts`: four families, one picture each, and a look belongs to one of them, plus the one surround every family wears at street level. What a picture carries is the surface around the window, which is the part a photograph is better at than arithmetic: panel courses, casting marks, staining, wear. A wall picture covers four bays by two floors at 256 pixels, which is about 21 pixels a metre, and a mullion is three centimetres, so a drawn one would be a fifth of a texel; the opening, the bars and the room are all cut out of it in the shader instead.

Each one tiles. A wall runs several pictures across and several up, so a seam would repeat over the whole building; the pack test measures the join against what one step inside the picture costs and refuses anything worse.

They are handed to the producer through `add-texture`, which is the verb that names the file, pairs the glow map and records the grid the picture holds. That grid is what fixes the uv scale the shader reads a bay off, so the two have to agree; both take it from the same `WindowKind`.

## Windows, and the rooms behind them

A window is not in the picture. `src/interior.ts` marches the view ray through the box behind each bay and samples a photographed room on whichever face of it the ray meets, so a facade has depth through it from the pavement instead of a lit rectangle. The technique is interior mapping. `@gb/kitbash` does the same for the kit's modelled panes and carries the room on the vertices, because it has vertices to carry it on; here a storey is eight triangles and there are none to carry anything.

- **It costs no geometry, no draw and no vertex.** What a fragment needs is where it sits in the picture, which the uv already says, and how many metres wide a bay is, which the surface's own derivatives already say. The metre scale is read off the surface rather than assumed, so a bay is the size it really is however the producer stretched the picture onto that wall, and a mirrored building comes out right.
- **The bay is the room.** The picture tiles, so the bay index runs on along the wall and never repeats with the picture: the pattern of which windows are lit does not repeat every twelve metres the way a painted one did.
- **Fourteen rooms, in two banks.** Eight for above the street (two offices, a server room, two flats, a bedroom, a corridor, a store room) and six for the pavement (a bar, a noodle counter, a shop, a clinic, a workshop, a lobby). A window under `4.6` m looks into the street bank. Each is seen small, through glass, at an angle, after dark, and never twice side by side, and each is tinted by one of eight light colours and mirrored or not, so fourteen pictures cover a city.
- **Which room a bay looks into is a pure function of where the bay is.** The bay index is hashed for the room, its light colour, whether it is mirrored and its key. There is no `Rng` and no frame state on this path, so a building draws the same rooms on every machine and every run. Two plots that drew the same model start at different bays: `catalogue.design` gives each plot a whole number of pictures to slide its uv along, which the picture tiles through and the hash does not.
- **A room is lit while the city's lit share is above its key**, the same rule `@gb/kitbash` uses, so the same rooms come on in the same order every night and none of them flickers. A shopfront takes about a third of the key an office does, because a street of shops is lit and a street of offices is not.
- **The picture belongs on the back wall.** The floor, the ceiling and the side walls sample the row or the column of it they meet, taken well down, so what would have been a smear reads as a surface out of the light. A pane seen along the street catches a fixed cool sheen instead, because at that angle a shop window is a smear of wet road under neon rather than a view of the shop.
- **The grid melts rather than aliases.** The opening and the mullions are feathered by how much of the picture one pixel covers, and once that is more than a mullion the bay fades to the share of itself that is glass, which is what a mip of a drawn one would have done.
- **A band under 1.6 m gets no windows.** A one storey building carries a 0.8 m parapet on the same finish as its wall, and a window squashed into that is not a window.

The room pictures are generated, not drawn: a prompt each in [rooms/prompts/](rooms/prompts/), one image through the Grok route in `tools/textures/README.md`, cropped and sized by `tools/draw-rooms.ts` and committed as `rooms/*.png`. They are ours, from our own prompts, so they travel inside a world file. Nothing in the build calls a model: it stacks the committed pictures. `draw-rooms` takes whatever raw images are in the folder it is pointed at, so a new room arrives on its own and the ones already committed are not redrawn to take it.

## The entrance

A door is the surface a player stands closest to, and since only about one building in eight opens, most of them are a door nobody will ever use and still the nearest thing on the street. It is drawn in `tools/doors.ts` rather than photographed: rectangles in shares of the leaf, which the producer stretches over whatever door the look asked for, so one plate fits every door in the city at the size it really is.

- **A pair of glazed leaves in a frame**, with a lit fanlight over them, a meeting stile down the middle, a pull either side of it, a lock rail and a kick plate under the glass, a lit threshold at the pavement and an entry panel with three lit marks on the frame.
- **It is symmetric on purpose.** Half the plots in a city draw their model mirrored, and a single leaf with its handle on one side would swap hands with the building. A pair reads the same both ways round. It also covers the range the looks ask for, 1.4 m to 2.6 m wide, where one leaf at the top of that range is a cupboard door.
- **The lobby is what you see.** The glazing ramps from dark at the head to lit at the sill, so the light reads as coming from inside rather than painted on. Everything else on the leaf is dark against it: a pull is a bar in silhouette, which is what a pull is at night.
- **The reveals wear the frame.** The producer wraps the leftmost twenty-fifth of the picture round the four edges of the plate, so the frame is drawn wider than that and an edge comes out frame-coloured rather than carrying a slice of glass.
- **The door you can use has its lights on.** The pack carries the entrance twice, on two layers: the same frame, the same leaves, the same pulls, with the lobby a lit warm surface rather than dark glass, the fanlight and the threshold burning about three times as hard, and the reader's three marks green instead of cool white. Most of the city does not open, so what has to carry from across the street is light on the pavement, and it has to carry by day as well, when nothing in the city glows, which is why the lit lobby is a lighter surface and not only a stronger glow.
- **Which one a building wears comes from `@gb/world` and nowhere else.** `plot.interiorId` is exactly the set of doors that open, checked in both directions by that box, so there is no second field to disagree with. The dressing moves the plot's door faces onto the lit layer on the copy of the geometry `orient` has already made for it: no geometry, no draw, no second material, and a plot without an interior is untouched. Nothing is ever baked onto the lit layer, so growing the pack cannot put a lobby light on a building that has no way in.

## The screens on the walls

> "You will also see displays like projected over those buildings. Those are basically images with some kind of effect. You will see, like, pixels or something like that."

A screen is a flat panel the producer stands on the wall, twelve triangles, on the same material as the wall behind it. Everything that makes it read as a screen rather than a poster is in `src/display.ts`.

- **The lamp grid is the whole trick.** An outdoor board is a field of lamps five centimetres apart, so close up a picture on it is dots and from across the street it is a picture. That is arithmetic off the surface's own derivatives, feathered by a pixel's footprint, and past the point where one pixel covers a pitch it melts to the share of the pitch that is lamp, divided back out so the panel holds the brightness it was authored at however far away it is read from.
- **The housing is metric, not fractional.** The lit face is inset 12 cm from the panel on every side, measured in metres off the surface, so a wide board and a tall banner wear the same frame. It also keeps the picture off the four edges of the plate for free: they are the depth of it, 11 cm, which is inside the bezel whichever way they run.
- **A line of light runs inside the housing.** Cool, 3.5 cm, and it is what gives a panel its shape once the picture has gone to bloom.
- **Two shapes, authored per look.** A `board` across the parapet storey, read from the far pavement, and a `banner` beside the entrance, read from the pavement. Four of the eight looks carry one or both: the corpo slab, the tower, the shop and the bar. A board is measured against the parapet's own face, so a look that steps its top storey back has that much less wall to hang one on, and it is left off a one storey building, whose parapet is 0.8 m.
- **A board costs its storey's windows.** The producer swaps a band's bay-and-floor picture for the plain wall as soon as anything is composed on it, because a window drawn in the middle of every bay is exactly where a composed element lands. So a parapet storey with a board on it wears the family's base finish, which is that same plain wall at the same tile.
- **Which picture a panel carries is the plot's own uv shift.** `catalogue.design` already gives every plot a whole number of wall pictures to slide along; a panel's own uv spans exactly one picture, so the whole number read back in the shader is that shift, exactly, and it is the same for every fragment of the panel. So a plot's screen is a pure function of the plot, two plots on one model need not carry the same one, and no screen changes halfway across itself.
- **Most of the way to square.** A square picture on a panel that is not gets stretched the rest of the way rather than letterboxed: 60% of the crop a strict fit would take, so a board shows most of its composition at a stretch nobody reads as one.
- **Five are committed pictures, one is drawn.** The pictures live in [screens/](screens/), ours from our own prompts, so they travel inside a world file; the sixth is a composition in `tools/screens.ts`, a ground with the bright mass the eye lands on and one hard graphic against it. Both go through the same exposure, normalised to what a picture's brightest half a percent reaches, so a row of adverts where one is twice as bright as the next cannot happen. The drawn one also gets a broad key light and its ground pushed well under the highlight, which a photograph already has. Nothing on them spells anything: text out of an image model garbles, and the words in this city are `@gb/kitbash`'s, which draws every letter over every door from a stroke font.
- **No hologram.** Additive, semi-transparent, nothing behind it: that is a second material and a sorted transparent pass, which is a second draw for every prefab building in the city, and one material for the whole town is the design this box is built on. The bright board plus the app's bloom carries the reference, which is itself a lit panel with a halo the renderer made.

## How a catalogue is made

A model writes a **look** by hand, offline, once: a small JSON saying what a building of that kind wears, with no reference to how big it is. Eight of them live in [looks/](looks/) and they are about fifteen lines each.

`tools/build-buildings.ts` replays every look at every shape the city cuts. That is 8 looks by 64 shapes, 512 models, in about two minutes of wall clock and no model time at all. Each one is driven through the `buildings` CLI verb by verb, the way its own skill says to drive it, in a throwaway home of its own.

What comes back is measured before it is allowed in, and the refusals are named:

- `wrong-height`: the walls are not exactly `4 + (storeys - 1) * 3.2` m tall, to the millimetre.
- `overhangs`: something reaches more than `PROUD` past the plot, in any direction.
- `faces-wrong-way`: the door is not on the south wall, which is the wall the runtime turns onto the street.
- `absolute-path`: a texture or a buffer points at a file on the machine that built it.
- `placed-crooked`: a band is turned or scaled rather than lifted.
- `unknown-finish`: the model wears something the pack has no layer for, which is how a balcony, a pipe or a mast is kept out.

The `cyber` style stands a lattice mast and its guys on every roof, taller than any building the forge cuts. Anything rising past the relief budget is left out before the model is measured, so the mast comes off without touching the producer.

Then the whole pack is read back the way the game reads it and measured again, because welding and quantization happen after the gates and the promise is about the committed bytes.

Run it with `node tools/build-buildings.ts`. It needs `glb-buildings` beside the checkout, or `GLB_BUILDINGS` pointing at it.

## Invariants

- One world unit is one metre. A model is baked at its plot's exact footprint and height and is never scaled, so its windows are the size they were drawn.
- A building is exactly as tall as the city says its plot is. Only lit trim reaches past that, and only by `PROUD` (0.2 m): a neon tube and the bracket it stands on, sideways at the shopfront and upwards at the parapet. Plots in a block abut, so a building already shares its relief with the one next door; `@gb/kitbash` reaches 5 cm with its window trim and 8 cm with a flat sign, and this is the same arrangement one step louder. Nothing hangs out over the street the way a kit blade sign does.
- **Same seed, same city, forever, whether or not a model is running.** The pick is a pure function of the plot and the committed pack: an `Rng` on the plot's own id, kind and style, forked per feature, drawing from no shared stream, so dressing one plot can never move another. Nothing on this path but the world file, the pack and three.js. Not the language model, not the sidecar, not the producer, not `@gltf-transform`.
- The pick chooses from members sorted by id, so what order the manifest happens to list them in can never reach a street.
- **A pinned plot is drawn from its pin, and growing the catalogue moves nothing.** `plot.design` is read, never re-derived: no pick, no `Rng`, no look at the plot's shape. A city pinned against one version of the pack draws the same 123 buildings against a pack with a whole new look in it, where picking again moves 53 of them. A plot with no pin is picked for exactly as before, so every city exported before the pin renders as it always did.
- **A pin that cannot be honoured falls back; it never picks again.** Another pack's name, a model this copy no longer holds, or a shape the catalogue does not cover all hand the plot to the dressing behind. A kit building on a prefab street reads as a fallback, and a substituted prefab reads as the city the file describes, which is the failure worth being loud about.
- **What a pack is called is a fact about its bytes.** `catalogue.identity` is the pack name, its version and the sha256 of the manifest as read, so a reader comparing packs is comparing what it actually loaded. The manifest names the hash of all five binaries, so that one string covers the whole pack.
- Every picture the pack ships is stored losslessly, so adding a finish leaves every other finish pixel for pixel where it was. A palette is shared by the whole strip, and a shared palette makes one new door a change to every wall in the city.
- Every model declares which trades it suits, and the pick filters on that before it draws. Where nothing in a shape claims the trade, the whole shape answers, so coverage stays provable and a chapel is never left bare.
- The catalogue covers every shape the forge can cut up to four storeys: four street frontages by four depths by four storey counts, sixty-four shapes, eight looks in each. A taller plot, a cell size that is not 2 m, or a footprint outside that range is handed to the dressing behind, which is why `@gb/kitbash` stays load-bearing.
- Turning a model onto its plot is a swap and a sign flip, never a sine, so the same model lands on the same coordinates on every machine. Mirroring happens in the model's own frame before the turn, so the door stays put and only the facade swaps hands, and every triangle is wound back so it still faces out.
- One material for every prefab building in the city. Which picture a face wears rides on its vertices as a layer index into an array texture, so `@gb/scene` puts the whole town into one buffer and draws it once. An array rather than an atlas because the producer's wall pictures tile across a wall, and only a layer of its own lets the sampler wrap one without bleeding into the picture next door.
- Which layers have windows in them, and which one is a screen, come from the manifest's own list of finishes, so the runtime reads what the pack says rather than assuming it. A layer that is neither costs two comparisons and no texture fetch, and no layer is ever both.
- Everything the room raymarch and the screen use is an offset, a direction or a size in the surface's own frame, so `@gb/scene` batching a building into a shared buffer moves the vertices and leaves the room and the picture where they were.
- Nothing glows in daylight. The rooms, the screens and the neon are the night level times what is behind the glass, which is the same `CityNight` the kit's windows and lamps read, so one `setTime` moves the whole street.
- A panel's own uv spans exactly one wall picture, which is what makes the whole number the runtime reads back the plot's shift and nothing else. The pack test holds every vertex on the screen layer to that range, because a uv outside it would tear a second screen across one board.
- Signage stays where it was written. `@gb/kitbash` puts every sign in the city on one material and publishes its name; this lifts those meshes off the kit's building and hangs them on the prefab, so a prefab street still has names over its doors and the town's signage is still one draw.
- The pack is checked on the way in: all five binary files have to hash to what the manifest says and the mesh has to hold every model it names, or nothing loads. It is committed art, and the one thing standing between an edited pack and a city that quietly draws something else.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.

## What it costs

Measured in Chrome on the WebGL2 fallback at 1568 by 764, looking down a street of a 4 block city (174 plots, 4 by 4 blocks, density 1, 21:30, wet), against the same city dressed in the Downtown kit alone:

| | the kit | the pack |
|---|---|---|
| batches the buildings draw in | 5 | 1, plus the shared sign batch |
| triangles in the building buffers | 2,209,476 | 39,300 |
| the scene's vertex and index buffers | 141.9 MB | 6.3 MB |
| triangles submitted at the camera | 318,703 | 45,939 |
| draw calls at the camera | 38 | 34 |
| textures resident | 119.6 MB over 50 | 69.1 MB over 33 |
| textures the buildings bring | none of their own | 16.8 MB |

A prefab building averages 223 triangles against a kit building's 12,700, and more than half of those are the neon tubes. The kit stays loaded for the ground, the street surfaces, the lamps, the signage and any plot the catalogue has no shape for, but its wall materials are never drawn, so the resident texture comes down even though the pack brings 16.8 MB of its own.

The shader bill is two branches on every prefab fragment and, on the fragments that are glass or screen, about thirty instructions and one texture fetch. Everything a facade used to be is still one fetch of the wall picture.

### What the entrances and the screens cost

Measured back to back on the same fallback, standing across the street from a three storey corpo front in the same city, against the pack immediately before this change:

| | before | after |
|---|---|---|
| batches the buildings draw in | 1 | 1 |
| triangles in the building buffers | 37,848 | 39,300 |
| draw calls at the camera | 56 | 56 |
| triangles at the camera | 122,139 | 123,387 |
| textures resident | 66.3 MB over 32 | 69.1 MB over 33 |
| textures the buildings bring | 14.0 MB over 40 layers | 16.8 MB over 48 |

**The entrance costs nothing.** It replaced the picture on a layer the pack already had, so not a byte and not a triangle.

**A screen costs 12 triangles where it hangs and 0.35 MB where its picture is stored.** The finish itself is one more layer in each of the two facade strips, 0.70 MB paid once for the whole city; each picture is 0.35 MB with its mips. Six of them plus the housing is 2.8 MB, and the panels are 6.8 triangles on an average building, which is what takes it from 217 to 223.

That is where the budget now stands. A layer is 0.35 MB with its mips; the wall finishes are 32 of them (11.2 MB) and the pictures are 18 (6.3 MB), so the buildings still pay more for their surfaces than for what is behind and on them. Six screens is where it stopped: twelve would draw level with the walls, and a seventh screen buys less than a seventh room did, because a screen is cropped differently by every panel it lands on and a room is not.

### What the door you can walk through costs

**0.70 MB resident, and nothing else.** It is one more layer in each of the two facade strips, which takes the pack from 16.8 MB over 48 layers to 17.5 MB over 50, and the scene's resident texture from 69.1 MB to 69.8 MB over the same 33 textures. No geometry, no draw call, no second material, no triangle: the swap rewrites one vertex attribute on the copy of the geometry `orient` already makes for that plot, which is a pass over a few hundred numbers once, when the building is built. On the download it is about 5 kB of PNG.

The pack's own bytes went from 3.83 MB to 4.34 MB in the same change, and the extra half megabyte is storing every picture losslessly rather than at 256 colours, not the door.

Two more rooms landed beside it, so the pack is now 52 layers and 18.2 MB resident, and the scene 70.5 MB over 33 textures. On disk it is 5.07 MB, of which the mesh is 3.09 MB and the rest is the four strips: the photographic rooms and screens are most of the growth, and neither costs the GPU anything a drawn one did not.

## Standing it up

```ts
const library = loadKit(gltf.scenes, world.theme)
const kit = new KitDressing(library, new Greybox())
const prefab = await loadPrefab(library.night)
scene.add(buildCity(world, new PrefabDressing(prefab, kit)).root)
scene.add(kit.streetlights(world))
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
  const size = { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize }
  const design = catalogue.design(plot, size)
  if (design) world.recordDesign(plot.id, { pack: catalogue.pack, ...design })
}
```

The size is the one `@gb/scene` hands `building`, and it has to be, or the pin
names a model of a different shape than the plot it stands on. `@gb/bundle`
takes the same `catalogue.identity` as its `requires`.

## How to modify this blackbox safely

Adding a look is a new file in `looks/` and a rebuild; it grows every shape at once and changes what some plots already draw, so bump the pack version with it. Changing what a look wears is that one file, and what the wall around a window is made of is a picture in `finishes/`, read by `tools/finishes.ts` alone. Changing which shapes the catalogue covers is `src/bucket.ts` and a rebuild, and the coverage test will tell you what the forge is actually cutting. How far trim may stand off a plot is `src/fit.ts` alone, how hard a lit face burns is `GLOW` in `src/pack.ts`, and which producer material lands on which layer is `tools/layers.ts`.

How a window is laid out and how deep the room behind it runs are the two `WindowKind`s at the top of `src/interior.ts`, and `tools/finishes.ts` reads the same two into the grid the producer is told, so a change to a grid moves the picture with it and a rebuild is needed. How bright a room burns, how dark its side walls are and what colours it is lit in are the constants beside them, and none of those needs a rebuild. Adding or replacing a room is a new prompt in `rooms/prompts/`, one image through the Grok route in `tools/textures/README.md`, an entry in `ROOM_PICTURES` in `src/rooms.ts` inside the run its bank covers, `node tools/draw-rooms.ts <folder of raw images>` to crop and size whatever raw images are in that folder, and a rebuild. A bank is a run of the strip, so a room added to the upper bank moves the street bank's `first` with it.

What an entrance looks like is `DOOR`, `DOOR_TONES` and `ENTRANCES` in `tools/doors.ts`, and a rebuild; `ENTRANCES` is what tells the two doors apart, and adding a third would be a name in `LAYERS` and a picture beside them. Both the doors and the screen housing are painted rectangle by rectangle with `Picture` in `tools/paint.ts`, which also holds the one conversion between what a glow map stores and what the runtime multiplies it back by. A screen is three places and they do not overlap: what a panel is made of and how the lamp grid behaves are `SCREEN` and the constants beside it in `src/display.ts`, which needs no rebuild; what the pictures show is the compositions in `tools/screens.ts`, which does; and where a screen goes is `BOARD`, `BANNER` and `displays()` in `tools/stack.ts` plus the `displays` list in a look, which does. A name in `SCREEN_PICTURES` is drawn if `POSTERS` in `tools/screens.ts` has a composition for it and read from `screens/<name>.png` if it does not, so replacing a drawn one with a picture is deleting its composition and dropping the file in.

A new finish goes at the **end** of `LAYERS` in `tools/layers.ts`. The layer index rides on the vertices of every model in the pack, so a finish inserted anywhere else renumbers the whole mesh; appended, the mesh comes out of a rebuild byte for byte identical and only the two strips and the manifest change. How every picture is written is `PNG` in `tools/paint.ts`, and it is lossless on purpose: turn palette quantisation back on and one new finish moves the pixels of every other one.

The pack's six files are committed art: never hand-edit them, because the manifest's hash is what the loader checks. Rebuild with `node tools/build-buildings.ts`, which is byte for byte reproducible on one machine, and bump `VERSION` in it whenever the bytes change. Run `pnpm --filter @gb/prefab test`.
