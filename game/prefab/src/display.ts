import type * as THREE from 'three'
import { Fn, If, clamp, float, floor, fract, hash, int, max, min, mix, smoothstep, step, texture, uv, vec2, vec3, vec4 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { layerIndex } from './layer.ts'
import { DISPLAY_FINISH, SCREEN_PICTURES, SCREEN_SIZE } from './screens.ts'
import { surfaceFrame } from './surface.ts'

/**
 * The lit screens over the street, drawn in the fragment shader.
 *
 * A display is a flat panel the producer stands on the wall, and everything
 * that makes it read as a screen rather than as a poster happens here: the
 * housing it is set into, the lamp grid over the picture, and the line of light
 * round the lit face. The panel is one rectangle of geometry, twelve triangles,
 * and it costs no draw because it is on the same material as the wall behind
 * it.
 *
 * The grid is the whole trick. An outdoor board is a field of lamps a few
 * centimetres apart, so up close a picture on it is dots and from across the
 * street it is a picture, and the crossover is exactly where a pixel of the
 * screen covers a lamp. That is arithmetic off the surface's own derivatives,
 * not a texture, so it is right at every distance and costs nothing to store.
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
  /** Metres of housing round the lit face. */
  bezel: 0.12,
  /** Metres between lamps, and how much of that pitch is the dark between them. */
  led: 0.05,
  gap: 0.16,
  /** What the dark between lamps is worth against a lamp. */
  between: 0.16,
  /** Metres of lit line inside the housing, and what it burns against the picture. */
  rim: 0.035,
  rimGlow: 0.75,
} as const

/** The colour of the line round the lit face. Cool, because every board in the references is. */
const RIM: readonly [number, number, number] = [0.55, 0.95, 1.0]

/**
 * How much of a picture is cropped to keep it square on a panel that is not.
 *
 * Nothing at 1: the picture is stretched onto the panel whatever shape it is,
 * and a face comes out two metres wide. Everything at 0: the picture keeps its
 * shape and a wide board shows a letterbox slice of the middle of it. Most of
 * the way over, because a board really is wider than it is tall and an
 * advertisement really is stretched to fit one.
 */
const CROP = 0.6

/** A face this small is the edge of the plate, not a screen. */
const SMALLEST = 0.35

/** How fast the lamp grid gives up as it shrinks. A pixel's footprint against the pitch. */
const MELT = 1.1

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
 * wall pictures `catalogue.design` slides each plot along. It is already a draw
 * off the plot's own seed, it is exact in the shader because it is an integer,
 * and it is constant across the panel because every vertex of it was slid by
 * the same amount, so two plots on one model never carry the same screen and a
 * screen never changes halfway across itself.
 */
export class WallScreens {
  readonly #panel: () => Node<'vec4'>

  constructor(screens: THREE.DataArrayTexture, finishes: readonly string[]) {
    const wearing = finishes.indexOf(DISPLAY_FINISH)
    const count = SCREEN_PICTURES.length

    this.#panel = Fn(() => {
      const frame = surfaceFrame()
      const out = vec4(0, 0, 0, 0).toVar()
      if (wearing < 0) return out

      If(layerIndex().equal(int(wearing)), () => {
        const wide = frame.wide
        const tall = frame.tall
        const at = fract(uv())
        const x = at.x.mul(wide)
        const y = at.y.mul(tall)
        const aa = vec2(frame.spread.x.mul(wide), frame.spread.y.mul(tall)).add(1e-5)

        // the housing, in metres off the surface rather than as a share of it,
        // so a wide board and a tall banner wear the same frame. It is also
        // what keeps the picture off the four edges of the plate: they are the
        // depth of it, eleven centimetres, which is inside the bezel whichever
        // way they run
        const plate = step(float(SMALLEST), wide).mul(step(float(SMALLEST), tall))
        const face = inset(x, wide, aa.x).mul(inset(y, tall, aa.y)).mul(plate)
        const inner = vec2(max(wide.sub(SCREEN.bezel * 2), 1e-3), max(tall.sub(SCREEN.bezel * 2), 1e-3))

        // the picture, kept most of the way to square on a panel that is not
        const held = max(inner.x, inner.y)
        const keep = vec2(mix(float(1), inner.x.div(held), CROP), mix(float(1), inner.y.div(held), CROP))
        const on = vec2(clamp(x.sub(SCREEN.bezel).div(inner.x), 0, 1), clamp(y.sub(SCREEN.bezel).div(inner.y), 0, 1))
        const shot = on.sub(0.5).mul(keep).add(0.5)

        const shift = floor(uv().x)
        const picture = floor(hash(shift.mul(1973).add(613)).mul(count)).toInt()
        const footprint = max(frame.spread.x.mul(wide).div(inner.x).mul(keep.x), frame.spread.y.mul(tall).div(inner.y).mul(keep.y))
        const shown = texture(screens, shot).depth(picture).level(max(footprint.mul(SCREEN_SIZE).log2(), 0)).rgb

        // the lamps, and what happens to them as they shrink: past the point
        // where one pixel covers a pitch the grid is the share of it that is
        // lamp, which keeps the panel at the brightness it was authored at
        // however far away it is being read from
        const pitch = vec2(x, y).div(SCREEN.led)
        const spread = aa.div(SCREEN.led)
        const lamp = band(fract(pitch.x), spread.x).mul(band(fract(pitch.y), spread.y))
        const melt = clamp(max(spread.x, spread.y).mul(MELT), 0, 1)
        const grid = mix(float(SCREEN.between), float(1), mix(lamp, float(LAMPS), melt)).div(AVERAGE)

        // the line of light inside the housing: the edge of a board seen from
        // the pavement is a bright rule, and it is what gives the panel a shape
        // once the picture on it has gone to bloom
        const edge = min(min(x, wide.sub(x)), min(y, tall.sub(y)))
        const wash = max(aa.x, aa.y)
        const rim = smoothstep(float(SCREEN.bezel - SCREEN.rim).sub(wash), float(SCREEN.bezel - SCREEN.rim).add(wash), edge)
          .mul(float(1).sub(smoothstep(float(SCREEN.bezel).sub(wash), float(SCREEN.bezel).add(wash), edge)))
          .mul(plate)

        out.assign(
          vec4(shown.mul(grid).mul(face).add(vec3(RIM[0], RIM[1], RIM[2]).mul(SCREEN.rimGlow).mul(rim)), min(face.add(rim), 1)),
        )
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

/** The share of one lamp pitch that is lamp rather than the dark between them. */
const LAMPS = (1 - SCREEN.gap * 2) ** 2

/** What a pitch is worth once it has melted, which is what the grid is divided back by. */
const AVERAGE = SCREEN.between + (1 - SCREEN.between) * LAMPS

/** 1 between the two metre insets of a face, 0 outside them, feathered by a pixel. */
function inset(at: Node<'float'>, size: Node<'float'>, aa: Node<'float'>): Node<'float'> {
  const low = float(SCREEN.bezel).sub(aa)
  const high = float(SCREEN.bezel).add(aa)
  return smoothstep(low, high, at).mul(smoothstep(low, high, size.sub(at)))
}

/** 1 on a lamp, 0 in the dark round it, feathered by a pixel's footprint on the pitch. */
function band(at: Node<'float'>, aa: Node<'float'>): Node<'float'> {
  const low = float(SCREEN.gap).sub(aa)
  const high = float(SCREEN.gap).add(aa)
  return smoothstep(low, high, at).mul(smoothstep(low, high, float(1).sub(at)))
}
