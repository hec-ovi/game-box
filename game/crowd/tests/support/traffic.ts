import type { Hazard, Hazards } from '../../src/index.ts'

/** One thing on the road, driven by the test rather than by `@gb/traffic`. */
export class Car implements Hazard {
  x: number
  z: number
  vx: number
  vz: number
  readonly radius: number

  constructor(at: { x: number; z: number }, velocity: { vx: number; vz: number }, radius = 2.5) {
    this.x = at.x
    this.z = at.z
    this.vx = velocity.vx
    this.vz = velocity.vz
    this.radius = radius
  }

  /** Park it where it stands. */
  stop(): void {
    this.vx = 0
    this.vz = 0
  }
}

/** The road as the crowd is allowed to see it: whatever the test put on it. */
export class Cars implements Hazards {
  readonly cars: Car[] = []

  add(car: Car): Car {
    this.cars.push(car)
    return car
  }

  /** Move everything on for a frame. The crowd never does this: the game's traffic does. */
  drive(seconds: number): void {
    for (const car of this.cars) {
      car.x += car.vx * seconds
      car.z += car.vz * seconds
    }
  }

  near(x: number, z: number, radius: number): readonly Hazard[] {
    return this.cars.filter((car) => Math.hypot(car.x - x, car.z - z) <= radius)
  }
}
