import { METRICS } from '@gb/world'
import type { CarModel } from './settings.ts'

/**
 * How `cars.glb` is laid out. The converter writes it, the loader reads it, and
 * the tests measure against it, so the numbers and names live in one place.
 */

/** The footprint the simulation reserves for a car, metres. Every model fits inside it. */
export const CAR_FOOTPRINT = {
  length: METRICS.vehicle.carLength,
  width: METRICS.vehicle.carWidth,
} as const

/** Children of a car node. The wheels are pivots at their axle, so they turn. */
export const CAR_PARTS = {
  body: 'Body',
  frontLeft: 'WheelFrontLeft',
  frontRight: 'WheelFrontRight',
  /** Both rear wheels: the pack models them as one object on one axle. */
  rear: 'WheelRear',
} as const

export type CarPart = (typeof CAR_PARTS)[keyof typeof CAR_PARTS]

/**
 * What a part is called inside the file. Every name carries its model, because
 * a glTF loader renames repeats (`Body`, `Body_1`, ...) and a car would then
 * only be findable by the order it was packed in.
 */
export function partName(model: CarModel, part: CarPart): string {
  return `${model}_${part}`
}

/** The file `node game/traffic/tools/build-cars.ts` writes into assets/dist. */
export const CARS_FILE = 'cars.glb'

/**
 * What a triangle of a car is made of. Every car in the pack wears one material
 * and carries its surface per vertex, so a whole car is one draw and the shader
 * still knows paint from glass from a lamp lens.
 */
export const CAR_SURFACES = {
  /** Body panels: metallic base under a clear coat. */
  paint: 0,
  /** Windows and the windscreen. */
  glass: 1,
  /** Head lamps, tail lamps and the beacons on the police car: these light up. */
  lamp: 2,
  /** Tyres, rubber, grilles and everything under the car. */
  trim: 3,
  /** Rims, exhausts and brightwork. */
  metal: 4,
} as const

export type CarSurface = (typeof CAR_SURFACES)[keyof typeof CAR_SURFACES]

/**
 * Brightwork is stored at a fifth of its brightness and lifted by the shader,
 * because the pack's own rims are near-black and a wheel is not. The converter
 * divides by it and `CarPaint` multiplies by it, so what a model was painted is
 * what it renders.
 */
export const METAL_LIFT = 5

/** The Quaternius material names, by what they are made of. Anything else is paint. */
const SURFACE_OF: Readonly<Record<string, CarSurface>> = {
  Windows: CAR_SURFACES.glass,
  Headlights: CAR_SURFACES.lamp,
  TailLights: CAR_SURFACES.lamp,
  WhiteLights: CAR_SURFACES.lamp,
  BlueLights: CAR_SURFACES.lamp,
  Black: CAR_SURFACES.trim,
  Grey: CAR_SURFACES.metal,
}

export function surfaceOf(material: string): CarSurface {
  return SURFACE_OF[material] ?? CAR_SURFACES.paint
}

/** The one material the whole pack is painted with, by name. */
export const CAR_MATERIAL = 'CarPaint'
