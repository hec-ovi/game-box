# @gb/land contract

contractVersion: 0.1.0

## Purpose

Builds the world the city sits in: a sky with a sun in it, the ring of hills the grid's mountain cells mark, ground running out to the horizon, ponds in the low places and woods on the slopes.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `buildLand(world, options?)` | a `@gb/world` `World` | at least one cell of the grid is not `mountain` |
| `options.theme` | a registered theme id (`THEMES`) | left out, the theme is matched from `world.theme` |
| `options.seed` | string | left out, `world.seed`. Same seed, same landscape |
| `options.horizon` | metres of land past the edge of the map | default 1600 |
| `options.detail` | `'full'` or `'low'` | `'low'` thins the woods and pulls the horizon in, for the WebGL2 tier |
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
| `Land.sun`, `Land.skyLight` | a directional light and a hemisphere light | the theme's daylight, pointed at the town |
| `Land.fog` | `THREE.Fog` | assign to `scene.fog`: the haze the horizon fades into |
| `Land.cameraFar` | metres | the smallest camera far plane that still sees the whole dome |
| `Land.heightAt(x, z)` | metres | height of the land anywhere, exactly `0` on the town and its roads |
| `Land.waterAt(x, z)` | metres or undefined | the water level standing at a point, undefined on dry ground |
| `Land.cost` | `triangles`, `vertices`, `trees`, `ponds`, `draws` | what this landscape costs to draw |

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
- Objects only. No renderer, no camera, no frame loop, which is why the whole box is tested in Node with no canvas.
- The sky is a node material, which is what `WebGPURenderer` needs and what its WebGL2 backend compiles for itself.

## What it costs

Measured on a one-block town (32x32 cells) and a four-block town (89x89 cells), both at the default detail:

| | terrain triangles | tree triangles | draws | build |
|---|---|---|---|---|
| 32x32, temperate | 6,248 | 23,300 (640 trees) | 5 | 6 ms |
| 89x89, arid | 17,648 | 21,900 (520 trees) | 5 | 10 ms |
| 89x89, maritime | 17,648 | 33,000 (900 trees) | 5 | 11 ms |

Five draws is the terrain, the water, the sky and one instanced mesh per tree species. `detail: 'low'` cuts the woods to 40% and the horizon to 60%.

## Standing it up

```ts
const land = buildLand(world)              // Result: check it
stage.scene.add(land.value.root)
stage.scene.fog = land.value.fog
stage.camera.far = land.value.cameraFar    // and updateProjectionMatrix()
```

The land carries its own daylight, so the scene needs no other lights, and `scene.background` is no longer used: the sky is a real object. `@gb/scene` still builds its own block of mountains per cell, which this replaces; hide `city.root.getObjectByName('mountains')`. Going inside a building, hide `land.root` with the rest of the outside.

## How to add a theme

A theme is one record in `src/theme.ts` and nothing else. Copy an existing one, give it an id and the words that should pick it out of a world's theme text, then set:

- `sky`: sun elevation and azimuth, the four Preetham numbers, and how much cloud there is.
- `light`: sun and sky colours and strengths, and the haze colour with where it starts and ends.
- `relief`: the shape of the ring in metres, skirt to outer plain, plus how big the hills laid over it are.
- `ground`: the colours the terrain is painted with, and the heights and the slope they change at.
- `water`: how many ponds, how wide, how deep. A pond needs `radius + 6` metres of clear ground, so a theme with a narrow skirt wants a small radius.
- `trees`: the species (trunk and canopy colour, height, spread, `cone`, `round` or `bare`), how far apart candidates start, what share of the ground is wooded, the tree line, the steepest ground roots hold, how far out woods reach and the cap on how many are drawn.

Add it to `THEMES`. Everything else picks it up: `landTheme(id)` finds it, `matchTheme` can choose it, and `buildLand` accepts its id.

## How to modify this blackbox safely

New land features are new modules under `src/` that read the theme and the height field and return objects, not new numbers scattered through the builders. Anything that needs the renderer, the camera or a frame loop belongs in the app. Run `pnpm --filter @gb/land test`.
