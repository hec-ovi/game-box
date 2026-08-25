# @gb/scene contract

contractVersion: 0.14.0

## Purpose

Turns a city into something you can stand in: ground, marked streets, buildings and interiors as three.js objects, at the size and place the world says, lit by what the buildings throw onto the street and, indoors, by a fill that reaches the ceiling. Every building is batched as its shell; the ones near the player wear their detail, rooms are built on entry and let go when far, and where a visitor may stand in a room is published.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `buildCity(world, dressing, options?)` | a `@gb/world` `World`, a `Dressing`, `CityOptions` | the world loaded, so its grid and plots agree |
| `CityOptions` | `seed?`, `wetness?`, `night?`, `clutter?`, `lights?`, `detail?` | left out: the world's own seed, a dry street after dark, the default amount of rubbish, `LIVE_LIGHTS` live lights and `DETAIL_RADIUS` metres of detail. `clutter: false` sweeps the streets |
| `city.wetness` | 0 dry to 1 soaked | write `@gb/land`'s `wetness` into it, as often as you like: it is one uniform |
| `city.night` | 0 by day to 1 after dark | the same reading the buildings light their windows on; the lights burn at their candela times it. Held to 0 to 1, and a reading that is not a number is day |
| `city.follow(x, z)` | metres on the ground: where the player is | every frame. The emitters nearest it become the live lights; when its cell changes, the buildings that came within `detail` metres are dressed and the ones that went beyond fall back to their shells, and rooms beyond it are let go |
| `city.interior(interiorId)` | one of that world's interior ids | built on the first call since it was last let go, the same `InteriorBuild` on every call after; undefined for an id the world lacks |
| `buildInterior(world, interior, dressing)` | one of that world's interiors | |
| `Dressing` | `building`, `shell?`, `lights?`, `prop`, `character`, `pickup`, `ground`, `surface`, `marking?`, `clutter?` | every object it returns has its origin at the centre of its base, faces north (-Z) unturned, and is its own: an object handed over a second time is drawn once, where it was placed last |
| `Dressing.building(plot, size, charter)`, `Dressing.shell?(plot, size, charter)`, `Dressing.lights?(plot, size, charter)` | a `@gb/world` `Plot`, `BuildingSize` (`width`, `depth`, `height` in metres), the plot's `ResolvedCharter` | the charter is `world.charter(plot.kind)`, and a plot's kind is the word of a charter the world holds, so it is always there. `shell` is the same building as seen from far off: walls and roof, nothing that is only worth drawing near (no signs, screens or rooms behind the panes); left out, `building` is drawn at every distance. `lights` is asked after `building` for that plot, never after `shell`. None of them has to answer: a member that is there and answers nothing, or an object with nothing in it to draw, reads as the member being left out for that plot |
| `Dressing.surface(part, size)` | `SurfacePart` (`floor`, `wall`, `ceiling`), `SurfaceSize` (`u`, `v`: the metres the surface spans along each texture axis) | the surface's UVs are in metres |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `buildCity` | `{ root, buildings, doorsteps, add, spawn, markings, clutter, lights, follow, interior, interiors, wetness, night }` | every plot standing at its footprint and height, and its doorstep in metres on the pavement in front of it |
| `spawn` | `Standing`: `x`, `z`, `heading` | a step off the first door in town that opens, standing on pavement and looking back at the door. `heading` is a three.js yaw in radians |
| `buildings` | `ReadonlyMap<string, CityBuilding>` | one per plot, by plot id, in the order the world lists its plots and whatever the dressing drew for it |
| `CityBuilding` | `plotId`, `bounds`, `visible`, `detailed` | the box it occupies in city metres, a switch that takes it out of the city or puts it back with no rebuild, and whether it is drawn in detail right now rather than as its shell |
| `add(plot)` | `CityBuilding` | one more plot built into the city that is already standing, in detail if it is near the player. Its ground is not repainted: the grid changed after the ground was laid, and the building covers it |
| `interiors` | `ReadonlySet<string>` | the interiors standing built right now |
| `DETAIL_RADIUS` | 64 m | how far from the player a building is drawn in detail and a room is kept built, measured below |
| `plotOf(hit)` | plot id, or undefined | which building a `THREE.Intersection` landed on. Buildings share buffers, so the object a ray hits is a batch and this is what turns the hit back into a plot |
| city meshes | `root.children` named `city:<material>` | one `THREE.BatchedMesh` per material the shells are drawn with, every building in it |
| detail meshes | `root.children` named `detail:<material>` | one `THREE.BatchedMesh` per material the near buildings' detail is drawn with, only when the dressing has a `shell`; the near buildings come and go from these as the player moves |
| ground meshes | `root.children` named `ground:<cell kind>` | one mesh per surface, carrying its top faces and its kerbs, with position, normal and uv |
| `markings` | `Marking[]` | every rectangle of paint on the streets: `kind` (`centre-line`, `edge-line`, `lane-line`, `crossing`, `stop-bar`), `paint`, centre in metres, `width` across the road, `length` along it, `rot` |
| marking meshes | `root.children` named `markings:white` and `markings:yellow` | one instanced mesh per paint, one instance per marking, in the same order as `markings` |
| `MARKING` | metres | the sizes the paint is laid at, and the lift that keeps it off the road plane and clear of the wet film |
| street surface | `root.children` named `street:skin` | one mesh over the roadway and the pavement carrying their grime, aggregate, paving joints, wear and standing water |
| `clutter` | `ClutterPiece[]` | everything lying on the streets: `kind`, `variant`, centre of its base in metres, `rot`, and the rectangle it stands on (`halfWidth`, `halfDepth`, `height`) |
| clutter mesh | `root.children` named `clutter` | one `THREE.BatchedMesh` holding every piece, one instance each |
| `CLUTTER`, `BAND`, `CLEARANCE`, `CLUTTER_MAX_HEIGHT` | metres | how big each kind of rubbish is, how the pavement is divided across its width, what has to stay clear, and the tallest thing a street carries |
| `CLUTTER_DENSITY` | chances, 0 to 1 | how much rubbish a street carries, per pavement cell and per paved cell |
| `lights` | `CityLights`: `emitters`, `lights`, `follow(x, z)`, `night` | every `PlacedEmitter` of the buildings drawn in detail (a `LightEmitter` in city metres with its `plotId`; with no `shell` on the dressing, every building's) and of no others, and the point lights the budget allows, under `root.children` named `lights`: `light:<n>`, decay 2, `distance` the emitter's radius, colour its colour, intensity its candela times `night`, `visible` only while it has an emitter |
| `LightEmitter` | `kind`, `position` (`[x, y, z]` metres in the building's frame, just off the lit face), `colour` (packed `0xRRGGBB`), `intensity` (candela at full dark), `radius` (metres past which it is not worth drawing) | the shape a dressing publishes from `lights`; `@gb/kitbash` and `@gb/prefab` publish this one |
| `LIVE_LIGHTS` | 16 | how many emitters are point lights at once, measured below |
| `Greybox.lights(plot, size)` | one `LightEmitter` | a warm lamp (`0xffd2a0`, 20 cd, 14 m) 20 cm off the wall over the door, so a greybox street lights its doorsteps |
| `SURFACE` | metres | the real-world size of every piece of street detail, from asphalt chippings to road repairs |
| `buildInterior` | `{ root, anchors, props, people, pickups, leave, blockers, visitorCells, entrance, inward, dispose }` | floor, walls with the doorways cut out, ceiling, a light named `fill` under `root` that lights whatever looks down, furniture standing where the world puts it (on the floor, or on the top it was lifted onto), an empty object at every anchor carrying its kind |
| `visitorCells` | `VisitorCell[]`: `x`, `z` (interior metres, the middle of the cell), `roomId` | where a visitor may stand, nearest the street door first: every `VISITOR_CELL` (1 m) square of floor a body 0.7 m across fits in clear of the blockers, at least 1.5 m from every door, 0.7 m from every anchor, and off the aisle the staff work along behind their piece |
| `dispose()` | nothing | lets go of the geometry this box made for the room (its shell and its pickup batches) and empties `root`; the dressing's own objects and materials are left alone |
| interior surfaces | `root.children` named `floor` and `ceiling`, and one unnamed mesh per stretch of wall | position, normal and uv, the uv in metres |
| `CEILING_FILL`, `CEILING_HEIGHT` | 1.6, and `METRICS.building.groundFloorHeight` (4 m) | what a face looking straight down is lit by, as the irradiance a white surface gets; how tall a room is |
| `pickups` | `ReadonlyMap<string, THREE.Object3D>` | one handle per thing lying about, by item id: where it is, and what takes it out of the room. Remove the handle and the thing stops being drawn |
| `leave(itemId, anchorId)` | the handle, or undefined | leaves that thing at that anchor once the room is standing, exactly where the room would have been built with it there. Undefined, and nothing drawn, for an anchor this room has not got or an item this world has not got |
| pickup meshes | `root.children` named `pickups:<material>` | one `THREE.BatchedMesh` per material the things in that room are drawn with, one instance each |
| `itemOf(hit)` | item id, or undefined | which thing a `THREE.Intersection` landed on. Things share buffers, so the object a ray hits is a batch and this is what turns the hit back into an item |
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
- The cell kinds and what each is drawn as are `@gb/world`'s `CELL_KINDS` and its table "The cells a city is laid in"; this box keeps no list of its own. Pavement and parks stand `METRICS.street.curbHeight` above the roadway; roads, land, water and building footprints are at zero. A `mountain` cell is the valley wall (`@gb/world`, "What a mountain cell means"): `@gb/land` starts its rise at the top of whatever surface it meets, so there is never a drop to close and no kerb is drawn against it. The pavement meets the rise flush. Measured on a generated town: every edge where a pavement or a park meets the ring carries no kerb face.
- The ground is solid. Every other drop from one cell to the next is closed by a kerb face wound to be seen from the low side, the edge of the grid included, so there is nowhere to look under the city and no gap where one surface stops and the next starts. Tops look up.
- Ground is one mesh per surface, and runs of cells merge into as few quads as the grid allows, so a city of thousands of cells is a handful of draws and a road is a few triangles. The verge gets no ground here: `@gb/land` covers it. What stands on it is `mountains`, one instanced block per verge cell, a stand-in ring so a city built with no landscape around it still closes its view; a game with `@gb/land` in it hides that object.
- The buildings are drawn out of one `THREE.BatchedMesh` per material, not one object each, so the city costs a draw per material however many buildings it has. Every building keeps its own transform, its own bounds and its own visibility inside the batch, so three still culls them one at a time and submits only what the frustum reaches, in the shadow pass as well as the frame. That is the whole reason it is a batch and not a merge: a merge costs the same one draw and hands the entire town to the rasteriser every time.
- A batch holds indexed, single-material meshes. Anything a dressing returns that a batch cannot draw the same way (an instanced mesh, a sprite, a light, a mesh cut into material groups) makes that whole building stand on its own in the city rather than being half taken. Empties and other markers hung on the object are not carried into the city: whatever a dressing wants the city to know goes through the `Dressing` seam, not through an object it hangs on a building.
- Two geometries share a batch only when they agree attribute for attribute, so a pane carrying the room behind it never lands in the same buffer as a blank wall on the same material.
- Batching does not depend on iteration order for what gets drawn: buildings go in in the order the world lists its plots, and a batch is named after its material, so the same city batches the same way every run.
- Ground UVs are in metres: on a top face `u` and `v` are where the corner is on the ground, up a kerb `u` runs along the face and `v` climbs it. A texture with `repeat` 1 tiles every metre, so a road surface lands at real-world size without knowing the cell size.
- Most of a city is shut, so the spawn goes to the first plot with an interior rather than the first plot: standing at a door nobody can go through means opening your eyes on a blank wall with nothing to press. The step off the doorstep is 2 m, inside arm's reach of the door, and it is taken onto pavement, so a one cell pavement is stepped along rather than backed off into the road. A city with no pavement at all still gets the plain step back.
- Two headings meet here and they are not the same number. The world stores compass degrees, 0 north and 90 east, running clockwise seen from above; a three.js turn about +Y runs the other way, so furniture and anchors are placed at `-rot` radians. `spawn.heading` is already a three.js yaw in radians, the way the app turns its camera. Getting the sign wrong leaves north and south right and swaps east and west, which is why it is tested at all four points of the compass.
- A dressing decides what things look like and nothing else. Where they go, how big they are and which way they face are decided here, so a building kit can replace the greybox without touching the builder.
- What a building is built of, how loud its signage is, what its blade spells and what colour it is tinted are the plot's charter, which the world resolved once and this box hands through the seam whole: `building(plot, size, charter)` and `lights(plot, size, charter)`. No box on the seam holds a table of kinds; a `Greybox` building is a box in the charter's `tint`.
- Every object a dressing returns has its origin at the centre of its base, so placing it on the floor cannot sink it.
- The greybox draws every piece of furniture to `@gb/world`'s own table: the floor `footprintOf(prop)` claims, as tall as the contact or the height `PROP_SPECS` declares (a plant, which declares neither, 1.2 m). A thing you pick up is a cube by how it is carried: 20 cm in a pocket, 35 cm in a bag, 44 cm two-handed, which is a crate. Nothing the greybox draws is wider than the piece the world stands it on.
- **A room's surfaces are laid out in metres.** The floor and the ceiling carry `u`, `v` as where the point is on the ground; a wall runs along itself and climbs, the same rule the ground uses, so a texture with `repeat` 1 tiles every metre whatever size the room is and the grain runs on from one wall into the next. `surface(part, size)` is told the metres each surface spans as well, so a dressing needs no shader rule to read a size off.
- **A ceiling is lit.** Nothing else in the game reaches a face looking down: the prefiltered sky's lower half is black by design, and a room's own light strips are emissive geometry. So every interior carries one directional light, `fill`, shining straight up from the floor at `CEILING_FILL`: a face is lit by how far it looks down, and a wall or a floor gets nothing from it. It stands in for the bounce off the floor, and it is a light rather than a probe because a probe bright enough to do this would flood the room. Measured on the renderer the game uses, a lid painted the colour `@gb/furnish` publishes for a corpo ceiling (`0x4a4d52`, 0.069 to 0.084 linear) reads 0.043 to 0.051 linear (sRGB 0.23 to 0.25) under the fill alone, and 0 without it; the same room's walls in the owner's screenshot read sRGB 0.31, so the ceiling lands at about three quarters of the wall, which is a lit ceiling under a cove and not a white one.
- A piece of furniture stands on the floor unless the world lifts it. `Furniture.lift` is the height of the top it stands on, so a till lands on the counter its base is placed at exactly, not near it. The lift is the object's transform and nothing else: the piece keeps the geometry and the material the dressing handed over, so it batches with every other copy of itself and costs no draw.
- Interiors are built in their own coordinates, entered rather than carried: `city.interior(id)` builds a room on the first entry and keeps it while its building is within `detail` metres of the player's cell; `follow` lets a far one go (`dispose`) and the next entry builds it again from the world file. A room built again is the file's room: what the playthrough moved is the caller's to put back, the same as on the first entry.
- **A visitor stands where nobody works and nothing stands.** The aisle is the strip 1 m deep along the side of a counter, desk, bench or stove its `serve`, `cook`, `work-desk` or `work-bench` anchor stands on, the length of the piece and half an aisle past either end; a cell within a body of it is not offered. The doorway clearance is wider than the door gap (1.5 m from the door), so a companion by the door is beside it and not in it. The cells are read off the room and its measured blockers and nothing else, so the same room offers the same cells in the same order every time.
- **A thing you pick up stands on what it is left on, whether the generator left it there or the player did.** `leave` is the same rule the build runs, called again: the generator's own placements go through it while the room is being built, so a thing put down at an anchor afterwards lands where that thing would have been built. Nothing is re-derived off `blockers`, and nothing has to be, since the rule is one call. An anchor names the piece of furniture it belongs to, and the thing left there is put down on that piece: on it, so no part of it overhangs the edge, and at the height the piece is drawn to under that point. The height is measured with a ray, never looked up, for the same reason the collision is: a chair holds a cup at its seat and not at the top of its backrest, a counter holds one at the shelf it is really over, and a kit that draws a taller counter gets a taller counter with no table to keep in step. A round seat in a square footprint has corners with nothing drawn in them, so the place is walked in from the edge until there is something under it. An anchor with no furniture behind it leaves the thing on the floor, which is the only surface there is.
- A thing is put down beside whoever is standing at that anchor rather than inside them: 45 cm to their own right, then brought onto the piece.
- Everything lying about in a room is one `THREE.BatchedMesh` per material, the way the city holds its buildings, so twenty things on a shelf cost the draw one thing costs. A model two things share goes into the buffer once and is placed twice, which is what a kit drawing one buffer per archetype gets for free. Each thing keeps its own place and its own visibility: its handle carries where it is, taking that handle out of the room stops the batch drawing it, and `itemOf` turns a ray back into an item. Where a thing is drawn is its instance matrix in the batch, so moving a handle is writing that matrix: a thing taken and put down somewhere else is drawn where it was put, not where it was first left. A thing the room has held before keeps the handle and the buffer copy it had, so a player taking one thing and leaving it twenty times is one instance moved twenty times rather than twenty instances and a room that quietly grows. An object a batch cannot draw the same way stands on its own in the room and is its own handle.
- Furniture collision is measured, never looked up. Each `blockers` rectangle is the bounding box of the object that was actually built, taken in the frame of the floor under it, so a kit that draws a wider table gets a wider footprint and what stops the player cannot drift from what they can see. A prop with nothing drawable in it gets no rectangle.
- `blockers` is in the same frame as `entrance` and the anchors: metres, interior coordinates, `rot` the three.js yaw the object carries. The half extents run across the prop's front and through it, so a turned counter is a turned rectangle and `contains(x, z, margin)` with the player's radius is the whole test. The caller needs no conversion.
- What blocks: anything standing more than `STEP_OVER_HEIGHT` (0.25 m) off the floor. Below that you walk over it rather than into it, which is a rug at 2 cm; a bar counter at 1.1 m stops you. Nothing else is exempt. Whether staff may pass behind a counter, or an NPC may stand in the chair their anchor sits in, is the caller's decision: this box only says where the furniture is.
- Nothing published can seal the player in. A rectangle that reaches into the floor a doorway needs (the door width plus 20 cm, the same hole cut in the wall) is left out, so furniture the generator parked on a door cannot lock the room; the prop is still drawn.

### The light the buildings throw

- **Every sign, lamp, screen and lit lobby is an emitter, and a few of them are lights.** A dressing publishes `LightEmitter`s from `lights(plot, size, charter)`; this box carries them into city metres and keeps every one for as long as the building stands in detail. Every lit material pays for every point light in the frame, so `LIVE_LIGHTS` (16) `THREE.PointLight`s are made once and the nearest emitters to the camera get them; the rest stay emissive geometry until the camera comes closer. `follow(x, z)` is the whole of it, and a city is built with the lights round the spawn so the first frame is lit before the app has said where the camera is.
- **A building's lights are never in the city while the building is not.** Emitters are hung when the building that throws them actually put something in the city and taken out with it, so a plot the dressing draws nothing for hangs nothing over an empty pavement. A far building throws none, and a near one that drew nothing throws none either.
- The lights stay in the scene whatever they are lighting. A light count is part of what a shader is compiled for, so a light that came and went would recompile every lit material as the camera moved; one that is only hidden does not.
- A light falls off by the inverse square (decay 2) and is cut at the emitter's `radius`, the metres where it falls to 0.1 lux, so a lamp lights the wall round it and not the street two blocks away. Intensity is candela at full dark times `city.night`, so the same clock that lights the windows lights the walls beside them, and nothing glows at noon.
- A dressing that publishes nothing lights nothing, and a building added to a standing city brings its emitters with it.

### What is near is drawn in detail

- **A building is drawn at every distance, whatever its dressing publishes.** A dressing decides what a building looks like; it never decides whether there is one. So an answer this box cannot draw is read as no answer for that plot and the next thing that can be drawn stands there instead: a `shell` that answers nothing leaves the plot with its whole `building` as its far look, and a `building` that answers nothing leaves the near plot standing as the shell it already had. Every plot is in `buildings` either way, so it can still be hidden, shown and dressed. Measured on two generated towns, walked cell by cell: a dressing that answers `undefined` through `shell`, one that answers an empty object through `shell`, and one that answers an empty object through `building` all leave every plot standing at every step, where before the first threw at open, the second left the town with no shells and no buildings to address, and the third took each near building out of the city as the player walked up to it.
- **Every building is its shell at open, and the near ones are dressed on top.** `Dressing.shell` is the far look, batched for every plot at open into `city:<material>`; `Dressing.building` is the whole building, asked only for the plots whose footprint comes within `detail` metres of the middle of the player's cell and batched into `detail:<material>`. A near building's shell instance is hidden while its detail stands, so a building is drawn once, from one batch, at any distance; `plotOf` names the plot from either. A dressing with no `shell` draws its `building` everywhere and pays for the whole town at open, which is what it did before.
- **What is drawn is a pure function of the player's cell.** `follow(x, z)` does nothing to the buildings until the cell changes; then every plot is measured against the new cell and what came near is built, in the order the world lists its plots, and what went far is taken out with the emitters it carried. So two players standing in the same cell of the same city see the same buildings in detail, and walking away and back rebuilds the same town.
- **The lights come with the detail.** `lights` is asked after `building`, so a shell has no emitters and a far building throws none, which is the budget the frame already lived with: the nearest sixteen emitters were never further than a street away. With no `shell` every building's emitters are kept, as before.
- The detail batches are their own buffers, sized at open for the neighbourhood of the spawn and grown as the player walks, so the churn of buildings coming and going never touches the town-sized shell buffers. A building taken out leaves its range behind; it is packed away only when the next one would not fit, so a batch settles at the size of what stands in it at once. The price is one more draw per material near the player: the greybox pays seven at the spawn of a twenty block city, a kit pays as many materials as it draws a building with.
- A city with `add(plot)` called after open puts the new plot's shell into the shell buffers and its detail into the detail buffers if it is near the cell `follow` last saw, spawn included.

### The street surface

- The road and the pavement wear one extra surface, `street:skin`: the same merged quads the ground is already made of, pushed 2 cm out along their own normals and given grime, aggregate, paving joints, road repairs, wheel tracks and standing water. It is one draw for the whole city, however big the city is, and it works over any dressing because it is laid over what the dressing painted rather than replacing it.
- Detail is sized in real metres, never in repeats, so a one cell alley and a hundred metre avenue wear the same asphalt and nothing stretches. `SURFACE` holds every size: chippings on a 0.55 m tile, staining on 6 m, standing water on 12 m, road repairs on 24 m, paving in 0.5 m flags with a 14 mm joint, kerb stones a metre long. They are calibrated against what is already on the street at a known size: a 10 m roadway kerb to kerb, a 4 m pavement, and the 0.12 m painted line.
- Where the grime is and where the water pools are the same number. `street:field` is one texel per metre of city holding how far that metre is from the edge of **its own** surface and whether it is roadway or pavement, and everything reads off it: dirt gathers in the gutter, water pools there first and in the wheel tracks next, the crown of the road stays cleanest, and the wheels polish two bands 1.8 m in from each kerb, which is where a car in the kerb lane runs whatever class the road is. Its own surface, because the kerb is the edge that matters: measured off the whole paved area instead, a road's gutter would land four metres out on the pavement. A 91 by 91 cell town is 66 KB of it.
- Wetness is the one thing that moves after the build, and it is one uniform. Dry, the street is matte and dark and the surface is grime and aggregate; wet, it darkens by half again, sheens all over and holds mirrors in the low places. `city.wetness` takes `@gb/land`'s reading; nothing here owns a clock or a barometer.
- What it reflects is a probe, not the scene. A wet road gives back the fronts of the buildings either side of it, and nothing a material can reach carries them: `scene.environment` is prefiltered from the sky, which is nearly black at night, and the signs and lit windows are emissive geometry no probe in the scene has ever seen. Both ways of reflecting the real thing cost a pass over the scene, and the batching this box exists for is what pays for that. So `street:canyon` is a 128 by 64 equirectangular picture of a lit street canyon, painted from the world's seed and read at a mip chosen by how rough the surface is at that point. It is structured up and down, where it has to be right, and only loosely round the compass, where nobody can tell: an up facing plane only ever reflects rays above the horizon, so the bright band lands down the street and the ground at your feet reflects the dark sky, which is what a wet street does.
- Water reflects two percent of what is straight above it and most of what grazes it, so the reflection is Fresnel and not a wash. Only faces looking up carry it, because a kerb given the same treatment is a vertical mirror. And it is scaled by `city.night`: by day the sky the app lights the city with is the right reflection and a neon canyon over it would be a lie.
- The paint stands above the film, not under it (`MARKING.lift` clears `SURFACE.lift`), so grime and water go under the lines and a dark road still reads as a marked road.

### What is lying on the street

- Every piece of rubbish in the city is one instance in one `THREE.BatchedMesh` on one material: one draw, whatever the size of the city. The models go into the buffer once and colour rides on the vertices, so bins, sacks, crates, pallets, cable, litter and cans are still one material. Each piece keeps its own transform and bounds, so three culls them one at a time exactly as it does the buildings.
- The models are generated here, not downloaded: a wheeled bin, a skip with a load in it, a crate, a leaning pallet, a refuse sack, a coil of cable, a scrap of paper and a crushed can, in two to four colourways each. Every one is brought inside the footprint its kind publishes as it is built, so nothing hangs over a rectangle the game tells everyone else is clear.
- Where it goes is separate from what it is, so the distribution can be retuned or replaced without touching a model. `planClutter` reads the grid, the doorsteps and the paint and nothing else, and `CLUTTER_DENSITY` is the only dial.
- A pavement cell is read as three bands across: `BAND.wall` against the building line, `BAND.walkway` down the middle, `BAND.kerb` in the gutter. **A cell takes at most one of the outer two, whichever it is the cell for.** The pavement `@gb/forge` lays is two 2 m cells wide, so the gutter band is the cell with the road beside it and the building line band is the cell with the wall behind it, and neither is ever asked of the other; a one cell pavement is both and takes both. The middle is never claimed, which keeps every pavement walkable by construction rather than by hoping: about 2.9 m of it across a four metre pavement, against the 0.7 m a body needs.
- Nothing that stands ever lands on the roadway, because cars drive on it. The roadway takes litter, and litter is under `STEP_OVER_HEIGHT`, so it is walked over rather than into. Nothing on the street is taller than `CLUTTER_MAX_HEIGHT`.
- Nothing lands on a doorstep, a crossing, a stop bar or the double yellow down the middle of a road. The lines along the road, the edge lines and the lane lines, are not on that list: a scrap blown over one is a scrap on a road. Those are read off what the city has already decided, the doorsteps and the paint, not off numbers a generator chose, and a pavement corner with roadway on two sides is left clear for the crowd to turn in.
- Two pieces cannot occupy the same ground. The street is a matrix of 25 cm squares and a piece claims the rectangle it stands on, the same rule a room places furniture by, so overlap is impossible by construction rather than caught by a test that might miss.
- Same seed, same street. Every draw comes from a `@gb/kit` `Rng` forked per feature (`clutter` into `standing` and `litter`, `canyon` into `signs`, `windows` and `shopfronts`, and the surface noise into `pools`, `stain`, `repairs` and `grit`), so retuning the litter cannot move the bins and retuning the puddles cannot move the grime.

### What the street carries

- Streets are marked North American: yellow between the two directions, white for everything else, right hand traffic. Every stretch of road between two junctions gets a double yellow line down the middle, a white edge line inside each kerb, a broken white line between same-direction lanes where there is more than one, a crossing at each end where a pavement run meets it, and a stop bar on the half the arriving cars drive on.
- Markings need both the road graph and the grid, and neither alone will do. The graph says which junctions are joined, what class each road is and how many lanes it carries; the grid is measured at the middle of each link for how wide the roadway really is and walked out from each junction for where the roadway opens. A street the grid paints but the graph does not carry gets no markings, and that is the graph's gap to close, not something to guess at here.
- **A four lane road carries a broken white line between the two lanes going each way**, one each side of the centre, at the width of a lane out from it: 3.5 m on a 14 m avenue, 4.5 m on the 18 m road out. It is 3 m of paint with 9 m of road between, the North American break. The lane count comes off the graph and the width off the grid, so the line lands between the lanes `@gb/traffic` drives. A street has one lane each way and gets none: the double yellow is already the line between them.
- Sizes are real, in metres: a painted line is 12 cm, the two yellows are 12 cm apart, an edge line stands 15 cm inside the kerb, a crossing is 40 cm bars with 40 cm between them running 2.4 m along the road, and a stop bar is 40 cm across the approaching half, a metre back from the crossing. On the roadways forge lays that is an edge line at 4.79 m from the middle of a street, 6.79 on an avenue and 8.79 on the road out, and 12 bars to a crossing on a street, 17 on an avenue and 22 on the road out.
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

### What the lights cost

Measured on the renderer the game uses in a headless Chromium on the Radeon 8060S, at 1920 by 937, standing at the spawn of the two block city the panel makes by default (27 plots, greyboxed, one lamp a building, the street wet, after dark), the render pass timed on the GPU, median of 240 frames:

| live lights | render pass, WebGPU | render pass, WebGL2 |
|---|---|---|
| 0 | 0.90 ms | 1.06 ms |
| 4 | 1.39 ms | 1.55 ms |
| 8 | 1.76 ms | 1.80 ms |
| 16 | 2.20 ms | 2.33 ms |
| 27, every emitter live | 2.89 ms | 3.07 ms |

About 0.08 ms a light on this screen, whichever backend, and it is per lit pixel rather than per building: a kit that costs more per fragment pays its own base and the same light term over it. Sixteen is 1.3 ms for the doorlamps, signs and screens of about three buildings round the camera, which is the end of a street canyon you are standing in; it is the budget, and `CityOptions.lights` moves it for a machine that wants another. `node game/scene/tools/bench/measure.ts street 0 4 8 16 32` is where the table comes from (`CHROME` names the browser, vite serves the repo root on 5312), `measure.ts ceiling 0 1.6` reads the ceiling back, and `SHOT=<dir>` keeps a screenshot of each run.

### What the detail costs

Measured headless in Node on a 20 by 20 block city (2,607 plots, 312 interiors, 589 by 578 cells), the camera at the spawn, for two dressings: the greybox (a box and a door slab, one lamp) and a dressed greybox that hangs what a kit hangs (a lit sign per storey, a screen over the door, three panes per storey on every wall, each on its own material, with an emitter per lit thing). Each is built twice, `whole` with no `shell` so the town is dressed at open and drawn at every distance, and `lod` with the shell for every plot and the detail on the 29 buildings within `DETAIL_RADIUS` of the spawn. `follow` is costed along a 120 m walk in 25 cm steps, 60 of which cross a cell:

| | open | meshes | triangles held | draws at the spawn | triangles at the spawn | emitters | `follow`, same cell | `follow`, new cell, median | worst |
|---|---|---|---|---|---|---|---|---|---|
| greybox, whole | 660 ms | 23 | 844,204 | 20 | 93,212 | 2,607 | 20.8 us | 0.02 ms | 0.19 ms |
| greybox, lod | 503 ms | 32 | 813,616 | 27 | 89,528 | 29 | 2.4 us | 0.16 ms | 1.57 ms |
| dressed, whole | 2,100 ms | 26 | 1,634,740 | 23 | 185,216 | 10,081 | 102.7 us | 0.10 ms | 0.20 ms |
| dressed, lod | 469 ms | 35 | 821,920 | 30 | 92,444 | 109 | 4.0 us | 0.65 ms | 4.49 ms |

Open time is the buildings the dressing is asked for: 2,607 whole buildings against 2,607 shells and 29 whole ones. The triangles in view halve for the dressed town because the far buildings in the frustum have lost their signs and panes, and the same-cell `follow` is cheaper because the nearest-emitter scan runs over the near buildings' emitters rather than the town's. A new cell costs what the one to three buildings that crossed the radius cost to dress and copy in, which is the dressing's `building` and the batch copy; the worst frame is a batch growing. Draws go up by one per material near the player, because the detail is its own set of buffers. `node game/scene/tools/bench/headless.ts 20` is where the table comes from.

The same town in a headless Chromium on the Radeon 8060S at 1920 by 937, greyboxed, sixteen lights live, the render pass timed on the GPU (`BLOCKS=20 node game/scene/tools/bench/measure.ts street 16`, and `street-gl` for the WebGL2 backend; `WHOLE=1` for every building whole):

| | open | draws, WebGL2 | draws, WebGPU | triangles | render pass, WebGL2 | render pass, WebGPU |
|---|---|---|---|---|---|---|
| whole | 618 ms | 24 | 10,204 | 259,077 | 2.02 ms | 1.87 ms |
| lod | 512 ms | 31 | 9,861 | 254,961 | 1.99 ms | 1.90 ms |

The greybox's detail is a door slab, so the pass does not move; what a kit's detail costs a fragment is what the shell saves. `renderer.info.render.drawCalls` on the WebGPU backend counts one draw per visible instance of a batch, 9,861 for the same scene the WebGL2 backend multi-draws in 31, which is that backend's way of submitting a `BatchedMesh` and is the same either way the town is built.

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
| 1 block, swept | 43 x 39 | 7 | 0 | 13 | 7,206 | 28 ms |
| 1 block | | | 390 | 14 | 9,528 | 24 ms |
| 5 blocks, swept | 139 x 133 | 141 | 0 | 22 | 33,108 | 33 ms |
| 5 blocks | | | 5,209 | 23 | 64,848 | 43 ms |
| 7 blocks, swept | 177 x 187 | 292 | 0 | 23 | 49,524 | 46 ms |
| 7 blocks | | | 9,229 | 24 | 109,050 | 74 ms |

Rubbish is about 6 triangles a piece and it scales with paved area rather than with plots, which is what moved the triangle ceiling from 60,000 to 70,000: a 4 m pavement is twice the ground a 2 m one was and it carries a band against the building line as well as one in the gutter.

The paint is two instanced meshes at any size: 120 rectangles on a one block town, 1,714 on five blocks and 2,802 on seven, of which the broken lane lines are 54 and 74. A four lane road is a handful more instances in the same two draws.

The street surface itself is 918 triangles over a 5 block town, because it is the ground's own merged quads and a road is a few of them. Its two textures are generated once at build: a 256 square tiling noise sheet (256 KB) and a 128 by 64 canyon probe (32 KB) shared by the whole city, plus the per-city field at one texel per metre, which is 66 KB for a 91 square town and 2 MB for the largest world `@gb/world` will accept.

### What a room's things cost

Measured headless in Node on a generated town dressed by `@gb/furnish`, whole rooms, shell, walls and things included. A generated room carries one to three things, so batching them takes the six rooms of a 4 block town from 220 meshes to 217; the rule shows on a room that carries a lot of them:

| | meshes |
|---|---|
| 25 things on a counter, one mesh each | 33 |
| the same 25 in one `BatchedMesh` | 9 |

The same two numbers greyboxed and dressed, because what collapses them is that a kit's things are indexed and share a material, which both are.

Leaving things after the build costs the room nothing to draw. The busiest room of a 5 block town (8 anchors, 14 pieces of furniture, 32 meshes) carries one pickup batch:

| | meshes | pickup batches | instances |
|---|---|---|---|
| built | 32 | 1 | 2 |
| its own two things moved to other anchors | 32 | 1 | 2 |
| five more carried in and left | 32 | 1 | 7 |
| those five taken and left again | 32 | 1 | 7 |

A thing brought in from another room is one more instance in the batch that is already there; a thing the room has held before is the same instance moved.

## Standing it up

```ts
const city = buildCity(world, dressing)
scene.add(city.root)
```

The street is built dry and after dark. Two numbers move it, both one uniform write, both safe every frame, and one call hands the lights to whatever is nearest:

```ts
city.wetness = land.wetness        // 0 dry to 1 soaked, straight from @gb/land
city.night = nightLook(hour).level // 0 by day to 1 after dark, the hour the windows light up on, and the lamps with them
city.follow(player.x, player.z)    // the lights to the nearest emitters, the detail and the rooms to the player's cell
```

Without them the street is a dark, grimy, dry road that reflects the neon and lights the spawn: right for the hours the game is mostly played in, wrong at noon. Indoors, `follow` is given the door the player came in by, so the street outside stays dressed and the room stays built.

Going in, and standing a companion somewhere:

```ts
const room = city.interior(interiorId)!   // built on this entry, or the room that was kept
scene.add(room.root)
const spot = room.visitorCells[0]          // by the door, on the floor, out of everybody's way
```

Taking a thing out of a room and leaving it somewhere in it:

```ts
room.pickups.get(itemId)?.removeFromParent()   // picked up: the batch stops drawing it
room.leave(itemId, anchorId)                   // put down: on the surface that anchor belongs to
```

## How to modify this blackbox safely

A real art kit is a new `Dressing`, not a change here. A dressing that wants its buildings batched has only to return indexed meshes on shared materials; welding a building's own pieces per material first, the way `@gb/kitbash` does, keeps the batch's instance count down but is not required. A kit that wants its far buildings cheap implements `shell(plot, size, charter)`: the walls and roof on the same footprint, with nothing on them that is only read from the pavement, and everything else stays in `building`. What a dressing answered, read so that nothing it does can empty the street, is `src/seam.ts` alone. How far the detail reaches is `DETAIL_RADIUS` in `src/lod/near.ts` alone, which buildings are near `src/lod/near.ts`, how they come and go `src/lod/detail.ts`, and how rooms are kept and let go `src/lod/rooms.ts`. Where a visitor may stand is `src/visitors.ts` alone. A kit that wants worn road paint implements `marking(paint)`, one that wants its own rubbish material implements `clutter()`, and one whose buildings should light the street implements `lights(plot, size, charter)`; leave any of them out and the street gets a plain one, or no light. How many emitters are live and how they are picked is `src/lights/city-lights.ts` alone; what a face looking down is lit by is `CEILING_FILL` in `src/fill.ts` alone; the shell of a room and its metre UVs are `src/shell.ts` and `src/metre-uv.ts`. What the ground is made of is the dressing's (`ground(kind)`); what the street has been through is this box's, and the two compose, so a pale kit surface will read pale through the film however dark the film is. Anything that needs the renderer, the camera, input or a frame loop belongs in the app, not in this box: everything here builds objects and returns them, which is why it is tested in Node with no browser. Where a thing left in a room lands is `src/surface.ts` and `src/leaving.ts` alone: the first measures the top of a piece off its triangles rather than off a table, so a kit that redraws a counter needs nothing here, and the second is the one rule both the build and `leave` go through. How a room's things are drawn together is `src/pickups.ts` alone. Retuning how much rubbish a street carries is `CLUTTER_DENSITY` alone; retuning what a piece of rubbish looks like is `src/clutter/models.ts` alone, and how big it is `src/clutter/catalog.ts`, which the placement reads. How big a piece of surface detail is in the real world is `src/street/sizes.ts` alone. Run `pnpm --filter @gb/scene test`.
