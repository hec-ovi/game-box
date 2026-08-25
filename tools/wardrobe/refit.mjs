import { apply, IDENTITY, invert, multiply, unit } from './matrix.mjs'

/** The build gate for a part: the same joints, in the same order. */
export function agree(skin, other, what) {
  const mine = skin.listJoints().map((joint) => joint.getName())
  const theirs = other.listJoints().map((joint) => joint.getName())
  const wrong = theirs.findIndex((name, index) => name !== mine[index])
  if (theirs.length !== mine.length || wrong >= 0) {
    throw new Error(`${what}: joint ${wrong} is ${theirs[wrong]}, expected ${mine[wrong]}`)
  }
}

/**
 * Moves a part's geometry from the rest pose it was modelled on to the body's
 * own. The two packs share the skeleton but not its proportions: this body is
 * two to four centimetres broader at the shoulders and hips, so clothes left in
 * their own rest pose would need their own bind matrices and would still sit
 * off the shoulder. Each vertex is blended through its bones' rest difference,
 * which is what lets every part share the body's one skin.
 *
 * Returns how far the furthest vertex moved, in metres.
 */
export function refit(part, skin, partSkin) {
  const body = skin.getInverseBindMatrices().getArray()
  const worn = partSkin.getInverseBindMatrices().getArray()
  const delta = []
  for (let joint = 0; joint * 16 < body.length; joint++) {
    delta.push(multiply(invert(body.slice(joint * 16, joint * 16 + 16)), worn.slice(joint * 16, joint * 16 + 16)))
  }

  let shifted = 0
  for (const mesh of part.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION')
      const normal = prim.getAttribute('NORMAL')
      const tangent = prim.getAttribute('TANGENT')
      const bones = prim.getAttribute('JOINTS_0')
      const weights = prim.getAttribute('WEIGHTS_0')

      for (let vertex = 0; vertex < position.getCount(); vertex++) {
        const blended = blend(delta, bones.getElement(vertex, []), weights.getElement(vertex, []))
        const before = position.getElement(vertex, [])
        const after = apply(blended, before, 1)
        shifted = Math.max(shifted, Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]))
        position.setElement(vertex, after)
        if (normal) normal.setElement(vertex, unit(apply(blended, normal.getElement(vertex, []), 0)))
        if (tangent) {
          const t = tangent.getElement(vertex, [])
          tangent.setElement(vertex, [...unit(apply(blended, t, 0)), t[3]])
        }
      }
    }
  }
  return { shifted }
}

/**
 * Weights in these packs do not always add up to one (0.925 shows up in the
 * ranger), so they are normalized here; unnormalized weights would drag the
 * vertex toward the origin by the shortfall.
 */
function blend(delta, bones, weights) {
  const total = weights[0] + weights[1] + weights[2] + weights[3]
  if (!total) return IDENTITY
  const out = new Array(16).fill(0)
  for (let slot = 0; slot < 4; slot++) {
    const weight = weights[slot] / total
    if (!weight) continue
    const matrix = delta[bones[slot]]
    for (let k = 0; k < 16; k++) out[k] += matrix[k] * weight
  }
  return out
}
