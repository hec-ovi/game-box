import type { RoadSegment } from '@gb/world'
import type { CarBodies } from './bodies.ts'

/**
 * The Quaternius Realistic Car Pack, by file name, with how common each one is
 * on the street. Closed on purpose: a name here is a model the app can load.
 */
export const CAR_MODELS = ['NormalCar1', 'NormalCar2', 'SUV', 'Taxi', 'SportsCar', 'SportsCar2', 'Cop'] as const
export type CarModel = (typeof CAR_MODELS)[number]

export const MODEL_MIX: ReadonlyArray<readonly [CarModel, number]> = [
  ['NormalCar1', 4],
  ['NormalCar2', 4],
  ['SUV', 3],
  ['Taxi', 2],
  ['SportsCar', 1],
  ['SportsCar2', 1],
  ['Cop', 0.5],
]

/** Metres per second by road kind: 30, 50 and 60 km/h. */
export const SPEED_LIMIT: Record<RoadSegment['kind'], number> = {
  street: 8.5,
  avenue: 13.9,
  exit: 16.7,
}

/** Nobody swings through a junction at speed. */
export const TURN_SPEED = 4

export interface TrafficOptions {
  /** Defaults to the world seed, so one city always gets the same traffic. */
  readonly seed?: string
  /** How many cars exist at once. */
  readonly maxCars?: number
  /** Cars are created on lanes within this many metres of the focus point. */
  readonly spawnRadius?: number
  /** And retired past this many. Must be larger than `spawnRadius`. */
  readonly despawnRadius?: number
  /** Never create a car closer than this, so none appears in front of you. */
  readonly minSpawnDistance?: number
  /** Inside this radius cars run the full model every frame. */
  readonly nearRadius?: number
  /** Outside it, one car in `farStride` is updated per frame, over the time it missed. */
  readonly farStride?: number
  /** Longest step a car integrates in one go, seconds. */
  readonly maxStep?: number
  /** Roadway width in metres. Defaults to three grid cells, 6 m on a 2 m grid. */
  readonly roadway?: number
  /** Height the model sits at, metres. */
  readonly rideHeight?: number
  /** Where three.js objects come from. Left out, the traffic runs without a scene. */
  readonly bodies?: CarBodies
}

export interface Settings {
  readonly seed: string
  readonly maxCars: number
  readonly spawnRadius: number
  readonly despawnRadius: number
  readonly minSpawnDistance: number
  readonly nearRadius: number
  readonly farStride: number
  readonly maxStep: number
  readonly roadway: number
  readonly rideHeight: number
  readonly bodies: CarBodies | undefined
}

export function withDefaults(options: TrafficOptions, seed: string, cellSize: number): Settings {
  const spawnRadius = options.spawnRadius ?? 140
  return {
    seed: options.seed ?? seed,
    maxCars: options.maxCars ?? 40,
    spawnRadius,
    despawnRadius: Math.max(options.despawnRadius ?? 180, spawnRadius + 20),
    minSpawnDistance: options.minSpawnDistance ?? 35,
    nearRadius: options.nearRadius ?? 60,
    farStride: Math.max(1, Math.round(options.farStride ?? 3)),
    maxStep: options.maxStep ?? 0.1,
    roadway: options.roadway ?? cellSize * 3,
    rideHeight: options.rideHeight ?? 0,
    bodies: options.bodies,
  }
}
