# @gb/nav contract

contractVersion: 0.1.0

## Purpose

Walking routes across a generated city, read straight off its grid: who can get where, by which way, and how far.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `CityNav.from(world, costs?)` | a `@gb/world` `World` | `costs` may override the price of any cell kind |
| `path(from, to)` / `reachable(from, to)` | cell coordinates | out-of-bounds or blocked cells are answered, not thrown |
| `pathToDoor(world, from, plotId)` | a plot id | unknown ids return undefined |
| `waypoints(path)` | a path from `path()` | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `path` | `Cell[]` or undefined | starts at `from`, ends at `to`, every step to a walkable neighbour, never through a building or mountain |
| `reachable` | boolean | true exactly when `path` would return a route |
| `waypoints` | `Point[]` in metres | the same route with straight stretches collapsed to their corners |
| `walkable(cell)` | boolean | false outside the grid |

## Errors (closed set)

None. Every question has an answer: no route is `undefined`, not an exception.

## Dependencies

- `@gb/world` contract (game/world/CONTRACT.md): the grid and its cell kinds.

## Invariants

- Buildings, mountains and water are never crossed, and a diagonal step never squeezes between two blocked corners.
- Sidewalks cost least and roadways cost most, so pedestrians walk the pavement and cross only when the detour would cost more.
- No navmesh is baked and nothing is cached across a world change: the grid the city was generated on is the navigation data, which is why adding a building needs no rebuild.
- Search scratch space is reused between calls, so a street full of NPCs asking for routes does not allocate per path.
- A route on a city with no way through returns undefined rather than searching forever.

## How to modify this blackbox safely

Cell kinds gain a cost in `WALK_COST` or they become impassable by default. Vehicle routing belongs here too when it lands, as a second cost table over the same grid, not a second copy of the search. Run `pnpm --filter @gb/nav test`.
