import * as THREE from 'three'
import type { Screening } from './screening.ts'

/**
 * The same piece, tuned to a different screening.
 *
 * A builder stamps a face as a screen and knows nothing about what is on it;
 * this writes the station and the phase over that stamp. So the handful of
 * screenings a town carries are the same buffers with one attribute swapped:
 * every position, normal, colour and index is shared with the piece it came
 * from, and a second screening costs four bytes a vertex rather than a second
 * copy of the furniture.
 */
export function tunedTo(geometry: THREE.BufferGeometry, screening: Screening, name: string): THREE.BufferGeometry {
  const from = geometry.getAttribute('screen').array as Uint8Array
  const bytes = Uint8Array.from(from)
  for (let at = 0; at < bytes.length; at += 4) {
    if (bytes[at + 2] === 0) continue
    bytes[at + 2] = screening.station
    bytes[at + 3] = Math.round(screening.phase * 255)
  }

  const tuned = new THREE.BufferGeometry()
  for (const [attribute, buffer] of Object.entries(geometry.attributes)) tuned.setAttribute(attribute, buffer)
  tuned.setAttribute('screen', new THREE.Uint8BufferAttribute(bytes, 4, true))
  tuned.setIndex(geometry.getIndex())
  tuned.boundingBox = geometry.boundingBox
  tuned.name = name
  return tuned
}
