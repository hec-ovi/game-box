import { compactPrimitive } from '@gltf-transform/functions'

/**
 * Drops every triangle of the base body that no bare bone drives, so what is
 * left is the head and the neck the collar closes over. A body left under the
 * clothes pokes through them and costs triangles for nothing.
 *
 * Returns the lowest point still on the body, which has to sit under the
 * outfit's collar or there is a gap at the neck.
 */
export function trimCovered(doc, skin, bare) {
  const joints = skin.listJoints().map((joint) => joint.getName())
  const uncovered = new Set(joints.flatMap((name, index) => (bare.has(name) ? [index] : [])))
  let lowest = Infinity

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION')
      const indices = prim.getIndices()
      if (!position || !indices) continue

      const skinIndex = prim.getAttribute('JOINTS_0')
      const skinWeight = prim.getAttribute('WEIGHTS_0')
      // a vertex stays if the bare bones drive most of it; the triangles that
      // straddle the line stay too, so the rim reaches a little under the collar
      const keep = new Uint8Array(position.getCount())
      for (let vertex = 0; vertex < keep.length; vertex++) {
        const bones = skinIndex.getElement(vertex, [])
        const weights = skinWeight.getElement(vertex, [])
        const mine = bones.reduce((sum, bone, slot) => (uncovered.has(bone) ? sum + weights[slot] : sum), 0)
        const total = weights.reduce((sum, weight) => sum + weight, 0)
        keep[vertex] = mine > total / 2 ? 1 : 0
      }

      const source = indices.getArray()
      const surviving = []
      for (let i = 0; i < source.length; i += 3) {
        if (!keep[source[i]] && !keep[source[i + 1]] && !keep[source[i + 2]]) continue
        surviving.push(source[i], source[i + 1], source[i + 2])
      }
      indices.setArray(new Uint32Array(surviving))
      compactPrimitive(prim)

      lowest = Math.min(lowest, prim.getAttribute('POSITION').getMin([])[1])
    }
  }
  return lowest
}

/**
 * Makes every vertex's four skin weights add up to one. Some parts ship short
 * (0.9255 across the female ranger's torso), and a shader does not normalize:
 * the shortfall drags the vertex toward the origin, which sinks a torso by
 * several centimetres and pulls the limbs in with it.
 */
export function normalizeWeights(doc) {
  let fixed = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const weights = prim.getAttribute('WEIGHTS_0')
      if (!weights) continue
      for (let vertex = 0; vertex < weights.getCount(); vertex++) {
        const share = weights.getElement(vertex, [])
        const total = share[0] + share[1] + share[2] + share[3]
        if (!total || Math.abs(total - 1) < 1e-4) continue
        weights.setElement(vertex, share.map((one) => one / total))
        fixed++
      }
    }
  }
  return fixed
}
