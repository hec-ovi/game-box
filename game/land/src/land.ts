import { err, ok, Rng, type Result } from '@gb/kit'
import type { World } from '@gb/world'
import * as THREE from 'three'
import { OpenField } from './field.ts'
import { HeightField } from './height.ts'
import { Noise } from './noise.ts'
import { buildAtmosphere } from './sky.ts'
import { buildTerrain } from './terrain.ts'
import { landTheme, matchTheme, type LandTheme } from './theme.ts'
import { buildTrees } from './trees.ts'
import { buildWater, carveBasins } from './water.ts'

/** Metres of land beyond the town, out to the horizon. */
const HORIZON = 1600
/** Metres a road carries on past the edge of the map before the hills close behind it. */
const PASS = 60

export type LandError =
  | { readonly code: 'unknown-theme'; readonly message: string }
  | { readonly code: 'no-valley'; readonly message: string }

export interface LandOptions {
  /** A registered theme id. Left out, the theme is read from the world's own theme text. */
  readonly theme?: string
  /** Left out, the world's seed. Same seed, same landscape. */
  readonly seed?: string
  /** Metres from the edge of the map to the far edge of the land. */
  readonly horizon?: number
  /** `low` thins the woods and pulls the horizon in, for the WebGL2 tier. */
  readonly detail?: 'full' | 'low'
}

export interface Land {
  /** Everything: sky, sun, terrain, water and woods. Add it to the scene once. */
  readonly root: THREE.Group
  readonly terrain: THREE.Mesh
  readonly water: THREE.Mesh | undefined
  readonly trees: readonly THREE.InstancedMesh[]
  readonly sky: THREE.Object3D
  readonly sun: THREE.DirectionalLight
  readonly skyLight: THREE.HemisphereLight
  /** Haze in the theme's colour. Assign it to `scene.fog`. */
  readonly fog: THREE.Fog
  readonly theme: LandTheme
  readonly horizon: number
  /** The smallest camera far plane that sees the whole sky. */
  readonly cameraFar: number
  /** Height of the land in metres at any point, zero on the town and its roads. */
  heightAt(x: number, z: number): number
  /** The water level standing at a point, or undefined where the ground is dry. */
  waterAt(x: number, z: number): number | undefined
  readonly cost: {
    readonly triangles: number
    readonly vertices: number
    readonly trees: number
    readonly ponds: number
    readonly draws: number
  }
}

/**
 * The land a city stands in: sky, the ring of hills its mountain cells mark,
 * the ground running out to the horizon, ponds in the low places and woods on
 * the slopes. Objects only, so it builds in Node with no canvas.
 */
export function buildLand(world: World, options: LandOptions = {}): Result<Land, LandError> {
  const theme = options.theme === undefined ? matchTheme(world.theme) : landTheme(options.theme)
  if (!theme) {
    return err({ code: 'unknown-theme', message: `no land theme called "${options.theme}"` })
  }

  const low = options.detail === 'low'
  const horizon = options.horizon ?? (low ? HORIZON * 0.6 : HORIZON)
  const rng = new Rng(options.seed ?? world.seed)

  const field = OpenField.of(world, {
    margin: HeightField.reach(theme) + 60,
    step: world.cellSize * 2,
    passLength: PASS,
  })
  if (!field.hasOpenGround()) {
    return err({ code: 'no-valley', message: 'every cell of the grid is mountain: there is no town to build land around' })
  }

  const relief = new Noise(rng.fork('relief').int(0, 0x7fffffff))
  const scatter = new Noise(rng.fork('scatter').int(0, 0x7fffffff))
  const height = new HeightField(field, theme, relief, world.cellSize)

  const centre = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
  const basins = carveBasins(height, theme, centre, rng.fork('water'))

  const terrain = buildTerrain(world, height, theme, relief, horizon)
  const water = buildWater(height, basins, theme)
  const budget = Math.round(theme.trees.max * (low ? 0.4 : 1))
  const trees = buildTrees(world, height, theme, scatter, rng.fork('trees'), budget)

  const townRadius = Math.hypot(world.grid.width * world.cellSize, world.grid.height * world.cellSize) / 2
  const skyRadius = horizon + townRadius + 100
  const air = buildAtmosphere(theme, centre, skyRadius)

  const root = new THREE.Group()
  root.name = 'land'
  root.add(air.sky, air.sun, air.sun.target, air.skyLight, terrain.mesh)
  if (water) root.add(water)
  for (const wood of trees.meshes) root.add(wood)

  return ok({
    root,
    terrain: terrain.mesh,
    water,
    trees: trees.meshes,
    sky: air.sky,
    sun: air.sun,
    skyLight: air.skyLight,
    fog: air.fog,
    theme,
    horizon,
    cameraFar: skyRadius * 1.2,
    heightAt: (x, z) => height.at(x, z),
    waterAt: (x, z) => height.waterAt(x, z),
    cost: {
      triangles: terrain.triangles,
      vertices: terrain.vertices,
      trees: trees.count,
      ponds: basins.length,
      // the terrain, the sky, the water if there is any, and one per tree species
      draws: 2 + (water ? 1 : 0) + trees.meshes.length,
    },
  })
}
