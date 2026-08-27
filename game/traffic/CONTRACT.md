# @gb/traffic contract

contractVersion: 0.8.0

## Purpose

Drives cars around a generated city: reads its road graph, puts cars on lanes, follows the car in front, gives way at junctions, and brings traffic in and out around the player.

## Inputs

| Param | Type | Preconditions |
|---|---|---|
| `Traffic.fromWorld(world, options?)` | a `@gb/world` `World`, `TrafficOptions` | the world's `roads` are nodes and segments that resolve |
| `Traffic.populate(focus)` | `Point` in metres, `{ x, z }` | fills the streets in one go, for the moment a city opens |
| `Traffic.update(dt, focus)` | seconds since the last call, the player's position | `dt` outside `(0, maxStep]` is clamped, `NaN` is ignored |
| `Traffic.handOver(carId)` | the `id` off a `CarView` | takes that car off the road for good, for somebody else to drive. An id nobody answers to is not an error |
| `LaneGraph.build(roads, shape)` | `Roads` from `world.toJSON().roads`, `GraphShape`: `cellSize` and `carLength` | the same graph `fromWorld` builds, if you want it on its own. How wide each road is comes from its own class, not from here |
| `CarPack.load(url, root)` | where the app serves `cars.glb`, a `three` `Object3D` | the pack is built; cars are added to and removed from `root` |
| `CarPack.parse(bytes, root)` | the pack's bytes, a `three` `Object3D` | the same, for bytes the app already fetched |
| `CarPack.update()` | | once a frame, after `Traffic.update`, to roll the wheels |
| `CarPack.setTime(hours)` | hours, 0 to 24, wrapping | whoever owns the clock calls it; the lamps come on after dark. Two numbers a frame, however many cars |

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
| `rideHeight` | 0 | the y a model sits at |
| `bodies` | none | where scene objects come from, see below |
| `obstacles` | none | who is standing in the road, see below |

`CarBodies` is the seam to three.js: `acquire({ id, model })` returns a `CarBody` and `release(body, { id, model })` takes it back. A `CarBody` is anything with `position: { x, y, z }` and `rotation: { y }`, which a three.js `Object3D` already is, so the simulation itself never touches a renderer. Left out, the traffic runs as pure simulation, which is how the tests drive it. `model` is one of `CAR_MODELS`: `NormalCar1`, `NormalCar2`, `SUV`, `Taxi`, `SportsCar`, `SportsCar2`, `Cop`, `GranTurismo`, `Concept`, `Patrol`.

`Obstacles` is the seam to the people: `near(centre, radius)` returns everything standing or walking within `radius` metres of `centre`, each one an `{ x, z, radius? }` in metres (half a metre if the radius is left out, which is a person). It is read once per update and nothing is kept between calls, so somebody stepping back onto the pavement clears the road the same frame, and the array may be the same one every call. The port knows nothing about roads and carries no velocity: traffic works out for itself who is in which lane, and treats everybody as if they will still be there when the car arrives. Left out, cars have only each other to avoid.

Whoever fills it puts everybody in it who can be run over: the walkers, the companions and the player. A person is read once per update whether they are on the pavement or in the road, so the port costs the same to feed either way.

`CarPack` is the one that draws them. Three lines put cars on the streets:

```ts
const bodies = await CarPack.load(`${base}/cars.glb`, scene)
const traffic = Traffic.fromWorld(world, { bodies, obstacles })   // Result, check .ok
// every frame: traffic.value.update(dt, player); bodies.update()
// and whenever the clock moves: bodies.setTime(clock.hours)
```

Without `setTime` the pack stays at midday and the lamps never light.

## Outputs

| Param | Type | Postconditions |
|---|---|---|
| `Traffic.fromWorld` | `Result<Traffic, TrafficError>` | never throws, never partly built |
| `Traffic.cars()` | `readonly CarView[]` | live objects: `id`, `model`, `x`, `z`, `heading`, `speed`, `trackId`. Read only, and the same array every frame |
| `Traffic.count` | number | cars alive now |
| `Traffic.handOver` | `CarHandover` or undefined | a snapshot, not the live car: `id`, `model`, `x`, `z`, `heading`, `speed`. Undefined when no car has that id |
| `Traffic.graph` | `LaneGraph` | `lanes`, `junctions`, `linksFrom(lane)`. A `Lane` carries its `kind`, its `lane` (counted from the centreline out) and how many `lanes` run its way. A junction has `centre`, `half` and `contains(point)` |
| bodies | written in place | `position.x/y/z` and `rotation.y` of every car that moved this frame |
| `CarPack` | a `CarBodies` | pass it as `bodies`. `root` is where the cars hang, `parked` is how many bodies wait for reuse, `paint` is the one material every car wears and `paint.lamps` is how lit the lamps are, 0 by day and 1 in the dark |

`heading` is radians around Y for a model whose nose points down +Z, which is `rotation.y` as it stands.

## Errors (closed set)

- `no-lanes`: no road segment is long enough to drive on. A city with no streets, or streets shorter than the junctions they join.
- `broken-graph`: a segment points at a node that is not in the graph.

`update` and `populate` never fail: with nowhere to put a car, no car appears.

Loading art is the one thing that throws, as `CarPackError`:

- `unreadable-pack`: the file would not fetch, or is not a GLB three can read.
- `incomplete-pack`: it read, but a model or one of its wheels is not in it.

Catch it and leave `bodies` out. The traffic still runs; it is just not drawn.

## Dependencies

- `@gb/world` contract (game/world/CONTRACT.md): the road graph, `cellSize`, `cellCentre` and `METRICS` (car 4.5 m by 1.8 m).
- `@gb/kit` contract (game/kit/CONTRACT.md): `Rng` and `Result`.
- `three`, `three/webgpu` and `three/tsl`, for `CarPack` and `CarPaint` alone: the loader, the pooled `Object3D`s, the wheels and the one node material the cars are painted with, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself. The simulation has no three.js in it.

## Invariants

- **A road is as wide as its class, and carries the lanes its class carries.** Right hand traffic, the roadway split evenly, each lane centred on its own share of it, so a 1.8 m car never leaves the roadway it is driving:

  | kind | roadway | lanes | lane centres from the centreline | speed limit |
  |---|---|---|---|---|
  | `street` | 10 m | 2 | 2.5 m | 8.5 m/s |
  | `avenue` | 14 m | 4 | 1.75 and 5.25 m | 13.9 m/s |
  | `exit` | 18 m | 4 | 2.25 and 6.75 m | 16.7 m/s |

  An even split rather than lanes and shoulders: one rule reads every class, and a 4.5 m lane on the road out is a lane a car sits in the middle of rather than a lane plus a strip nothing uses. Widths come from `@gb/world`'s `METRICS.road`, the count from the segment's own `lanes`, and the metres are `roadwayCells` times the world's `cellSize`, so a class that widens widens here with nothing to change.
- Following is Treiber's Intelligent Driver Model, so a car closes on the one in front and settles at a gap it could stop in. Cars on one lane keep their order: no overtaking, no driving through. **A car keeps the lane it is in until the next junction**, so a slow car on a four lane road is followed rather than passed; which lane it leaves the junction in is the turn it takes, below.
- Somebody in the road is the car in front that never moves off: they go into the same following model at zero speed, so a car eases down and stops about two metres short of them, and pulls away again when they step clear. It brakes, it never swerves and it never sounds a horn. A person counts as being in the way when they are within half a car's width of the lane the car is driving, so somebody on the kerb of a ten metre street is two and a half metres clear of the nearest lane and stops nobody. That is the whole of the rule on purpose: a city where every car stops for the pavement is a city that never moves, and a car that swerves is a lane change, which this box does not model.
- **A car never drives into anybody, even when no brakes could have stopped it.** Braking is the driving and the model does all of it; under the model is a floor that no car passes. Somebody who appears closer than the stopping distance, which is the player stepping off a kerb and nobody else, is stopped at rather than driven through, half a metre short of them: the nose ends exactly 0.5 m from their near edge. Half a metre because a car pressed against somebody is a car shoving them down the street: whoever owns the walking pushes a body out of a car it is standing inside, so the two must never touch in the first place. Nothing here ever moves a person; the only things this box writes are its own cars.
- **No part of a car, nose, flank or tail, moves to within half a metre of anybody.** The gap ahead is measured along the lane; this is measured against the car's own rectangle, 4.5 m by 1.8 m, at the place the step would put it, and a step that would bring any of it within 0.5 m of somebody standing in that piece of road or the next is not taken. It is what stops the tail of a car swinging through a turn into somebody standing beside the bend: a rigid car cuts a curve, so its corners swing wide of the line its middle drives, by 0.6 m on a street's left turn and 0.93 m on its right, measured per turn when the city loads. Somebody that far off the line of a bend is within reach of a car on it, so they are filed against that bend as well, and only the rectangle rule sees them: the braking rule stays the lane's own width, so a car does not brake down a straight road for someone on the far side of a corner. A car somebody is standing against goes nowhere until they step off, which is the jam rule for anything out of sight. Measured with the box's own walker, a person crossing lanes, waiting in them and running between them for five minutes at a time, who never steps into a car: over 16 walks (288,000 frames) on streets and avenues, zero frames with any car on them, and every car that moved with them squarely ahead kept at least 0.5 m.
- A car sees one stretch of road ahead of the one it is on, the same lookahead it uses for the car in front, and does not take a junction it would have to stop inside, because a car stopped in a junction holds it against every other arm. Both halves are checked: somebody in the mouth of the road out, and somebody out in the middle of the square on the very line this car would drive. The line is what is checked rather than the square, so a right turn that hugs the kerb still goes while somebody stands in the middle. A car already inside when they step in front of it stops, because there is nothing else it can do. New cars never appear on top of somebody, nor so close behind them that they could not stop.
- Nobody is nudged out of the way and nobody is waited on forever: a car stopped for twelve seconds is taken off the road once the player is far enough away not to see it go, which also gives back any junction it was holding. Inside `nearRadius` it keeps waiting, because a car that vanishes, swerves into oncoming traffic or drives over somebody all look worse than a car waiting for a person standing in the street.
- **A junction is as wide as its widest arm**, so where an avenue crosses a street the square kept clear is the avenue's, which is how the city paints it. A node with one road on it is not a junction but the end of a road: nothing is kept clear there and the lane runs right up to it, which is what lets the short stub of the road out of the valley be driven at all.
- **A turn stays in its lane.** Straight on keeps the lane it is in, a right turn leaves the kerb lane and joins the kerb lane, a left turn leaves the lane against the centreline and joins the same, so nothing crosses a lane inside a junction and a left turn on a four lane road is one curve rather than a diagonal. A lane the rule strands, which a bend in a four lane road does, takes the way out nearest its own place: every lane that arrives at a junction with a road out of it can leave. Turns through a junction are curves that stay inside the square the roadways share.
- One car is inside a junction at a time. It takes the junction on approach, only from the head of its queue and only when the road out has room, keeps it while it is crossing and gives it back on the far side. Cars arriving together give way to the right, and an all-round standoff goes to the earliest claim.
- A car that runs out of road is never taken away in front of the player. The end of the road is a car in front that never moves, so it eases down to it the way it eases down behind a stopped car and stands two metres short of it, and it goes the same way a jammed car goes: twelve seconds standing still, and only once the player is further off than `nearRadius`. That holds at any frame step, sixty a second or the `maxStep` a far car catches up in. Past `despawnRadius` it goes whatever it is doing.
- The road out of town carries on past the last junction. An `exit` lane with no junction to turn into runs off the edge of the map for 120 m, which is how far `@gb/land` grades the ground under a road out, so a car leaving town drives away into the distance instead of stopping ten metres past the last building. No other dead end does this: driving off the end of a street in the middle of the city would put a car through a building, so a car there stops at the kerb and is taken away out of sight.
- Everything random comes from `@gb/kit`'s `Rng`, forked per car: the same seed, city and sequence of updates gives the same traffic, position for position.
- Cars are never created in front of a car already driving: a new one joins at the back of its lane.
- **A car handed over stops existing here entirely.** Its place in the queue and any junction it was holding are given back the same way a retired car gives them back, and its body goes to the pool, so nothing is left queued behind a ghost and no junction is held by a car nobody is driving any more. What comes back is a snapshot rather than the live car, because from that moment it is somebody else's. `@gb/drive` is what asks: the car the player gets into is a car that was already on the road.
- Nothing is measured off the grid. The graph carries the class and the lane count of every segment and `METRICS.road` carries the widths, so the lanes are arithmetic on those two and a road the grid paints wider than its class says is still driven at its class's width.
- **Lane changing is not modelled.** A car cannot pull out to pass, and a car in the kerb lane of an avenue cannot turn left because it will not move over for it: it goes straight on or turns right. Half a manoeuvre looks worse than none, and a lane change is a gap check against two queues plus a lateral slide, which is a change to `lane-graph.ts` and `traffic.ts` together rather than a number here.
- One material paints the whole pack, a `MeshPhysicalNodeMaterial` keyed off the surface each vertex carries: paint is metal under a clear coat, glass is a near-black mirror, rims are brightwork, tyres are matte, and the lamps carry their own light. There is a sky to reflect, so what a car looks like is mostly what is above it. Every car shares the instance, so an hour of the day is one uniform write and a car stays four draws.
- Cars cast shadows and receive them. Whether anything is drawn into a shadow map is the app's business; the pack marks its meshes either way.
- This box holds no clock. `CarPack.setTime` remembers the hour and lights the lamps for it; cars put their lights on before the streetlights do and keep them on a little past dawn.
- `CarPack` pools bodies: a retired car leaves the scene graph and waits for the next car of its model, so an hour of driving clones each model a handful of times rather than once per spawn.

## The car pack

One file, `assets/dist/cars.glb`: 540 KB, ten models, one material, no textures. Build it with `node game/traffic/tools/build-cars.ts`. It is gitignored, so a fresh clone builds it before the cars appear.

Seven cars come from the Quaternius Realistic Car Pack, registered as `quaternius-cars` in `assets/registry/sources.json`. Its `License.txt` reads "CC0 1.0 Universal Public Domain Dedication", with an invitation to support the author on Patreon: public domain, no attribution owed, ours to redistribute inside a world file. The pack ships OBJ, FBX and Blend and nothing here reads those, so the converter parses the OBJ with three.js and writes glTF.

Three are single models downloaded from Sketchfab, fitted to a street car's budget by `node tools/fit-model.mjs <file> --out assets/src/<slug> --keep-parts --bake` and staged under `assets/src/`: `sketchfab-audi-e-tron-gt` (GranTurismo), `sketchfab-concept-car-037` (Concept) and `sketchfab-carbon-e7` (Patrol). Each has a row in the registry carrying the licence its own file states, the page it came from and the command that fitted it. Sketchfab asks for a login, so those three are saved by hand rather than by `tools/fetch-assets.mjs`, and the build says which file is missing when one is not there.

Either way gltf-transform then dedups, welds and meshopt-compresses the result the way the rest of the art is packed.

A car is one node named for its model, with four children: `<Model>_Body`, `<Model>_WheelFrontLeft`, `<Model>_WheelFrontRight`, `<Model>_WheelRear`. The model is on every part because a glTF loader renames repeated node names.

| Model | Source scaled by | Length | Width | Height | Triangles | Weight in the mix |
|---|---|---|---|---|---|---|
| NormalCar1 | 0.996 | 4.20 m | 1.80 m | 1.17 m | 2,966 | 4 |
| NormalCar2 | 1.099 | 3.64 m | 1.80 m | 1.26 m | 3,136 | 4 |
| SUV | 0.853 | 3.59 m | 1.80 m | 1.30 m | 3,306 | 3 |
| Taxi | 0.996 | 4.20 m | 1.80 m | 1.31 m | 3,290 | 2 |
| SportsCar | 0.997 | 3.96 m | 1.80 m | 1.15 m | 3,090 | 1 |
| SportsCar2 | 0.962 | 3.78 m | 1.80 m | 1.16 m | 3,160 | 1 |
| Cop | 1.013 | 3.78 m | 1.80 m | 1.25 m | 3,244 | 0.5 |
| GranTurismo | 83.674 | 4.15 m | 1.80 m | 1.14 m | 12,002 | 3 |
| Concept | 0.931 | 4.50 m | 1.71 m | 0.99 m | 11,972 | 2 |
| Patrol | 0.008 | 4.34 m | 1.80 m | 1.45 m | 1,672 | 1 |

Weights out of 21.5: the three downloaded cars are a little over a quarter of the traffic between them. Which car a driver gets is `Rng.weighted` off the traffic stream, so it is the seed's, not the frame's.

- Size: one factor per model, so each keeps its own proportions and comes out as large as it fits the 4.5 m by 1.8 m footprint the simulation reserves. Whichever of the two runs out first binds: nine of the ten are 1.80 m across and 3.6 to 4.3 m long, and the Concept is the one whose length binds, at 4.50 m by 1.71 m. Tyres sit at y = 0 and the origin is the middle of the car, so `rideHeight` 0 puts it on the road.
- Nose: +Z. The Quaternius cars are checked at build time against their own `Headlights` and `TailLights` materials. A downloaded model says which way it faces in `tools/car-sources.ts`, and the build checks that against its lamps: the end with the brighter ones is the nose, on every car and in every sheet, and a model the table has backwards fails the build. `rotation.y = heading` is therefore true of the art, not only of the maths.
- Wheels: they turn. Each is a pivot at its axle, and `CarPack.update()` rolls all three by distance over wheel radius and steers the front two into the turn. The two rear wheels are one object on one axle, so they always turn together, and no wheel moves on its own suspension. Quaternius names its wheels; a downloaded model names them for whoever modelled it, or welds the whole car into one primitive, so `tools/car-wheels.ts` finds them by shape instead: the geometry is cut into islands of triangles that share vertices, and the four round ones standing on the road, out towards a flank, are the wheels. Whatever sits inside one, a rim, a hub cap, a brake disc, goes with it. Four is the only answer the build accepts.
- Surfaces: the Quaternius materials map to the five surfaces by name. A downloaded model lists every material it carries in `tools/car-sources.ts`, and the build fails on one it does not know, so a re-fit that renames a material cannot ship a windscreen painted like a bonnet. Two things a name never says are read off the colour: a saturated patch on a car whose paint, glass and rubber are all grey is a lamp, and on a model painted with a single baked sheet the dark part of a wheel is the tyre and the bright part is the rim. A car with more than 15% of itself saturated is a car painted a colour of its own and is left alone.
- Shading: sources have smoothing switched off or lose it to the simplifier, so their normals say nothing the triangles do not and a bonnet reads as origami. The converter throws them away and works the shading out of the geometry instead: panels meeting shallower than 48 degrees are one curved surface and get an averaged normal, anything sharper stays a corner. It runs after the car is scaled to metres, because the creaser groups vertices by the centimetre. Welding then only merges vertices that agree, so the creases survive the pack.
- Colour and surface ride on the vertices, as `COLOR_0`: linear RGB in the first three bytes and which of five surfaces the triangle is in the fourth (paint, glass, lamp, trim, metal). That is what makes a whole car one material and four draws instead of twelve. A generic glTF viewer shows the colours and ignores the fourth byte, because the material is opaque. A downloaded model arrives with its texture sheets already read onto its vertices by `--bake`, which is what lets a police livery survive with no image in the pack.
- Brightwork is stored at a fifth of its brightness and multiplied back by the shader (`METAL_LIFT` in `pack-layout.ts`), because the Quaternius rim colour is near-black and a wheel is not. The converter divides by it, so a rim renders the colour it was modelled.
- Under the car: the shell's own floor pan stops a hand's width up and its arches are open, so a plain box fills the space between the wheels, tucked just inside them and black. It closes the arches, stops daylight showing under the sills and gives the car a shadow to cast. Twelve triangles, and it is inside every model's own sills.
- Lamps are repainted at build time, because a source bakes an unlit lens the muddy colour it is in daylight. A Quaternius head lamp becomes near white. On a downloaded car a lamp takes the colour of the end it is on: near white in the front third, red in the back third, and its own hue at full brightness in between, which is what a roof beacon and a side repeater are.

## What it costs

The simulation, on a 6 by 6 junction lattice with the default 40 cars, bodies stubbed out: 7.9 us per update on streets with no `obstacles` port. With the port it depends on where the people are, not how many roads there are:

| people near the player | on the pavements | out in the lanes |
|---|---|---|
| 20 | 12 us | 22 us |
| 40 | 13 us | 32 us |
| 80 | 20 us | 54 us |

The same lattice built of avenues, twice the lanes, costs 6.6 us empty, 11, 14 and 21 us with people on the pavements and 22, 33 and 58 us with them in the lanes. Standing in a lane costs more because the traffic then does what it is for: cars brake, queue behind each other and sit at junctions waiting for a way across.

Every person is measured once, against the two or three pieces of road they could be standing in, found through a grid of the roads built when the city loads, and a piece of road whose box they are nowhere near is dismissed before it is measured. So the cost follows the people near the player, and a city with more streets in it is no dearer to watch. The rectangle rule costs nothing while nobody is filed, and one rectangle per person on the car's road otherwise.

The art, per car: **4 draw calls**, one body and three wheels, every one of them on the same material and none of them textured. Triangles are per model, in the table above: 2,966 to 3,306 for the Quaternius cars, 1,672 for the Patrol, and 11,972 and 12,002 for the two downloaded cars that were fitted to the 12,000 triangle budget.

A busy street is 40 cars. Measured through `CarPack` on the shipped file, weighted by how common each model is: **5,135 triangles and 4 draws an average car, so 205,395 triangles and 160 draws for the forty**. The seven Quaternius cars on their own came to 3,147 an average car and 125,879 for the forty, at the same 160 draws. All of the extra is geometry: the draw calls, the material and the texture memory are what they were.

The paint, measured on this machine's WebGL2 fallback at 1869 by 911, against the same geometry wearing a plain standard material:

| | car paint | plain | the clear coat costs |
|---|---|---|---|
| one car filling two thirds of the screen | 0.31 to 0.36 ms | 0.25 to 0.28 ms | 0.04 to 0.10 ms |
| seven cars at street distance, about a quarter of the screen | 0.88 to 0.98 ms | 0.76 to 0.83 ms | 0.11 to 0.15 ms |

Cars never cover more than a fifth of a city frame, so the clear coat, the glass and the lamps together cost well under a tenth of a millisecond. Lighting the lamps is one uniform write for the whole pack.

## How to modify this blackbox safely

The behaviour lives in six places and they stay separate: `idm.ts` is the car following model, `junctions.ts` is right of way, `hazards.ts` turns the people into distances a driver can brake against and the rectangle no step may put on them, `track-index.ts` is the grid of where the roads are that lets it do that per person rather than per car, `road-class.ts` is how wide a class of road is and where its lanes sit in it, and `lane-graph.ts` cuts the lanes and joins them across junctions. One way streets, traffic lights and pulling out to pass are all changes to `lane-graph.ts` plus one of the others, not new boxes.

Where a car leaves the world is `src/runoff.ts`, and nothing else knows about it. Taking a car off the road, whether it was retired or handed to a driver, is `#takeOff` in `src/traffic.ts` and is one path, so the two cannot drift apart.

The art is separate again, and the two sources meet in one place. `tools/car-sources.ts` is the table of where every car comes from and what its materials are made of; `tools/car-source.ts` reads a Quaternius OBJ and `tools/car-glb.ts` a staged download, and both hand `tools/car-parts.ts` the same four pieces, which sizes them, shades them, closes them underneath and hangs them on their pivots. `tools/car-wheels.ts` is the wheel finder, `tools/car-shading.ts` the normals and the vertex colours, `tools/car-underbody.ts` the box under the car, `src/pack-layout.ts` what the file is called and how it is laid out, `src/car-paint.ts` the one material, and `src/car-pack.ts` the loading and pooling. Changing the layout or the surface vocabulary means rebuilding the pack, so the converter and the loader read the same constants out of `pack-layout.ts`.

Adding a car is four steps: fit and stage the model, add its row to `assets/registry/sources.json`, add its name to `CAR_MODELS` and `MODEL_MIX` in `src/settings.ts`, and add its source to `SOURCE_OF` in `tools/car-sources.ts`. The build then tells you what it could not work out: a material you have not classified, a car whose wheels it cannot find, or a nose pointing the wrong way. Run `pnpm --filter @gb/traffic test`; the tests that measure the pack skip when it has not been built.
