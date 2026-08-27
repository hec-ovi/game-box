import * as THREE from 'three'
import { attribute, ceil, clamp, float, floor, fract, max, mix, smoothstep, step, uniformArray, uv, vec2 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { ENTRANCE_ATTRIBUTE } from './doorway.ts'
import type { SurfaceFrame } from './surface.ts'
import { glassShareOf, windowsOn, type WindowKind } from './windows.ts'

/**
 * The window grid, cut out of a wall arithmetically.
 *
 * A prefab wall is a flat quad with a picture on it and no window in the
 * picture. This says, for a fragment, which bay it sits in, where in that bay,
 * how big the bay is in metres and how much of the fragment is pane rather
 * than surround or mullion. The room behind the pane and the glass over it are
 * two materials, and both read the same layout, so the glass lands exactly
 * over the opening the room is seen through.
 *
 * The bay index runs on along the wall and never repeats with the picture, so
 * which room a bay looks into is a function of where the bay is, not of where
 * the picture happens to wrap.
 *
 * A bay the entrance stands on is not a window. The model says where its door
 * is and `Doorway` writes that patch onto the wall behind it, so the opening,
 * the pane over it and the room behind it all stop at the same place: a door
 * is a face, a window is a face, and one face is one thing.
 */

/**
 * How fast the window grid gives up as it shrinks: a pixel's footprint against
 * a bay. Past 1 the bay is the flat share of itself that is glass, which is
 * what a mip of a drawn one would have done.
 */
const MELT = 1.5

export interface BayLayout {
  /** Which bay along and down the wall. */
  readonly id: Node<'vec2'>
  /** Where in the bay, 0 to 1 each way. */
  readonly at: Node<'vec2'>
  /** How much of the bay one pixel covers, which is what every edge is feathered by. */
  readonly aa: Node<'vec2'>
  /** Metres across and down one bay, read off the surface itself. */
  readonly wide: Node<'float'>
  readonly tall: Node<'float'>
  /** How much of this fragment is pane. */
  readonly share: Node<'float'>
  /** Metres the room behind runs back from the glass. */
  readonly deep: Node<'float'>
  /** How much of the night's lit share it takes to light the room. */
  readonly keys: Node<'float'>
  /** 1 where a low window looks into a shop rather than a room. */
  readonly street: Node<'float'>
}

/** The window grid of every windowed finish in the pack, read per fragment off the layer it wears. */
export class Bays {
  readonly #shape: ReturnType<typeof uniformArray<'vec4'>>
  readonly #glass: ReturnType<typeof uniformArray<'vec4'>>
  readonly #look: ReturnType<typeof uniformArray<'vec4'>>

  constructor(finishes: readonly string[]) {
    this.#shape = uniformArray<'vec4'>(finishes.map((finish) => shapeOf(windowsOn(finish))), 'vec4')
    this.#glass = uniformArray<'vec4'>(finishes.map((finish) => paneOf(windowsOn(finish))), 'vec4')
    this.#look = uniformArray<'vec4'>(finishes.map((finish) => lookOf(windowsOn(finish))), 'vec4')
  }

  /** Whether the layer this fragment wears has windows cut into it. */
  windowed(layer: Node<'int'>): Node<'bool'> {
    return this.#shape.element(layer).x.greaterThan(0)
  }

  /** The bay this fragment sits in, on a layer `windowed` said yes to. */
  layout(layer: Node<'int'>, frame: SurfaceFrame): BayLayout {
    const bay = this.#shape.element(layer)
    const pane = this.#glass.element(layer)
    const room = this.#look.element(layer)

    // where this fragment sits in its bay, and which bay that is
    const grid = vec2(bay.x, bay.y)
    const cell = uv().mul(grid)
    const id = floor(cell)
    const at = cell.sub(id)
    const aa = frame.spread.mul(grid).add(1e-5)

    // a bay is the size it really is however the producer stretched the
    // picture onto that wall, and whichever way round the building is
    const wide = frame.wide.div(bay.x)
    const tall = frame.tall.div(bay.y)

    // the opening and the mullions across it, feathered by how much of the
    // picture one pixel covers: at a distance the grid melts into the share of
    // the bay that is glass
    const inner = vec2(float(1).sub(bay.z.mul(2)), float(1).sub(bay.w.mul(2)))
    const panes = vec2(pane.x, pane.y)
    const q = at.sub(vec2(bay.z, bay.w)).div(inner).mul(panes)
    const aq = aa.div(inner).mul(panes)
    const sharp = band(at.x, bay.z, aa.x)
      .mul(band(at.y, bay.w, aa.y))
      .mul(band(fract(q.x), pane.z, aq.x))
      .mul(band(fract(q.y), pane.z, aq.y))
    const melt = clamp(max(aa.x, aa.y).mul(MELT), 0, 1)
    const share = mix(sharp, room.z, melt).mul(step(room.w, tall)).mul(float(1).sub(shut(id, grid)))

    return { id, at, aa, wide, tall, share, deep: pane.w, keys: room.x, street: room.y }
  }
}

/**
 * 1 where this bay is the one the entrance stands on, 0 everywhere else.
 *
 * The attribute is the patch of the face's own uv the door plate covers, so
 * the bays it reaches are the ones it starts in and ends in. All zeroes is an
 * empty range, which is every face in the city with no door on it.
 */
function shut(id: Node<'vec2'>, grid: Node<'vec2'>): Node<'float'> {
  const patch = attribute<'vec4'>(ENTRANCE_ATTRIBUTE, 'vec4')
  const first = floor(vec2(patch.x, patch.z).mul(grid))
  const last = ceil(vec2(patch.y, patch.w).mul(grid)).sub(1)
  return step(first.x, id.x).mul(step(id.x, last.x)).mul(step(first.y, id.y)).mul(step(id.y, last.y))
}

/** 1 between the two insets, 0 outside them, feathered by a pixel's own footprint. */
function band(at: Node<'float'>, inset: Node<'float'>, aa: Node<'float'>): Node<'float'> {
  const low = inset.sub(aa)
  const high = inset.add(aa)
  return smoothstep(low, high, at).mul(smoothstep(low, high, float(1).sub(at)))
}

function shapeOf(kind: WindowKind | undefined): THREE.Vector4 {
  if (!kind) return new THREE.Vector4(0, 0, 0, 0)
  return new THREE.Vector4(kind.grid.across, kind.grid.down, kind.frame.across, kind.frame.down)
}

function paneOf(kind: WindowKind | undefined): THREE.Vector4 {
  if (!kind) return new THREE.Vector4(1, 1, 0, 1)
  return new THREE.Vector4(kind.panes.across, kind.panes.down, kind.panes.mullion, kind.deep)
}

function lookOf(kind: WindowKind | undefined): THREE.Vector4 {
  if (!kind) return new THREE.Vector4(1, 0, 0, 0)
  return new THREE.Vector4(kind.keys, kind.street ? 1 : 0, glassShareOf(kind), kind.shortest)
}
