# @gb/land contract

contractVersion: 0.2.0

## Purpose

Builds the world the city sits in and the sky over it: the ring of hills the grid's mountain cells mark, ground running out to the horizon, ponds in the low places, woods on the slopes, and a sun, a moon and weather that the game drives from outside.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `buildLand(world, options?)` | a `@gb/world` `World` | at least one cell of the grid is not `mountain` |
| `options.theme` | a registered theme id (`THEMES`) | left out, the theme is matched from `world.theme` |
| `options.seed` | string | left out, `world.seed`. Same seed, same landscape |
| `options.horizon` | metres of land past the edge of the map | default 1600 |
| `options.detail` | `'full'` or `'low'` | `'low'` thins the woods and the rain and pulls the horizon in, for the WebGL2 tier |
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
| `Land.fog` | `THREE.Fog` | assign to `scene.fog` once: the same object is edited as the time and weather change |
| `Land.time`, `Land.weather` | hours and the weather it was last told | this box remembers what it was told, it does not run a clock |
| `Land.wetness` | 0 dry to 1 soaked | what another box should read to decide how wet to make a surface |
| `Land.cameraFar` | metres | the smallest camera far plane that still sees the whole dome |
| `Land.heightAt(x, z)` | metres | height of the land anywhere, exactly `0` on the town and its roads |
| `Land.waterAt(x, z)` | metres or undefined | the water level standing at a point, undefined on dry ground |
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
- The city's ground belongs to `@gb/scene`. Terrain is laid on the grid's `mountain` cells and outside the map, and on nothing else: no face, no tree and no water ever lands on a street, a pavement, a park or a plot.
- The land is flat at zero on every open cell and for two metres around it, which is what keeps the road out of the valley passable. The exits carry on 60 m past the edge of the map before the hills close behind them, so the way out is a pass and not a dead end.
- The ring rises out of the valley instead of standing on it: a gentle skirt across the mountain footprint, then a climb of over a hundred metres to the crest, then a descent to a plain that runs to the horizon. Height is a function of distance from open ground, so a grid with a different mountain footprint grows a different ring with no change here.
- The terrain is one mesh: the footprint at cell resolution welded to a skirt of rings whose steps grow with distance. Vertices are shared by position, so the two cannot crack apart.
- Water is carved, not floated. A pond's level is set below the lowest point of its own rim, so it closes on every side, and its shore is walked out to where the land comes back up through the surface. The land inside the shore is always under the water and the land outside it is always above.
- Same seed, same landscape, always. Every random choice comes from a `@gb/kit` `Rng` forked per feature (`relief`, `scatter`, `water`, `trees`), so retuning the woods cannot move the hills.
- Time and weather move light, never geometry. `setTime` and `setWeather` write the sun and moon positions, the sky's uniforms and the colours and strengths of the lights and the fog, all in place. No vertex of the terrain, the water or the woods is ever touched again after the build.
- The sun and the moon are the two ends of one arc: sunrise at 06:00, noon overhead at the theme's `noonElevation`, sunset at 18:00, the moon opposite it all the way round. Twilight runs from seven degrees below the horizon to eleven above.
- Night is dim, not black. Moonlight plus a lifted blue ambient leaves it about five times darker than noon (5.3 light units at noon against 1.1 at midnight, on the temperate theme), which is a street you can walk down and read. Cloud takes less off the moon than off the sun, so a wet night stays walkable.
- Rain is a box of streaks that travels with the viewer. Drops keep world positions and wrap when they leave the box, so walking moves you through the rain instead of dragging it along, and no drop is ever drawn outside the volume.
- This box holds no clock. It remembers the last time and weather it was told and renders them; whoever owns the clock calls `setTime`.
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.
- The sky is a node material, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself. Everything else is ordinary three.js: mesh, instanced mesh, points and line segments, which render the same on both backends. Rain is stepped on the CPU for the same reason.

## What it costs

Measured on a one-block town (32x32 cells) and a four-block town (89x89 cells), both at the default detail:

| | terrain triangles | tree triangles | draws | build |
|---|---|---|---|---|
| 32x32, temperate | 6,248 | 23,300 (640 trees) | 5 | 23 ms |
| 89x89, arid | 17,648 | 21,900 (520 trees) | 5 | 15 ms |
| 89x89, maritime | 17,648 | 33,000 (900 trees) | 5 | 15 ms |

Five draws is the terrain, the water, the sky and one instanced mesh per tree species. Night adds two: 1,200 stars in one `Points` draw and a 96 triangle moon. Rain adds one more.

Per frame:

- `setTime`: 0.0005 ms. Two vectors, a handful of colour blends and eight uniform writes. Call it every frame without thinking about it.
- `setWeather`: the same work, plus setting a draw range. No allocation.
- `update` while raining: 0.08 ms for 3,000 streaks, and 72 KB of positions uploaded. Dry, it returns immediately.

3,000 streaks is what a 26 x 20 x 26 m volume wants to read as steady rain from inside a 6 m street. `detail: 'low'` cuts the woods to 40%, the rain to 1,350 drops and the horizon to 60%.

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

And whenever the weather changes: `land.setWeather('rain')`.

The land carries its own daylight, so the scene needs no other lights, and `scene.background` is no longer used: the sky is a real object. `@gb/scene` still builds its own block of mountains per cell, which this replaces; hide `city.root.getObjectByName('mountains')`. Going inside a building, hide `land.root` with the rest of the outside and stop calling `update`.

Wet ground is not this box: `land.wetness` is published for whoever owns the street and the buildings to read, 0 dry to 1 soaked.

## How to add a theme

A theme is one record in `src/theme.ts` and nothing else. Copy an existing one, give it an id and the words that should pick it out of a world's theme text, then set:

- `sky`: how high the sun stands at midday (which is what makes a place northern or southern), the four Preetham numbers, and how much cloud there is in clear weather.
- `light`: sun colour high and low, moon colour and strength, sky and bounce colours and ambient strength by day and again at night, and the haze colour by day and at night with where it starts and ends. The night numbers are where you tune how dark night gets.
- `relief`: the shape of the ring in metres, skirt to outer plain, plus how big the hills laid over it are.
- `ground`: the colours the terrain is painted with, and the heights and the slope they change at.
- `water`: how many ponds, how wide, how deep. A pond needs `radius + 6` metres of clear ground, so a theme with a narrow skirt wants a small radius.
- `trees`: the species (trunk and canopy colour, height, spread, `cone`, `round` or `bare`), how far apart candidates start, what share of the ground is wooded, the tree line, the steepest ground roots hold, how far out woods reach and the cap on how many are drawn.

Add it to `THEMES`. Everything else picks it up: `landTheme(id)` finds it, `matchTheme` can choose it, and `buildLand` accepts its id.

## How to modify this blackbox safely

New land features are new modules under `src/` that read the theme and the height field and return objects, not new numbers scattered through the builders. Anything that needs the renderer, the camera or a frame loop belongs in the app. Run `pnpm --filter @gb/land test`.
