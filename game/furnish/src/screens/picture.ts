import * as THREE from 'three'
import { CYCLE, SWITCH, hashOf, programmeAt, spotAt } from './schedule.ts'

/**
 * What is on the glass, in TypeScript.
 *
 * This is the picture itself: a news desk, a market board, an advert cutting on
 * a beat, a camera looking at a yard, and static between them. All of it is
 * arithmetic on where the point is on the screen and what second it is, so a
 * town carries no video file, nothing to download and nothing to licence, and
 * the same screen shows the same thing on the second visit.
 *
 * The rule is written twice, the way the surface tiling is: here, where the
 * tests read it and the probe measures it, and in `glass.ts`, where the
 * renderer runs it as nodes. The two use the same hash and the same colours, so
 * what a test measures is what the screen shows. Change one and change the
 * other.
 */

export type Rgb = readonly [number, number, number]

/** How hard a screen emits at its brightest. Over 1 so the app's bloom finds it. */
export const SCREEN_LIGHT = 1.5

/**
 * Everything on a screen is painted in one of these. Written as sRGB hex the
 * way a colour picker gives it, resolved once into the renderer's working
 * space, and read by both sides so a colour cannot drift between them.
 */
export const SCREEN_INK = {
  wall: linear(0x2c4b6b),
  skin: linear(0xe8b493),
  suit: linear(0x1d2836),
  desk: linear(0x121a24),
  strap: linear(0xa8351f),
  paper: linear(0xf2f7ff),
  amber: linear(0xffb03a),
  night: linear(0x0d1a1e),
  rise: linear(0x4cf0a0),
  fall: linear(0xff5a63),
  yard: linear(0xd2ffe4),
  grey: linear(0xb9c4cc),
  ad: [linear(0xff3d8b), linear(0x28e0ff), linear(0xffc21a), linear(0x8b5cff)] as const,
} as const

/** A cast over the whole picture, so two stations on the same programme still differ. */
export const STATION_CAST: readonly Rgb[] = [
  [1, 1, 1],
  [1.06, 0.94, 0.86],
  [0.86, 0.97, 1.12],
  [1.04, 0.9, 1.02],
]

/**
 * What one point of one screen is emitting at one second.
 *
 * `u` runs left to right across the glass as the room sees it and `v` bottom to
 * top, both 0 to 1. `station` is 1 to `STATIONS`; `phase` is how far into that
 * station's schedule this screen is.
 */
export function pictureAt(u: number, v: number, station: number, phase: number, seconds: number): Rgb {
  // bounded first, and on both sides: `time` on the GPU runs for as long as the
  // game is open, and a float32 second past a few thousand has no frames left in it
  const now = seconds % CYCLE
  const { spot, into } = spotAt(now, phase)
  const kind = programmeAt(station, spot)
  const line = spot + station * 1024

  let rgb =
    kind === 0
      ? news(u, v, into, line)
      : kind === 1
        ? market(u, v, into, line)
        : kind === 2
          ? advert(u, v, into, line)
          : camera(u, v, into, line)

  rgb = mix3(rgb, snow(u, v, now), clamp01(1 - into / SWITCH))
  return scale(times(rgb, STATION_CAST[(station - 1) % STATION_CAST.length]!), glass(v, now) * SCREEN_LIGHT)
}

/** A studio: a graphic behind, somebody behind a desk, a headline under them. */
function news(u: number, v: number, into: number, line: number): Rgb {
  const sway = 0.005 * Math.sin(into * 1.6)
  const panel = box(u, v, 0.52, 0.95, 0.36, 0.86)
  const bars = panel * step(v, 0.4 + 0.42 * hashOf(Math.floor(u * 9) + line * 32))
  const shoulders = blob(u, v, 0.28 + sway, 0.3, 0.185, 0.21)
  const head = blob(u, v, 0.28 + sway, 0.52, 0.056, 0.074)
  const strap = box(u, v, 0.04, 0.72, 0.105, 0.19)
  const under = box(u, v, 0.04, 0.56, 0.055, 0.095)

  let rgb = scale(SCREEN_INK.wall, 0.015 + 0.03 * v)
  rgb = plus(rgb, scale(SCREEN_INK.paper, panel * 0.04))
  rgb = plus(rgb, scale(SCREEN_INK.amber, bars * 0.11))
  rgb = mix3(rgb, scale(SCREEN_INK.suit, 0.9), shoulders)
  rgb = mix3(rgb, scale(SCREEN_INK.skin, 0.5), head)
  rgb = mix3(rgb, scale(SCREEN_INK.desk, 0.7), box(u, v, 0, 1, 0, 0.3))
  rgb = plus(rgb, scale(SCREEN_INK.paper, box(u, v, 0, 1, 0.285, 0.305) * 0.22))
  rgb = mix3(rgb, scale(SCREEN_INK.strap, 0.85), strap)
  rgb = plus(rgb, scale(SCREEN_INK.paper, strap * words((u - 0.06) / 0.62, 22, line * 8 + Math.floor(into / 1.6)) * 0.8))
  rgb = plus(rgb, scale(SCREEN_INK.paper, under * words((u - 0.06) / 0.48, 30, line * 5 + Math.floor(into / 2.4)) * 0.5))
  return plus(rgb, scale(SCREEN_INK.amber, box(u, v, 0.86, 0.955, 0.83, 0.925) * 0.7))
}

/** A market board: columns that rise and fall, a headline rail, a crawling ticker. */
function market(u: number, v: number, into: number, line: number): Rgb {
  const columns = 26
  const at = Math.floor(u * columns)
  const tall = 0.3 + 0.42 * (0.5 + 0.5 * Math.sin(at * 0.7 + into * 0.9 + line))
  const stem = gate(fract(u * columns), 0.12, 0.88) * gate(v, 0.26, tall)
  const rail = box(u, v, 0, 1, 0.86, 1)
  const band = box(u, v, 0, 1, 0.05, 0.2)

  let rgb = scale(SCREEN_INK.night, 0.05 + 0.04 * v)
  rgb = plus(rgb, scale(hashOf(at + line * 512) < 0.5 ? SCREEN_INK.fall : SCREEN_INK.rise, stem * 0.9))
  rgb = mix3(rgb, scale(SCREEN_INK.night, 2.2), Math.max(rail, band))
  rgb = plus(rgb, scale(SCREEN_INK.amber, rail * words(u, 20, line * 3 + Math.floor(into / 2)) * 0.9))
  return plus(rgb, scale(SCREEN_INK.rise, band * words(u - into * 0.07, 40, line) * 0.9))
}

/** An advert: two colours cutting on a beat, a product growing out of them, a word. */
function advert(u: number, v: number, into: number, line: number): Rgb {
  const beat = Math.floor(into * 0.8)
  const through = into * 0.8 - beat
  const one = SCREEN_INK.ad[Math.floor(hashOf(line * 256 + beat) * SCREEN_INK.ad.length)]!
  const two = SCREEN_INK.ad[Math.floor(hashOf(line * 256 + beat + 7919) * SCREEN_INK.ad.length)]!
  const grow = 0.5 + 0.5 * Math.min(1, through * 3)
  const slab = box(u, v, 0.5 - 0.2 * grow, 0.5 + 0.2 * grow, 0.44, 0.44 + 0.3 * grow)
  const gloss = box(u, v, 0.5 - 0.2 * grow, 0.5 - 0.11 * grow, 0.44, 0.44 + 0.3 * grow)

  let rgb = mix3(scale(one, 0.09), scale(two, 0.15), step(0.42, v))
  rgb = plus(rgb, scale(two, slab * 0.7))
  rgb = plus(rgb, scale(SCREEN_INK.paper, gloss * 0.22))
  rgb = plus(rgb, scale(one, box(u, v, 0.1, 0.9, 0.105, 0.125) * 1.1))
  rgb = plus(
    rgb,
    scale(SCREEN_INK.paper, box(u, v, 0.1, 0.9, 0.15, 0.3) * words((u - 0.12) / 0.76, 14, line * 16 + beat) * 1.1),
  )
  return plus(rgb, scale(SCREEN_INK.paper, Math.max(0, 1 - through * 10) * 0.25))
}

/** A camera on a yard: a lit doorway, crates, somebody walking across, a clock. */
function camera(u: number, v: number, into: number, line: number): Rgb {
  const ground = step(v, 0.52)
  const far = 0.008 + 0.009 * hashOf(Math.floor((u + into * 0.004) * 26) + line * 64)
  const crates = Math.max(box(u, v, 0.1, 0.27, 0.3, 0.46), box(u, v, 0.82, 0.94, 0.31, 0.42))
  const walk = fract(hashOf(line * 77) + into * 0.075)
  const figure = Math.max(box(u, v, walk - 0.022, walk + 0.022, 0.3, 0.48), blob(u, v, walk, 0.5, 0.021, 0.03))
  const clock = box(u, v, 0.05, 0.34, 0.88, 0.95) * words((u - 0.055) / 0.28, 10, line)

  let lit = far + ground * (0.006 + 0.05 * (0.55 - v))
  lit = lit * (1 - crates) + 0.012 * crates
  lit += 0.2 * box(u, v, 0.62, 0.75, 0.3, 0.66) + 0.05 * box(u, v, 0.6, 0.77, 0.28, 0.31)
  lit = lit * (1 - figure) + 0.03 * figure

  const rgb = plus(scale(SCREEN_INK.yard, lit), scale(SCREEN_INK.yard, clock * (0.2 + 0.3 * step(0.5, into % 1))))
  return scale(rgb, 0.66 + 0.34 * step(0.5, fract(v * 46)))
}

/** Between two spots: no signal. */
function snow(u: number, v: number, seconds: number): Rgb {
  const grain = hashOf(Math.floor(u * 128) + Math.floor(v * 72) * 131 + Math.floor(seconds * 20) * 7919)
  const tear = box(u, v, 0, 1, fract(seconds * 0.7), fract(seconds * 0.7) + 0.045)
  return scale(SCREEN_INK.grey, 0.08 + 0.5 * grain + 0.3 * tear)
}

/** The glass itself: scanlines, and a bright line rolling slowly up it. */
function glass(v: number, seconds: number): number {
  return (0.94 + 0.06 * Math.sin(v * 180)) * (1 + 0.1 * smoothstep(0.97, 1, fract(v * 0.9 - seconds * 0.1)))
}

/**
 * A row of block words: cells across the row, some inked, with a gap down each
 * side of a cell so a run of them reads as letters rather than as a bar. `x`
 * runs past both ends on purpose, so a crawling ticker is an endless line and
 * not the same forty cells coming round.
 */
function words(x: number, cells: number, line: number): number {
  const cell = Math.floor(x * cells)
  const ink = step(0.36, hashOf((cell + line * 4096) >>> 0))
  return ink * gate(fract(x * cells), 0.1, 0.86) * (0.6 + 0.4 * hashOf((cell * 13 + line) >>> 0))
}

function box(u: number, v: number, x0: number, x1: number, y0: number, y1: number): number {
  return gate(u, x0, x1) * gate(v, y0, y1)
}

/** A soft ellipse: solid in the middle, gone at the rim. */
function blob(u: number, v: number, x: number, y: number, wide: number, tall: number): number {
  return 1 - smoothstep(0.82, 1, Math.hypot((u - x) / wide, (v - y) / tall))
}

function gate(t: number, low: number, high: number): number {
  return step(low, t) * step(t, high)
}

function step(edge: number, t: number): number {
  return t < edge ? 0 : 1
}

function smoothstep(low: number, high: number, t: number): number {
  const at = clamp01((t - low) / (high - low))
  return at * at * (3 - 2 * at)
}

function fract(t: number): number {
  return t - Math.floor(t)
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

function linear(hex: number): Rgb {
  const colour = new THREE.Color().setHex(hex, THREE.SRGBColorSpace)
  return [colour.r, colour.g, colour.b]
}

function scale(rgb: Rgb, by: number): Rgb {
  return [rgb[0] * by, rgb[1] * by, rgb[2] * by]
}

function times(one: Rgb, two: Rgb): Rgb {
  return [one[0] * two[0], one[1] * two[1], one[2] * two[2]]
}

function plus(one: Rgb, two: Rgb): Rgb {
  return [one[0] + two[0], one[1] + two[1], one[2] + two[2]]
}

function mix3(one: Rgb, two: Rgb, at: number): Rgb {
  return [
    one[0] + (two[0] - one[0]) * at,
    one[1] + (two[1] - one[1]) * at,
    one[2] + (two[2] - one[2]) * at,
  ]
}
