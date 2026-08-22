import { err, ok, Rng, type Result } from '@gb/kit'
import type { World } from '@gb/world'
import * as THREE from 'three'
import { OpenField } from './field.ts'
import { Ground, type TierSpec } from './ground.ts'
import { HeightField, type Basin } from './height.ts'
import { Noise } from './noise.ts'
import { Atmosphere } from './sky.ts'
import { buildTerrain } from './terrain.ts'
import { landTheme, matchTheme, type LandTheme } from './theme.ts'
import { buildTrees } from './trees.ts'
import { buildWater, carveBasins, waterLevelAt } from './water.ts'
import { RAIN_VOLUME, Rainfall, WEATHER, type Weather } from './weather.ts'

/** Metres of ground measured to the metre around the town, and how far the road out is graded. */
const FIELD_MARGIN = 300
const PASS = 120
/** Streaks of rain in the volume around the viewer, at the heaviest. */
const DROPS = 3000
/** Rise over run past which a slope is not something you can walk up. */
const MAX_WALK_SLOPE = 0.7

/**
 * How fine the ground is, and how far each step of it reaches past the map.
 * Six metre quads for the half kilometre you are most likely to walk, then
 * four times coarser twice over, which is what makes kilometres affordable.
 */
function tiers(theme: LandTheme, horizon: number, coarse: boolean): TierSpec[] {
  const scale = coarse ? 2 : 1
  return [
    { step: 6 * scale, reach: 460 },
    { step: 24 * scale, reach: 1800 },
    { step: 96 * scale, reach: horizon },
  ]
}

export type LandError =
  | { readonly code: 'unknown-theme'; readonly message: string }
  | { readonly code: 'no-valley'; readonly message: string }

export interface LandOptions {
  /** A registered theme id. Left out, the theme is read from the world's own theme text. */
  readonly theme?: string
  /** Left out, the world's seed. Same seed, same landscape. */
  readonly seed?: string
  /** Metres from the edge of the map to the far edge of the land. Default: past the far side of the ring. */
  readonly horizon?: number
  /** `low` thins the woods and the rain and pulls the horizon in, for the WebGL2 tier. */
  readonly detail?: 'full' | 'low'
  /** Hours, 0 to 24. Default midday. */
  readonly time?: number
  /** Default clear. */
  readonly weather?: Weather
}

export interface LandCost {
  readonly triangles: number
  readonly vertices: number
  readonly trees: number
  readonly ponds: number
  readonly drops: number
  /** Draws in clear daylight. Night adds the stars and the moon, rain adds one more. */
  readonly draws: number
}

/**
 * The land a city stands in, and the sky over it.
 *
 * Built once and then driven: the time of day and the weather move the sun, the
 * moon, the lights and the haze without touching a single vertex of the
 * terrain, so the app can set the time every frame.
 */
export class Land {
  /** Everything: sky, sun, moon, terrain, water, woods and rain. Add it to the scene once. */
  readonly root = new THREE.Group()
  readonly terrain: THREE.Mesh
  readonly water: THREE.Mesh | undefined
  readonly trees: readonly THREE.InstancedMesh[]
  readonly theme: LandTheme
  readonly horizon: number
  /** The smallest camera far plane that sees the whole sky. */
  readonly cameraFar: number
  /** Metres of the box of rain that travels with the viewer. */
  readonly rainVolume = RAIN_VOLUME.clone()
  readonly cost: LandCost

  readonly #air: Atmosphere
  readonly #rain: Rainfall
  readonly #ground: Ground
  readonly #height: HeightField
  readonly #basins: readonly Basin[]

  constructor(parts: {
    theme: LandTheme
    horizon: number
    cameraFar: number
    ground: Ground
    height: HeightField
    basins: readonly Basin[]
    air: Atmosphere
    rain: Rainfall
    terrain: THREE.Mesh
    water: THREE.Mesh | undefined
    trees: readonly THREE.InstancedMesh[]
    cost: Omit<LandCost, 'drops'>
  }) {
    this.theme = parts.theme
    this.horizon = parts.horizon
    this.cameraFar = parts.cameraFar
    this.terrain = parts.terrain
    this.water = parts.water
    this.trees = parts.trees
    this.#ground = parts.ground
    this.#height = parts.height
    this.#basins = parts.basins
    this.#air = parts.air
    this.#rain = parts.rain

    this.root.name = 'land'
    this.root.add(...parts.air.objects, parts.terrain, parts.rain.object)
    if (parts.water) this.root.add(parts.water)
    for (const wood of parts.trees) this.root.add(wood)

    this.cost = { ...parts.cost, drops: parts.rain.capacity }
  }

  get sky(): THREE.Object3D {
    return this.#air.sky
  }

  get stars(): THREE.Points {
    return this.#air.stars
  }

  get sun(): THREE.DirectionalLight {
    return this.#air.sun
  }

  get moon(): THREE.DirectionalLight {
    return this.#air.moon
  }

  get skyLight(): THREE.HemisphereLight {
    return this.#air.skyLight
  }

  /** Haze in the theme's colour, at this hour and this weather. Assign it to `scene.fog` once. */
  get fog(): THREE.FogExp2 {
    return this.#air.fog
  }

  get rain(): THREE.Object3D {
    return this.#rain.object
  }

  get time(): number {
    return this.#air.time
  }

  get weather(): Weather {
    return this.#air.weather
  }

  /** 0 dry to 1 soaked: what a surface should read to decide how wet to look. */
  get wetness(): number {
    return WEATHER[this.#air.weather].wetness
  }

  /** Hours, 0 to 24, wrapping. Cheap enough to call every frame. */
  setTime(hours: number): void {
    this.#air.setTime(hours)
  }

  setWeather(weather: Weather): void {
    this.#air.setWeather(weather)
    this.#rain.setFall(WEATHER[weather].fall)
  }

  /** Move the weather on by this many seconds, around a viewer who may have walked. */
  update(seconds: number, viewer: THREE.Vector3): void {
    this.#rain.update(seconds, viewer)
  }

  /**
   * Height of the ground in metres at any point, which is the very triangle the
   * mesh draws there. Zero over the town and its roads. Cheap: two searches
   * along a lattice and four numbers, so a player's feet can ask it every frame.
   */
  heightAt(x: number, z: number): number {
    return this.#ground.heightAt(x, z)
  }

  /** Rise over run of the ground under a point, off the same triangle. */
  slopeAt(x: number, z: number): number {
    return this.#ground.slopeAt(x, z)
  }

  /** Whether a foot can go here: not too steep, and not in the water. */
  walkableAt(x: number, z: number): boolean {
    if (this.#ground.slopeAt(x, z) > MAX_WALK_SLOPE) return false
    return this.waterAt(x, z) === undefined
  }

  /** The water level standing at a point, or undefined where the ground is dry. */
  waterAt(x: number, z: number): number | undefined {
    return waterLevelAt(this.#basins, this.#ground, x, z)
  }
}

/**
 * Builds the land: the ring of hills the grid's mountain cells mark, the ground
 * running out to the horizon, ponds in the low places, woods on the slopes and
 * a sky over all of it. Objects only, so it builds in Node with no canvas.
 */
export function buildLand(world: World, options: LandOptions = {}): Result<Land, LandError> {
  const theme = options.theme === undefined ? matchTheme(world.theme) : landTheme(options.theme)
  if (!theme) {
    return err({ code: 'unknown-theme', message: `no land theme called "${options.theme}"` })
  }

  const low = options.detail === 'low'
  const horizon = options.horizon ?? HeightField.reach(theme) + 1400
  const rng = new Rng(options.seed ?? world.seed)

  const field = OpenField.of(world, {
    margin: FIELD_MARGIN,
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

  const ground = Ground.build(world, height, tiers(theme, horizon, low))
  const terrain = buildTerrain(world, ground, height, theme, relief)
  const water = buildWater(ground, basins, theme)
  const trees = buildTrees(world, ground, height, water.basins, theme, scatter, rng.fork('trees'), Math.round(theme.trees.max * (low ? 0.4 : 1)))

  const townRadius = Math.hypot(world.grid.width * world.cellSize, world.grid.height * world.cellSize) / 2
  const skyRadius = ground.reach + townRadius + 200
  const air = new Atmosphere(theme, centre, skyRadius, rng.fork('stars'))
  const rain = new Rainfall(Math.round(DROPS * (low ? 0.45 : 1)), rng.fork('rain'))

  const land = new Land({
    theme,
    horizon: ground.reach,
    cameraFar: skyRadius * 1.2,
    ground,
    height,
    basins: water.basins,
    air,
    rain,
    terrain: terrain.mesh,
    water: water.mesh,
    trees: trees.meshes,
    cost: {
      triangles: terrain.triangles,
      vertices: terrain.vertices,
      trees: trees.count,
      ponds: water.basins.length,
      // the terrain, the sky, the water if there is any, and one per tree species
      draws: 2 + (water.mesh ? 1 : 0) + trees.meshes.length,
    },
  })
  land.setWeather(options.weather ?? 'clear')
  land.setTime(options.time ?? 12)
  return ok(land)
}
