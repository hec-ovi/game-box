# @gb/land contract

contractVersion: 0.3.0

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
| `land.setTime(hours)` | hours, wrapping | cheap enough for every frame |
| `land.setWeather(weather)` | one of `WEATHERS` | |
| `land.update(seconds, viewer)` | seconds since the last frame, the camera's position in metres | call every frame the player is outside |
| `landTheme(id)` / `matchTheme(text)` | string | `matchTheme` always answers: no match falls to `DEFAULT_THEME` |

## Outputs

`buildLand` answers a `@gb/kit` `Result<Land, LandError>`.

| Param | Schema | Postconditions |
|---|---|---|
| `Land.root` | `THREE.Group` named `land` | the whole landscape. Add it to the scene once, beside the city |
| `Land.terrain` | one `THREE.Mesh` named `land:terrain` | indexed, welded, vertex-coloured, every face looking up |
| `Land.water` | one `THREE.Mesh` named `land:water`, or undefined | every pond, each drawn out to its own shoreline |
| `Land.trees` | one `THREE.InstancedMesh` per species, `land:trees:<species>` | each tree standing on the ground at its position |
| `Land.sky` | the skydome, named `land:sky` | Preetham daylight with clouds, drawn first and never into the depth buffer |
| `Land.stars` | `THREE.Points` named `land:stars` | 1,200 stars, faded out before the sun reaches the horizon; the moon is `land:moon-disc` |
| `Land.sun`, `Land.moon`, `Land.skyLight` | two directional lights and a hemisphere light | the sun and the moon on opposite ends of the same arc, and the sky filling in behind them |
| `Land.rain` | `THREE.LineSegments` named `land:rain` | streaks inside `Land.rainVolume`, centred on the last viewer it was given |
| `Land.fog` | `THREE.FogExp2` | assign to `scene.fog` once: the same object is edited as the time and weather change |
| `Land.heightAt(x, z)` | metres | the height of the triangle the mesh draws there, to float precision. Zero over the town and its roads |
| `Land.slopeAt(x, z)` | rise over run | the tilt of that same triangle. Zero over the town |
| `Land.walkableAt(x, z)` | boolean | false where the ground is steeper than 0.7, or under water. True everywhere else, town included |
| `Land.waterAt(x, z)` | metres or undefined | the water level standing at a point, undefined on dry ground |
| `Land.time`, `Land.weather` | hours and the weather it was last told | this box remembers what it was told, it does not run a clock |
| `Land.wetness` | 0 dry to 1 soaked | what another box should read to decide how wet to make a surface |
| `Land.horizon`, `Land.cameraFar` | metres | how far the land goes, and the smallest camera far plane that sees the whole sky |
| `Land.cost` | `triangles`, `vertices`, `trees`, `ponds`, `drops`, `draws` | what this landscape costs to draw |

## Errors (closed set)

- `unknown-theme`: `options.theme` names a theme nothing is registered under.
- `no-valley`: every cell of the grid is `mountain`, so there is no town to grow land around.

## Dependencies

- `@gb/world` contract: the grid, `CELL`, `cellSize` and the world's theme and seed.
- `@gb/kit` contract: `Rng` for determinism, `Result` for the answer.
- `three`, and `three/addons/objects/SkyMesh.js` for the sky.

## Invariants

- One world unit is one metre, Y up. Nothing here reads a size that is not the world's `cellSize` or a number in the theme.
- The grid's `mountain` cells are not where the mountains are. They are the verge: the strip between the last pavement and the open ground, flat, walkable, and covered here because the city's own ground stops at them. The high ground is a function of distance from the built area and does not begin for well over a kilometre.
- The city's ground belongs to `@gb/scene`. Terrain is laid on the verge and outside the map, and on nothing else: no face, no tree and no water ever lands on a street, a pavement, a park or a plot.
- The land is flat at zero on every open cell and for two metres around it, and the roads out are graded for 120 m past the edge of the map, so leaving town is never uphill into a wall.
- `heightAt` reads the very surface the mesh is built from, not an approximation of it: the same lattice, the same quad, the same one of its two triangles. Measured against raycasts of the finished mesh the two agree to under a hundredth of a millimetre, so a player placed on the answer stands exactly on what they can see.
- The ground is built as three steps of resolution, each four times coarser and further out than the last, all welded into one mesh. A tier's outermost ring of heights is pulled onto the coarse edge it meets, so no crack opens at a seam.
- Water is carved, not floated. A pond's level is set below the lowest point of its own rim and its shore is walked out to where the ground comes back up through the surface. A bowl the drawn ground does not close on every side stays a dry hollow rather than a pond hanging over the land.
- Time and weather move light, never geometry. `setTime` and `setWeather` write the sun and moon positions, the sky's uniforms and the colours and strengths of the lights and the fog, all in place. No vertex is touched again after the build.
- The sun and the moon are the two ends of one arc: sunrise at 06:00, noon overhead at the theme's `noonElevation`, sunset at 18:00, the moon opposite it all the way round. Twilight runs from seven degrees below the horizon to eleven above.
- Night is dim, not black. Moonlight plus a lifted blue ambient leaves it about five times darker than noon (5.3 light units at noon against 1.1 at midnight, on the temperate theme). Cloud takes less off the moon than off the sun, so a wet night stays walkable.
- Rain is a box of streaks that travels with the viewer. Drops keep world positions and wrap when they leave the box, so walking moves you through the rain instead of dragging it along, and no drop is ever drawn outside the volume.
- Same seed, same landscape, always. Every random choice comes from a `@gb/kit` `Rng` forked per feature (`relief`, `scatter`, `water`, `trees`, `stars`, `rain`), so retuning the woods cannot move the hills.
- This box holds no clock. It remembers the last time and weather it was told and renders them; whoever owns the clock calls `setTime`.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.
- The sky is a node material, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself. Everything else is ordinary three.js: mesh, instanced mesh, points and line segments, which render the same on both backends. Rain is stepped on the CPU for the same reason.

## What it costs

Measured on three towns, at the default detail:

| | terrain | woods | ponds | draws | build |
|---|---|---|---|---|---|
| 32x32 cells, temperate | 135,630 tris | 3,200 trees, 74,500 tris | 5 | 5 | 97 ms |
| 89x89 cells, arid | 159,568 tris | 2,200 trees, 61,600 tris | 2 | 5 | 75 ms |
| 51x51 cells, maritime | 131,990 tris | 4,000 trees, 93,400 tris | 7 | 5 | 78 ms |

The land is 6 to 7 km across and it is still five draws: the terrain, the water, the sky and one instanced mesh per tree species. Night adds two (1,200 stars in one `Points` draw and a 96 triangle moon), rain adds one.

Ground resolution is 6 m quads for the first half kilometre out of town, 24 m to about 1.8 km, then 96 m to the horizon. `detail: 'low'` doubles all three, which is a quarter of the geometry (35,300 tris) and a 28 ms build.

Per query and per frame:

- `heightAt`: 0.04 us. Two binary searches along a lattice and four numbers.
- `walkableAt`: 0.09 to 0.16 us, the difference being one pass over the ponds. Both are safe several times a frame in a collision loop.
- `setTime` / `setWeather`: 0.0005 ms. Two vectors, a few colour blends and eight uniform writes.
- `update` while raining: 0.08 ms for 3,000 streaks and 72 KB of positions uploaded. Dry, it returns immediately.

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
land.setTime(clock.hours)                  // whoever owns the clock decides the rate
land.update(delta, camera.position)
```

For the player's feet, anywhere in the world:

```ts
const y = land.heightAt(x, z)              // stand them on this
if (!land.walkableAt(x, z)) { /* refuse the step */ }
```

And whenever the weather changes: `land.setWeather('rain')`.

The land carries its own daylight, so the scene needs no other lights, and `scene.background` is no longer used: the sky is a real object. `@gb/scene` still builds its own block of mountains per cell, which this replaces; hide `city.root.getObjectByName('mountains')`. Going inside a building, hide `land.root` with the rest of the outside and stop calling `update`.

Wet ground is not this box: `land.wetness` is published for whoever owns the street and the buildings to read, 0 dry to 1 soaked.

## How to add a theme

A theme is one record in `src/theme.ts` and nothing else. Copy an existing one, give it an id and the words that should pick it out of a world's theme text, then set:

- `sky`: how high the sun stands at midday (which is what makes a place northern or southern), the four Preetham numbers, and how much cloud there is in clear weather.
- `light`: sun colour high and low, moon colour and strength, sky and bounce colours and ambient strength by day and again at night, the haze colour by day and at night, and how thick the air is per metre. The night numbers are where you tune how dark night gets.
- `relief`: metres, measured outward from the built area. How far the open ground runs and the little it lifts across it, then where the ring climbs, how high, how wide its top is, how far it takes to come down and what it settles to. Then three sizes of rolling laid over all of it, each an amplitude and a wavelength: keep the amplitude under about a twentieth of the wavelength or the open ground stops being walkable.
- `ground`: the colours the terrain is painted with, and the heights and the slope they change at.
- `water`: how many ponds, how wide, how deep. Ponds grow with distance from town, because the ground is drawn in bigger squares out there; one the ground cannot hold is quietly left as a dry hollow.
- `trees`: the species (trunk and canopy colour, height, spread, `cone`, `round` or `bare`), how far apart candidates start, what share of the ground is wooded, the tree line, the steepest ground roots hold, how far out woods reach and the cap on how many are drawn.

Add it to `THEMES`. Everything else picks it up: `landTheme(id)` finds it, `matchTheme` can choose it, and `buildLand` accepts its id.

## How to modify this blackbox safely

New land features are new modules under `src/` that read the theme and the ground and return objects, not new numbers scattered through the builders. Anything that needs the renderer, the camera or a frame loop belongs in the app. Run `pnpm --filter @gb/land test`.
