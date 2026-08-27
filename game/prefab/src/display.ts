import type * as THREE from 'three'
import { Fn, If, clamp, float, floor, fract, int, max, mix, smoothstep, step, texture, uv, vec2, vec4 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { layerIndex } from './layer.ts'
import { DISPLAY_FINISH, SCREEN_SIZE } from './screens.ts'
import { surfaceFrame } from './surface.ts'

/**
 * The lit screens over the street, drawn in the fragment shader.
 *
 * A screen is the lit picture and nothing else. The producer stands a plate on
 * the wall, twelve triangles on the same material as the wall behind it, and
 * the whole of its face is picture: no housing, no rim, no edge of any kind.
 * What makes it read as a screen rather than a poster is the lamp grid, a field
 * of lamps a few centimetres apart, so up close a picture on it is dots and from
 * across the street it is a picture. That is arithmetic off the surface's own
 * derivatives, not a texture, so it is right at every distance and costs
 * nothing to store.
 */

/**
 * What a screen is worth and what it is made of.
 *
 * `glow` is where the picture lands after dark, authored just under the
 * clipping the pack's glow map has, the same place `@gb/kitbash` puts its
 * signage. It is what the app's bloom turns into the light on the street; a
 * halo drawn into the picture would blow out both the panel and its reflection
 * in the wet road.
 */
export const SCREEN = {
  glow: 1.9,
  /** What the panel lends the surface, so a screen is a printed board by day. */
  albedo: 0.4,
  /** Smoother than a wall: it is glass over lamps. */
  roughness: 0.32,
  /** Metres between lamps, and how much of that pitch is the dark between them. */
  led: 0.03,
  gap: 0.12,
  /** What the dark between lamps is worth against a lamp: the grid is weaker than the picture on it. */
  between: 0.55,
} as const

/** How fast the lamp grid gives up as it shrinks. A pixel's footprint against the pitch. */
const MELT = 1.1

/** A face this narrow is an edge of the plate, which is 11 cm deep, not a screen. */
const SMALLEST = 0.35

/** What is on the panel here: the light coming off it, and how much of the fragment is panel. */
export interface Panel {
  readonly light: Node<'vec3'>
  readonly share: Node<'float'>
}

/**
 * Every screen in the city, as one node the building material lays over its
 * wall picture.
 *
 * Which picture a panel carries is the plot's own uv shift, the whole number of
 * wall pictures `catalogue.design` slides each plot along, folded onto the
 * count of pictures. It is exact in the shader because it is an integer, it is
 * constant across the panel because every vertex of it was slid by the same
 * amount, and `pictureFor` answers the same number in plain code, so whoever
 * lights the street from a screen knows what colour it is.
 */
export class WallScreens {
  readonly #panel: () => Node<'vec4'>

  constructor(screens: THREE.DataArrayTexture, finishes: readonly string[]) {
    const wearing = finishes.indexOf(DISPLAY_FINISH)
    const count = screens.image.depth

    this.#panel = Fn(() => {
      const frame = surfaceFrame()
      const out = vec4(0, 0, 0, 0).toVar()
      if (wearing < 0) return out

      If(layerIndex().equal(int(wearing)), () => {
        // a panel's own uv spans exactly one picture, so the metres one unit
        // covers are the panel's own width and height, and a face narrower
        // than any panel is one of the plate's edges
        const wide = frame.wide
        const tall = frame.tall
        const face = step(float(SMALLEST), wide).mul(step(float(SMALLEST), tall))
        const at = fract(uv())

        // the picture at its own aspect, filling the panel: whatever the panel
        // is not the shape of is cropped off, centred, never stretched
        const held = max(wide, tall)
        const keep = vec2(wide.div(held), tall.div(held))
        const shot = at.sub(0.5).mul(keep).add(0.5)

        const shift = floor(uv().x)
        const picture = shift.sub(floor(shift.div(count)).mul(count)).toInt()
        const footprint = max(frame.spread.x.mul(keep.x), frame.spread.y.mul(keep.y))
        const shown = texture(screens, shot).depth(picture).level(max(footprint.mul(SCREEN_SIZE).log2(), 0)).rgb

        // the lamps, and what happens to them as they shrink: past the point
        // where one pixel covers a pitch the grid is the share of it that is
        // lamp, which keeps the panel at the brightness it was authored at
        // however far away it is being read from
        const aa = vec2(frame.spread.x.mul(wide), frame.spread.y.mul(tall)).add(1e-5)
        const pitch = vec2(at.x.mul(wide), at.y.mul(tall)).div(SCREEN.led)
        const spread = aa.div(SCREEN.led)
        const lamp = band(fract(pitch.x), spread.x).mul(band(fract(pitch.y), spread.y))
        const melt = clamp(max(spread.x, spread.y).mul(MELT), 0, 1)
        const grid = mix(float(SCREEN.between), float(1), mix(lamp, float(LAMPS), melt)).div(AVERAGE)

        out.assign(vec4(shown.mul(grid).mul(face), face))
      })

      return out
    })
  }

  /** What is on the panel this fragment wears, if it wears one at all. */
  panel(): Panel {
    const seen = this.#panel().toVar()
    return { light: seen.rgb, share: seen.a }
  }
}

/** Which picture a plot's panels carry, out of a strip of `held`: the same fold of its uv shift the shader takes. */
export function pictureFor(rooms: number, held: number): number {
  return rooms % held
}

/** The share of one lamp pitch that is lamp rather than the dark between them. */
const LAMPS = (1 - SCREEN.gap * 2) ** 2

/** What a pitch is worth once it has melted, which is what the grid is divided back by. */
const AVERAGE = SCREEN.between + (1 - SCREEN.between) * LAMPS

/** 1 on a lamp, 0 in the dark round it, feathered by a pixel's footprint on the pitch. */
function band(at: Node<'float'>, aa: Node<'float'>): Node<'float'> {
  const low = float(SCREEN.gap).sub(aa)
  const high = float(SCREEN.gap).add(aa)
  return smoothstep(low, high, at).mul(smoothstep(low, high, float(1).sub(at)))
}
