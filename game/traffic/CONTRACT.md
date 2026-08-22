# @gb/traffic contract

contractVersion: 0.1.0

## Purpose

Drives cars around a generated city: reads its road graph, puts cars on lanes, follows the car in front, gives way at junctions, and brings traffic in and out around the player.

## Inputs

| Param | Type | Preconditions |
|---|---|---|
| `Traffic.fromWorld(world, options?)` | a `@gb/world` `World`, `TrafficOptions` | the world's `roads` are nodes and segments that resolve |
| `Traffic.populate(focus)` | `Point` in metres, `{ x, z }` | fills the streets in one go, for the moment a city opens |
| `Traffic.update(dt, focus)` | seconds since the last call, the player's position | `dt` outside `(0, maxStep]` is clamped, `NaN` is ignored |
| `LaneGraph.build(roads, shape)` | `Roads` from `world.toJSON().roads`, `GraphShape` | the same graph `fromWorld` builds, if you want it on its own |

`TrafficOptions`, all optional:

| Option | Default | What it does |
|---|---|---|
| `seed` | the world seed | every choice comes off this one stream |
| `maxCars` | 40 | held down to one car per 40 m of lane, so a small city cannot be flooded |
| `spawnRadius` | 140 m | cars appear on lanes within this of the focus |
| `despawnRadius` | 180 m | and are retired past it, always at least `spawnRadius` + 20 |
| `minSpawnDistance` | 35 m | nothing appears closer than this |
| `nearRadius` | 60 m | inside it every car moves every frame |
| `farStride` | 3 | outside it, one car in three per frame, over the time it missed |
| `maxStep` | 0.1 s | longest step a car integrates in one go |
| `roadway` | 3 cells, 6 m on a 2 m grid | width of the roadway the lanes are laid in |
| `rideHeight` | 0 | the y a model sits at |
| `bodies` | none | where scene objects come from, see below |

`CarBodies` is the seam to three.js: `acquire({ id, model })` returns a `CarBody` and `release(body, { id, model })` takes it back. A `CarBody` is anything with `position: { x, y, z }` and `rotation: { y }`, which a three.js `Object3D` already is, so this box imports no renderer and no loader. Left out, the traffic runs as pure simulation. `model` is one of `CAR_MODELS`, the file names of the Quaternius Realistic Car Pack (CC0): `NormalCar1`, `NormalCar2`, `SUV`, `Taxi`, `SportsCar`, `SportsCar2`, `Cop`.

## Outputs

| Param | Type | Postconditions |
|---|---|---|
| `Traffic.fromWorld` | `Result<Traffic, TrafficError>` | never throws, never partly built |
| `Traffic.cars()` | `readonly CarView[]` | live objects: `id`, `model`, `x`, `z`, `heading`, `speed`, `trackId`. Read only, and the same array every frame |
| `Traffic.count` | number | cars alive now |
| `Traffic.graph` | `LaneGraph` | `lanes`, `junctions`, `linksFrom(lane)`. A junction has `centre`, `half` and `contains(point)` |
| bodies | written in place | `position.x/y/z` and `rotation.y` of every car that moved this frame |

`heading` is radians around Y for a model whose nose points down +Z, which is `rotation.y` as it stands.

## Errors (closed set)

- `no-lanes`: no road segment is long enough to drive on. A city with no streets, or streets shorter than the junctions they join.
- `broken-graph`: a segment points at a node that is not in the graph.

`update` and `populate` never fail: with nowhere to put a car, no car appears.

## Dependencies

- `@gb/world` contract (game/world/CONTRACT.md): the road graph, `cellSize`, `cellCentre` and `METRICS` (car 4.5 m by 1.8 m).
- `@gb/kit` contract (game/kit/CONTRACT.md): `Rng` and `Result`.

## Invariants

- Right hand traffic, one lane each way, each lane centred on its half of the roadway, so a 1.8 m car in a 6 m roadway never leaves it. Turns through a junction are curves that stay inside the square the two roadways share.
- Following is Treiber's Intelligent Driver Model, so a car closes on the one in front and settles at a gap it could stop in. Cars on one lane keep their order: no overtaking, no driving through.
- One car is inside a junction at a time. It takes the junction on approach, only from the head of its queue and only when the road out has room, keeps it while it is crossing and gives it back on the far side. Cars arriving together give way to the right, and an all-round standoff goes to the earliest claim.
- A car that runs out of graph is retired, and so is one past `despawnRadius` or stuck out of sight for more than twelve seconds.
- Everything random comes from `@gb/kit`'s `Rng`, forked per car: the same seed, city and sequence of updates gives the same traffic, position for position.
- Cars are never created in front of a car already driving: a new one joins at the back of its lane.
- A segment's `lanes` count is not read. The graph carries no direction and no width, so the rule above is fixed here instead.

## How to modify this blackbox safely

The behaviour lives in three places and they stay separate: `idm.ts` is the car following model, `junctions.ts` is right of way, `lane-graph.ts` is the geometry lanes are cut from. Multi-lane roads, one way streets and traffic lights are all changes to `lane-graph.ts` plus one of the other two, not new boxes. Run `pnpm --filter @gb/traffic test`.
