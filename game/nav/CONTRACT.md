# @gb/nav contract

contractVersion: 0.2.0

## Purpose

Walking routes across a generated city, read straight off its grid: who can get where, by which way, and how far.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `CityNav.from(world, costs?)` | a `@gb/world` `World` | `costs` may override the price of any cell kind |
| `path(from, to)` / `reachable(from, to)` | cell coordinates: any walkable cell, a building's doorstep (`plot.entrance.cell`) included | out-of-bounds or blocked cells are answered, not thrown |
| `reachableFrom(start)` | a cell coordinate | a start you cannot stand on reaches nothing |
| `pathToDoor(world, from, plotId)` | a plot id | unknown ids return undefined |
| `waypoints(path)` | a path from `path()` | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `path` | `Cell[]` or undefined | starts at `from`, ends at `to`, every step to a walkable neighbour, never through a building or mountain, and no cheaper walk exists |
| `reachable` | boolean | true exactly when `path` would return a route |
| `reachableFrom` | `Reach` | everywhere that start can walk to, in one pass over the grid |
| `waypoints` | `Point[]` in metres | the same route with straight stretches collapsed to their corners |
| `walkable(cell)` | boolean | false outside the grid |

A `Reach` is a lookup, never another search:

| Param | Schema | Postconditions |
|---|---|---|
| `reaches(cell)` | boolean | false outside the grid; agrees with `reachable(start, cell)` for every cell |
| `reachesPlot(world, plotId)` | boolean | the building's doorstep; false when the id is unknown |
| `unreachablePlots(world)` | `string[]` | every plot id the start cannot walk to, in the world's own order |
| `from`, `cells`, `byteLength` | `Cell`, number, number | where it started, how many cells it covers, and what it costs to keep |

## Errors (closed set)

None. Every question has an answer: no route is `undefined`, not an exception.

## Doorsteps

A doorstep is an ordinary walkable cell. A companion spawned at `plot.entrance.cell`, or a walker on any pavement cell, routes with the same `path(from, to)` as everyone else; `pathToDoor` is only `path` with the destination looked up by plot id. Nothing is registered ahead of time.

## Dependencies

- `@gb/world` contract (game/world/CONTRACT.md): the grid and its cell kinds.

## Invariants

- A `mountain` cell is impassable, the same as `building` and `water`: `WALK_COST` prices all three infinite, so no route starts, ends or passes there. `@gb/world` owns the cell vocabulary; this box only prices it.
- Buildings, mountains and water are never crossed, and a diagonal step never squeezes between two blocked corners. `path`, `reachable` and `reachableFrom` all ask one cost grid the same question, so they cannot disagree about what is passable.
- Sidewalks cost least and roadways cost most, so pedestrians walk the pavement and cross only when the detour would cost more. The heuristic is priced at the cheapest ground in the table it was given, so overriding `costs` keeps routes cheapest rather than merely valid.
- The same world and the same question give the same route, always, however many other searches ran in between. Working memory is reused, never carried: each search stamps what it writes and reads nothing it did not stamp.
- No navmesh is baked and nothing is cached across a world change: the grid the city was generated on is the navigation data, which is why adding a building needs no rebuild.
- A `CityNav` allocates its search memory once and keeps it. After the first few searches a route costs only the array of cells it hands back, and `reachable` costs nothing at all.
- A route on a city with no way through returns undefined rather than searching forever.

## What it costs

Measured in Node 24 on generated cities, best of ten rounds.

| City | Grid | Plots | One cross-city route | One short hop | 200 searches allocate | Every plot, one by one | Every plot, one `reachableFrom` | `Reach` size |
|---|---|---|---|---|---|---|---|---|
| 1x2 blocks | 35x51 | 19 | 0.04 ms | 0.9 us | 0.01 MB | 0.001 s | 0.17 ms | 224 B |
| 7x7 blocks | 147x149 | 294 | 1.65 ms | 0.9 us | 0.01 MB | 0.48 s | 1.38 ms | 2.7 KB |
| 12x12 blocks | 247x251 | 904 | 4.44 ms | 0.9 us | 0.01 MB | 4.61 s | 4.04 ms | 7.8 KB |
| 24x24 blocks | 485x483 | 3180 | 13.68 ms | 0.5 us | 0.01 MB | 56.18 s | 13.42 ms | 29 KB |

A short hop is the shape the crowd asks for every frame: a few dozen cells, on whatever size of city. It costs the same on the largest grid as on the smallest, which is the point of keeping the scratch space rather than sizing it per search.

"Every plot, one by one" is one `reachable` per plot. One `reachableFrom` answers the same question for the whole city, and the answer is small enough to keep.

## How to modify this blackbox safely

Cell kinds gain a cost in `WALK_COST` or they become impassable by default. Vehicle routing belongs here too when it lands, as a second cost table over the same grid, not a second copy of the search. Anything that touches the searches has to keep two promises: reused memory must be stamped, not cleared, because clearing three city-sized arrays costs 77 us on a 485x483 grid against a 0.5 us search; and the same question asked twice must give the same route, which `tests/contract.test.ts` proves by answering a hundred questions on one searcher and on a hundred fresh ones. Run `pnpm --filter @gb/nav test`.
