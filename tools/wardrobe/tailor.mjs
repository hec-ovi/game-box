import { compactPrimitive } from '@gltf-transform/functions'

/**
 * Alterations to a garment's shape, in the part's own rest pose, before it is
 * refitted onto a body.
 *
 * The pack's footwear is knee-high: a real shoe at the bottom, then a shaft of
 * laces and buckles under a turned-down leather cuff, and its trousers stop
 * below the knee to be tucked into it. That is the shape of the outfit, not
 * its colour, so no repaint reaches it. Cutting the shaft off and letting the
 * trouser fall to the ankle is what makes a leg read as a leg in a city.
 */

/**
 * Drops every triangle of a garment that sits entirely above `height`, in
 * metres off the floor. A triangle that straddles the line stays, so the rim
 * reaches a little past the cut and tucks under whatever covers it.
 */
export function cutAbove(document, height) {
  let dropped = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION')
      const indices = prim.getIndices()
      if (!position || !indices) continue

      const low = new Uint8Array(position.getCount())
      for (let vertex = 0; vertex < low.length; vertex++) {
        low[vertex] = position.getElement(vertex, [])[1] <= height ? 1 : 0
      }
      const source = indices.getArray()
      const kept = []
      for (let corner = 0; corner < source.length; corner += 3) {
        if (!low[source[corner]] && !low[source[corner + 1]] && !low[source[corner + 2]]) {
          dropped++
          continue
        }
        kept.push(source[corner], source[corner + 1], source[corner + 2])
      }
      indices.setArray(new Uint32Array(kept))
      compactPrimitive(prim)
    }
  }
  return dropped
}

/**
 * Pulls a garment's bottom rim down to `height` by stretching its lowest
 * `band` metres over the longer drop. The texture stretches with it, which
 * costs nothing here: these trousers are repainted to one settled colour, so
 * there is no pattern left to smear.
 */
export function dropHem(document, height, band = 0.2) {
  const primitives = []
  let rim = Infinity
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION')
      if (!position) continue
      primitives.push(position)
      rim = Math.min(rim, position.getMin([])[1])
    }
  }
  if (!Number.isFinite(rim)) throw new Error('nothing to take a hem down')
  if (height >= rim) return 0

  const top = rim + band
  let moved = 0
  for (const position of primitives) {
    for (let vertex = 0; vertex < position.getCount(); vertex++) {
      const point = position.getElement(vertex, [])
      if (point[1] >= top) continue
      const along = (point[1] - rim) / band
      point[1] = height + along * (top - height)
      position.setElement(vertex, point)
      moved++
    }
  }
  return moved
}
