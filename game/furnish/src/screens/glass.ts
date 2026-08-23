import { Fn, If, float, fract, hash, length, max, mix, sin, smoothstep, step, time, vec2, vec3 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { PROGRAMMES, SPOT, SWITCH, CYCLE } from './schedule.ts'
import { SCREEN_INK, SCREEN_LIGHT, STATION_CAST } from './picture.ts'

/**
 * The same picture as nodes, for the renderer.
 *
 * Line for line the twin of `picture.ts`: the same schedule, the same hash and
 * the same colours, which are imported rather than written again so a colour
 * cannot drift between the two. Change one and change the other.
 *
 * It is a `Fn` and it is called under an `If`, so a room full of furniture pays
 * nothing for it: only the fragments actually on a screen run the branch.
 */

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

const ink = (rgb: readonly number[]): Vec3 => vec3(rgb[0]!, rgb[1]!, rgb[2]!)

/** What one point of one screen is emitting, this frame. */
export const pictureNode = Fn(
  ([uv, station, phase]: [Node<'vec2'>, Float, Float]): Vec3 => {
    const u = uv.x
    const v = uv.y
    const now = time.mod(CYCLE)
    const at = now.add(phase.mul(CYCLE)).mod(CYCLE)
    const spot = at.div(SPOT).floor()
    const into = at.sub(spot.mul(SPOT))
    const line = spot.add(station.mul(1024))
    const kind = hash(line).mul(PROGRAMMES.length).floor()

    const out = vec3(0).toVar()
    If(kind.lessThan(0.5), () => {
      out.assign(news(u, v, into, line))
    })
      .ElseIf(kind.lessThan(1.5), () => {
        out.assign(market(u, v, into, line))
      })
      .ElseIf(kind.lessThan(2.5), () => {
        out.assign(advert(u, v, into, line))
      })
      .Else(() => {
        out.assign(camera(u, v, into, line))
      })

    const shown = mix(out, snow(u, v, now), float(1).sub(into.div(SWITCH)).clamp(0, 1))
    return shown.mul(cast(station)).mul(glass(v, now)).mul(SCREEN_LIGHT)
  },
) as unknown as (uv: Node<'vec2'>, station: Float, phase: Float) => Vec3

/**
 * The cast the station puts over the whole picture. A four-row table read as a
 * chain of steps: cheaper inline than a texture nothing else would sample.
 */
function cast(station: Float): Vec3 {
  let out: Vec3 = ink(STATION_CAST[0]!)
  for (let at = 1; at < STATION_CAST.length; at++) out = mix(out, ink(STATION_CAST[at]!), step(at + 1, station))
  return out
}

/** A studio: a graphic behind, somebody behind a desk, a headline under them. */
function news(u: Float, v: Float, into: Float, line: Float): Vec3 {
  const sway = sin(into.mul(1.6)).mul(0.005)
  const panel = box(u, v, 0.52, 0.95, 0.36, 0.86)
  const bars = panel.mul(step(v, hash(u.mul(9).floor().add(line.mul(32))).mul(0.42).add(0.4)))
  const shoulders = blob(u, v, sway.add(0.28), float(0.3), 0.185, 0.21)
  const head = blob(u, v, sway.add(0.28), float(0.52), 0.056, 0.074)
  const strap = box(u, v, 0.04, 0.72, 0.105, 0.19)
  const under = box(u, v, 0.04, 0.56, 0.055, 0.095)

  let rgb: Vec3 = ink(SCREEN_INK.wall).mul(v.mul(0.03).add(0.015))
  rgb = rgb.add(ink(SCREEN_INK.paper).mul(panel.mul(0.04)))
  rgb = rgb.add(ink(SCREEN_INK.amber).mul(bars.mul(0.11)))
  rgb = mix(rgb, ink(SCREEN_INK.suit).mul(0.9), shoulders)
  rgb = mix(rgb, ink(SCREEN_INK.skin).mul(0.5), head)
  rgb = mix(rgb, ink(SCREEN_INK.desk).mul(0.7), box(u, v, 0, 1, 0, 0.3))
  rgb = rgb.add(ink(SCREEN_INK.paper).mul(box(u, v, 0, 1, 0.285, 0.305).mul(0.22)))
  rgb = mix(rgb, ink(SCREEN_INK.strap).mul(0.85), strap)
  rgb = rgb.add(
    ink(SCREEN_INK.paper).mul(strap.mul(words(u.sub(0.06).div(0.62), 22, line.mul(8).add(into.div(1.6).floor()))).mul(0.8)),
  )
  rgb = rgb.add(
    ink(SCREEN_INK.paper).mul(under.mul(words(u.sub(0.06).div(0.48), 30, line.mul(5).add(into.div(2.4).floor()))).mul(0.5)),
  )
  return rgb.add(ink(SCREEN_INK.amber).mul(box(u, v, 0.86, 0.955, 0.83, 0.925).mul(0.7)))
}

/** A market board: columns that rise and fall, a headline rail, a crawling ticker. */
function market(u: Float, v: Float, into: Float, line: Float): Vec3 {
  const columns = 26
  const at = u.mul(columns).floor()
  const tall = sin(at.mul(0.7).add(into.mul(0.9)).add(line)).mul(0.5).add(0.5).mul(0.42).add(0.3)
  const stem = gate(fract(u.mul(columns)), float(0.12), float(0.88)).mul(gate(v, float(0.26), tall))
  const rail = box(u, v, 0, 1, 0.86, 1)
  const band = box(u, v, 0, 1, 0.05, 0.2)
  const way = step(0.5, hash(at.add(line.mul(512))))

  let rgb: Vec3 = ink(SCREEN_INK.night).mul(v.mul(0.04).add(0.05))
  rgb = rgb.add(mix(ink(SCREEN_INK.fall), ink(SCREEN_INK.rise), way).mul(stem.mul(0.9)))
  rgb = mix(rgb, ink(SCREEN_INK.night).mul(2.2), max(rail, band))
  rgb = rgb.add(ink(SCREEN_INK.amber).mul(rail.mul(words(u, 20, line.mul(3).add(into.div(2).floor()))).mul(0.9)))
  return rgb.add(ink(SCREEN_INK.rise).mul(band.mul(words(u.sub(into.mul(0.07)), 40, line)).mul(0.9)))
}

/** An advert: two colours cutting on a beat, a product growing out of them, a word. */
function advert(u: Float, v: Float, into: Float, line: Float): Vec3 {
  const beat = into.mul(0.8).floor()
  const through = into.mul(0.8).sub(beat)
  const one = adColour(hash(line.mul(256).add(beat)).mul(SCREEN_INK.ad.length).floor())
  const two = adColour(hash(line.mul(256).add(beat).add(7919)).mul(SCREEN_INK.ad.length).floor())
  const grow = through.mul(3).min(1).mul(0.5).add(0.5)
  const wide = grow.mul(0.2)
  const tall = grow.mul(0.3).add(0.44)
  const slab = gate(u, float(0.5).sub(wide), float(0.5).add(wide)).mul(gate(v, float(0.44), tall))
  const gloss = gate(u, float(0.5).sub(wide), float(0.5).sub(grow.mul(0.11))).mul(gate(v, float(0.44), tall))

  let rgb: Vec3 = mix(one.mul(0.09), two.mul(0.15), step(0.42, v))
  rgb = rgb.add(two.mul(slab.mul(0.7)))
  rgb = rgb.add(ink(SCREEN_INK.paper).mul(gloss.mul(0.22)))
  rgb = rgb.add(one.mul(box(u, v, 0.1, 0.9, 0.105, 0.125).mul(1.1)))
  rgb = rgb.add(
    ink(SCREEN_INK.paper).mul(box(u, v, 0.1, 0.9, 0.15, 0.3).mul(words(u.sub(0.12).div(0.76), 14, line.mul(16).add(beat))).mul(1.1)),
  )
  return rgb.add(ink(SCREEN_INK.paper).mul(max(float(0), float(1).sub(through.mul(10))).mul(0.25)))
}

/** One of the four advert colours, picked without a branch. */
function adColour(pick: Float): Vec3 {
  let out: Vec3 = ink(SCREEN_INK.ad[0]!)
  for (let at = 1; at < SCREEN_INK.ad.length; at++) out = mix(out, ink(SCREEN_INK.ad[at]!), step(at, pick))
  return out
}

/** A camera on a yard: a lit doorway, crates, somebody walking across, a clock. */
function camera(u: Float, v: Float, into: Float, line: Float): Vec3 {
  const ground = step(v, 0.52)
  const far = hash(u.add(into.mul(0.004)).mul(26).floor().add(line.mul(64))).mul(0.009).add(0.008)
  const crates = max(box(u, v, 0.1, 0.27, 0.3, 0.46), box(u, v, 0.82, 0.94, 0.31, 0.42))
  const walk = fract(hash(line.mul(77)).add(into.mul(0.075)))
  const figure = max(
    gate(u, walk.sub(0.022), walk.add(0.022)).mul(gate(v, float(0.3), float(0.48))),
    blob(u, v, walk, float(0.5), 0.021, 0.03),
  )
  const clock = box(u, v, 0.05, 0.34, 0.88, 0.95).mul(words(u.sub(0.055).div(0.28), 10, line))

  const yard = far.add(ground.mul(float(0.55).sub(v).mul(0.05).add(0.006)))
  const behind = mix(yard, float(0.012), crates)
    .add(box(u, v, 0.62, 0.75, 0.3, 0.66).mul(0.2))
    .add(box(u, v, 0.6, 0.77, 0.28, 0.31).mul(0.05))
  const lit = mix(behind, float(0.03), figure)

  const rgb = ink(SCREEN_INK.yard)
    .mul(lit)
    .add(ink(SCREEN_INK.yard).mul(clock.mul(step(0.5, into.mod(1)).mul(0.3).add(0.2))))
  return rgb.mul(step(0.5, fract(v.mul(46))).mul(0.34).add(0.66))
}

/** Between two spots: no signal. */
function snow(u: Float, v: Float, now: Float): Vec3 {
  const grain = hash(u.mul(128).floor().add(v.mul(72).floor().mul(131)).add(now.mul(20).floor().mul(7919)))
  const from = fract(now.mul(0.7))
  return ink(SCREEN_INK.grey).mul(grain.mul(0.5).add(gate(v, from, from.add(0.045)).mul(0.3)).add(0.08))
}

/** The glass itself: scanlines, and a bright line rolling slowly up it. */
function glass(v: Float, now: Float): Float {
  const roll = smoothstep(0.97, 1, fract(v.mul(0.9).sub(now.mul(0.1))))
  return sin(v.mul(180)).mul(0.06).add(0.94).mul(roll.mul(0.1).add(1))
}

/** A row of block words: see the twin. */
function words(x: Float, cells: number, line: Float): Float {
  const cell = x.mul(cells).floor()
  const lit = step(0.36, hash(cell.add(line.mul(4096))))
  return lit.mul(gate(fract(x.mul(cells)), float(0.1), float(0.86))).mul(hash(cell.mul(13).add(line)).mul(0.4).add(0.6))
}

function box(u: Float, v: Float, x0: number, x1: number, y0: number, y1: number): Float {
  return gate(u, float(x0), float(x1)).mul(gate(v, float(y0), float(y1)))
}

/** A soft ellipse: solid in the middle, gone at the rim. */
function blob(u: Float, v: Float, x: Float, y: Float, wide: number | Float, tall: number | Float): Float {
  return float(1).sub(smoothstep(0.82, 1, length(vec2(u.sub(x).div(wide), v.sub(y).div(tall)))))
}

function gate(t: Float, low: Float, high: Float): Float {
  return step(low, t).mul(step(t, high))
}
