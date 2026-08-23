# @gb/scene contract

contractVersion: 0.4.0

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
| `buildCity` | `{ root, buildings, doorsteps, spawn, markings }` | one object per plot at its footprint and height, its doorstep in metres on the pavement in front of it, a spawn on the pavement facing the first door in town |
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

Measured on the app's own city (seed `town`, 2 by 2 blocks, 51 by 51 cells, 20 plots), greybox dressing:

| Part of the city | Draws | How |
|---|---|---|
| ground and mountains | 5 | one mesh per surface, one instanced block for the ring |
| street markings | 2 | one instanced mesh per paint, 240 instances |
| buildings | 40 | two per plot, and a real kit's business |

The paint is two draws whatever the city's size: a bigger city is more instances in the same two meshes.

## How to modify this blackbox safely

A real art kit is a new `Dressing`, not a change here. A kit that wants worn road paint implements `marking(paint)`; leave it out and the street gets plain white and yellow. Anything that needs the renderer, the camera, input or a frame loop belongs in the app, not in this box: everything here builds objects and returns them, which is why it is tested in Node with no browser. Run `pnpm --filter @gb/scene test`.
