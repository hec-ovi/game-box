# @gb/scene contract

contractVersion: 0.5.0

## Purpose

Turns a city into something you can stand in: ground, marked streets, buildings and interiors as three.js objects, at the size and place the world says.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `buildCity(world, dressing)` | a `@gb/world` `World`, a `Dressing` | the world loaded, so its grid and plots agree |
| `buildInterior(world, interior, dressing)` | one of that world's interiors | |
| `Dressing` | `building`, `prop`, `ground`, `surface`, `marking?` | every object it returns has its origin at the centre of its base and faces north (-Z) unturned |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `buildCity` | `{ root, buildings, doorsteps, add, spawn, markings }` | every plot standing at its footprint and height, its doorstep in metres on the pavement in front of it, a spawn on the pavement facing the first door in town |
| `buildings` | `ReadonlyMap<string, CityBuilding>` | one per plot, by plot id |
| `CityBuilding` | `plotId`, `bounds`, `visible` | the box it occupies in city metres, and a switch that takes it out of the city or puts it back with no rebuild |
| `add(plot)` | `CityBuilding` | one more plot built into the city that is already standing. Its ground is not repainted: the grid changed after the ground was laid, and the building covers it |
| `plotOf(hit)` | plot id, or undefined | which building a `THREE.Intersection` landed on. Buildings share buffers, so the object a ray hits is a batch and this is what turns the hit back into a plot |
| city meshes | `root.children` named `city:<material>` | one `THREE.BatchedMesh` per material every building is drawn with |
| ground meshes | `root.children` named `ground:<cell kind>` | one mesh per surface, carrying its top faces and its kerbs, with position, normal and uv |
| `markings` | `Marking[]` | every rectangle of paint on the streets: `kind`, `paint`, centre in metres, `width` across the road, `length` along it, `rot` |
| marking meshes | `root.children` named `markings:white` and `markings:yellow` | one instanced mesh per paint, one instance per marking, in the same order as `markings` |
| `MARKING` | metres | the sizes the paint is laid at, and the lift that keeps it off the road plane |
| `buildInterior` | `{ root, anchors, props, people, pickups, blockers, entrance, inward }` | floor, walls with the doorways cut out, ceiling, furniture standing on the floor, an empty object at every anchor carrying its kind |
| `blockers` | `PropFootprint[]` | one rectangle of floor per piece of furniture the player cannot walk through, measured off the object that was built |
| `PropFootprint` | `{ propId, prop, x, z, halfWidth, halfDepth, rot, height }`, `contains(x, z, margin?)`, `reaches(x, z, half)` | an oriented rectangle in interior metres: centre, half extents along the prop's own axes, the yaw it stands at, and how tall it is |
| `storeyHeight(storeys)` | metres | ground floor taller than the ones above it |

## Errors (closed set)

None. Nothing here validates: a world that got this far already passed `@gb/world`.

## Dependencies

- `@gb/world` contract: the grid, the plots, the interiors, the road graph (`toJSON().roads`) and `METRICS`.
- `three`.

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
- Interiors are built in their own coordinates, entered rather than carried: the city does not hold every room all the time.
- Furniture collision is measured, never looked up. Each `blockers` rectangle is the bounding box of the object that was actually built, taken in the frame that object was placed in, so a kit that draws a wider table gets a wider footprint and what stops the player cannot drift from what they can see. A prop with nothing drawable in it gets no rectangle.
- `blockers` is in the same frame as `entrance` and the anchors: metres, interior coordinates, `rot` the three.js yaw the object carries. The half extents run across the prop's front and through it, so a turned counter is a turned rectangle and `contains(x, z, margin)` with the player's radius is the whole test. The caller needs no conversion.
- What blocks: anything standing more than `STEP_OVER_HEIGHT` (0.25 m) off the floor. Below that you walk over it rather than into it, which is a rug at 2 cm; a bar counter at 1.1 m stops you. Nothing else is exempt. Whether staff may pass behind a counter, or an NPC may stand in the chair their anchor sits in, is the caller's decision: this box only says where the furniture is.
- Nothing published can seal the player in. A rectangle that reaches into the floor a doorway needs (the door width plus 20 cm, the same hole cut in the wall) is left out, so furniture the generator parked on a door cannot lock the room; the prop is still drawn.

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

## How to modify this blackbox safely

A real art kit is a new `Dressing`, not a change here. A dressing that wants its buildings batched has only to return indexed meshes on shared materials; welding a building's own pieces per material first, the way `@gb/kitbash` does, keeps the batch's instance count down but is not required. A kit that wants worn road paint implements `marking(paint)`; leave it out and the street gets plain white and yellow. Anything that needs the renderer, the camera, input or a frame loop belongs in the app, not in this box: everything here builds objects and returns them, which is why it is tested in Node with no browser. Run `pnpm --filter @gb/scene test`.
