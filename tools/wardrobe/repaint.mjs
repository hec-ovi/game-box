import { FabricSet, luminance } from './fabrics.mjs'

/**
 * How far above its own colour a fabric may be lit, and how much deeper than
 * that its folds go. Narrow on purpose: the source sheets swing four to one
 * between a shadowed seam and a lit panel, and carrying that straight over
 * turns any warm colour into polished metal.
 */
const LIT = 1.28
const SHADOW = 1.9

/** The brightest channel a highlight may reach, short of clipping to flat white. */
const HEADROOM = 250

/** Which slice of a fabric's own range counts as its floor and its ceiling. */
const LOW = 0.08
const HIGH = 0.92

/**
 * Gives one garment new colours without losing the shading baked into it.
 *
 * Each fabric is measured across the garment first, so a repaint knows what
 * counts as shadow and what counts as highlight for that cloth in particular.
 * Every pixel then lands somewhere in a fixed band around its new colour:
 * folds, seams and ambient shadow survive, and the hue is entirely ours.
 *
 * `flatten` narrows that band towards nothing, which is how the painted-on
 * hardware goes. A buckle keeps the garment's colour and loses the shape that
 * made it read as a buckle.
 */
export class Repaint {
  #fabrics
  #recipe

  /** `recipe` maps a fabric name to `{ colour: [r,g,b], flatten: 0..1 }`. */
  constructor(family, recipe) {
    this.#fabrics = new FabricSet(family)
    this.#recipe = recipe
    const unknown = Object.keys(recipe).filter((name) => !this.#fabrics.names.includes(name))
    if (unknown.length) throw new Error(`${family} has no fabric called ${unknown.join(', ')}`)
  }

  /** The fabrics of this family the recipe does not name. */
  missing() {
    return this.#fabrics.names.filter((name) => !this.#recipe[name])
  }

  /** Whether any fabric in this recipe gives off light. */
  glows() {
    return Object.values(this.#recipe).some((rule) => rule.glow)
  }

  /**
   * Repaints `pixels` (raw RGB) wherever `mask` is set: one pass to sort the
   * pixels by fabric and learn each one's range, one to paint. A fabric with
   * `glow` also writes itself into `lit`, the sheet the material emits from,
   * which is black everywhere else.
   */
  apply(pixels, mask, lit) {
    const names = this.#fabrics.names
    const fabric = new Uint8Array(mask.size * mask.size)
    const levels = new Map(names.map((name) => [name, []]))

    for (let at = 0; at < fabric.length; at++) {
      if (!mask.at(at)) continue
      const light = luminance(pixels[at * 3], pixels[at * 3 + 1], pixels[at * 3 + 2])
      const name = this.#fabrics.classify(pixels[at * 3], pixels[at * 3 + 1], pixels[at * 3 + 2])
      fabric[at] = names.indexOf(name) + 1
      levels.get(name).push(light)
    }

    const range = new Map()
    for (const [name, list] of levels) range.set(name, spread(list))
    const band = new Map()
    const settling = new Map()
    for (const name of names) {
      const rule = this.#recipe[name]
      if (!rule) continue
      band.set(name, swing(rule))
      settling.set(name, rule.flatten ?? this.#fabrics.settle(name))
    }

    const painted = new Map()
    for (let at = 0; at < fabric.length; at++) {
      if (!fabric[at]) continue
      const name = names[fabric[at] - 1]
      const rule = this.#recipe[name]
      if (!rule) continue
      const [floor, ceiling] = range.get(name)
      const [darkest, brightest] = band.get(name)
      const light = luminance(pixels[at * 3], pixels[at * 3 + 1], pixels[at * 3 + 2])
      const place = clamp((light - floor) / (ceiling - floor), -0.25, 1.25)
      const full = darkest + place * (brightest - darkest)
      const middle = (darkest + brightest) / 2
      const shade = middle + (full - middle) * (1 - settling.get(name))
      for (let channel = 0; channel < 3; channel++) {
        const value = clamp(Math.round(rule.colour[channel] * shade), 0, 255)
        pixels[at * 3 + channel] = value
        if (rule.glow && lit) lit[at * 3 + channel] = clamp(Math.round(value * rule.glow), 0, 255)
      }
      painted.set(name, (painted.get(name) ?? 0) + 1)
    }
    return painted
  }
}

/**
 * How far one colour may be lit and shaded. A pale fabric has almost no room
 * left above it, so it is given a shallow band; anything brighter would clip
 * to flat white and read as foil rather than cotton. What a colour loses in
 * highlight it does not gain back in shadow, so light cloth stays light.
 */
function swing(rule) {
  const brightest = Math.min(LIT, HEADROOM / Math.max(...rule.colour, 1))
  return [1 - (brightest - 1) * SHADOW, brightest]
}

/** A fabric's floor and ceiling, taken off the ends of its own distribution. */
function spread(levels) {
  if (!levels.length) return [0, 1]
  const sorted = Float64Array.from(levels).sort()
  const floor = sorted[Math.floor(LOW * (sorted.length - 1))]
  const ceiling = sorted[Math.floor(HIGH * (sorted.length - 1))]
  return ceiling - floor > 0.02 ? [floor, ceiling] : [floor - 0.01, floor + 0.01]
}

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value
}
