/**
 * Keeps a piece worn over the body on the outside of the skin it crosses.
 *
 * Both packs are cut for a narrower body than this one. The hairstyles, brows
 * and beard are modelled on a smaller head: worn as they come, two fifths of a
 * buzz cut lies up to 12 mm under the scalp and only the crown shows, which
 * reads as a bald head with a patch on it. The garments' collars are cut for a
 * narrower neck: the ranger coat's rim sits up to 50 mm inside the nape, so the
 * neck bulges out through the cloth and the collar reads as torn open.
 *
 * So every vertex of a piece is measured against the skin under it and, where
 * it is inside the surface or closer to it than `clearance`, it is moved out
 * along that skin's own normal until it is not.
 *
 * The move is smoothed over the piece's own edges before it is applied: each
 * vertex takes the average of its neighbours' moves, and never less than its
 * own, so a buried collar rim carries the cloth around it and opens as one
 * piece. Moved a vertex at a time it tears into shards; carried out at full
 * strength it stands off the neck as a funnel.
 *
 * Measured in the body's rest pose, which is where both were modelled. Only the
 * skin's bare part is looked at (the head and neck the build keeps). Where the
 * skin curves sharply a vertex pushed out past one skin vertex can land under
 * the next, so the pass runs again until nothing moves.
 */

/** A vertex further than this from any skin vertex is not over the skin and is left alone. */
const NEAR = 0.06

/** How many times the whole piece is walked before a fold in the skin is given up on. */
const PASSES = 6

/** How many times the moves are averaged across the piece before they are applied. */
const ROUNDS = 8

/** A move smaller than this is not worth making, and is how a pass knows it has settled. */
const STILL = 1e-5

export function settleOnSkin(part, bare, clearance) {
  const surface = surfaceOf(bare)
  let moved = 0
  let deepest = 0
  for (let pass = 0; pass < PASSES; pass++) {
    let lifted = 0
    for (const mesh of part.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const wanted = needed(prim, surface, clearance)
        if (pass === 0) deepest = Math.min(deepest, wanted.deepest)
        carry(prim, wanted)
        lifted += apply(prim, wanted)
      }
    }
    moved += lifted
    if (!lifted) break
  }
  return { moved, deepest }
}

/** How far out each vertex has to go, along which way, and the move that makes. */
function needed(prim, surface, clearance) {
  const position = prim.getAttribute('POSITION')
  const out = new Float64Array(position.getCount())
  const way = new Array(position.getCount()).fill(undefined)
  const move = Array.from({ length: position.getCount() }, () => [0, 0, 0])
  const point = []
  let deepest = 0
  for (let vertex = 0; vertex < out.length; vertex++) {
    position.getElement(vertex, point)
    const near = surface.under(point)
    if (!near) continue
    deepest = Math.min(deepest, near.depth)
    if (near.depth >= clearance - 1e-6) continue
    out[vertex] = clearance - near.depth
    way[vertex] = near.normal
    move[vertex] = near.normal.map((one) => one * out[vertex])
  }
  return { out, way, move, deepest }
}

/**
 * Smooths the moves over the piece's own edges, so the cloth around a buried
 * vertex comes with it instead of being torn off it, and a rim that needed
 * different amounts along its length stays a rim. Averaging alone would undo
 * the move, so after each round every vertex is topped back up to what it
 * needs along its own way out.
 */
function carry(prim, { out, way, move }) {
  const ring = neighbours(prim)
  for (let round = 0; round < ROUNDS; round++) {
    const before = move.map((one) => [...one])
    for (let vertex = 0; vertex < move.length; vertex++) {
      const mean = [...before[vertex]]
      for (const other of ring[vertex]) {
        mean[0] += before[other][0]
        mean[1] += before[other][1]
        mean[2] += before[other][2]
      }
      const share = ring[vertex].length + 1
      mean[0] /= share
      mean[1] /= share
      mean[2] /= share
      const along = way[vertex]
      if (along) {
        const short = out[vertex] - (mean[0] * along[0] + mean[1] * along[1] + mean[2] * along[2])
        if (short > 0) for (let axis = 0; axis < 3; axis++) mean[axis] += along[axis] * short
      }
      move[vertex] = mean
    }
  }
}

function apply(prim, { move }) {
  const position = prim.getAttribute('POSITION')
  const point = []
  let lifted = 0
  for (let vertex = 0; vertex < move.length; vertex++) {
    const step = move[vertex]
    if (Math.hypot(step[0], step[1], step[2]) < STILL) continue
    position.getElement(vertex, point)
    position.setElement(vertex, [point[0] + step[0], point[1] + step[1], point[2] + step[2]])
    lifted++
  }
  return lifted
}

/**
 * Every vertex's neighbours through the triangles, welded by position: a UV
 * seam splits one vertex into two and a move that stopped at the seam would
 * tear the piece open along it.
 */
function neighbours(prim) {
  const position = prim.getAttribute('POSITION')
  const indices = prim.getIndices().getArray()
  const welded = new Map()
  const same = new Map()
  const point = []
  const at = new Int32Array(position.getCount())
  for (let vertex = 0; vertex < at.length; vertex++) {
    position.getElement(vertex, point)
    const key = point.map((one) => one.toFixed(5)).join(',')
    if (!welded.has(key)) welded.set(key, welded.size)
    at[vertex] = welded.get(key)
    const list = same.get(at[vertex])
    if (list) list.push(vertex)
    else same.set(at[vertex], [vertex])
  }

  const near = new Map()
  const join = (one, other) => {
    const list = near.get(one)
    if (list) list.add(other)
    else near.set(one, new Set([other]))
  }
  for (let corner = 0; corner < indices.length; corner += 3) {
    const [a, b, c] = [at[indices[corner]], at[indices[corner + 1]], at[indices[corner + 2]]]
    join(a, b)
    join(b, a)
    join(b, c)
    join(c, b)
    join(c, a)
    join(a, c)
  }
  return Array.from({ length: at.length }, (_, vertex) =>
    [...(near.get(at[vertex]) ?? [])].flatMap((other) => same.get(other) ?? []),
  )
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
      if (!normal) throw new Error(`${mesh.getName()}: the skin carries no normals to settle against`)
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
    /**
     * How far a point is outside the skin under it, and which way is out.
     *
     * Both are blends of the skin vertices around the point, weighted by how
     * near each one is. Taken off the one nearest vertex instead, the answer
     * jumps by a few millimetres from one vertex of a piece to the next, and a
     * rim settled against it comes out serrated; taken off the deepest vertex
     * in reach, a fold under the jaw pushes the piece out by its own depth.
     */
    under(point) {
      let depth = 0
      let share = 0
      const normal = [0, 0, 0]
      const [cx, cy, cz] = [Math.floor(point[0] / cell), Math.floor(point[1] / cell), Math.floor(point[2] / cell)]
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let y = cy - 1; y <= cy + 1; y++) {
          for (let z = cz - 1; z <= cz + 1; z++) {
            for (const entry of buckets.get(`${x},${y},${z}`) ?? []) {
              const away = [point[0] - entry.at[0], point[1] - entry.at[1], point[2] - entry.at[2]]
              const d = Math.hypot(...away)
              if (d > NEAR) continue
              const weight = 1 / (d * d + 1e-6)
              share += weight
              depth += weight * (away[0] * entry.normal[0] + away[1] * entry.normal[1] + away[2] * entry.normal[2])
              for (let axis = 0; axis < 3; axis++) normal[axis] += entry.normal[axis] * weight
            }
          }
        }
      }
      if (!share) return undefined
      const length = Math.hypot(...normal) || 1
      return { depth: depth / share, normal: normal.map((one) => one / length) }
    },
  }
}
