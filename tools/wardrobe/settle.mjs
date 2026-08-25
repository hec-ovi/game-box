/**
 * Keeps a hair piece on the outside of the skin it is worn over.
 *
 * The pack's hairstyles, brows and beard are modelled on a smaller head than
 * this body's: worn as they come, two fifths of a buzz cut lies up to 12 mm
 * under the scalp and only the crown shows, which reads as a bald head with a
 * patch on it. So every vertex of a piece is measured against the nearest
 * point of the bare skin and, where it is under the surface or closer to it
 * than `clearance`, moved out along the skin's own normal until it is not.
 *
 * Measured in the body's rest pose, which is where both were modelled. Only
 * the skin's bare part is looked at (the head and neck the build keeps), so
 * clothes never push hair around. Where the skin curves sharply a vertex
 * pushed out past one skin vertex can land under the next, so the pass runs
 * again until nothing moves.
 */

/** A vertex further than this from any skin vertex is not on the scalp and is left alone. */
const NEAR = 0.05

/** How many times the whole piece is walked before a fold in the skin is given up on. */
const PASSES = 6

export function settleOnSkin(part, bare, clearance) {
  const surface = surfaceOf(bare)
  let moved = 0
  let deepest = 0
  for (let pass = 0; pass < PASSES; pass++) {
    let lifted = 0
    for (const mesh of part.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION')
        const point = []
        for (let vertex = 0; vertex < position.getCount(); vertex++) {
          position.getElement(vertex, point)
          const near = surface.nearest(point)
          if (!near || near.distance > NEAR) continue
          const depth =
            (point[0] - near.at[0]) * near.normal[0] + (point[1] - near.at[1]) * near.normal[1] + (point[2] - near.at[2]) * near.normal[2]
          if (depth >= clearance - 1e-6) continue
          const out = clearance - depth
          position.setElement(vertex, [point[0] + near.normal[0] * out, point[1] + near.normal[1] * out, point[2] + near.normal[2] * out])
          lifted++
          if (pass === 0) deepest = Math.min(deepest, depth)
        }
      }
    }
    moved += lifted
    if (!lifted) break
  }
  return { moved, deepest }
}

/** The bare meshes' vertices and normals, bucketed on a grid so a lookup is cheap. */
function surfaceOf(bare) {
  const cell = NEAR
  const buckets = new Map()
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
  for (const mesh of bare) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION')
      const normal = prim.getAttribute('NORMAL')
      if (!normal) throw new Error(`${mesh.getName()}: the skin carries no normals to settle hair against`)
      for (let vertex = 0; vertex < position.getCount(); vertex++) {
        const at = position.getElement(vertex, [])
        const entry = { at, normal: normal.getElement(vertex, []) }
        const slot = key(...at)
        const list = buckets.get(slot)
        if (list) list.push(entry)
        else buckets.set(slot, [entry])
      }
    }
  }
  return {
    nearest(point) {
      let best
      let distance = Infinity
      const [cx, cy, cz] = [Math.floor(point[0] / cell), Math.floor(point[1] / cell), Math.floor(point[2] / cell)]
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let y = cy - 1; y <= cy + 1; y++) {
          for (let z = cz - 1; z <= cz + 1; z++) {
            for (const entry of buckets.get(`${x},${y},${z}`) ?? []) {
              const d = Math.hypot(point[0] - entry.at[0], point[1] - entry.at[1], point[2] - entry.at[2])
              if (d < distance) {
                distance = d
                best = entry
              }
            }
          }
        }
      }
      return best && { ...best, distance }
    },
  }
}
