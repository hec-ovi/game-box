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
