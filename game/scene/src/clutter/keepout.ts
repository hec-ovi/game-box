import * as THREE from 'three'
import type { Marking } from '../markings.ts'
import { CLEARANCE } from './catalog.ts'

/** A rectangle of street nothing may be dropped on, in metres, axis aligned. */
interface Forbidden {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

/** How big a bucket of the lookup grid is. Big enough that a rectangle lands in a few. */
const BUCKET = 8

/**
 * The parts of a street that have to stay clear, whatever else the city puts on
 * it: every doorstep, every crossing, every bar cars stop at, and the middle of
 * the roadway the two directions are divided by.
 *
 * These are read off what the city has already decided rather than guessed: the
 * doorsteps `@gb/scene` puts on the pavement, and the paint it lays from the
 * road graph. Nothing here is a number a generator chose.
 */
export class KeepOut {
  #buckets = new Map<string, Forbidden[]>()

  constructor(doorsteps: Iterable<THREE.Vector3>, markings: readonly Marking[]) {
    for (const doorstep of doorsteps) {
      this.#add({
        minX: doorstep.x - CLEARANCE.doorstep,
        maxX: doorstep.x + CLEARANCE.doorstep,
        minZ: doorstep.z - CLEARANCE.doorstep,
        maxZ: doorstep.z + CLEARANCE.doorstep,
      })
    }
    for (const marking of markings) {
      const margin = marking.kind === 'centre-line' ? CLEARANCE.centreLine : marking.kind === 'edge-line' ? undefined : CLEARANCE.crossing
      if (margin === undefined) continue
      // at rot 0 the length runs along z; a quarter turn swaps the two
      const alongZ = Math.abs(Math.cos(marking.rot)) > 0.5
      const halfX = (alongZ ? marking.width : marking.length) / 2 + margin
      const halfZ = (alongZ ? marking.length : marking.width) / 2 + margin
      this.#add({ minX: marking.x - halfX, maxX: marking.x + halfX, minZ: marking.z - halfZ, maxZ: marking.z + halfZ })
    }
  }

  /** True when a rectangle this size centred here would land on something that has to stay clear. */
  blocked(x: number, z: number, halfX: number, halfZ: number): boolean {
    for (let bx = Math.floor((x - halfX) / BUCKET); bx <= Math.floor((x + halfX) / BUCKET); bx++) {
      for (let bz = Math.floor((z - halfZ) / BUCKET); bz <= Math.floor((z + halfZ) / BUCKET); bz++) {
        for (const rect of this.#buckets.get(`${bx},${bz}`) ?? []) {
          if (x + halfX > rect.minX && x - halfX < rect.maxX && z + halfZ > rect.minZ && z - halfZ < rect.maxZ) return true
        }
      }
    }
    return false
  }

  #add(rect: Forbidden): void {
    for (let bx = Math.floor(rect.minX / BUCKET); bx <= Math.floor(rect.maxX / BUCKET); bx++) {
      for (let bz = Math.floor(rect.minZ / BUCKET); bz <= Math.floor(rect.maxZ / BUCKET); bz++) {
        const key = `${bx},${bz}`
        const bucket = this.#buckets.get(key)
        if (bucket) bucket.push(rect)
        else this.#buckets.set(key, [rect])
      }
    }
  }
}
