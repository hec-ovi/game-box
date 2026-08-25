# @gb/drive contract

contractVersion: 0.1.0

## Purpose

The car the player drives: walking up to one on the road and taking it, how it answers the keys, who rides with them, and where everybody stands when they get out.

## Inputs

| Param | Type | Preconditions |
|---|---|---|
| `new Driving(deps)` | `DrivingDeps` | `rider` and `solid` are required; everything else left out is a thing the player simply cannot do |
| `Driving.target()` | | what the crosshair should offer where the player is standing |
| `Driving.act()` | | get in, or get out. Nothing in reach is nothing done |
| `Driving.open(traffic, bodies?)` | a `RoadTraffic`, a `DriveBodies` | the cars, once their art has loaded. The same thing as passing them in, for a game that draws before it downloads |
| `Driving.update(seconds)` | seconds since the last frame | once a frame; costs nothing while the player is on foot with no car of their own |
| `new Driver(tuning?)` | `Handling` | the handling model on its own, with no world around it |
| `Driver.step(seconds, throttle, steer)` | seconds, -1..1, -1..1 | `throttle` 1 forwards, -1 backwards, 0 coasting; `steer` 1 left, -1 right |
| `new CrowdRiders({ crowd, cast })` | a `RiderCrowd`, a `RiderCast` | a `@gb/crowd` `Crowd` and `SceneCast` are both already these |

`DrivingDeps`:

| Dep | Default | What it is |
|---|---|---|
| `rider` | required | the player: where they stand, what the movement keys say, and where to put them. `@gb/app`'s first person body is one |
| `solid` | required | what the car cannot drive through, asked fresh: walls, water, people, other traffic |
| `ground` | flat at 0 | how high the road is under a point |
| `traffic` | none | the cars driving themselves. With none there is nothing to get into until `open` says otherwise |
| `bodies` | none | where the car object comes from. `@gb/traffic`'s `CarPack` is one. With none the car drives but is not drawn |
| `riders` | none | the companions. With none the player drives alone |
| `outdoors` | always | false while the player is inside a building |
| `tuning` | `CITY_CAR` | how the car answers the keys |

## Outputs

| Param | Type | Postconditions |
|---|---|---|
| `Driving.aboard` | boolean | true from the frame the player gets in to the frame they get out |
| `Driving.car` | `Moving` or undefined | the player's car, driving or parked: `x`, `z`, `heading`, `speed` in metres per second along the heading, negative in reverse and 0 parked. A crowd hazard feed reads it to tell a car coming from one standing |
| `Driving.target()` | `DriveTarget` or undefined | `{ kind: 'drive', id, label, at }`, the same shape a game's own target list holds. `at` is the point on the bodywork nearest the player, so reach is measured to the car and not to its middle |
| `Driving.passengers()` | `readonly string[]` | the npc ids riding, in seat order |
| `Driving.rolling()` | `readonly Rolling[]` | the parked car as an oriented rectangle to walk into. Empty while somebody is in it |
| `Driving.inTheRoad()` | `readonly Blocking[]` | the car as three round patches down its length, for a driver behind to brake against. Parked or moving |
| `Driver.speed`, `.wheel`, `.orientation`, `.roll` | numbers | metres per second, radians |
| `Driver.step` | `{ x, z }` | how far the car wants to move this frame. Refusing it is the caller's business |
| `CITY_CAR` | `Handling` | the numbers a city car is tuned at |

`heading` and `orientation` are radians around Y for a model whose nose points down +Z, which is `rotation.y` as it stands and the same convention `@gb/traffic` uses. `@gb/app`'s player heading is the other way round, 0 looking north, which is why `Rider.placeAt` is given `heading + PI`.

## Errors (closed set)

None. Nothing here throws and nothing returns a failure: with no car in reach `act()` does nothing, with no traffic there is nothing to offer, with no cast a companion simply does not ride, and a car with a wall in front of it stops.

## Dependencies

- `@gb/world` contract (game/world/CONTRACT.md): `METRICS` for the size of a car, how far the player can reach, and the `Npc` a companion is.

Nothing else. The traffic, the car art, the crowd, the player and the walls all arrive as ports, so this box has no three.js in it, no browser in it and no import of `@gb/traffic` or `@gb/crowd`.

## Invariants

- One metre is one unit, Y up, and one car at a time. Taking a second car gives the first one back.
- **The player's car is a car that was already there.** Nothing is parked for them: they walk up to something on the road and `traffic.handOver` takes it off it for good. So a city with cars in it has cars to drive and a city without has none, and no object exists until somebody gets in.
- Getting in and out is the same key on the same target list. On foot the target is the nearest car within `METRICS.player.interactRange` of its bodywork; behind the wheel it is the seat itself, so it is always in reach and the crosshair never offers the street instead.
- **Getting in turns the view to the windscreen.** However the player was looking when they opened the door, the seat's first frame carries the turn that brings them round to the way the car is pointing. After that the view turns with the car and the mouse still looks around inside it.
- **The player comes back out onto the pavement.** They are put down at the first clear door: the driver's side, then the passenger's, then the back doors, then behind and in front. Only if every one of those is inside something solid do they step out where the car is, which is a car parked inside a wall and nothing sensible left to do.
- **Nobody is put down on top of anybody else.** Each companion takes the next clear door, and a door somebody already stepped into is taken.
- Speed is integrated with a decay branch: the throttle accelerates, the other pedal brakes twice as hard as the throttle pushes and then reverses, and nothing held rolls the car to a stand rather than to a crawl. Reverse is under a third of the top speed.
- **The car turns with the ground it covers, not with the clock.** Orientation moves by the distance driven times the wheel angle, so a parked car with the wheel on full lock does not spin and the same corner comes out the same at any frame rate.
- **The faster it goes the less lock it has**, down to under a fifth of it at the top speed, and a wheel already turned unwinds as the car picks up speed. Without that the turn radius would be the same at 3 and at 20 metres a second and a car at speed would pirouette. With it the car comes round inside six metres at a crawl, which is what turning a junction between two six metre roadways takes, and inside thirty at the top speed, which is a lane change. Above about ten metres a second the sideways pull is roughly level, the way a tyre's is.
- Leaning is speed times wheel angle. It rides on the model and on the eye, less than half as much on the eye as on the model, and it costs the car speed in the corner. A car standing still does not lean, and neither does one on the straight.
- **A car does not cross a wall.** Its outline is nine points, the four corners, the middle of each side and the middle, tested against the same `solid` the player walks against. The move is tried whole, then one axis at a time so a glancing hit slides along the building rather than stopping dead, and a car with nowhere to go stops where it is. Turning is tried before either, so a car wedged against a wall cannot rotate its nose into it.
- **A car with something solid inside it can always back out.** Every pose reads as blocked then, and the rule above would hold it there for good, so while it is buried any move that does not bury it deeper is taken. That gets it out and cannot be used to drive further in.
- No physics engine and no baked collision. What is solid is asked fresh every frame, which is what lets a pedestrian stepping into the road stop the car and lets them clear it again the same frame.
- **Companions ride.** Everybody following the player takes a seat when the player gets in, up to the three there are, and is taken out of the crowd while they are in the car so nobody is walking the pavement and sitting in the back at once. Anybody left over keeps following on foot. They sit in the car's own frame, so they turn with it and arrive with it, and they play the cast's driving clip. Getting out releases their bodies and hands them back to the crowd from where they stood up, walking with the player again.
- **Every head is under every roof.** The cast's driving pose stands 1.44 m from its root to the crown and the lowest roof in the car pack is 1.15 m, so a seated body goes 0.3 m below the road. The feet that go under the floor are behind the underbody panel, where no daylight reaches, and a head through a roof would be the only one of the two anybody could see.
- **The traffic can see the car.** `inTheRoad()` is three patches half a car's width across, down the length of the car, which is the shape `@gb/traffic`'s obstacle port reads and narrow enough that a car in one lane does not read as blocking the other. It reports whether the player is driving or has parked and walked off, so an abandoned car is something the AI brakes for rather than drives through.
- **The car is solid to the player on foot only when nobody is in it**, or the player would collide with the car they are sitting in.
- The car the player walked away from is given back to the pool past 200 m, which is a little outside where `@gb/traffic` retires its own. Holding a scene object for a car nobody can see costs four draws for nothing, and the streets are full of others.
- **Nothing here is world state.** No `Rng`, no clock, no reading or writing of a world: driving is input. The same seed builds the same city whether or not anybody ever gets into a car.
- Nothing here touches a browser. The keys arrive as `rider.input`, the same two numbers walking reads, so there is no second keyboard listener in the game and no DOM in this box.

## The handling model, in numbers

`CITY_CAR`, and what each number is for.

| | | |
|---|---|---|
| `topSpeed` | 20 m/s | 72 km/h: a little over the fastest road limit the traffic drives at |
| `reverseSpeed` | 6 m/s | backing out of somewhere, not driving backwards |
| `acceleration` | 5 m/s² | four seconds to the top |
| `braking` | 10 m/s² | holding the other pedal, which is twice the throttle |
| `coasting` | 3 m/s² | engine braking with nothing held |
| `wheelLock` | 30 degrees | how far the front wheels go standing still |
| `lockAtSpeed` | 0.18 | how much of that is left flat out |
| `wheelSpeed` | 1.6 rad/s | a third of a second to full lock |
| `steerRatio` | 0.35 rad per metre per radian | the tightness of a turn: 6 m at a crawl, 30 m flat out |
| `rollScale` | 0.018 | about three degrees of lean in a corner |
| `cornerDrag` | 40 | how much speed a corner scrubs off: a third of the throttle, hard over |

The seat is `EYE_HEIGHT` 1.16 m, which is higher than the passengers sit. The cars are stylised and only a little over a metre tall, so an eye where a driver's really is puts the bonnet across half the screen; this is the height that leaves the bonnet in the bottom quarter with the road ahead in the middle. Nobody ever sees the driver, so the view is the only thing it has to get right.

## Standing it up

```ts
const driving = new Driving({
  rider: player,                                  // the first person body
  solid: street.solid(),                          // walls, water, people, traffic
  ground: street.floor(),
  riders: new CrowdRiders({ crowd, cast }),       // a @gb/crowd Crowd and SceneCast
  outdoors: () => buildings.outdoors,
})
// once cars.glb has loaded: a @gb/traffic Traffic and its CarPack, which is the
// same art, the same material and the same pool the traffic draws from
driving.open(traffic, cars)

// every frame
driving.update(seconds)
// in the target list, and on the act key
driving.target()
driving.act()
// and tell the street about it
street.setPlayerCar(driving)
```

## What it costs

Nothing that grows. One car, one `Driver`, three seats: an update is a dozen multiplies and nine `solid` calls for the outline, doubled on the frames it slides along a wall. The car is one more object in the scene, four draws on the same material as the traffic's, and its wheels are rolled by the same `CarPack.update` that rolls theirs.

## How to modify this blackbox safely

The handling lives in `src/handling.ts` and knows nothing about the world: change how a car feels there and nowhere else, and the tests that measure a turn radius will tell you what you did. `src/car.ts` is the one place a wall can stop a car. `src/cabin.ts` is who is riding, `src/seats.ts` is where they sit and where they get out, and `src/riders.ts` is the only file that knows a crowd exists. A second drivable thing (a van, a bike) is a second `Handling` and a second seat table, not a second box. Run `pnpm --filter @gb/drive test`.
