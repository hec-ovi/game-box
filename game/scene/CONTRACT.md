# @gb/scene contract

contractVersion: 0.7.0

## Purpose

Turns a city into something you can stand in: ground, marked streets, buildings and interiors as three.js objects, at the size and place the world says.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `buildCity(world, dressing, options?)` | a `@gb/world` `World`, a `Dressing`, `CityOptions` | the world loaded, so its grid and plots agree |
| `CityOptions` | `seed?`, `wetness?`, `night?`, `clutter?` | left out: the world's own seed, a dry street after dark, and the default amount of rubbish. `clutter: false` sweeps the streets |
| `city.wetness` | 0 dry to 1 soaked | write `@gb/land`'s `wetness` into it, as often as you like: it is one uniform |
| `city.night` | 0 by day to 1 after dark | the same reading the buildings light their windows on |
| `buildInterior(world, interior, dressing)` | one of that world's interiors | |
| `Dressing` | `building`, `prop`, `ground`, `surface`, `marking?`, `clutter?` | every object it returns has its origin at the centre of its base and faces north (-Z) unturned |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `buildCity` | `{ root, buildings, doorsteps, add, spawn, markings, clutter, wetness, night }` | every plot standing at its footprint and height, its doorstep in metres on the pavement in front of it, a spawn on the pavement facing the first door in town |
| `buildings` | `ReadonlyMap<string, CityBuilding>` | one per plot, by plot id |
| `CityBuilding` | `plotId`, `bounds`, `visible` | the box it occupies in city metres, and a switch that takes it out of the city or puts it back with no rebuild |
| `add(plot)` | `CityBuilding` | one more plot built into the city that is already standing. Its ground is not repainted: the grid changed after the ground was laid, and the building covers it |
| `plotOf(hit)` | plot id, or undefined | which building a `THREE.Intersection` landed on. Buildings share buffers, so the object a ray hits is a batch and this is what turns the hit back into a plot |
| city meshes | `root.children` named `city:<material>` | one `THREE.BatchedMesh` per material every building is drawn with |
| ground meshes | `root.children` named `ground:<cell kind>` | one mesh per surface, carrying its top faces and its kerbs, with position, normal and uv |
| `markings` | `Marking[]` | every rectangle of paint on the streets: `kind`, `paint`, centre in metres, `width` across the road, `length` along it, `rot` |
| marking meshes | `root.children` named `markings:white` and `markings:yellow` | one instanced mesh per paint, one instance per marking, in the same order as `markings` |
| `MARKING` | metres | the sizes the paint is laid at, and the lift that keeps it off the road plane and clear of the wet film |
| street surface | `root.children` named `street:skin` | one mesh over the roadway and the pavement carrying their grime, aggregate, paving joints, wear and standing water |
| `clutter` | `ClutterPiece[]` | everything lying on the streets: `kind`, `variant`, centre of its base in metres, `rot`, and the rectangle it stands on (`halfWidth`, `halfDepth`, `height`) |
| clutter mesh | `root.children` named `clutter` | one `THREE.BatchedMesh` holding every piece, one instance each |
| `CLUTTER`, `BAND`, `CLEARANCE`, `CLUTTER_MAX_HEIGHT` | metres | how big each kind of rubbish is, how the pavement is divided across its width, what has to stay clear, and the tallest thing a street carries |
| `CLUTTER_DENSITY` | chances, 0 to 1 | how much rubbish a street carries, per pavement cell and per paved cell |
| `SURFACE` | metres | the real-world size of every piece of street detail, from asphalt chippings to road repairs |
| `buildInterior` | `{ root, anchors, props, people, pickups, blockers, entrance, inward }` | floor, walls with the doorways cut out, ceiling, furniture standing where the world puts it (on the floor, or on the top it was lifted onto), an empty object at every anchor carrying its kind |
| `blockers` | `PropFootprint[]` | one rectangle of floor per piece of furniture the player cannot walk through, measured off the object that was built |
| `PropFootprint` | `{ propId, prop, x, z, halfWidth, halfDepth, rot, height }`, `contains(x, z, margin?)`, `reaches(x, z, half)` | an oriented rectangle in interior metres: centre, half extents along the prop's own axes, the yaw it stands at, and how tall it is |
| `storeyHeight(storeys)` | metres | ground floor taller than the ones above it |

## Errors (closed set)

None. Nothing here validates: a world that got this far already passed `@gb/world`.

## Dependencies

- `@gb/world` contract: the grid, the plots, the interiors, the road graph (`toJSON().roads`) and `METRICS`.
- `@gb/kit` contract: `Rng`, so the same seed lays the same rubbish and paints the same grime.
- `three`, and `three/webgpu` with `three/tsl` for the street surface, which is a node material: what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself.

## Invariants

- One world unit is one metre, and everything is sized from `METRICS`: 2 m cells, 2.1 m doors, a 4 m ground floor, kerbs 15 cm above the road.
- Pavement and parks stand `METRICS.street.curbHeight` above the roadway; roads, land, water and building footprints are at zero.
- The ground is solid. Every drop from one cell to the next is closed by a kerb face wound to be seen from the low side, the edge of the grid included, so there is nowhere to look under the city and no gap where one surface stops and the next starts. Tops look up.
- Ground is one mesh per surface and mountains are one instanced block per cell, and runs of cells merge into as few quads as the grid allows, so a city of thousands of cells is a handful of draws and a road is a few triangles.
- The buildings are drawn out of one `THREE.BatchedMesh` per material, not one object each, so the city costs a draw per material however many buildings it has. Every building keeps its own transform, its own bounds and its own visibility inside the batch, so three still culls them one at a time and submits only what the frustum reaches, in the shadow pass as well as the frame. That is the whole reason it is a batch and not a merge: a merge costs the same one draw and hands the entire town to the rasteriser every time.
- A batch holds indexed, single-material meshes. Anything a dressing returns that a batch cannot draw the same way (an instanced mesh, a sprite, a light, a mesh cut into material groups) makes that whole building stand on its own in the city rather than being half taken. Empties and other markers hung on the object are not carried into the city: whatever a dressing wants the city to know goes through the `Dressing` seam, not through an object it hangs on a building.
- Two geometries share a batch only when they agree attribute for attribute, so a pane carrying the room behind it never lands in the same buffer as a blank wall on the same material.
- Batching does not depend on iteration order for what gets drawn: buildings go in in the order the world lists its plots, and a batch is named after its material, so the same city batches the same way every run.
- Ground UVs are in metres: on a top face `u` and `v` are where the corner is on the ground, up a kerb `u` runs along the face and `v` climbs it. A texture with `repeat` 1 tiles every metre, so a road surface lands at real-world size without knowing the cell size.
- Two headings meet here and they are not the same number. The world stores compass degrees, 0 north and 90 east, running clockwise seen from above; a three.js turn about +Y runs the other way, so furniture and anchors are placed at `-rot` radians. `spawn.heading` is already a three.js yaw in radians, the way the app turns its camera. Getting the sign wrong leaves north and south right and swaps east and west, which is why it is tested at all four points of the compass.
- A dressing decides what things look like and nothing else. Where they go, how big they are and which way they face are decided here, so a building kit can replace the greybox without touching the builder.
- Every object a dressing returns has its origin at the centre of its base, so placing it on the floor cannot sink it.
- A piece of furniture stands on the floor unless the world lifts it. `Furniture.lift` is the height of the top it stands on, so a till lands on the counter its base is placed at exactly, not near it. The lift is the object's transform and nothing else: the piece keeps the geometry and the material the dressing handed over, so it batches with every other copy of itself and costs no draw.
- Interiors are built in their own coordinates, entered rather than carried: the city does not hold every room all the time.
- Furniture collision is measured, never looked up. Each `blockers` rectangle is the bounding box of the object that was actually built, taken in the frame of the floor under it, so a kit that draws a wider table gets a wider footprint and what stops the player cannot drift from what they can see. A prop with nothing drawable in it gets no rectangle.
- `blockers` is in the same frame as `entrance` and the anchors: metres, interior coordinates, `rot` the three.js yaw the object carries. The half extents run across the prop's front and through it, so a turned counter is a turned rectangle and `contains(x, z, margin)` with the player's radius is the whole test. The caller needs no conversion.
- What blocks: anything standing more than `STEP_OVER_HEIGHT` (0.25 m) off the floor. Below that you walk over it rather than into it, which is a rug at 2 cm; a bar counter at 1.1 m stops you. Nothing else is exempt. Whether staff may pass behind a counter, or an NPC may stand in the chair their anchor sits in, is the caller's decision: this box only says where the furniture is.
- Nothing published can seal the player in. A rectangle that reaches into the floor a doorway needs (the door width plus 20 cm, the same hole cut in the wall) is left out, so furniture the generator parked on a door cannot lock the room; the prop is still drawn.

### The street surface

- The road and the pavement wear one extra surface, `street:skin`: the same merged quads the ground is already made of, pushed 2 cm out along their own normals and given grime, aggregate, paving joints, road repairs, wheel tracks and standing water. It is one draw for the whole city, however big the city is, and it works over any dressing because it is laid over what the dressing painted rather than replacing it.
- Detail is sized in real metres, never in repeats, so a one cell alley and a hundred metre avenue wear the same asphalt and nothing stretches. `SURFACE` holds every size: chippings on a 0.55 m tile, staining on 6 m, standing water on 12 m, road repairs on 24 m, paving in 0.5 m flags with a 14 mm joint, kerb stones a metre long. They are calibrated against what is already on the street at a known size: a 6 m roadway kerb to kerb, a 2 m pavement, and the 0.12 m painted line.
- Where the grime is and where the water pools are the same number. `street:field` is one texel per metre of city holding how far that metre is from the edge of the paved surface and whether it is roadway or pavement, and everything reads off it: dirt gathers in the gutter, water pools there first and in the wheel tracks next, the crown of the road stays cleanest, and the wheels polish two bands 1.8 m in from each kerb. A 91 by 91 cell town is 66 KB of it.
- Wetness is the one thing that moves after the build, and it is one uniform. Dry, the street is matte and dark and the surface is grime and aggregate; wet, it darkens by half again, sheens all over and holds mirrors in the low places. `city.wetness` takes `@gb/land`'s reading; nothing here owns a clock or a barometer.
- What it reflects is a probe, not the scene. A wet road gives back the fronts of the buildings either side of it, and nothing a material can reach carries them: `scene.environment` is prefiltered from the sky, which is nearly black at night, and the signs and lit windows are emissive geometry no probe in the scene has ever seen. Both ways of reflecting the real thing cost a pass over the scene, and the batching this box exists for is what pays for that. So `street:canyon` is a 128 by 64 equirectangular picture of a lit street canyon, painted from the world's seed and read at a mip chosen by how rough the surface is at that point. It is structured up and down, where it has to be right, and only loosely round the compass, where nobody can tell: an up facing plane only ever reflects rays above the horizon, so the bright band lands down the street and the ground at your feet reflects the dark sky, which is what a wet street does.
- Water reflects two percent of what is straight above it and most of what grazes it, so the reflection is Fresnel and not a wash. Only faces looking up carry it, because a kerb given the same treatment is a vertical mirror. And it is scaled by `city.night`: by day the sky the app lights the city with is the right reflection and a neon canyon over it would be a lie.
- The paint stands above the film, not under it (`MARKING.lift` clears `SURFACE.lift`), so grime and water go under the lines and a dark road still reads as a marked road.

### What is lying on the street

- Every piece of rubbish in the city is one instance in one `THREE.BatchedMesh` on one material: one draw, whatever the size of the city. The models go into the buffer once and colour rides on the vertices, so bins, sacks, crates, pallets, cable, litter and cans are still one material. Each piece keeps its own transform and bounds, so three culls them one at a time exactly as it does the buildings.
- The models are generated here, not downloaded: a wheeled bin, a skip with a load in it, a crate, a leaning pallet, a refuse sack, a coil of cable, a scrap of paper and a crushed can, in two to four colourways each. Every one is brought inside the footprint its kind publishes as it is built, so nothing hangs over a rectangle the game tells everyone else is clear.
- Where it goes is separate from what it is, so the distribution can be retuned or replaced without touching a model. `planClutter` reads the grid, the doorsteps and the paint and nothing else, and `CLUTTER_DENSITY` is the only dial.
- The pavement `@gb/forge` lays is one 2 m cell wide, so it is read as three bands across: `BAND.wall` against the building line, `BAND.walkway` down the middle, `BAND.kerb` in the gutter. Only the two outer bands are ever claimed, which is what keeps the middle of every pavement walkable by construction rather than by hoping: 0.94 m of it, against the 0.7 m a body needs, and no closer than 0.42 m to the middle of a cell whatever the jitter does.
- Nothing that stands ever lands on the roadway, because cars drive on it. The roadway takes litter, and litter is under `STEP_OVER_HEIGHT`, so it is walked over rather than into. Nothing on the street is taller than `CLUTTER_MAX_HEIGHT`.
- Nothing lands on a doorstep, a crossing, a stop bar or the double yellow down the middle of a road. Those are read off what the city has already decided, the doorsteps and the paint, not off numbers a generator chose, and a pavement corner with roadway on two sides is left clear for the crowd to turn in.
- Two pieces cannot occupy the same ground. The street is a matrix of 25 cm squares and a piece claims the rectangle it stands on, the same rule a room places furniture by, so overlap is impossible by construction rather than caught by a test that might miss.
- Same seed, same street. Every draw comes from a `@gb/kit` `Rng` forked per feature (`clutter` into `standing` and `litter`, `canyon` into `signs`, `windows` and `shopfronts`, and the surface noise into `pools`, `stain`, `repairs` and `grit`), so retuning the litter cannot move the bins and retuning the puddles cannot move the grime.

### What the street carries

- Streets are marked North American: yellow between the two directions, white for everything else, right hand traffic. Every stretch of road between two junctions gets a double yellow line down the middle, a white edge line inside each kerb, a crossing at each end where a pavement run meets it, and a stop bar on the half the arriving cars drive on.
- Markings need both the road graph and the grid, and neither alone will do. The graph says which junctions are joined; the grid is measured at the middle of each link for how wide the roadway really is and walked out from each junction for where the roadway opens. A street the grid paints but the graph does not carry gets no markings, and that is the graph's gap to close, not something to guess at here.
- Sizes are real, in metres: a painted line is 12 cm, the two yellows are 12 cm apart, an edge line stands 15 cm inside the kerb, a crossing is 40 cm bars with 40 cm between them running 2.4 m along the road, and a stop bar is 40 cm across the approaching half, a metre back from the crossing. On the 6 m roadway forge lays, that is two 3 m lanes and seven bars to a crossing.
- No paint ever lands on a pavement, a plot or the water: every rectangle sits inside the street cells the grid marks, and a crossing stops on the kerb line rather than over it.
- Paint stands 1 cm above the road (`MARKING.lift`) rather than using a polygon offset, because a lift is the same number on the WebGPU renderer and on its WebGL2 fallback while depth bias is pipeline state each backend sets its own way. One centimetre is far under the 15 cm kerb, so paint can never climb a pavement, and it is well clear of a 24 bit depth buffer at any distance the markings are still a pixel wide.
- No randomness anywhere in the paint: the same city marks the same street every time, because the roads alone decide it.

## What it costs

Measured headless in Node on a 7 by 7 city (350 plots, 157 by 147 cells) dressed in the shipped Downtown kit, and again in Chrome on the WebGL2 fallback at 1920 by 999 with the camera at the spawn:

| | meshes | draws at the spawn | triangles at the spawn | attributes | scene build |
|---|---|---|---|---|---|
| one object per building | 1,525 | 992 | 2,239,681 | 160.7 MB | 948 ms |
| batched | 56 | 41 | 2,239,681 | 177.4 MB | 1,540 ms |

The triangles are the same number twice over: per-building culling survives batching exactly, because a batch culls each instance and multi-draws the rest.

In the browser, on an AMD Radeon 8060S through ANGLE, `renderer.info.render.drawCalls` at street level goes from 1,069 to 46, and the frame from 9.97 ms to 1.63 ms with shadows off, 18.14 ms to 2.49 ms with the shadow map on. The shadow pass re-submits every caster, so it is charged per object and collapses with the same fix: 7.3 ms of it becomes 0.9 ms.

Attributes grow 10% because a batch's index buffer is 32 bit while a small building's own was 16 bit. Build time grows because every index is rewritten as it is copied into the shared buffer.

The ground is a handful of draws whatever the size of the city, and the paint is two: a bigger city is more instances in the same two meshes.

### What the wet street and the rubbish cost

Measured in Chrome on the WebGL2 fallback at 1568 by 764, standing in a street canyon of a 4 block city (333 plots, 147 by 151 cells) dressed in the shipped Downtown kit with its signs and lamps, at 21:30 in the rain. Median frame over 90 frames:

| | draws | triangles | frame |
|---|---|---|---|
| the street as it was | 37 | 1,184,764 | 1.30 ms |
| plus 1,416 pieces of rubbish | 38 | 1,195,374 | 1.40 ms |
| plus the wet street surface, soaked | 39 | 1,195,970 | 1.50 ms |

Two draws and 0.2 ms for both halves, and neither number moves with how much city there is: the rubbish is one batch and the surface is one mesh, and a bigger town is more instances and more quads in the same two.

Headless in Node on the same generator at three sizes, greyboxed, with and without the rubbish:

| | cells | plots | pieces | meshes | triangles | build |
|---|---|---|---|---|---|---|
| 1 block, swept | 35 x 31 | 7 | 0 | 15 | 5,934 | 33 ms |
| 1 block | | | 169 | 16 | 7,434 | 21 ms |
| 5 blocks, swept | 113 x 107 | 141 | 0 | 23 | 27,732 | 35 ms |
| 5 blocks | | | 2,318 | 24 | 48,668 | 39 ms |
| 7 blocks, swept | 147 x 151 | 333 | 0 | 22 | 40,798 | 52 ms |
| 7 blocks | | | 3,318 | 23 | 75,294 | 64 ms |

Rubbish is about 9 triangles a piece and it scales with paved area rather than with plots, which is what moved the triangle ceiling from 40,000 to 60,000. The street surface itself is 840 triangles over a 5 block town, because it is the ground's own merged quads and a road is a few of them. Its two textures are generated once at build: a 256 square tiling noise sheet (256 KB) and a 128 by 64 canyon probe (32 KB) shared by the whole city, plus the per-city field at one texel per metre, which is 66 KB for a 91 square town and 2 MB for the largest world `@gb/world` will accept.

## Standing it up

```ts
const city = buildCity(world, dressing)
scene.add(city.root)
```

The street is built dry and after dark. Two numbers move it, both one uniform write, both safe every frame:

```ts
city.wetness = land.wetness        // 0 dry to 1 soaked, straight from @gb/land
city.night = nightLook(hour).level // 0 by day to 1 after dark, the hour the windows light up on
```

Without them the street is a dark, grimy, dry road that reflects the neon: right for the hours the game is mostly played in, wrong at noon.

## How to modify this blackbox safely

A real art kit is a new `Dressing`, not a change here. A dressing that wants its buildings batched has only to return indexed meshes on shared materials; welding a building's own pieces per material first, the way `@gb/kitbash` does, keeps the batch's instance count down but is not required. A kit that wants worn road paint implements `marking(paint)`, and one that wants its own rubbish material implements `clutter()`; leave either out and the street gets a plain one. What the ground is made of is the dressing's (`ground(kind)`); what the street has been through is this box's, and the two compose, so a pale kit surface will read pale through the film however dark the film is. Anything that needs the renderer, the camera, input or a frame loop belongs in the app, not in this box: everything here builds objects and returns them, which is why it is tested in Node with no browser. Retuning how much rubbish a street carries is `CLUTTER_DENSITY` alone; retuning what a piece of rubbish looks like is `src/clutter/models.ts` alone, and how big it is `src/clutter/catalog.ts`, which the placement reads. How big a piece of surface detail is in the real world is `src/street/sizes.ts` alone. Run `pnpm --filter @gb/scene test`.
