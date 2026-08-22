# @gb/crowd contract

contractVersion: 0.1.0

## Purpose

Keeps a city's streets populated: pedestrians who appear on the pavement near the player, walk somewhere real, face where they are going, and are retired once the player has left them behind.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Crowd.create(deps, options?)` | `deps`: `{ world, nav, cast, seed? }` | `world` is a loaded `@gb/world` `World`; `nav` is a `CrowdNav` (a `@gb/nav` `CityNav` is one); `cast` is a `CrowdCast`; `seed` defaults to `${world.seed}/crowd` |
| `options` | `Partial<CrowdOptions>` in [src/options.ts](src/options.ts), defaults in `CROWD_DEFAULTS` | any subset; contradictory numbers are settled, not rejected |
| `update(seconds, viewer)` | frame time in seconds, `viewer` a `Point` in metres | call once per frame with where the player is standing |
| `SceneCast(cast, root)` | a `@gb/cast` `Cast` (`CastSpawner`), a `three` `Object3D` | the cast is loaded; `root` is in the scene |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `Crowd.walkers()` | `readonly WalkerView[]` in [src/ports.ts](src/ports.ts) | a snapshot: id, position in metres, heading in radians, `walking` or `idle`, the clip playing, metres left on the trip |
| `Crowd.count` | number | how many are alive right now, never above `population` |
| `Crowd.options` | `CrowdOptions` | the settled numbers, after defaults and clamping |
| `Crowd.clear()` | | every body released, count back to zero |
| `SceneCast.spawn(npc)` | `CrowdActor` | a `@gb/cast` body parented to `root`, ready to be moved |
| `SceneCast.parked` | number | bodies waiting to be reused |

Positions, headings and clips reach the world through `CrowdActor`: `placeAt(x, y, z)`, `faceTo(heading)`, `play(clip)`, `release()`. Implement it (and `CrowdCast.spawn`) to drive something other than `@gb/cast`, or to test with no art at all.

## Errors (closed set)

None. Nothing here throws and nothing returns a failure: a city with no pavement gets no walkers, a walker with nowhere reachable to go is retired, and an unknown clip name is the cast's business to ignore.

## Dependencies

- `@gb/world` contract (game/world/CONTRACT.md): the grid, cell kinds, `METRICS`, the `Npc` shape.
- `@gb/nav` contract (game/nav/CONTRACT.md): `path` and `waypoints` over that grid, through the `CrowdNav` port.
- `@gb/cast` contract (game/cast/CONTRACT.md): bodies and clip names, through `SceneCast`.
- `@gb/kit` contract (game/kit/CONTRACT.md): the `Rng`.
- `three`, for the `Object3D` a `SceneCast` parents bodies to. The crowd itself has no three.js in it.

## Invariants

- One metre is one unit, Y up. `heading` is yaw in radians about Y, zero facing north (-Z), the way `@gb/cast` spawns a body, growing towards east (+X).
- Same seed, same crowd. Every walker's numbers come from `Rng.fork("walker/<serial>")`, so the tenth walker draws the same stream whether they are the tenth or the only one, and spawning a new walker cannot move one already walking. No `Math.random`, no clock.
- A walker follows a route from `@gb/nav` exactly, corner to corner, so they cross roads but never stand inside a building, a mountain or water.
- Walkers spawn only on the ground kinds in `options.pavement` (pavement and parks by default), between `spawnNear` and `spawnFar` of the player, and are retired past `retireRadius`, which is always kept at least 5 m outside `spawnFar` so nobody is deleted the frame they appear.
- Feet sit on the kerb: `options.kerbHeight` above the roadway on pavement and park cells, zero elsewhere. Set it to 0 for flat ground.
- Walking pace is `METRICS.player.walkSpeed` give or take `speedSpread`, and a walker turns at `turnRate` towards the leg they are on, so corners are turned rather than snapped.
- One update does bounded work: at most `spawnsPerUpdate` new walkers and `routesPerUpdate` walkers re-routed, each trying at most `routeTries` destinations. A walker that cannot reach any of them is retired. A long frame is clipped to `maxStep` seconds of walking, so a stalled tab does not teleport the crowd.
- `SceneCast` recycles bodies, because `@gb/cast` keeps a mixer per body it spawns and offers no way to hand one back. A retired body leaves the scene graph and waits for the next walker of the same body kind, preferring one that wanted the same variant. So the faces on the street are drawn once and reused, rather than a fresh skeleton per passer-by.
- Pedestrians are scenery: they are minted here with ids from `npc_900000` up, are never added to the world, own nothing and know nothing. Anybody the player can talk to is a world NPC and belongs to somebody else's box.

## How to modify this blackbox safely

Walkers do not see each other and do not avoid the player: if the crowd needs to part around obstacles, that is steering, and it belongs here as a pass over the same routes, not as a change to `@gb/nav`. Interior crowds need a second navigation source, so widen `CrowdNav` before widening `Crowd`. Anything to do with vehicles is `@gb/traffic`. Run `pnpm --filter @gb/crowd test`.

Measured on a 48x48 cell city with bodies stubbed out: 3.3 us per update for 24 walkers, 6.0 us for 48, 12.1 us for 96, worst frame under 0.8 ms including path searches. The cost that matters at a few dozen walkers is the animation the cast does, not the walking.
