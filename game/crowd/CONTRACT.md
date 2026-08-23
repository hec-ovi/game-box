# @gb/crowd contract

contractVersion: 0.6.0

## Purpose

Keeps a city's streets populated: pedestrians who appear on the pavement near the player, walk somewhere real, cross the road at a crossing, face where they are going, step around each other and around the player, stop and turn to whoever talks to them, and are retired once the player has left them behind.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Crowd.create(deps, options?)` | `deps`: `{ world, nav, cast, hazards?, ground?, people?, seed? }` | `world` is a loaded `@gb/world` `World`; `nav` is a `CrowdNav` (a `@gb/nav` `CityNav` is one); `cast` is a `CrowdCast`; `seed` defaults to `${world.seed}/crowd` |
| `deps.hazards` | `Hazards` in [src/ports.ts](src/ports.ts) | what is moving on the roads. With none, walkers cross without looking |
| `deps.ground` | `CrowdGround` in [src/ports.ts](src/ports.ts) | the ground the whole world stands on, city and country alike. A `@gb/land` `Land` is one. With none, the city grid is all there is and there is nowhere to stand past its edge |
| `deps.people` | `CrowdPeople` in [src/ports.ts](src/ports.ts) | who is out on the street. With none, the crowd mints strangers of its own |
| `options` | `Partial<CrowdOptions>` in [src/options.ts](src/options.ts), defaults in `CROWD_DEFAULTS` | any subset; contradictory numbers are settled, not rejected |
| `update(seconds, viewer)` | frame time in seconds, `viewer` a `Point` in metres | call once per frame with where the player is standing; walkers keep their distance from it |
| `follow(who)` | `Companion`: `{ npc, at?, actor? }` in [src/ports.ts](src/ports.ts) | `npc` is a `@gb/world` `Npc`; `at` is where they set off from, defaulting to where the player was last seen; `actor` is a body the game already has, and with none the crowd asks its cast for one. Following twice is following once |
| `stopFollowing(npcId)` | the `Npc` id | unknown ids are ignored |
| `attend(npcId, x, y, z)` | the `Npc` id of anybody on the street or walking with the player, and the point they should face, in metres, Y up | the point is where somebody's eyes are: the body turns to it and the head looks at it. An id nobody answers to is not an error |
| `SceneCast(cast, root)` | a `@gb/cast` `Cast` (`CastSpawner`), a `three` `Object3D` | the cast is loaded; `root` is in the scene |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `Crowd.walkers()` | `readonly WalkerView[]` in [src/ports.ts](src/ports.ts) | a snapshot: id, position in metres, heading in radians, `walking`, `waiting` (for traffic or for the person in front) or `idle`, the clip playing, metres left on the trip |
| `Crowd.count` | number | how many pedestrians are alive right now, never above `population` |
| `Crowd.following()` | `readonly WalkerView[]` | the companions, in the order they joined |
| `Crowd.person(id)` | `Npc` or undefined | who a walker or a companion is, by the id their view carries. Unknown ids answer nothing |
| `Crowd.options` | `CrowdOptions` | the settled numbers, after defaults and clamping |
| `Crowd.clear()` | | every body released, count back to zero |
| `Crowd.attend(...)` | `Attention` in [src/attention.ts](src/attention.ts) | a hold: `face(x, y, z)` moves the point as the player moves, `release()` lets them carry on, `held` says whether the hold is still worth anything. A hold on somebody who has since gone home does nothing |
| `SceneCast.spawn(npc)` | `CrowdActor` | a `@gb/cast` body parented to `root`, ready to be moved |
| `SceneCast.members()` | `ReadonlyMap<string, CastMember>`, the `@gb/cast` member | the body each person out here is wearing, by their NPC id. Live: an entry appears when they are given a body and is gone the moment it is handed back |
| `SceneCast.parked` | number | bodies waiting to be reused |

### Reaching somebody's body

Making a walker talk with their hands, or anything else done to a person rather than to a pedestrian, goes through `SceneCast.members()`: `members().get(npcId)` is the `@gb/cast` `CastMember` that person is wearing this frame, or nothing when they are not out here. It is the same call, in the same shape, that `CastDressing.members()` answers for the people standing at posts indoors, so the game asks one question one way whoever it is talking to.

It is deliberately not on `Attention`. A hold means one thing, this walker is dealing with the player, and it is handed out for as long as a conversation lasts. A live body hung on it would make every hold a licence to drive that body, and would leave bodies reachable only through a hold, so the next thing that wants one (handing an item over, lip sync) needs a second door. The body belongs where it is owned: `SceneCast` spawns it, parks it and recycles it, and is the only thing that knows the moment it stops being that person's.

**Never keep a `CastMember`.** Bodies are recycled, so one held past its walker is not dead, it is somebody else's arms. Look the id up again on the frame you use it, and treat `undefined` the way you treat `held === false`: that person has gone.

The gesture channel is the caller's: `gesture` and `stopGesture`, over the names in `@gb/cast`'s `GESTURES`, layer on the upper body and leave the walk cycle alone. Where the body stands, which way it faces and what it is playing underneath are the crowd's, written every frame, so `play`, `object.position` and `object.rotation` are not yours to set.

Positions, headings and clips reach the world through `CrowdActor`: `placeAt(x, y, z)`, `faceTo(heading)`, `play(clip)`, `release()`, and optionally `lookAt(x, y, z)` and `lookAway()` for a body that can turn its head. Implement it (and `CrowdCast.spawn`) to drive something other than `@gb/cast`, or to test with no art at all. A body with no head turn in it still stops and still faces whoever is talking to it.

## Errors (closed set)

None. Nothing here throws and nothing returns a failure: a city with no pavement gets no walkers, a walker with nowhere reachable to go is retired, a companion with nowhere to stand stands still, a hold on somebody nobody knows holds nobody, and an unknown clip name is the cast's business to ignore.

## Dependencies

- `@gb/world` contract (game/world/CONTRACT.md): the grid, cell kinds, `METRICS`, the `Npc` shape.
- `@gb/nav` contract (game/nav/CONTRACT.md): `path` and `waypoints` over that grid, through the `CrowdNav` port.
- `@gb/cast` contract (game/cast/CONTRACT.md): bodies and clip names, through `SceneCast`.
- `@gb/kit` contract (game/kit/CONTRACT.md): the `Rng`.
- `three`, for the `Object3D` a `SceneCast` parents bodies to. The crowd itself has no three.js in it.

The ground and the traffic arrive through ports, so nothing here imports `@gb/land` or `@gb/traffic`.

## Invariants

- One metre is one unit, Y up. `heading` is three.js `rotation.y`: a body at zero looks north (-Z), the way `@gb/cast` stands somebody up and the way the player's own heading works, and it grows anticlockwise seen from above, so -PI/2 looks east (+X). A walker's heading is the yaw that points its own -Z along the way it is stepping, so the walk cycle always runs forwards.
- Same seed, same crowd, down to the last step: every walker's numbers come from `Rng.fork("walker/<serial>")`, and nothing here reads `Math.random` or a clock. People do push each other about, so what one walker does depends on who else is on the street.
- A walker follows a route from `@gb/nav` corner to corner, leaning around whoever is in the way. Every step, the route's own and any step around somebody, is taken only onto ground it may stand on, so they cross roads but never stand inside a building, a mountain or water. A corner is turned when they are within a third of a metre of it, not when they stand on the spot: asking for the spot would let one person standing on a corner hold up everybody whose route turns there.
- **Roads are crossed at crossings.** A crossing is where a pavement run ends against a road and carries on at a corner on the far kerb, which is what a junction leaves behind. Stepping off the long side of a band, with the road running on beside you, is the middle of the block and is not one, however much pavement is behind you: a pavement is two cells deep, so there is pavement behind you the whole length of it. **A crossing is as wide as the road it crosses**, up to `@gb/world`'s `WIDEST_ROADWAY_CELLS`, so an avenue and the road out of the valley are crossings the same as a street is. Every crossing in the city is found once when the crowd is created, and in the cities this box has walked they tie every stretch of pavement into one network, so a pedestrian can reach any pavement in town without ever walking down a roadway. On a generated 117 by 115 town that is 98 crossings tying all 36 stretches of pavement together.
- A route that steps into the road anywhere else is mended: the walker walks along the pavement to the shortest way round by crossings, one or two of them, and comes out where the route was going. The pavement legs are `@gb/nav`'s own routes, refused if they would step into the road themselves, so mending a crossing never invents another one. Up to three roadways on one trip are mended this way.
- Nobody walks to the other end of town for a crossing. `crossingDetour` metres is what a walker will go out of their way; past that they cross where the route does, which is still a look both ways, never a walk into the traffic.
- Nobody is ever closer to anybody than `personalSpace`: a step that would enter somebody's is refused, and a body already inside one may only move out. That holds for the player too, who is one more body in the way, and for the moment somebody is born: a spot with somebody standing in it is not spawned on.
- Walkers lean away from where they would meet somebody, not from where that somebody is standing now, looking `anticipate` seconds ahead. Two people on courses that cross ease apart while still several metres apart, so the correction is small and early rather than a swerve at arm's length. The room they want is arm's length plus half a metre plus more again with the speed they are closing, so a stranger at walking pace gets more room than one standing still.
- Turning is not the only answer. A walker behind somebody going the same way slows to their pace and follows: on a pavement too narrow to pass, that is a queue rather than a scrum. Somebody coming the other way is passed on the right, the same side every time, and never at less than a third pace, so squeezing past is slow but never a standstill.
- A walker that cannot go the way it wants steps to the side or slides along the wall rather than stopping dead. Being boxed in is measured by the ground gained on where it is going, never by the ground covered, because somebody shoved to and fro in a scrum at a crossing covers plenty of metres and gets nowhere: `stuckSeconds` without gaining a quarter of a metre and it drops its route and asks for another. A walker standing about that the player walks into cuts its pause short and moves off.
- **A walker leaving the pavement looks for as long as the crossing takes.** Given `Hazards`, it measures how much road is in front of it, works out how long it will be out there at its own walking pace, and holds on the kerb, standing in an idle rather than frozen mid-stride, while anything moving would come within its personal space of it *while it is crossing*. So the question is asked about where the walker will be when each car arrives, not about the kerb it is standing on: a car in the oncoming lanes counts against the moment the walker reaches the oncoming lanes. That is what a wide road needs. Ten metres of street is seven seconds of walking; fourteen metres of avenue is ten, five of them in the oncoming half, and a car covers seventy metres in five seconds at an avenue's speed limit, so a look sized at the kerb alone would send people out in front of it. `kerbLook` is the least a walker ever looks, not the whole of it. Once in the road it keeps going, so a crossing is never abandoned half way, and now the decision at the kerb covered the whole way over. Anything slower than `hazardSpeed` is standing still rather than coming, so a stopped car never strands anybody, and traffic that brakes for pedestrians cannot deadlock against pedestrians waiting for traffic.
- Walkers spawn only on the ground kinds in `options.pavement` (pavement and parks by default), between `spawnNear` and `spawnFar` of the player, and are retired past `retireRadius`, which is always kept at least 5 m outside `spawnFar` so nobody is deleted the frame they appear.
- **Feet stand on the ground the game gave us**, plus `options.kerbHeight` on pavement and park cells. Given a `CrowdGround` that is the whole world's ground, `@gb/land`'s included, so somebody out of town stands on the hillside rather than at zero. With none, the city is flat at zero, which is what a city is, and only the kerb lifts anybody.
- **The grid stops at the edge of town and the world does not.** Inside it, what may be walked on is `@gb/nav`'s answer. Outside it, it is the ground source's `walkableAt`, and with no ground source there is nowhere out there at all. Routes are a city thing: past the edge of the map a companion walks straight at where they are going and slides around whatever is in the way.
- **Every walker is somebody.** `walkers()` and `following()` report `Npc` ids, and `person(id)` hands the person back, so the game can name whoever the player is looking at and talk to them. Given a `CrowdPeople`, the people on the street are the game's own, `world.npc(walker.id)` resolves, and nobody is out twice at once, companions included: somebody already walking the street who is asked to follow the player leaves the pavement first, so joining you is a change of job rather than a second body. With none, the crowd mints strangers from `npc_900000` up: they are in no world, own nothing and know nothing, but they still have a name, a role and an id that answers.
- A companion walks to a spot `followGap` behind the way the player is going, fanned out either side so two of them never want the same pair of shoes, and moved along the fan when that spot is inside a wall. **When no spot on the fan is open they stand still**: standing still is a companion waiting a moment, and standing on the player is a companion inside their head. They stand where they get to and set off again when the player does. They are `Walker`s underneath, so they take routes from `@gb/nav`, keep out of everybody the way pedestrians do, and wait at kerbs for traffic. They follow the player rather than the crossings, because where the player went is where they are going.
- Keeping up has three gears: they walk inside `catchUp`, jog up to the player's running speed beyond it, which makes up ground round a corner, and are put back on their own spot past `lostRadius`, which is a last resort for somebody left the other side of the city rather than a way of following. That spot is always open ground, never wherever the player happens to be standing.
- **Somebody being talked to stops and turns to face you.** Held, they stand where they are in an idle, whatever they were doing: a walker mid-route keeps the route and walks the rest of it afterwards, and a companion stops keeping up and catches up again once let go. The body eases round rather than snapping, quickly while it has a way to go and softly as it arrives, never faster than 4 radians a second, so the whole way round takes about a second. The head goes first and is never turned more than 1.25 radians off the shoulders it is on, so a person glances over their shoulder and the body brings the rest; once the body is round, the head is straight at you. Let go, they come round to the way they were walking before they set off, rather than sliding away sideways in the wrong direction.
- A hold outlives whoever it is on. Somebody retired mid-conversation, by distance or by `clear()`, ends the hold: `held` goes false, and facing them or letting go of them after that does nothing. Nothing about being held draws on an `Rng` or a clock, so the same seed still gives the same crowd.
- Companions are never retired by distance and outlive anything the pedestrians do, but `clear()` sends them home with everybody else. A game that tears its city down and rebuilds it reads `following()` first and calls `follow` again after, which is also how a companion survives the player going into a building and coming back out.
- **A body answers to whoever is wearing it and to nobody else.** `SceneCast.members()` gains an entry when somebody is given a body and loses it the moment that body is handed back, by distance, by `clear()` or by `stopFollowing`. Ask for somebody who has gone home and the answer is nothing, never the stranger now wearing what they wore. Spawn one person twice and the newest body is theirs; the older one going home does not blank them.
- A body is parked with its hands down and its head straight. Whatever it was doing when its walker was retired, `stopGesture` and `lookAway` are called before it goes back in the pool, so somebody retired mid-sentence does not come back as a passer-by talking to nobody.
- `SceneCast` recycles bodies, because `@gb/cast` keeps a mixer per body it spawns and offers no way to hand one back. A retired body leaves the scene graph and waits for the next walker of the same body kind, preferring one that wanted the same variant. So the faces on the street are drawn once and reused, rather than a fresh skeleton per passer-by.

## Standing it up

```ts
const bodies = new SceneCast(cast, walkers)  // walkers: an Object3D already in the scene
const crowd = Crowd.create({ world, nav, cast: bodies, hazards: traffic, ground: land, people })
crowd.update(delta, player.position)       // every frame
const who = crowd.person(walker.id)        // whoever the player is looking at

const held = crowd.attend(who.id, eye.x, eye.y, eye.z)  // they stop and turn to you
held.face(eye.x, eye.y, eye.z)             // every frame, as the player moves
held.release()                             // and they walk on
```

While they talk, their body is `bodies.members().get(who.id)`, looked up each time rather than kept:

```ts
bodies.members().get(who.id)?.gesture(CLIPS.talk)      // the turn starts
bodies.members().get(who.id)?.stopGesture()            // the turn ends
```

Nothing needs a null check beyond the `?.`: somebody retired mid-conversation answers nothing here and `held` goes false the same frame, which is the game's cue to close the panel.

`ground: land` is the whole line: a `@gb/land` `Land` already answers `heightAt` and `walkableAt` for the entire landscape. `people` is optional; give it one to put the city's own residents on the pavement:

```ts
const residents: Npc[] = whoIsOutToday()          // the game's own people, from @gb/world
const people = { street: (serial, rng) => rng.pick(residents) }
```

Whoever it hands over walks until the player leaves them behind, and the crowd never asks for the same person while they are already on the street or walking with the player.

## How to modify this blackbox safely

Bodies by id live in `src/scene-cast.ts`, next to the pool that recycles them, because they are one lifetime: an entry and a parked body are the same fact read two ways, and splitting them is how a caller ends up holding a stranger. Being talked to lives in `src/attention.ts`: the hold the game keeps, how far a head turns, and where a body at a given heading may look. Companions live in `src/escort.ts` and `src/follower.ts`, and own nothing but where a walker is going: who is a companion is `@gb/play`'s business, adding and removing them is `@gb/quest`'s, and neither is imported here. Steering lives in `src/space.ts` and is a pass over the same routes, never a change to `@gb/nav`: the routes stay the city's business and the elbows stay this box's. Crossings are the same shape of thing: `src/sides.ts` labels the stretches of pavement, `src/crossings.ts` finds the gaps between them and answers which way round to walk, and `src/router.ts` is the one pass that mends a route onto them. Interior crowds need a second navigation source, so widen `CrowdNav` before widening `Crowd`. Anything to do with vehicles is `@gb/traffic`. Run `pnpm --filter @gb/crowd test`.

`node tools/walk-city.ts <bundle.json>` walks a real generated city rather than the hand-laid town the tests use: it reports the stretches of pavement and the crossings between them, sends one pedestrian from one edge of town to the other, counts how many of their crossings were at a crossing, and prices a full crowd on that city.

Measured on a 48x48 cell city with bodies stubbed out: 36 us per update for 32 walkers, 60 us for 48, 101 us for 96, worst frame 0.35 ms including path searches. On generated cities the same crowd costs 15 us for 14 walkers and 37 us for 32, with half the frames under 0.04 ms and 99 of a hundred under 0.15 ms; the long frames are `@gb/nav` searches on a big grid, which is what a route costs there whether it is mended or not. Mending routes onto crossings adds about 2 us per update at 32 walkers, because it costs two more short searches on the frame a walker is given a route and nothing at all on any other. Finding every crossing in the city costs 0.35 ms once on a 48x48 grid and 1.1 ms on a 117x115 generated town, at `Crowd.create`. Reading the crowd is most of the rest: everybody is bucketed once a frame, each walker scans one three-by-three block of buckets once, and the answer is reused for every question it asks that frame, so the cost grows with the crowd rather than with the crowd squared. Looking before crossing costs nothing measurable at 32 walkers with a dozen cars on the roads: a walker already in the road stops asking after one lookup, and measuring the road ahead is a few dozen grid reads on the one frame somebody is standing at a kerb. A companion costs under a microsecond a frame, three of them with no crowd around 2.5 us. Holding somebody costs nothing measurable and nothing that grows with the crowd: 32 walkers cost 38 us an update with nobody held and 34 to 36 us with somebody held, 96 walkers 148 us either way, because a held walker turns on the spot instead of walking a route. The cost that matters at a few dozen walkers is still the animation the cast does, not the walking.
