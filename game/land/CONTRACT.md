# @gb/land contract

contractVersion: 0.6.0

## Purpose

Builds the world the city stands in and the sky over it: kilometres of open, rolling ground running out from the edge of the built area, distant mountains closing the view, ponds and woods in between, and a sun, a moon and weather the game drives from outside.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `buildLand(world, options?)` | a `@gb/world` `World` | at least one cell of the grid is not `mountain` |
| `options.theme` | a registered theme id (`THEMES`) | left out, the theme is matched from `world.theme` |
| `options.seed` | string | left out, `world.seed`. Same seed, same landscape |
| `options.horizon` | metres from the edge of the map to the far edge of the land | left out, far enough to clear the far side of the ring |
| `options.detail` | `'full'` or `'low'` | `'low'` doubles the size of every ground quad and thins the woods and the rain, for the WebGL2 tier |
| `options.time` | hours, 0 to 24 | default midday |
| `options.weather` | `'clear'`, `'overcast'` or `'rain'` | default clear |
| `options.shadow` | any part of a `ShadowSpec` | left out, `SUN_SHADOW`: 100 m of near field at 2,048 square |
| `land.setTime(hours)` | a real number of hours, wrapping | call it every frame with the fractional hour: everything it writes is a smooth function of it, so dusk is a slope and never a step |
| `land.setWeather(weather)` | one of `WEATHERS` | |
| `land.update(seconds, viewer)` | seconds since the last frame, the camera's position in metres | call every frame the player is outside, walking or not: the sky rides on this |
| `landTheme(id)` / `matchTheme(text)` | string | `matchTheme` always answers: no match falls to `DEFAULT_THEME` |

## Outputs

`buildLand` answers a `@gb/kit` `Result<Land, LandError>`.

| Param | Schema | Postconditions |
|---|---|---|
| `Land.root` | `THREE.Group` named `land` | the whole landscape. Add it to the scene once, beside the city |
| `Land.terrain` | one `THREE.Mesh` named `land:terrain` | indexed, welded, vertex-coloured, every face looking up |
| `Land.water` | one `THREE.Mesh` named `land:water`, or undefined | every pond, each drawn out to its own shoreline |
| `Land.trees` | one `THREE.InstancedMesh` per species, `land:trees:<species>` | each tree standing on the ground at its position |
| `Land.sky` | the skydome, named `land:sky` | Preetham daylight with clouds by day and the galaxy, its dust and the city's glow after dark, all in one draw, centred on the camera, drawn first and never into the depth buffer |
| `Land.stars` | `THREE.Points` named `land:stars` | 1,200 stars on a sphere around the camera, over half of them lying along the galaxy's band the dome paints behind them, a handful bright and most of them faint, a few amber and the rest blue-white, faded out before the sun reaches the horizon; the moon beside them is the sprite `land:moon-disc` |
| `Land.sun`, `Land.moon`, `Land.skyLight` | two directional lights and a hemisphere light | the sun and the moon on opposite ends of the same arc, and the sky filling in behind them |
| `Land.light` | a `Daylight` | the hour's light as numbers, the state the lights were last written from: `sunward` (unit vector, the moon is its negative), `sunElevation` (degrees), `sunYaw` (radians about +Y), `day` (0 night to 1 day), `low`, `dark`, `dusk` (0 all morning, 1 by sunset), `sunStrength` (1 at noon), `skyBrightness` (mean radiance of the dome over the upper hemisphere, in the dome's own units), and the theme's `sunrise`, `sunset` and `noonElevation`. One object, updated in place; read it every frame |
| `Land.sun.castShadow` | true | the sun is the one thing in the game that casts. Its map follows the viewer `update` is given |
| `Land.shadow` | a `SunShadow`: `spec` and `texel` | how much ground the map covers, how many pixels it has, and the metres one of them covers |
| `SHADOW_LAYER` | 7 | the layer the shadow camera draws and no camera does, for a merged stand-in |
| `Land.rain` | `THREE.LineSegments` named `land:rain` | streaks inside `Land.rainVolume`, centred on the last viewer it was given |
| `Land.fog` | `THREE.FogExp2` | assign to `scene.fog` once: the same object is edited as the time and weather change |
| `Land.heightAt(x, z)` | metres | the height of the triangle the mesh draws there, to float precision. Zero over the town and its roads, the pavement's top where the verge meets a pavement |
| `Land.slopeAt(x, z)` | rise over run | the tilt of that same triangle. Zero over the town |
| `Land.walkableAt(x, z)` | boolean | false where the ground is steeper than 0.7, or under water. True everywhere else, town included |
| `Land.waterAt(x, z)` | metres or undefined | the water level standing at a point, undefined on dry ground |
| `Land.time`, `Land.weather` | hours and the weather it was last told | this box remembers what it was told, it does not run a clock |
| `Land.wetness` | 0 dry to 1 soaked | what another box should read to decide how wet to make a surface |
| `Land.horizon`, `Land.cameraFar` | metres | how far the land goes, and the far plane to give the camera: it holds the whole sky and everything the haze still shows of the land |
| `Land.cost` | `triangles`, `vertices`, `trees`, `ponds`, `drops`, `draws`, `shadowDraws` | what this landscape costs to draw, and how much of it is drawn again into the shadow map |

## Errors (closed set)

- `unknown-theme`: `options.theme` names a theme nothing is registered under.
- `no-valley`: every cell of the grid is `mountain`, so there is no town to grow land around.

## Dependencies

- `@gb/world` contract: the grid, `cellSize`, `METRICS.street.curbHeight`, and the world's theme and seed.
- `@gb/kit` contract: `Rng` for determinism, `Result` for the answer.
- `three`, `three/addons/objects/SkyMesh.js` for the sky and `three/tsl` for the night it wears.

## Invariants

- One world unit is one metre, Y up. Nothing here reads a size that is not the world's `cellSize`, `METRICS.street.curbHeight` or a number in the theme.
- The grid's `mountain` cells are not where the mountains are. They are the verge: the strip between the last pavement and the open ground, where the ground starts to rise. The high ground is a function of distance from the built area and does not begin for well over a kilometre.
- **The verge meets the city at the height of what it touches.** A verge corner a pavement or a park touches is at the pavement's top, `METRICS.street.curbHeight` (0.15 m), and one a street touches is at zero, the road surface; so nothing can be seen under the edge of the pavement and the road leaves town level. Measured on a 43 by 45 cell town, 112 pavement edges and 33 street edges round the ring, none of them with a gap; the same count at 212 and 58 on a 76 by 76 town. A kerb `@gb/scene` may still draw against a verge cell is buried inside the verge.
- **The ground rises from the very edge of the city, so the city is a valley with far limits.** The pavement's height is carried out across the verge and fades by its far edge while the theme's bank climbs from the kerb line: on the temperate theme the verge runs 0.15 m at the kerb to 0.55 m at the map edge, the bank is 4 m by 40 m out, and the ring's crest is 3 km away. The slope on the verge is under 0.1, so the crowd and the player can walk over it. Beside the road out the same bank rises from the road's edge, and the road itself is graded flat for 120 m past the map.
- Distance from the open ground is exact where it matters. The distance field is sampled at the grid's own cell corners, and the nearest point of a cell to a corner is another corner, so a corner's distance to the nearest open corner is its distance to the open ground itself. Every ground lattice is stepped in whole cells and lands on those corners.
- The city's ground belongs to `@gb/scene`. Terrain is laid on the verge and outside the map, and on nothing else: no face, no tree and no water ever lands on a street, a pavement, a park or a plot.
- `heightAt` reads the very surface the mesh is built from, not an approximation of it: the same lattice, the same quad, the same one of its two triangles. Measured against raycasts of the finished mesh the two agree to under a hundredth of a millimetre, so a player placed on the answer stands exactly on what they can see.
- The ground is built as four steps of resolution, all welded into one mesh: the grid's own cells over the verge and a shoulder one coarse step wide outside the map, then three cells a quad, then twelve, then forty-eight. A tier's outermost ring of heights is pulled onto the coarse edge it meets, so no crack opens at a seam.
- Water is carved, not floated. A pond's level is set below the lowest point of its own rim and its shore is walked out to where the ground comes back up through the surface. A bowl the drawn ground does not close on every side stays a dry hollow rather than a pond hanging over the land.
- Time and weather move light, never geometry. `setTime` and `setWeather` write the sun and moon positions, the sky's uniforms and the colours and strengths of the lights and the fog, all in place. No vertex is touched again after the build.
- **Everything the hour drives is a smooth function of the fractional hour.** The sun's place on its arc, its colour and strength, the moon's, the ambient, the haze, the stars' fade, the shadow's strength and the dome's brightness are all read off `Daylight` for the real number `setTime` was given. Measured at a frame of 1/900 of an hour, which is a clock ten times faster than the default 24x, nothing moves by more than a twentieth of a degree of sky, a hundredth of a light unit or half a percent of a colour channel between two frames. Whoever holds the clock decides the rate; this box never steps.
- **The day is a winter day.** The sun's path is the real one for the theme's latitude and the solar declination of the day the city lives in, with solar noon at 12:00 and the moon the other end of the same line. Two numbers set how long the day is and how high the sun gets, and a winter declination makes it short and low at once. Twilight runs from seven degrees below the horizon to eleven above.

  | theme | latitude, declination | sunrise | sunset | day | noon sun |
  |---|---|---|---|---|---|
  | temperate | 48, -18 | 07:25 | 16:35 | 9.2 h | 24 degrees |
  | arid | 33, -12 | 06:32 | 17:28 | 10.9 h | 45 degrees |
  | maritime | 55, -17 | 07:44 | 16:16 | 8.6 h | 18 degrees |

- **The day runs warm to cold, and it is a peak, not a plateau.** The sun's strength through the air follows the sky model's own earth-shadow law, 1 at noon and less the lower it stands. A low sun is coloured by the air: amber (`lowSun`) all morning, and cooling through the afternoon to `duskSun` while the sky light and the haze go halfway to the night's colours by sunset. On the temperate theme, measured:

  | hour | sun elevation | sun intensity | sun colour | moon | ambient | shadow | sky brightness | haze |
  |---|---|---|---|---|---|---|---|---|
  | 00:00 | -60 | 0 | | 0.34 | 0.78 | 0 | 0.019 | `#1d2836` |
  | 06:00 | -13 | 0 | | 0.34 | 0.78 | 0 | 0.019 | `#1d2836` |
  | 08:00 | 5 | 0.70 | `#ffa268` | 0.10 | 1.80 | 1 | 0.30 | `#a0b0bc` |
  | 12:00 | 24 | 3.10 | `#fff1d8` | 0 | 2.20 | 1 | 1.59 | `#b9cbd8` |
  | 15:00 | 13 | 1.89 | `#f5d6c6` | 0 | 2.20 | 1 | 0.85 | `#98a7b3` |
  | 16:00 | 5 | 0.70 | `#dda6b7` | 0.10 | 1.80 | 1 | 0.30 | `#798691` |
  | 18:00 | -13 | 0 | | 0.34 | 0.78 | 0 | 0.019 | `#1d2836` |

  Sky brightness is the dome's mean radiance over the upper hemisphere in its own units: the sun's aureole is left out of it by scattering the haze evenly, because a few degrees of sky that moves with the sun would make the number jump as it crossed each sample. At noon the dome's zenith is `(0.10, 0.33, 0.95)` and its horizon away from the sun `(1.30, 1.79, 1.94)`, a five to one gradient: the sky at midday is blue overhead and pale at the horizon, and what it looks like on screen after that is exposure and grade, which belong to the app.
- **The environment can be prefiltered now and then and carried between.** The sky's pattern is very nearly rigid about the vertical, so a prefiltered copy of the dome is turned by `light.sunYaw` minus the yaw it was filtered at, and scaled by `light.skyBrightness` over the brightness it was filtered at. `sunYaw` is `atan2(sunward.x, sunward.z)`, which is `rotation.y` in three's sense; it wraps at midnight, where a full turn is the same rotation. How often to refilter is the caller's choice; this box never asks for it.
- The sun casts and nothing else does. One directional light, one shadow map, and it is 100 m of near field at 2,048 square: a texel covers 9.8 cm square to the beam, so a 1.8 m person lays down 18 texels of shadow and a 2.1 m door 21, and the soft filter blurs the edge over about 15 cm. Under the temperate noon sun, 24 degrees up, the ground texel is 24 cm along the beam and 9.8 across it. Stretching one map over the 6 to 7 km the land runs would put a texel at 3 m, where a person casts nothing and a house casts a smear. Cascades are the wrong trade on this stack: on the WebGL2 fallback a shadow pass is charged by the caster, about 6 us each, so every extra cascade multiplies the one bill that matters.
- The shadow map rides on the player and lands on whole texels. It is centred on the viewer `update` is given, so the near field goes with them six kilometres out of town; and the centre is snapped to whole texels of the light's own three axes before it is used, so the grid stays pinned to the world. Without the snap every shadow edge in the scene boils as the player walks, which looks worse than no shadows. Sliding the viewer a centimetre at a time moves the map in 9.8 cm steps and never between them. Moving it does not turn the sun: the light and its target move together, so the direction is the one the hour says.
- Nothing has to be widened for a tall building upwind. Whatever lands its shadow inside the map already stands inside the map's own square, because a shadow and its caster are the same point projected along the beam. The slab simply runs 2 km back up the beam, which holds a 40 m building with the sun two degrees up.
- Dusk dissolves the shadow rather than letting it degenerate. A square held square to the beam covers `radius / sin(elevation)` metres of ground along the sun's bearing, so the ground texel stretches the same way: 20 cm at 30 degrees, 1.1 m at five, 6.5 m at one. It stretches along the beam only, the axis a low sun makes long anyway, and by then the ground is taking under a tenth of the sunlight, so the shadow rides the sun most of the way down and fades out over the last five degrees. Below the horizon there is no shadow and no shadow pass: the sun goes invisible and the frame stops paying for it.
- The moon casts nothing. Its light is a fifth of the sun's against a lifted ambient, so a hard-edged moon shadow would read as a dirty smear rather than a shadow, and it would put a second shadow pass on the frame at the hour the city is already paying for lit windows and street lamps. Night is shaped by the ambient and by what the lamps light, not by a shadow map.
- The woods cast and the ground does not. One instanced mesh a species is one draw, and the near field of a wood is what a walk through it needs. The terrain stays out of the map because six metre quads with smoothed normals shadow themselves into a flat dark field under a low sun, and the shape of the hills is already in their shading. Water and the sky never cast; the terrain and the water receive.
- The shadow camera also draws layer 7 (`SHADOW_LAYER`), which no camera draws. A box that draws one building as four meshes can put one merged stand-in on it, drop `castShadow` from the meshes people see, and pay one caster instead of four. Measured on a town of 173 buildings, that is the difference between 4.8 ms and 1.4 ms a frame.
- The night sky is depth-correct. The stars and the moon are geometry at a real distance and they read the depth buffer like anything else, so a wall, a tree or someone standing in front of them hides them, and the moon comes up from behind the hills rather than over them. The skydome is the one object that ignores depth, and it may: it is a background, it draws before everything and it writes nothing back.
- The sky rides with the camera. The dome, the stars and the moon are centred on the last viewer `update` was given, in all three axes, because a sky is at infinity and the observer stands in the middle of it. Constellations hold their bearings across a six kilometre walk and the horizon stays at eye level up a hill, and the sky costs the far plane the same thing wherever the player is. The dome is scaled by its own diagonal, so its eight corners land on the reach rather than 1.73 times past it; the stars sit at 0.96 of the reach and the moon at 0.92. The two lights stay on the town, because a directional light is a direction and its position says nothing.
- The far plane is set by the air, not by the size of the map. `FogExp2` leaves `exp(-(density * metres)^2)` of a surface, and `cameraFar` is the distance where that is a hundredth: less than one step of colour, so nothing it cuts can be seen. 6.7 km on the temperate theme, 9.8 km in the clear desert air of the arid one, 3.9 km in maritime haze. The sky is hung just inside it, which is what puts the moon behind the last ridge you can still make out.
- The night sky is painted, never downloaded, and it rides on the dome rather than on an object of its own. A 384 by 192 equirectangular sheet carries the galaxy, its dust lanes and the grain of the stars too faint to draw one at a time in its colour, and the city's glow in its alpha; the dome reads it by the direction being looked at and adds it to the Preetham sky, so the whole night sky costs the frame one texture read and no extra draw. Both fade with the hour, on different schedules: cloud puts the galaxy out and makes the glow stronger, because an overcast night over a town is brighter than a clear one. What colour the glow is belongs to the theme, not to the sheet: sodium at the rooftops going cold as it thins out overhead.
- The sheet is seamless because it is a function of the direction, not a picture. Every texel is `f(dir)` through noise built over the sphere, so the two edges are the same direction and agree, and every texel of the top row is straight up. That is the whole reason it is painted here rather than generated as an image: an equirectangular sky from an image model has to be cut to wrap and pinched at the poles, and both show. It carries no mip chain either, because nothing on it is finer than three texels, which also removes the seam a mip picks where the wrap makes the texture coordinate jump a whole turn.
- The glow dies below the horizon as well as above it. Nothing under the horizon is ever seen, and a lower half left glowing would light the whole scene from underneath through the prefiltered dome.
- The moon is generated, never downloaded: maria, a limb that darkens towards the edge, a faint halo and a phase, painted once from the seed into a 128 px texture carried on two triangles that face the camera. The phase belongs to the world, not to the hour, because this box is handed a time of day and no date.
- Night is dim, not black. Moonlight plus a lifted blue ambient leaves it about five times darker than noon (5.3 light units at noon against 1.1 at midnight, on the temperate theme). Cloud takes less off the moon than off the sun, so a wet night stays walkable.
- Rain is a box of streaks that travels with the viewer. Drops keep world positions and wrap when they leave the box, so walking moves you through the rain instead of dragging it along, and no drop is ever drawn outside the volume.
- Same seed, same landscape, always. Every random choice comes from a `@gb/kit` `Rng` forked per feature (`relief`, `scatter`, `water`, `trees`, `stars`, `rain`), so retuning the woods cannot move the hills. Under `stars` the moon forks again, and so does `galaxy`, which decides where the band lies and paints the sheet: the band and the stars strung along it agree, and retuning either cannot move the other.
- This box holds no clock. It remembers the last time and weather it was told and renders them; whoever owns the clock calls `setTime`.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas. The sky's brightness is read off a CPU copy of the dome's own Preetham maths, term for term, for the same reason.
- The sky is a node material, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself. Everything else is ordinary three.js: mesh, instanced mesh, points and line segments, which render the same on both backends. Rain is stepped on the CPU for the same reason.

## What it costs

Measured on three towns, at the default detail:

| | terrain | woods | ponds | draws | build |
|---|---|---|---|---|---|
| 41x41 cells, temperate | 139,276 tris | 3,200 trees, 74,300 tris | 5 | 5 | 106 ms |
| 95x93 cells, arid | 163,746 tris | 2,200 trees, 61,600 tris | 2 | 5 | 98 ms |
| 78x75 cells, maritime | 141,756 tris | 4,000 trees, 93,800 tris | 7 | 5 | 93 ms |

The land is 6 to 7 km across and it is still five draws: the terrain, the water, the sky and one instanced mesh per tree species. Night adds two (1,200 stars in one `Points` draw and a two triangle moon sprite carrying a 64 KB face it paints at build time), rain adds one. The galaxy and the city's glow add none: they are a 288 KB sheet read inside the dome's own draw, painted once at build for a fixed 25 ms whatever the size of the town. The sun's shadow map redraws the woods and nothing else of the landscape: one or two draws, 60,000 to 93,000 triangles, `cost.shadowDraws`.

Ground resolution is the grid's own 2 m cells over the verge and the shoulder just outside the map, 6 m quads for the first half kilometre out of town, 24 m to about 1.8 km, then 96 m to the horizon. `detail: 'low'` doubles the three open-ground steps, which is under a third of the geometry (39,000 to 48,000 tris) and a 55 to 67 ms build.

Per query and per frame:

- `heightAt`: 0.04 us. Two binary searches along a lattice and four numbers.
- `walkableAt`: 0.09 to 0.16 us, the difference being one pass over the ponds. Both are safe several times a frame in a collision loop.
- `setTime` / `setWeather`: 0.014 ms. The sun's place, a few colour blends, eight uniform writes, and 72 samples of the sky for its brightness.
- `update`: 0.08 ms while raining, for 3,000 streaks and 72 KB of positions uploaded. Dry, it is the four vector writes that put the sky back on the eye. Aiming the shadow map is part of it: three dot products and three rounds, under a microsecond.

### What the shadow costs, and who pays it

Measured on this machine's WebGL2 fallback (no WebGPU), at 1920 by 1080, standing in the middle of a 120 m town of 173 buildings drawn the way `@gb/kitbash` draws them, 1.28 M triangles of caster.

| | caster draws | shadow triangles | frame | shadow pass |
|---|---|---|---|---|
| sun does not cast | 0 | 0 | 1.60 ms | |
| sun casts, buildings as 4 meshes each | 756 | 1,278,720 | 6.35 ms | 4.75 ms |
| sun casts, one merged caster a building | 237 | 1,278,720 | 2.04 ms | 1.44 ms |

The two casting rows draw the same triangles into the same map. The only thing that changes is how many objects are handed to the pass, and the cost moves with it: about 6 us an object, of which 4.3 ms of the 4.75 is CPU submission with no GPU wait in it. Dropping the map from 2,048 square to 512 changed the pass by 0.6 ms, and halving the radius changed it by nothing, because in a town this size the whole place is inside the map either way. It is a draw call bill, not a pixel bill and not a triangle bill.

The landscape's own share of those 756 is two: the woods. Practically the whole 4.75 ms is the city, and it is over the roughly 2 ms this is worth at 1080p. What to drop is caster draws, not resolution and not radius: `SHADOW_LAYER` is there so a building can hand the pass one merged stand-in instead of four meshes, which is the 1.44 ms row. After sunset none of it is paid: the sun goes invisible and the pass does not run.

## Standing it up

Once, when the city is built:

```ts
const built = buildLand(world)             // Result: check it
const land = built.value
stage.scene.add(land.root)
stage.scene.fog = land.fog                 // the same object from here on
stage.camera.far = land.cameraFar          // and updateProjectionMatrix()
```

Every frame the player is outside:

```ts
land.setTime(clock.secondsOfDay / 3600)    // the fractional hour: whoever owns the clock decides the rate
land.update(delta, camera.position)        // the sky and the rain ride on this
```

If the sky is prefiltered into `scene.environment`, filter it now and then and carry it in between off `land.light`:

```ts
const filtered = { yaw: land.light.sunYaw, brightness: land.light.skyBrightness }   // when the prefilter runs
scene.environmentRotation.y = land.light.sunYaw - filtered.yaw                       // every frame
scene.environmentIntensity = base * (land.light.skyBrightness / filtered.brightness)
```

For the player's feet, anywhere in the world:

```ts
const y = land.heightAt(x, z)              // stand them on this
if (!land.walkableAt(x, z)) { /* refuse the step */ }
```

And whenever the weather changes: `land.setWeather('rain')`.

The land carries its own daylight, so the scene needs no other lights, and `scene.background` is not used: the sky is a real object. That includes an environment map: lighting the scene from a prefiltered copy of this skydome on top of `Land.skyLight` counts the sky twice, and a cast shadow only takes away the sun's own share of the light. Measured on the temperate theme at midday, a shadow darkens what it falls on by 39 percent with the land's lights alone, by 6 percent with the sky also in `scene.environment` at 0.35, and by 1.4 percent at 1.0, where it has stopped being visible at all. Pick one of the two.

For the sun's shadow the renderer needs `shadowMap.enabled = true` and a filter (`PCFSoftShadowMap` is what the near field is tuned for), and it has to be driven from `renderer.setAnimationLoop`: that is where `WebGPURenderer` advances the node frame the shadow map is redrawn on, so a loop that calls `render` from its own `requestAnimationFrame` draws the map once and then leaves it frozen where the player stood.

`@gb/scene` builds a stand-in ring of blocks over the verge for a city standing with no landscape around it, which this replaces; hide `city.root.getObjectByName('mountains')`. Going inside a building, hide `land.root` with the rest of the outside and stop calling `update`.

Wet ground is not this box: `land.wetness` is published for whoever owns the street and the buildings to read, 0 dry to 1 soaked.

## How to add a theme

A theme is one record in `src/theme.ts` and nothing else. Copy an existing one, give it an id and the words that should pick it out of a world's theme text, then set:

- `sky`: the latitude and the sun's declination (together, how long the day is and how high the sun gets: a winter declination makes it short and low at once), the four Preetham numbers, how much cloud there is in clear weather, and the night sky: how bright the galaxy is, how much light the city throws back up at the horizon, and the two colours that glow runs through. Dry clear air wants a strong galaxy and a weak glow; sea haze the other way round.
- `light`: sun colour high, low in the morning and low in the evening, moon colour and strength, sky and bounce colours and ambient strength by day and again at night, the haze colour by day and at night, and how thick the air is per metre. The night numbers are where you tune how dark night gets.
- `relief`: metres, measured outward from the built area. The bank the ground rises by from the town's edge and how far out it takes, how far the open ground runs and the little it lifts across it, then where the ring climbs, how high, how wide its top is, how far it takes to come down and what it settles to. Then three sizes of rolling laid over all of it, each an amplitude and a wavelength: keep the amplitude under about a twentieth of the wavelength or the open ground stops being walkable.
- `ground`: the colours the terrain is painted with, and the heights and the slope they change at.
- `water`: how many ponds, how wide, how deep. Ponds grow with distance from town, because the ground is drawn in bigger squares out there; one the ground cannot hold is quietly left as a dry hollow.
- `trees`: the species (trunk and canopy colour, height, spread, `cone`, `round` or `bare`), how far apart candidates start, what share of the ground is wooded, the tree line, the steepest ground roots hold, how far out woods reach and the cap on how many are drawn.

Add it to `THEMES`. Everything else picks it up: `landTheme(id)` finds it, `matchTheme` can choose it, and `buildLand` accepts its id.

## How to modify this blackbox safely

New land features are new modules under `src/` that read the theme and the ground and return objects, not new numbers scattered through the builders. Anything that needs the renderer, the camera or a frame loop belongs in the app. Run `pnpm --filter @gb/land test`.
