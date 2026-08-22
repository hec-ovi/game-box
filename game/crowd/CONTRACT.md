# @gb/crowd contract

contractVersion: 0.2.0

## Purpose

Keeps a city's streets populated: pedestrians who appear on the pavement near the player, walk somewhere real, face where they are going, step around each other and around the player, and are retired once the player has left them behind.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Crowd.create(deps, options?)` | `deps`: `{ world, nav, cast, seed? }` | `world` is a loaded `@gb/world` `World`; `nav` is a `CrowdNav` (a `@gb/nav` `CityNav` is one); `cast` is a `CrowdCast`; `seed` defaults to `${world.seed}/crowd` |
| `options` | `Partial<CrowdOptions>` in [src/options.ts](src/options.ts), defaults in `CROWD_DEFAULTS` | any subset; contradictory numbers are settled, not rejected |
| `update(seconds, viewer)` | frame time in seconds, `viewer` a `Point` in metres | call once per frame with where the player is standing; walkers keep their distance from it |
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

- One metre is one unit, Y up. `heading` is three.js `rotation.y`: a body at zero looks north (-Z), the way `@gb/cast` stands somebody up and the way the player's own heading works, and it grows anticlockwise seen from above, so -PI/2 looks east (+X). A walker's heading is the yaw that points its own -Z along the way it is stepping, so the walk cycle always runs forwards.
- Same seed, same crowd, down to the last step: every walker's numbers come from `Rng.fork("walker/<serial>")`, and nothing here reads `Math.random` or a clock. People do push each other about, so what one walker does depends on who else is on the street.
- A walker follows a route from `@gb/nav` corner to corner, leaning around whoever is in the way. Every step, the route's own and any step around somebody, is taken only onto ground `CrowdNav.walkable` allows, so they cross roads but never stand inside a building, a mountain or water.
- Nobody is ever closer to anybody than `personalSpace`: a step that would enter somebody's is refused, and a body already inside one may only move out. That holds for the player too, who is one more body in the way, and for the moment somebody is born: a spot with somebody standing in it is not spawned on.
- Somebody coming the other way is passed on the right, and a walker boxed in for `stuckSeconds` drops its route and asks for another rather than shuffling on the spot. A walker standing about that the player walks into cuts its pause short and moves off.
- Walkers spawn only on the ground kinds in `options.pavement` (pavement and parks by default), between `spawnNear` and `spawnFar` of the player, and are retired past `retireRadius`, which is always kept at least 5 m outside `spawnFar` so nobody is deleted the frame they appear.
- Feet sit on the kerb: `options.kerbHeight` above the roadway on pavement and park cells, zero elsewhere. Set it to 0 for flat ground.
- Walking pace is `METRICS.player.walkSpeed` give or take `speedSpread`, and a walker turns at `turnRate` towards the leg they are on, so corners are turned rather than snapped.
- One update does bounded work: at most `spawnsPerUpdate` new walkers and `routesPerUpdate` walkers re-routed, each trying at most `routeTries` destinations. A walker that cannot reach any of them is retired. A long frame is clipped to `maxStep` seconds of walking, so a stalled tab does not teleport the crowd.
- `SceneCast` recycles bodies, because `@gb/cast` keeps a mixer per body it spawns and offers no way to hand one back. A retired body leaves the scene graph and waits for the next walker of the same body kind, preferring one that wanted the same variant. So the faces on the street are drawn once and reused, rather than a fresh skeleton per passer-by.
- Pedestrians are scenery: they are minted here with ids from `npc_900000` up, are never added to the world, own nothing and know nothing. Anybody the player can talk to is a world NPC and belongs to somebody else's box.

## How to modify this blackbox safely

Steering lives in `src/space.ts` and is a pass over the same routes, never a change to `@gb/nav`: the routes stay the city's business and the elbows stay this box's. Interior crowds need a second navigation source, so widen `CrowdNav` before widening `Crowd`. Anything to do with vehicles is `@gb/traffic`. Run `pnpm --filter @gb/crowd test`.

Measured on a 48x48 cell city with bodies stubbed out: 12 us per update for 32 walkers, 20 us for 48, 46 us for 96, worst frame under 0.4 ms including path searches. Keeping people out of each other is about 9 us of the 12 at the default population: everybody is bucketed once a frame and each walker looks at one three-by-three block of buckets, so it grows with the crowd rather than with the crowd squared. The cost that matters at a few dozen walkers is still the animation the cast does, not the walking.
