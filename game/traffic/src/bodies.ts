import type { CarModel } from './settings.ts'

/**
 * The part of a scene object traffic writes to. A three.js `Object3D` satisfies
 * this, and so does a plain object in a test, which is why this box never
 * imports a loader or a renderer.
 */
export interface CarBody {
  position: { x: number; y: number; z: number }
  rotation: { y: number }
}

export interface CarSpawn {
  readonly id: string
  readonly model: CarModel
}

/**
 * Where car objects come from and go back to. Implement it with a pool: traffic
 * acquires on spawn and releases on retire, many times a minute.
 */
export interface CarBodies {
  acquire(spawn: CarSpawn): CarBody
  release(body: CarBody, spawn: CarSpawn): void
}
