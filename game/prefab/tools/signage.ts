import { SIGN, type Sign } from '@gb/kitbash'
import * as THREE from 'three'
import { axesOf, type StreetFace } from '../src/face.ts'
import { Fixtures } from '../src/fixtures.ts'

/**
 * Reads a building's signage back off its mesh, for the measurement and the
 * test that hold a seated fixture to the face it belongs on.
 *
 * A town's signage is one welded buffer per building, which is what makes it
 * one draw, so a vertex only means something next to the sign whose patch it
 * stands in. Dress the same plot with the kit as well and the two buffers hold
 * the same vertices in the same order, once where the kit wrote them and once
 * where they were hung, which is what says which vertex belongs to which sign
 * without reading the seat that moved it.
 */
export function signPoints(building: THREE.Object3D): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  building.traverse((child) => {
    const one = child as THREE.Mesh
    if (!one.isMesh || (one.material as THREE.Material).name !== SIGN.material) return
    one.updateMatrix()
    const position = one.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < position.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(one.matrix))
  })
  return out
}

/** One sign, where it ended up: across its wall, up it, and how far its face stands from the building's origin. */
export interface SeatedSign {
  readonly sign: Sign
  readonly across: [number, number]
  readonly up: [number, number]
  readonly out: number
  /** The furthest any of its vertices travelled from where the kit wrote it. */
  readonly moved: number
}

/**
 * Every sign of a plot, measured where it was hung. `written` is the same
 * building dressed by the kit alone, which is where each vertex started.
 */
export function seatedSigns(written: readonly THREE.Vector3[], hung: readonly THREE.Vector3[], signs: readonly Sign[], face: StreetFace): { seated: SeatedSign[]; orphans: number } {
  if (written.length !== hung.length) throw new Error(`${written.length} sign vertices written, ${hung.length} hung`)
  const fixtures = Fixtures.on(face, signs)
  const owner = written.map((point) => fixtures.holder([point.x, point.y, point.z]))
  const seated: SeatedSign[] = []
  for (const [index, sign] of signs.entries()) {
    const mine = hung.filter((_, at) => owner[at] === index)
    if (!mine.length) continue
    const { across, out, outward } = axesOf(sign.wall)
    const at = (point: THREE.Vector3, axis: 'x' | 'z') => (axis === 'x' ? point.x : point.z)
    const from = written.filter((_, at) => owner[at] === index)
    seated.push({
      sign,
      across: [Math.min(...mine.map((point) => at(point, across))), Math.max(...mine.map((point) => at(point, across)))],
      up: [Math.min(...mine.map((point) => point.y)), Math.max(...mine.map((point) => point.y))],
      out: Math.min(...mine.map((point) => at(point, out) * outward)),
      moved: Math.max(...mine.map((point, was) => point.distanceTo(from[was]!))),
    })
  }
  return { seated, orphans: owner.filter((one) => one === undefined).length }
}

/** Where a plate sits along the wall it is on, off a face's own plate. */
export function middleOf(plate: { position: readonly [number, number, number] }, face: StreetFace): number {
  return plate.position[axesOf(face.wall).across === 'x' ? 0 : 2]
}
