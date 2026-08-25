import type * as THREE from 'three'
import type { CityBatcher, Taken } from './batch/batcher.ts'
import type { LightEmitter } from './lights/emitter.ts'

/**
 * What a dressing answered, made safe to use.
 *
 * The seam's optional members travel through wrappers, and a wrapper that
 * carries a member it has nothing behind can leave it there answering nothing.
 * Nothing a dressing answers may take a building out of the city, so every
 * answer is read through here rather than trusted.
 */

const NOTHING: Taken = { draws: false }

/** The object a dressing published, or nothing if it published no object. */
function objectOf(answer: THREE.Object3D | undefined): THREE.Object3D | undefined {
  return answer?.isObject3D ? answer : undefined
}

/** The emitters a dressing published, or none. */
export function emittersOf(answer: readonly LightEmitter[] | undefined): readonly LightEmitter[] {
  return Array.isArray(answer) ? answer : []
}

/** Offers whatever a dressing answered: one that answered nothing puts nothing in the city. */
export function offerTo(batcher: CityBatcher, plotId: string, answer: THREE.Object3D | undefined, at: THREE.Matrix4): Taken {
  const object = objectOf(answer)
  return object ? batcher.offer(plotId, object, at) : NOTHING
}
