/**
 * The section of a piece, top to bottom: how far in from the plan each ring
 * sits, how high it is, and whether the two bands meeting there are creased or
 * blended.
 *
 * An edge is the second half of "one side sharp, the other circular": the same
 * slab reads as a machined worktop with a chamfer, a moulded plastic top with a
 * radius, or a bare board with neither.
 *
 * The top ring is always at `y1` exactly, whatever the edge does, because that
 * is the surface a body meets and it is a contract, not a measurement.
 */

export type Edge =
  | { readonly kind: 'sharp' }
  | { readonly kind: 'chamfer'; readonly size: number }
  | { readonly kind: 'round'; readonly size: number; readonly steps?: number }

export const SHARP: Edge = { kind: 'sharp' }

export interface Ring {
  /** Metres in from the plan. */
  readonly inset: number
  readonly y: number
  /** True when this ring blends the band below into the band above. */
  readonly smooth: boolean
}

const ROUND_STEPS = 3

/**
 * The rings of one extrusion, bottom first.
 *
 * `bottomInset` and `topInset` taper the body itself, which is how a plant pot,
 * a lamp column and a stool base come out of the same primitive as a slab.
 */
export function section(spec: {
  y0: number
  y1: number
  bottom: Edge
  top: Edge
  bottomInset?: number
  topInset?: number
}): Ring[] {
  const height = spec.y1 - spec.y0
  const bottomInset = spec.bottomInset ?? 0
  const topInset = spec.topInset ?? 0

  const below = edgeRings(spec.bottom, spec.y0, 1, bottomInset, height)
  const above = edgeRings(spec.top, spec.y1, -1, topInset, height)
  return [...below, ...above.reverse()]
}

/**
 * One edge, from the face outward. `way` is +1 climbing off the bottom and -1
 * dropping off the top; the caller reverses the top back into order.
 */
function edgeRings(edge: Edge, y: number, way: number, inset: number, height: number): Ring[] {
  if (edge.kind === 'sharp') return [{ inset, y, smooth: false }]

  const size = Math.min(edge.size, height / 2)
  if (edge.kind === 'chamfer') {
    return [
      { inset: inset + size, y, smooth: false },
      { inset, y: y + way * size, smooth: false },
    ]
  }

  const steps = edge.steps ?? ROUND_STEPS
  const rings: Ring[] = []
  for (let step = 0; step <= steps; step++) {
    const angle = (Math.PI / 2) * (step / steps)
    rings.push({
      inset: inset + size * (1 - Math.sin(angle)),
      y: y + way * size * (1 - Math.cos(angle)),
      // the last ring stands tangent to the wall, so a fillet runs into the side with no crease
      smooth: step > 0,
    })
  }
  return rings
}
