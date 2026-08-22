# @gb/scene contract

contractVersion: 0.2.1

## Purpose

Turns a city into something you can stand in: ground, buildings and interiors as three.js objects, at the size and place the world says.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `buildCity(world, dressing)` | a `@gb/world` `World`, a `Dressing` | the world loaded, so its grid and plots agree |
| `buildInterior(world, interior, dressing)` | one of that world's interiors | |
| `Dressing` | `building`, `prop`, `ground`, `surface` | every object it returns has its origin at the centre of its base and faces north (-Z) unturned |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `buildCity` | `{ root, buildings, doorsteps, spawn }` | one object per plot at its footprint and height, its doorstep in metres on the pavement in front of it, a spawn on the pavement facing the first door in town |
| ground meshes | `root.children` named `ground:<cell kind>` | one mesh per surface, carrying its top faces and its kerbs, with position, normal and uv |
| `buildInterior` | `{ root, anchors, props, people, pickups, entrance, inward }` | floor, walls with the doorways cut out, ceiling, furniture standing on the floor, an empty object at every anchor carrying its kind |
| `storeyHeight(storeys)` | metres | ground floor taller than the ones above it |

## Errors (closed set)

None. Nothing here validates: a world that got this far already passed `@gb/world`.

## Dependencies

- `@gb/world` contract: the grid, the plots, the interiors and `METRICS`.
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

## How to modify this blackbox safely

A real art kit is a new `Dressing`, not a change here. Anything that needs the renderer, the camera, input or a frame loop belongs in the app, not in this box: everything here builds objects and returns them, which is why it is tested in Node with no browser. Run `pnpm --filter @gb/scene test`.
