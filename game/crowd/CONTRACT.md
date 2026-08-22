# @gb/crowd contract

contractVersion: 0.2.0

## Purpose

Keeps a city's streets populated: pedestrians who appear on the pavement near the player, walk somewhere real, face where they are going, step around each other and around the player, and are retired once the player has left them behind.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Crowd.create(deps, options?)` | `deps`: `{ world, nav, cast, hazards?, seed? }` | `world` is a loaded `@gb/world` `World`; `nav` is a `CrowdNav` (a `@gb/nav` `CityNav` is one); `cast` is a `CrowdCast`; `hazards` is a `Hazards`, what is moving on the roads, and with none given walkers cross without looking; `seed` defaults to `${world.seed}/crowd` |
| `options` | `Partial<CrowdOptions>` in [src/options.ts](src/options.ts), defaults in `CROWD_DEFAULTS` | any subset; contradictory numbers are settled, not rejected |
| `update(seconds, viewer)` | frame time in seconds, `viewer` a `Point` in metres | call once per frame with where the player is standing; walkers keep their distance from it |
| `follow(who)` | `Companion`: `{ npc, at?, actor? }` in [src/crowd.ts](src/crowd.ts) | `npc` is a `@gb/world` `Npc`; `at` is where they set off from, defaulting to where the player was last seen; `actor` is a body the game already has, and with none the crowd asks its cast for one. Following twice is following once |
| `stopFollowing(npcId)` | the `Npc` id | unknown ids are ignored |
| `SceneCast(cast, root)` | a `@gb/cast` `Cast` (`CastSpawner`), a `three` `Object3D` | the cast is loaded; `root` is in the scene |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `Crowd.walkers()` | `readonly WalkerView[]` in [src/ports.ts](src/ports.ts) | a snapshot: id, position in metres, heading in radians, `walking`, `waiting` (for traffic or for the person in front) or `idle`, the clip playing, metres left on the trip |
| `Crowd.count` | number | how many pedestrians are alive right now, never above `population` |
| `Crowd.following()` | `readonly WalkerView[]` | the companions, in the order they joined, each `id` an `Npc` id |
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
- Walkers lean away from where they would meet somebody, not from where that somebody is standing now, looking `anticipate` seconds ahead. Two people on courses that cross ease apart while still several metres apart, so the correction is small and early rather than a swerve at arm's length. The room they want is arm's length plus half a metre plus more again with the speed they are closing, so a stranger at walking pace gets more room than one standing still.
- Turning is not the only answer. A walker behind somebody going the same way slows to their pace and follows: on a pavement too narrow to pass, that is a queue rather than a scrum. Somebody coming the other way is passed on the right, the same side every time, and never at less than a third pace, so squeezing past is slow but never a standstill.
- A walker that cannot go the way it wants steps to the side or slides along the wall rather than stopping dead, and one boxed in for `stuckSeconds` all the same drops its route and asks for another. A walker standing about that the player walks into cuts its pause short and moves off.
- A walker leaving the pavement looks first: given `Hazards`, it asks what is moving near the spot it is about to step into and holds on the kerb, standing in an idle rather than frozen mid-stride, while anything would come within its personal space in the next `kerbLook` seconds. Once in the road it keeps going, so a crossing is never abandoned half way. Anything slower than `hazardSpeed` is standing still rather than coming, so a stopped car never strands anybody, and traffic that brakes for pedestrians cannot deadlock against pedestrians waiting for traffic.
- Walkers spawn only on the ground kinds in `options.pavement` (pavement and parks by default), between `spawnNear` and `spawnFar` of the player, and are retired past `retireRadius`, which is always kept at least 5 m outside `spawnFar` so nobody is deleted the frame they appear.
- Feet sit on the kerb: `options.kerbHeight` above the roadway on pavement and park cells, zero elsewhere. Set it to 0 for flat ground.
- Walking pace is `METRICS.player.walkSpeed` give or take `speedSpread`, and a walker turns at `turnRate` towards the leg they are on, so corners are turned rather than snapped.
- One update does bounded work: at most `spawnsPerUpdate` new walkers and `routesPerUpdate` walkers re-routed, each trying at most `routeTries` destinations. A walker that cannot reach any of them is retired. A long frame is clipped to `maxStep` seconds of walking, so a stalled tab does not teleport the crowd.
- `SceneCast` recycles bodies, because `@gb/cast` keeps a mixer per body it spawns and offers no way to hand one back. A retired body leaves the scene graph and waits for the next walker of the same body kind, preferring one that wanted the same variant. So the faces on the street are drawn once and reused, rather than a fresh skeleton per passer-by.
- Pedestrians are scenery: they are minted here with ids from `npc_900000` up, are never added to the world, own nothing and know nothing. Anybody the player can talk to is a world NPC and belongs to somebody else's box.
- A companion walks to a spot `followGap` behind the way the player is going, fanned out either side so two of them never want the same pair of shoes, and moved along to open ground when that spot is inside a wall. They stand still when they get there and set off again when the player does. They are `Walker`s underneath, so they take routes from `@gb/nav`, keep out of everybody the way pedestrians do, and wait at kerbs for traffic.
- Keeping up has three gears: they walk inside `catchUp`, jog up to the player's running speed beyond it, which makes up ground round a corner, and are put back beside the player past `lostRadius`, which is a last resort for somebody left the other side of the city rather than a way of following. Whether that is out of sight is the game's business: it knows where the player is looking and this box does not.
- Companions are never retired by distance and outlive anything the pedestrians do, but `clear()` sends them home with everybody else. A game that tears its city down and rebuilds it reads `following()` first and calls `follow` again after, which is also how a companion survives the player going into a building and coming back out.

## How to modify this blackbox safely

Companions live in `src/follower.ts` and own nothing but where a walker is going: who is a companion is `@gb/play`'s business, adding and removing them is `@gb/quest`'s, and neither is imported here. Steering lives in `src/space.ts` and is a pass over the same routes, never a change to `@gb/nav`: the routes stay the city's business and the elbows stay this box's. Interior crowds need a second navigation source, so widen `CrowdNav` before widening `Crowd`. Anything to do with vehicles is `@gb/traffic`. Run `pnpm --filter @gb/crowd test`.

Measured on a 48x48 cell city with bodies stubbed out: 16 us per update for 32 walkers, 30 us for 48, 65 us for 96, worst frame under 0.5 ms including path searches. Reading the crowd is about 11 us of the 16 at the default population: everybody is bucketed once a frame, each walker scans one three-by-three block of buckets once, and the answer is reused for every question it asks that frame, so the cost grows with the crowd rather than with the crowd squared. Looking before crossing adds about 1 us at 32 walkers with a dozen cars on the roads, because a walker already in the road stops asking after one lookup. A companion costs under a microsecond a frame, three of them with no crowd around 2.5 us, because they only think about where the player is and ask `@gb/nav` for a route when the way there is not a straight line. The cost that matters at a few dozen walkers is still the animation the cast does, not the walking.
