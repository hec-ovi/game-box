import type * as THREE from 'three'

/**
 * A part of a building drawn from code rather than taken from the kit, on one
 * of the kit's own materials and in the building's frame, so it welds into the
 * building's meshes and costs no draw of its own.
 */
export interface Fixture {
  /** What it is, for the error a failed weld names. */
  readonly piece: string
  readonly material: string
  readonly geometry: THREE.BufferGeometry
}

/** Where a fixture stands in the building's frame: its origin, and the turn that points its +Z out. */
export interface Standing {
  readonly position: readonly [number, number, number]
  readonly rotationY: number
}
