/**
 * Puts a borrowed face piece where this body's own one sits.
 *
 * The pack models a pair of eyebrows for each head and binds each pair to that
 * head's own rest pose. Refitting carries a borrowed pair across by the head
 * bone, which the two bind poses already agree on, so what is left over is the
 * difference between the two faces: the female sheet lands 9 mm inside the male
 * forehead and 7 mm above his brow ridge, the male sheet 10 mm off the front of
 * the female face and 7 mm below hers. Settled out of the skin from there the
 * sheet rides up the forehead and its lash row lifts clear of the eye, which on
 * screen is a second pair of eyebrows above the first.
 *
 * So a borrowed sheet is moved bodily until it covers the same patch of face as
 * the body's own: both bounding boxes centred on the same point. That lands each
 * pair within 2 mm of where it sits on the head it was modelled for, lashes back
 * on the eye.
 *
 * Measured in the body's rest pose, after the refit and before the settle, so
 * the settle only has the skin left to answer for.
 */

/** Moves `part` so its bounding box shares a centre with `own`. Returns how far, in metres. */
export function alignOver(part, own) {
  const there = boxOf(own.listPrimitives())
  const here = boxOf(part.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives()))
  const shift = [0, 1, 2].map((axis) => centre(there, axis) - centre(here, axis))

  const point = []
  for (const mesh of part.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION')
      for (let vertex = 0; vertex < position.getCount(); vertex++) {
        position.getElement(vertex, point)
        position.setElement(vertex, [point[0] + shift[0], point[1] + shift[1], point[2] + shift[2]])
      }
    }
  }
  return Math.hypot(shift[0], shift[1], shift[2])
}

function centre(box, axis) {
  return (box.min[axis] + box.max[axis]) / 2
}

function boxOf(prims) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const prim of prims) {
    const position = prim.getAttribute('POSITION')
    const low = position.getMin([])
    const high = position.getMax([])
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], low[axis])
      max[axis] = Math.max(max[axis], high[axis])
    }
  }
  return { min, max }
}
